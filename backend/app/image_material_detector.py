"""Genuine image material detector for raster drawings and photos.

The original ``hf_2d_parser`` (OWL-ViT zero-shot object detection) only looks
for architectural *objects* (``wall``/``door``/``window``) and therefore
produces generic material labels such as "Concrete C32/40" or "Double
glazing".  It frequently returns zero detections for photographs and stylised
renderings, which used to leave the BOQ empty.

This module solves that by:

1.  classifying the *material* of the image using CLIP zero-shot matching,
2.  using OpenCV colour masks to estimate the quantity of each detected
    material,
3.  mapping the result to the same BOQ contract the frontend already renders.

Only materials that CLIP actually detects above a calibrated threshold are
emitted, so the output is derived from the uploaded pixels rather than from a
fixed per-file table.
"""

from __future__ import annotations

import threading
from pathlib import Path
from typing import Any

import cv2
import numpy as np

_CLIP_MODEL = "openai/clip-vit-base-patch32"
_PPM = 100.0  # nominal pixels-per-metre used by the raster pipeline

# ---------------------------------------------------------------------------
# Material library: CLIP descriptors -> BOQ metadata + OpenCV colour ranges
# ---------------------------------------------------------------------------

_MATERIAL_LIBRARY: list[dict[str, Any]] = [
    {
        "code": "MAT-001",
        "element": "Roof",
        "clip": [
            "dark brown roofing",
            "asphalt shingle roof",
            "dark tile roof",
        ],
        "hsv": ((8, 60, 20), (28, 220, 120)),
        "description": "Dark-brown roofing",
        "unit": "m2",
        "rate": 320.0,
        "trade": "Roofing",
        "family": "Roofing",
    },
    {
        "code": "MAT-002",
        "element": "Exterior wall",
        "clip": [
            "timber wall cladding",
            "wood siding",
            "wooden facade",
        ],
        "hsv": ((10, 60, 60), (30, 220, 190)),
        "description": "Timber or wood-look cladding",
        "unit": "m2",
        "rate": 450.0,
        "trade": "Cladding",
        "family": "Timber",
    },
    {
        "code": "MAT-003",
        "element": "Masonry wall",
        "clip": [
            "brick wall",
            "red brick masonry",
            "clay brick facade",
        ],
        "hsv": ((0, 55, 80), (12, 220, 200)),
        "description": "Brick masonry",
        "unit": "m2",
        "rate": 95.0,
        "trade": "Masonry",
        "family": "Brick",
    },
    {
        "code": "MAT-004",
        "element": "Concrete wall",
        "clip": [
            "concrete wall",
            "grey concrete surface",
            "cement render wall",
        ],
        "hsv": ((0, 0, 80), (180, 45, 210)),
        "description": "Concrete or masonry finish",
        "unit": "m2",
        "rate": 280.0,
        "trade": "Masonry",
        "family": "Concrete",
    },
    {
        "code": "MAT-005",
        "element": "Stone feature",
        "clip": [
            "stone masonry",
            "natural stone wall",
            "stacked stone veneer",
        ],
        "hsv": ((0, 0, 100), (40, 60, 220)),
        "description": "Natural stone veneer",
        "unit": "m2",
        "rate": 680.0,
        "trade": "Masonry",
        "family": "Stone",
    },
    {
        "code": "MAT-006",
        "element": "Windows",
        "clip": [
            "glass window",
            "glazing",
            "window glass",
        ],
        "hsv": ((90, 10, 140), (140, 70, 255)),
        "description": "Clear glazing",
        "unit": "m2",
        "rate": 1250.0,
        "trade": "Glazing",
        "family": "Glazing",
    },
    {
        "code": "MAT-007",
        "element": "Metal framing",
        "clip": [
            "metal framing",
            "steel frame",
            "aluminium frame",
        ],
        "hsv": ((0, 0, 30), (180, 50, 120)),
        "description": "Metal framing",
        "unit": "m",
        "rate": 380.0,
        "trade": "Metalwork",
        "family": "Metal",
    },
    {
        "code": "MAT-008",
        "element": "Curtain wall",
        "clip": [
            "glass curtain wall facade",
            "curtain wall glazing",
        ],
        "hsv": ((95, 15, 130), (140, 60, 255)),
        "description": "Glass curtain wall",
        "unit": "m2",
        "rate": 1850.0,
        "trade": "Facade",
        "family": "Glazing",
    },
    {
        "code": "MAT-009",
        "element": "Fascia and trim",
        "clip": [
            "wooden trim",
            "fascia board",
            "painted wood trim",
        ],
        "hsv": ((10, 40, 80), (30, 180, 210)),
        "description": "Timber or painted-wood trim",
        "unit": "m",
        "rate": 210.0,
        "trade": "Timber",
        "family": "Timber",
    },
]

_MIN_PROB = 0.04  # absolute floor for CLIP presence
_MIN_RELATIVE = 0.28  # keep labels within 28% of the top-scoring label


def _render_rgb(path: Path) -> np.ndarray:
    """Return an RGB numpy array for an image or the first PDF page."""
    suffix = path.suffix.lower()

    if suffix == ".pdf":
        import fitz
        from PIL import Image

        doc = fitz.open(str(path))
        try:
            if doc.page_count == 0:
                raise ValueError("PDF has no pages")
            pix = doc[0].get_pixmap(dpi=150)
            image = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
            return np.array(image)
        finally:
            doc.close()

    from PIL import Image

    image = Image.open(path).convert("RGB")
    return np.array(image)


