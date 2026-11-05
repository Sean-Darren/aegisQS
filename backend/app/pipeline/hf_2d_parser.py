"""Hugging Face 2D drawing parser for the AegisQS BIM pipeline.

Parses 2D architectural drawings (PNG, JPG, PDF*) through a zero-shot
object-detection model and translates bounding-box predictions into
:class:`BimElement` instances the downstream readiness engine can consume
without modification.

* PDF support requires ``pdf2image`` (optional dependency); without it,
  PDF paths raise :class:`ImportError` with an actionable message.

Usage::

    from hf_2d_parser import HuggingFace2DParser

    parser = HuggingFace2DParser()
    elements = parser.parse("floor_plan_v2.png")
    # elements is a list[BimElement] ready for ReadinessEngine
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from models import BimElement, MaterialFamily
from PIL import Image

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Categories the vision model searches for → IFC type + defaults
_LABEL_TO_IFC: dict[str, str] = {
    "wall":   "IfcWall",
    "door":   "IfcDoor",
    "window": "IfcWindow",
    "column": "IfcColumn",
    "beam":   "IfcBeam",
    "slab":   "IfcSlab",
    "stair":  "IfcStair",
}

_LABEL_TO_MATERIAL: dict[str, str] = {
    "wall":   "Concrete C32/40",
    "door":   "Timber C24",
    "window": "Double glazing",
    "column": "Concrete C32/40",
    "beam":   "Steel S355",
    "slab":   "Concrete C32/40",
    "stair":  "Concrete C32/40",
}

_LABEL_TO_FAMILY: dict[str, MaterialFamily] = {
    "wall":   MaterialFamily.CONCRETE,
    "door":   MaterialFamily.TIMBER,
    "window": MaterialFamily.GLAZING,
    "column": MaterialFamily.CONCRETE,
    "beam":   MaterialFamily.STEEL,
    "slab":   MaterialFamily.CONCRETE,
    "stair":  MaterialFamily.CONCRETE,
}

# Mock 3D depths per category (metres) — used because 2D drawings lack Z-axis
_CATEGORY_MOCK_DEPTH: dict[str, float] = {
    "IfcWall":   0.20,
    "IfcDoor":   0.05,
    "IfcWindow": 0.01,
    "IfcColumn": 0.30,
    "IfcBeam":   0.30,
    "IfcSlab":   0.15,
    "IfcStair":  1.00,
}

# Scale: how many image pixels represent one metre
_PIXELS_PER_METRE = 100.0

# Minimum confidence threshold for detections
_MIN_CONFIDENCE = 0.05

# Model to load from Hugging Face
_MODEL_NAME = "google/owlvit-base-patch32"

# Target labels the model searches for
_TARGET_LABELS: list[str] = [
    "wall", "door", "window", "column", "beam", "slab", "stair",
]


# ---------------------------------------------------------------------------
# HuggingFace2DParser
# ---------------------------------------------------------------------------


class HuggingFace2DParser:
    """Parse a 2D drawing into :class:`BimElement` objects.

    The parser runs a zero-shot object-detection pipeline on the image, then
    translates every detection above the confidence threshold into a
    ``BimElement`` with plausible 3D geometry derived from the 2D bounding
    box and per-category mock depths.

    Parameters
    ----------
    device:
        ``-1`` for CPU (default), ``0`` for the first GPU.
    confidence_threshold:
        Minimum detection score to keep (default ``0.05``).
    pixels_per_metre:
        Scale factor — image pixels per real-world metre (default 100).
    """

    __slots__ = (
        "_pipeline",
        "_confidence_threshold",
        "_pixels_per_metre",
        "_loaded",
        "_device",
    )

    _pipeline: Any
    _confidence_threshold: float
    _pixels_per_metre: float
    _loaded: bool
    _device: int

    def __init__(
        self,
        device: int = -1,
        confidence_threshold: float = _MIN_CONFIDENCE,
        pixels_per_metre: float = _PIXELS_PER_METRE,
    ) -> None:
        self._pipeline = None
        self._confidence_threshold = confidence_threshold
        self._pixels_per_metre = pixels_per_metre
        self._loaded = False
        self._device = device

    # ------------------------------------------------------------------
    # public API
    # ------------------------------------------------------------------

    def parse(self, file_path: str) -> list[BimElement]:
        """Parse *file_path* and return a list of :class:`BimElement`.

        Supported extensions: ``.png``, ``.jpg``, ``.jpeg``, ``.pdf``.
        PDF paths require the optional ``pdf2image`` package.
        """
        path = Path(file_path)
        suffix = path.suffix.lower()

        if suffix == ".pdf":
            image = self._pdf_to_image(str(path))
        elif suffix in (".png", ".jpg", ".jpeg"):
            image = Image.open(path).convert("RGB")
        else:
            raise ValueError(
                f"Unsupported drawing format: {suffix!r}. "
                "Expected .png, .jpg, .jpeg, or .pdf."
            )

        width, height = image.size

        # 1. Run the vision model
        detections = self._detect_elements(image)

        # 2. Translate to BimElement list
        return self._translate_to_bim_elements(detections, width, height)

    # ------------------------------------------------------------------
    # AI Vision Layer
    # ------------------------------------------------------------------

    def _detect_elements(self, image: Image.Image) -> list[dict[str, Any]]:
        """Run the zero-shot object-detection pipeline.

        Returns
        -------
        list[dict]
            ``[{label, score, box: [xmin, ymin, xmax, ymax]}, ...]``
            sorted by score descending.
        """
        self._ensure_pipeline_loaded()

        results = self._pipeline(image, candidate_labels=_TARGET_LABELS)

        detections: list[dict[str, Any]] = []
        for result in results:
            score = float(result["score"])
            if score < self._confidence_threshold:
                continue
            box = result["box"]
            # OWL-ViT returns boxes as dicts {xmin, ymin, xmax, ymax};
            # normalise to a list for downstream use.
            if isinstance(box, dict):
                box_list = [
                    float(box["xmin"]), float(box["ymin"]),
                    float(box["xmax"]), float(box["ymax"]),
                ]
            else:
                box_list = [float(v) for v in box]
            detections.append({
                "label": str(result["label"]),
                "score": score,
                "box": box_list,
            })

        # Sort by score descending
        detections.sort(key=lambda d: d["score"], reverse=True)
        return detections

    # ------------------------------------------------------------------
    # Metadata Translator Layer
    # ------------------------------------------------------------------

    def _translate_to_bim_elements(
        self,
        raw_detections: list[dict[str, Any]],
        image_width: int,
        image_height: int,
    ) -> list[BimElement]:
        """Convert raw 2D detections into structured :class:`BimElement` objects.

        Each detection is translated through these steps:

        1.  Calculate 2D area from the bounding box (pixels → m²).
        2.  Apply a per-category mock depth to derive volume (m³).
        3.  Map the AI label to an IFC category (``IfcWall`` etc.).
        4.  Assign a default material, family, and classification code.

        Parameters
        ----------
        raw_detections:
            Output of :meth:`_detect_elements`.
        image_width:
            Image width in pixels.
        image_height:
            Image height in pixels.

        Returns
        -------
        list[BimElement]
        """
        if not raw_detections:
            return []

        elements: list[BimElement] = []
        ppm = self._pixels_per_metre

        for i, det in enumerate(raw_detections):
            label = str(det["label"]).lower()
            score = float(det["score"])
            box = det["box"]  # [xmin, ymin, xmax, ymax]

            # ---- map label to IFC category ----
            ifc_category = _LABEL_TO_IFC.get(label, "IfcBuildingElementProxy")
            material = _LABEL_TO_MATERIAL.get(label, "Unknown")
            family = _LABEL_TO_FAMILY.get(label, MaterialFamily.OTHER)
            mock_depth = _CATEGORY_MOCK_DEPTH.get(ifc_category, 0.20)

            # ---- calculate 2D area (pixels → m²) ----
            box_w_px = box[2] - box[0]
            box_h_px = box[3] - box[1]
            width_m = box_w_px / ppm
            height_m = box_h_px / ppm
            area_m2 = round(width_m * height_m, 4)

            # ---- mock 3D volume (area × depth) ----
            volume_m3 = round(area_m2 * mock_depth, 4)

            # ---- build element id ----
            element_id = f"2D-{label.upper()}-{i + 1:03d}"

            elements.append(
                BimElement(
                    id=element_id,
                    category=ifc_category,
                    name=f"{label.title()} {i + 1}",
                    location=f"2D-drawing@{box[0]:.0f},{box[1]:.0f}",
                    volume=volume_m3,
                    area=area_m2,
                    length=max(width_m, height_m),
                    material_name=material,
                    material_family=family,
                    level="Level 0",
                    classification_code="Ss_25_10_30",
                    properties={
                        "source": "hf_2d_parser",
                        "ai_label": label,
                        "ai_confidence": score,
                        "bounding_box_px": box,
                        "image_dimensions_px": [image_width, image_height],
                        "mock_depth_m": mock_depth,
                        "pixels_per_metre": ppm,
                    },
                )
            )

        return elements

    # ------------------------------------------------------------------
    # internal helpers
    # ------------------------------------------------------------------

    def _ensure_pipeline_loaded(self) -> None:
        """Lazy-load the Hugging Face pipeline on first use."""
        if self._loaded:
            return
        from transformers import pipeline

        print(f"[HuggingFace2DParser] Loading model {_MODEL_NAME!r} (device=-1 / CPU) …")
        self._pipeline = pipeline(
            "zero-shot-object-detection",
            model=_MODEL_NAME,
            device=-1,
        )
        self._loaded = True
        print("[HuggingFace2DParser] Model loaded.")

    @staticmethod
    def _pdf_to_image(file_path: str) -> Image.Image:
        """Convert the first page of a PDF to a PIL Image.

        Requires ``pdf2image`` (``pip install pdf2image``).
        """
        try:
            from pdf2image import convert_from_path
        except ImportError:
            raise ImportError(
                "PDF parsing requires pdf2image. Install with: pip install pdf2image"
            ) from None

        pages = convert_from_path(file_path, dpi=150, first_page=1, last_page=1)
        if not pages:
            raise ValueError(f"No pages found in PDF: {file_path}")
        return pages[0].convert("RGB")


# ---------------------------------------------------------------------------
# Re-export the detect_elements top-level helper for standalone use
# ---------------------------------------------------------------------------

def detect_elements(image_path: str) -> list[dict[str, Any]]:
    """Run the zero-shot detection pipeline directly on *image_path*.

    This is a convenience wrapper that loads the pipeline, runs inference,
    and returns raw results without the translator layer.

    Returns
    -------
    list[dict]
        ``[{label, score, box: [xmin, ymin, xmax, ymax]}, ...]``.
    """
    parser = HuggingFace2DParser()
    img = Image.open(image_path).convert("RGB")
    return parser._detect_elements(img)