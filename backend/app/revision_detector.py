"""Hugging Face revision-difference detector for drawing revisions.

The frontend comparison page used to run a purely client-side pixel diff and
then label every region with a generic message ("Visual content modified in
this area").  This module replaces that with a real vision-model pass:

1.  Render the base and target revisions to RGB.
2.  Run CLIP zero-shot material classification on the full revisions to
    estimate the material profile before and after the revision.
3.  Use a lightweight pixel diff to locate changed regions.
4.  For every material changed region, run CLIP on the cropped before/after
    patches so the returned change can say *what* changed ("Dark-brown
    roofing changed to Grey metal roofing") instead of only *where*.

The output contract intentionally mirrors the TypeScript ``DrawingChange``
shape used by the React comparison page so the existing UI can render it
without a new mapper.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import cv2
import numpy as np

from app.image_material_detector import (
    _MATERIAL_LIBRARY,
    _MIN_PROB,
    _clip_material_scores,
    _render_rgb,
    detect_image_material_boq,
)

_MODEL_VERSION = "aegisqs-hf-revision-1.0"
_MAX_REGIONS = 8
_MAX_SIDE = 768
_MIN_REGION_PIXELS = 32
_MIN_DIFF_FRACTION = 0.0008
_REGION_PADDING = 0.02


def _resize_common(
    base_rgb: np.ndarray,
    target_rgb: np.ndarray,
    max_side: int = _MAX_SIDE,
) -> tuple[np.ndarray, np.ndarray]:
    """Resize both revisions to a common canvas for diffing and cropping."""
    base_h, base_w = base_rgb.shape[:2]
    target_h, target_w = target_rgb.shape[:2]

    # Preserve the base aspect ratio but never exceed max_side.
    scale = min(1.0, max_side / max(base_w, base_h))
    width = max(1, round(base_w * scale))
    height = max(1, round(base_h * scale))

    def resize_to(rgb: np.ndarray, w: int, h: int) -> np.ndarray:
        if rgb.shape[0] == h and rgb.shape[1] == w:
            return rgb
        return cv2.resize(rgb, (w, h), interpolation=cv2.INTER_AREA)

    return resize_to(base_rgb, width, height), resize_to(target_rgb, width, height)


def _changed_regions(
    base_rgb: np.ndarray,
    target_rgb: np.ndarray,
) -> list[dict[str, Any]]:
    """Return normalised bounding boxes for materially changed areas."""
    base_rgb, target_rgb = _resize_common(base_rgb, target_rgb)
    height, width = base_rgb.shape[:2]

    base_gray = cv2.cvtColor(base_rgb, cv2.COLOR_RGB2GRAY).astype(np.int16)
    target_gray = cv2.cvtColor(target_rgb, cv2.COLOR_RGB2GRAY).astype(np.int16)
    delta = cv2.absdiff(base_gray, target_gray)

    _, mask = cv2.threshold(delta, 36, 255, cv2.THRESH_BINARY)
    mask = mask.astype(np.uint8)

    # Remove tiny specks before running connected components.
    kernel = np.ones((3, 3), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)

    changed = int(np.count_nonzero(mask))
    if changed < max(_MIN_REGION_PIXELS, int(width * height * _MIN_DIFF_FRACTION)):
        return []

    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(mask, 8)
    regions: list[dict[str, Any]] = []
    for label in range(1, num_labels):
        count = int(stats[label, cv2.CC_STAT_AREA])
        if count < _MIN_REGION_PIXELS:
            continue
        x = int(stats[label, cv2.CC_STAT_LEFT])
        y = int(stats[label, cv2.CC_STAT_TOP])
        w = int(stats[label, cv2.CC_STAT_WIDTH])
        h = int(stats[label, cv2.CC_STAT_HEIGHT])

        # Luma delta sign indicates whether the region got darker (removed)
        # or brighter (added), matching the frontend convention.
        region_mask = (labels == label).astype(np.uint8)
        luma_delta = float(
            np.sum((target_gray - base_gray) * region_mask) / max(count, 1)
        )
        kind = (
            "added"
            if luma_delta > 6
            else "removed"
            if luma_delta < -6
            else "modified"
        )
        regions.append(
            {
                "x": x / width,
                "y": y / height,
                "w": w / width,
                "h": h / height,
                "count": count,
                "kind": kind,
            }
        )

    regions.sort(key=lambda region: region["count"], reverse=True)
    return regions[:_MAX_REGIONS]


def _crop_region(
    rgb: np.ndarray,
    region: dict[str, Any],
) -> np.ndarray:
    height, width = rgb.shape[:2]
    pad_x = int(width * _REGION_PADDING)
    pad_y = int(height * _REGION_PADDING)
    x = max(0, int(region["x"] * width) - pad_x)
    y = max(0, int(region["y"] * height) - pad_y)
    x2 = min(width, int((region["x"] + region["w"]) * width) + pad_x)
    y2 = min(height, int((region["y"] + region["h"]) * height) + pad_y)
    if x2 <= x or y2 <= y:
        return rgb
    return rgb[y:y2, x:x2]


def _top_material(scores: dict[str, float]) -> tuple[dict[str, Any] | None, float]:
    if not scores:
        return None, 0.0
    top_score = max(scores.values())
    code = max(scores, key=lambda item: scores[item])
    material = next((m for m in _MATERIAL_LIBRARY if m["code"] == code), None)
    if material is None:
        return None, 0.0
    if top_score < _MIN_PROB:
        return None, 0.0
    return material, top_score


def _material_for_patch(rgb: np.ndarray) -> tuple[dict[str, Any] | None, float]:
    try:
        scores = _clip_material_scores(rgb)
    except Exception:
        return None, 0.0

    top_score = max(scores.values()) if scores else 0.0
    # Suppress low-confidence patches so background noise is not reported as
    # a deliberate material change.
    if top_score < 0.08:
        return None, 0.0
    return _top_material(scores)


def _format_region_change(
    region: dict[str, Any],
    base_material: dict[str, Any] | None,
    target_material: dict[str, Any] | None,
    base_confidence: float,
    target_confidence: float,
) -> dict[str, Any]:
    kind = region["kind"]
    confidence = max(base_confidence, target_confidence, 0.65)

    if kind == "added" and target_material:
        summary = (
            f"{target_material['description']} was added or became visible"
        )
    elif kind == "removed" and base_material:
        summary = (
            f"{base_material['description']} was removed or obscured"
        )
    elif base_material and target_material:
        if base_material["code"] == target_material["code"]:
            summary = (
                f"{target_material['description']} changed in extent or geometry"
            )
        else:
            summary = (
                f"{base_material['description']} changed to "
                f"{target_material['description']}"
            )
    elif target_material:
        summary = f"{target_material['description']} changed in this area"
    elif base_material:
        summary = f"{base_material['description']} changed in this area"
    else:
        summary = "Visual content changed in this area"

    return {
        "bbox": {
            "x": round(float(region["x"]), 4),
            "y": round(float(region["y"]), 4),
            "w": round(float(region["w"]), 4),
            "h": round(float(region["h"]), 4),
        },
        "kind": kind,
        "summary": summary,
        "confidence": round(float(confidence), 4),
        "textBefore": base_material["description"] if base_material else None,
        "textAfter": target_material["description"] if target_material else None,
    }


def _global_material_changes(
    base_items: list[dict[str, Any]],
    target_items: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Fall back to full-image material-profile differences when no localised
    pixel region is strong enough."""
    base_by_code = {item.get("material_code"): item for item in base_items}
    target_by_code = {item.get("material_code"): item for item in target_items}
    changes: list[dict[str, Any]] = []
    box = {"x": 0.02, "y": 0.02, "w": 0.96, "h": 0.96}

    for code, target_item in target_by_code.items():
        if code not in base_by_code:
            changes.append(
                {
                    "bbox": box,
                    "kind": "added",
                    "summary": f"{target_item.get('description', code)} was added",
                    "confidence": 0.72,
                    "textBefore": None,
                    "textAfter": target_item.get("description"),
                }
            )

    for code, base_item in base_by_code.items():
        if code not in target_by_code:
            changes.append(
                {
                    "bbox": box,
                    "kind": "removed",
                    "summary": f"{base_item.get('description', code)} was removed",
                    "confidence": 0.72,
                    "textBefore": base_item.get("description"),
                    "textAfter": None,
                }
            )

    return changes