_clip = None
_clip_lock = threading.Lock()


def _load_clip() -> tuple[Any, Any]:
    """Lazy-load the cached CLIP model and processor (thread-safe).

    Assessment jobs run concurrently in the Starlette threadpool; without
    the lock two jobs could each load a full CLIP model into memory.
    """
    global _clip
    if _clip is not None:
        return _clip
    with _clip_lock:
        if _clip is None:
            from transformers import CLIPModel, CLIPProcessor

            model = CLIPModel.from_pretrained(_CLIP_MODEL)
            processor = CLIPProcessor.from_pretrained(_CLIP_MODEL)
            _clip = (model, processor)
    return _clip


def _clip_material_scores(rgb: np.ndarray) -> dict[str, float]:
    """Return CLIP presence probabilities for each material descriptor group."""
    from PIL import Image
    import torch

    model, processor = _load_clip()
    image = Image.fromarray(rgb)

    # Flatten every descriptor into one batch, remembering which material
    # group each descriptor belongs to.
    flat_labels: list[str] = []
    flat_groups: list[str] = []
    for material in _MATERIAL_LIBRARY:
        for label in material["clip"]:
            flat_labels.append(label)
            flat_groups.append(material["code"])

    inputs = processor(text=flat_labels, images=image, return_tensors="pt", padding=True)
    with torch.no_grad():
        outputs = model(**inputs)

    probs = outputs.logits_per_image[0].softmax(dim=0).tolist()

    # Max descriptor probability wins for each material group.
    grouped: dict[str, float] = {}
    for group, prob in zip(flat_groups, probs):
        grouped[group] = max(grouped.get(group, 0.0), float(prob))
    return grouped


def _colour_coverage(rgb: np.ndarray, hsv_range: tuple[tuple[int, int, int], tuple[int, int, int]]) -> float:
    """Return the fraction of the image covered by a colour range."""
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    lower, upper = hsv_range
    mask = cv2.inRange(hsv, np.array(lower, dtype=np.uint8), np.array(upper, dtype=np.uint8))
    return float(mask.sum()) / 255.0


def _estimate_quantity(
    rgb: np.ndarray,
    material: dict[str, Any],
    clip_score: float,
    total_score: float,
) -> float:
    """Estimate a material quantity from the CLIP presence score.

    Photographs and rendered drawings include large background regions, so
    pixel coverage alone is not a reliable proxy for the building envelope.
    The CLIP zero-shot score is therefore the primary signal for both
    *identity* and *relative quantity*; OpenCV colour coverage is used only as
    a small refinement when it is informative.
    """
    # Approximate the building envelope from the rendered canvas using the
    # same nominal 100 px = 1 m convention as the rest of the pipeline.
    canvas_m2 = float(rgb.shape[0] * rgb.shape[1]) / (_PPM * _PPM)
    envelope_m2 = canvas_m2 * 0.18  # building typically ~18% of a rendering

    # CLIP probability share -> base area for this material.
    share = clip_score / max(total_score, 1e-6)
    base_area_m2 = envelope_m2 * share

    # Blend with colour coverage to respect the actual drawing geometry when
    # the colour signature is present, without letting it dominate.
    colour_area_m2 = _colour_coverage(rgb, material["hsv"]) / (_PPM * _PPM)
    area_m2 = 0.65 * base_area_m2 + 0.35 * colour_area_m2

    if material["unit"] == "m":
        # Length materials are expressed as a perimeter proxy of the area.
        length_m = max(0.5, round(float(np.sqrt(max(area_m2, 0.01)) * 4.0), 2))
        return length_m
    return round(max(area_m2, 0.05), 2)


def detect_image_material_boq(file_path: str) -> list[dict[str, Any]]:
    """Detect the material breakdown for an image or raster PDF using CLIP.

    Returns a list of BOQ line-items derived from the actual uploaded pixels.
    """
    path = Path(file_path)
    rgb = _render_rgb(path)
    scores = _clip_material_scores(rgb)

    if not scores:
        return []

    top_score = max(scores.values())
    selected_scores: dict[str, float] = {}
    selected: list[dict[str, Any]] = []
    for material in _MATERIAL_LIBRARY:
        score = scores.get(material["code"], 0.0)
        if score < _MIN_PROB:
            continue
        if top_score > 0 and score < _MIN_RELATIVE * top_score:
            continue

        selected_scores[material["code"]] = score

    total_selected_score = sum(selected_scores.values())
    for material in _MATERIAL_LIBRARY:
        if material["code"] not in selected_scores:
            continue
        quantity = _estimate_quantity(
            rgb,
            material,
            selected_scores[material["code"]],
            total_selected_score,
        )
        total = round(quantity * float(material["rate"]), 2)
        selected.append(
            {
                "material_code": material["code"],
                "bim_element": material["element"],
                "description": material["description"],
                "quantity": quantity,
                "unit": material["unit"],
                "rate": material["rate"],
                "total_price": total,
                "rate_applied": material["rate"],
                "price_book_item_code": material["code"],
                "confidence": "VISUAL",
                "trade": material["trade"],
                "material_family": material["family"],
                "element_ids": [f"MATERIAL-{material['element'].upper().replace(' ', '_')}"],
            }
        )

    # Order by value so the primary material reads first.
    selected.sort(key=lambda item: item["total_price"], reverse=True)
    for i, item in enumerate(selected, start=1):
        item["item_id"] = f"BOQ-{i:03d}"

    return selected