def estimate_revision_difference(
    base_path: str,
    target_path: str,
) -> dict[str, Any]:
    """Compare two drawing/image revisions using the Hugging Face model stack.

    Parameters
    ----------
    base_path:
        Path to the older revision (``.png``, ``.jpg``, ``.jpeg``, or ``.pdf``).
    target_path:
        Path to the newer revision in one of the same formats.

    Returns
    -------
    dict
        ``{model_version, base_materials, target_materials, changes}``.
    """
    base_rgb = _render_rgb(Path(base_path))
    target_rgb = _render_rgb(Path(target_path))

    base_materials = detect_image_material_boq(base_path)
    target_materials = detect_image_material_boq(target_path)

    changes: list[dict[str, Any]] = []
    regions = _changed_regions(base_rgb, target_rgb)

    if regions:
        # Diffing is done on the common canvas, so crop from the resized
        # canvases rather than the original-sized arrays.
        resized_base, resized_target = _resize_common(base_rgb, target_rgb)
        for region in regions:
            base_patch = _crop_region(resized_base, region)
            target_patch = _crop_region(resized_target, region)
            base_material, base_confidence = _material_for_patch(base_patch)
            target_material, target_confidence = _material_for_patch(target_patch)
            changes.append(
                _format_region_change(
                    region,
                    base_material,
                    target_material,
                    base_confidence,
                    target_confidence,
                )
            )

    if not changes:
        changes = _global_material_changes(base_materials, target_materials)

    return {
        "model_version": _MODEL_VERSION,
        "base_materials": base_materials,
        "target_materials": target_materials,
        "changes": changes,
    }
