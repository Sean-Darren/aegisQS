"""Vector PDF parser for the AegisQS BIM pipeline.

Parses architectural PDF drawings through a dual-layer approach:

1.  **Vector layer** — extracts native PDF line/curve/rect paths via PyMuPDF
    (``page.get_drawings()``).  Works for CAD-exported PDFs that contain
    actual vector geometry for walls, doors, and windows.

2.  **Raster fallback** — triggered automatically when no vector content is
    found (the PDF is pixel-based, e.g. a rendered floor plan).  Renders the
    page at 300 DPI, then uses OpenCV contour detection for walls, connected-
    component analysis for rooms, and heuristic-based door/window placement.

Both layers produce the same ``list[BimElement]`` output that the downstream
pipeline (ReadinessEngine, QuantityCalculator, etc.) expects.

Usage::

    from vector_pdf_parser import VectorPDFParser

    parser = VectorPDFParser()
    elements = parser.parse("floor_plan.pdf")
    # list[BimElement]
"""

from __future__ import annotations

import math
from pathlib import Path
from typing import Any

import cv2
import fitz  # PyMuPDF
import numpy as np
from PIL import Image

from hf_2d_parser import (
    _CATEGORY_MOCK_DEPTH,
    _LABEL_TO_FAMILY,
    _LABEL_TO_IFC,
    _LABEL_TO_MATERIAL,
)
from models import BimElement, MaterialFamily

# ---------------------------------------------------------------------------
# Room / IfcSpace mapping — not present in hf_2d_parser (photo-only labels)
# ---------------------------------------------------------------------------

_LABEL_TO_IFC["room"] = "IfcSpace"
_LABEL_TO_MATERIAL["room"] = None
_LABEL_TO_FAMILY["room"] = MaterialFamily.OTHER
_CATEGORY_MOCK_DEPTH["IfcSpace"] = 3.00  # typical room height

# ---------------------------------------------------------------------------
# Detection constants
# ---------------------------------------------------------------------------

_VECTOR_PAGE_BORDER_MAX = 4  # ignore pages with only a border rect
_RASTER_DPI = 300
_CLOSE_KERNEL_SIZE = 11  # aggressive: fuse architectural hatch into solid blobs
_OPEN_KERNEL_SIZE = 3   # remove text / dimension-line noise
_MIN_WALL_AREA_PX = 500  # discard small text/symbol contours
_MIN_ROOM_AREA_PX = 2000  # discard small enclosed spaces
_DOOR_PER_METRE_WALL = 1.0 / 10.0  # 1 door per 10 m wall
_WINDOW_PER_METRE_WALL = 1.0 / 15.0  # 1 window per 15 m wall


# ---------------------------------------------------------------------------
# VectorPDFParser
# ---------------------------------------------------------------------------


class VectorPDFParser:
    """Parse an architectural PDF into :class:`BimElement` objects.

    Parameters
    ----------
    pixels_per_metre:
        Scale factor — PDF points per real-world metre (default 100).
    dpi:
        DPI used for raster fallback rendering (default 300).
    wall_thickness_threshold:
        Minimum PDF line *width* to classify as a wall in the vector layer
        (default 0.5 pts).
    min_wall_area_px:
        Minimum contour area (pixels) for wall detection in the raster layer.
    min_room_area_px:
        Minimum connected-component area (pixels) for room detection.
    """

    __slots__ = (
        "_ppm",
        "_dpi",
        "_wall_threshold",
        "_min_wall_area",
        "_min_room_area",
    )

    _ppm: float
    _dpi: int
    _wall_threshold: float
    _min_wall_area: int
    _min_room_area: int

    def __init__(
        self,
        pixels_per_metre: float = 100.0,
        dpi: int = _RASTER_DPI,
        wall_thickness_threshold: float = 0.5,
        min_wall_area_px: int = _MIN_WALL_AREA_PX,
        min_room_area_px: int = _MIN_ROOM_AREA_PX,
    ) -> None:
        self._ppm = pixels_per_metre
        self._dpi = dpi
        self._wall_threshold = wall_thickness_threshold
        self._min_wall_area = min_wall_area_px
        self._min_room_area = min_room_area_px

    # ------------------------------------------------------------------
    # public API
    # ------------------------------------------------------------------

    def parse(self, file_path: str) -> list[BimElement]:
        """Parse *file_path* and return a list of :class:`BimElement`.

        Only ``.pdf`` files are accepted.
        """
        path = Path(file_path)
        if path.suffix.lower() != ".pdf":
            raise ValueError(
                f"Expected a .pdf file, got {path.suffix!r}. "
                "Use HuggingFace2DParser for raster image formats."
            )

        doc = fitz.open(str(path))
        try:
            if doc.page_count == 0:
                return []

            page = doc[0]

            # ── Layer 1: native vector extraction ──
            drawings = page.get_drawings()
            elements = self._parse_vectors(drawings, page)

            if elements:
                print(
                    f"[VectorPDFParser] Vector layer: {len(elements)} "
                    f"element(s) from {len(drawings)} drawing paths"
                )
                return elements

            # ── Layer 2: raster fallback ──
            print(
                "[VectorPDFParser] No vector content found "
                f"({len(drawings)} drawing(s) — likely raster PDF). "
                "Triggering CV raster fallback …"
            )
            return self._parse_raster(page)

        finally:
            doc.close()

    # ------------------------------------------------------------------
    # Layer 1 — vector extraction
    # ------------------------------------------------------------------

    def _parse_vectors(
        self, drawings: list[dict[str, Any]], page: fitz.Page
    ) -> list[BimElement]:
        """Extract walls, doors, and windows from native PDF vector paths.

        Returns an empty list when *drawings* contains only a page border
        (≤ 4 paths), signalling that the raster fallback should take over.
        """
        if len(drawings) <= _VECTOR_PAGE_BORDER_MAX:
            return []

        wall_lines: list[dict[str, Any]] = []
        curve_items: list[dict[str, Any]] = []
        thin_lines: list[dict[str, Any]] = []

        for d in drawings:
            width = float(d.get("width") or 0.0)
            items = d.get("items", [])
            if not items:
                continue

            # ── thick line → wall candidate ──
            line_candidates = [it for it in items if it[0] == "l"]
            if width >= self._wall_threshold and line_candidates:
                wall_lines.append({
                    "width": width,
                    "lines": line_candidates,
                    "rect": d.get("rect"),
                })

            # ── curve/bezier → door candidate ──
            curves = [it for it in items if it[0] == "c"]
            if curves:
                curve_items.append({
                    "width": width,
                    "curves": curves,
                    "rect": d.get("rect"),
                })

            # ── very thin line → window candidate ──
            if 0.0 < width < 0.2 and line_candidates:
                thin_lines.append({
                    "width": width,
                    "lines": line_candidates,
                    "rect": d.get("rect"),
                })

        elements: list[BimElement] = []

        # 1. Walls from thick vector lines
        for i, w in enumerate(wall_lines):
            elements.extend(
                self._vector_lines_to_elements(w, "wall", i)
            )

        # 2. Doors from arcs/curves (simple: one door per curve group)
        for i, c in enumerate(curve_items):
            elements.append(self._vector_item_to_element(c, "door", i))

        # 3. Windows from thin lines
        for i, w in enumerate(thin_lines):
            elements.append(self._vector_item_to_element(w, "window", i))

        # 4. Rooms from text blocks inside wall boundaries
        text_dict = page.get_text("dict")
        text_blocks = [b for b in text_dict.get("blocks", []) if b.get("type") == 0]
        for i, tb in enumerate(text_blocks):
            bbox = tb.get("bbox")
            if bbox:
                elements.append(self._text_to_room(tb, bbox, i))

        return elements

    def _vector_lines_to_elements(
        self, wall_data: dict[str, Any], label: str, wall_idx: int
    ) -> list[BimElement]:
        """Convert a group of thick vector lines into wall BimElements.

        Each individual line becomes a separate wall element so downstream
        BOQ aggregation can sum their quantities.
        """
        elements: list[BimElement] = []
        lines = wall_data.get("lines", [])
        ppm = self._ppm

        for li, line in enumerate(lines):
            # line tuple: ('l', Point(x1,y1), Point(x2,y2))
            p1 = line[1]  # fitz.Point
            p2 = line[2]
            dx = abs(p2.x - p1.x)
            dy = abs(p2.y - p1.y)

            # PDF units are points (1/72 inch) → convert via ppm
            length_m = math.hypot(dx, dy) / ppm
            if length_m <= 0.0:
                continue

            ifc_cat = _LABEL_TO_IFC.get(label, "IfcBuildingElementProxy")
            mock_depth = _CATEGORY_MOCK_DEPTH.get(ifc_cat, 0.20)
            area_m2 = round(length_m * mock_depth, 4)
            volume_m3 = round(area_m2 * 1.0, 4)  # unit width

            element_id = f"VEC-{label.upper()}-{wall_idx + 1:03d}-{li + 1:03d}"

            elements.append(
                BimElement(
                    id=element_id,
                    category=ifc_cat,
                    name=f"{label.title()} {wall_idx + 1}-{li + 1}",
                    location=f"Vector@{p1.x:.0f},{p1.y:.0f}",
                    volume=volume_m3,
                    area=area_m2,
                    length=length_m,
                    material_name=_LABEL_TO_MATERIAL.get(label),
                    material_family=_LABEL_TO_FAMILY.get(label),
                    level="Level 0",
                    classification_code="Ss_25_10_30",
                    properties={
                        "source": "vector_pdf_parser",
                        "detection_layer": "vector",
                        "ai_confidence": 0.95,
                        "pdf_width_pts": wall_data.get("width"),
                        "pixels_per_metre": ppm,
                        "mock_depth_m": mock_depth,
                        "pdf_rect": (
                            [wall_data["rect"].x0, wall_data["rect"].y0,
                             wall_data["rect"].x1, wall_data["rect"].y1]
                            if wall_data.get("rect") else None
                        ),
                    },
                )
            )
        return elements

    def _vector_item_to_element(
        self, item_data: dict[str, Any], label: str, idx: int
    ) -> BimElement:
        """Convert a single vector item group (curve set or thin-line set)
        into a BimElement."""
        rect = item_data.get("rect")
        ppm = self._ppm
        w_m = 1.0
        h_m = 0.8

        if rect is not None:
            w_m = abs(rect.x1 - rect.x0) / ppm
            h_m = abs(rect.y1 - rect.y0) / ppm
            area_m2 = round(w_m * h_m, 4)
        else:
            area_m2 = 0.1  # minimal default

        ifc_cat = _LABEL_TO_IFC.get(label, "IfcBuildingElementProxy")
        mock_depth = _CATEGORY_MOCK_DEPTH.get(ifc_cat, 0.05)
        volume_m3 = round(area_m2 * mock_depth, 4)
        length_m = max(w_m, h_m)

        element_id = f"VEC-{label.upper()}-{idx + 1:03d}"

        return BimElement(
            id=element_id,
            category=ifc_cat,
            name=f"{label.title()} {idx + 1}",
            location=f"Vector@{rect.x0:.0f},{rect.y0:.0f}" if rect else f"Vector-{idx}",
            volume=volume_m3,
            area=area_m2,
            length=length_m,
            material_name=_LABEL_TO_MATERIAL.get(label),
            material_family=_LABEL_TO_FAMILY.get(label),
            level="Level 0",
            classification_code="Ss_25_10_30",
            properties={
                "source": "vector_pdf_parser",
                "detection_layer": "vector",
                "ai_confidence": 0.90,
                "pdf_width_pts": item_data.get("width"),
                "pixels_per_metre": ppm,
                "mock_depth_m": mock_depth,
                "pdf_rect": (
                    [rect.x0, rect.y0, rect.x1, rect.y1]
                    if rect else None
                ),
            },
        )

    def _text_to_room(
        self, text_block: dict[str, Any], bbox: tuple[float, ...], idx: int
    ) -> BimElement:
        """Convert a text block inside wall boundaries into an IfcSpace."""
        ppm = self._ppm
        x0, y0, x1, y1 = bbox
        w_m = abs(x1 - x0) / ppm
        h_m = abs(y1 - y0) / ppm
        area_m2 = round(w_m * h_m, 4)
        mock_depth = _CATEGORY_MOCK_DEPTH.get("IfcSpace", 3.00)
        volume_m3 = round(area_m2 * mock_depth, 4)

        # Extract text content for the room name
        lines = text_block.get("lines", [])
        room_name = ""
        for line in lines:
            for span in line.get("spans", []):
                room_name += span.get("text", "")
        room_name = room_name.strip() or f"Room {idx + 1}"

        return BimElement(
            id=f"VEC-ROOM-{idx + 1:03d}",
            category="IfcSpace",
            name=room_name,
            location=f"Text@{x0:.0f},{y0:.0f}",
            volume=volume_m3,
            area=area_m2,
            length=max(w_m, h_m),
            material_name=None,
            material_family=MaterialFamily.OTHER,
            level="Level 0",
            classification_code="Ss_25_10_30",
            properties={
                "source": "vector_pdf_parser",
                "detection_layer": "vector",
                "ai_confidence": 0.85,
                "pixels_per_metre": ppm,
                "mock_depth_m": mock_depth,
                "text_bbox": list(bbox),
            },
        )

    # ------------------------------------------------------------------
    # Layer 2 — raster fallback (OpenCV)
    # ------------------------------------------------------------------

    def _parse_raster(self, page: fitz.Page) -> list[BimElement]:
        """OpenCV-based detection for pixel-based floor plans.

        Pipeline:
            1.  Render page at ``self._dpi`` → PIL Image → numpy array.
            2.  Grayscale → Otsu binary threshold → invert.
            3.  Morphological close (11×11) to fuse hatch into solid blobs.
            4.  Morphological open (3×3) to remove text noise.
            5.  Contour detection → filter by area → walls.
            6.  Connected-component analysis on inverted image → rooms.
            7.  Mock doors/windows based on total wall length.
        """
        pix = page.get_pixmap(dpi=self._dpi)
        image = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
        img_array = np.array(image)
        img_h, img_w = img_array.shape[:2]

        # ── preprocessing ──
        gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
        _, binary = cv2.threshold(
            gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU
        )

        close_kernel = cv2.getStructuringElement(
            cv2.MORPH_RECT, (_CLOSE_KERNEL_SIZE, _CLOSE_KERNEL_SIZE)
        )
        open_kernel = cv2.getStructuringElement(
            cv2.MORPH_RECT, (_OPEN_KERNEL_SIZE, _OPEN_KERNEL_SIZE)
        )

        closed = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, close_kernel)
        cleaned = cv2.morphologyEx(closed, cv2.MORPH_OPEN, open_kernel)

        # ── wall detection (contours) ──
        contours, _ = cv2.findContours(
            cleaned, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )

        wall_elements: list[BimElement] = []
        wall_idx = 0
        for cnt in contours:
            area_px = cv2.contourArea(cnt)
            if area_px < self._min_wall_area:
                continue
            wall_idx += 1
            x, y, w, h = cv2.boundingRect(cnt)

            element = self._cv_box_to_bim_element(
                box=(x, y, x + w, y + h),
                label="wall",
                idx=wall_idx,
                img_w=img_w,
                img_h=img_h,
                contour_area_px=area_px,
            )
            wall_elements.append(element)

        # ── room detection (connected components on inverted) ──
        inverted = cv2.bitwise_not(cleaned)
        n_labels, _labels, stats, _centroids = cv2.connectedComponentsWithStats(
            inverted, connectivity=8
        )

        room_elements: list[BimElement] = []
        room_idx = 0
        for label_id in range(1, n_labels):  # skip background (label 0)
            area_px = stats[label_id, cv2.CC_STAT_AREA]
            if area_px < self._min_room_area:
                continue
            room_idx += 1
            x = stats[label_id, cv2.CC_STAT_LEFT]
            y = stats[label_id, cv2.CC_STAT_TOP]
            w = stats[label_id, cv2.CC_STAT_WIDTH]
            h = stats[label_id, cv2.CC_STAT_HEIGHT]

            element = self._cv_box_to_bim_element(
                box=(x, y, x + w, y + h),
                label="room",
                idx=room_idx,
                img_w=img_w,
                img_h=img_h,
                contour_area_px=area_px,
            )
            room_elements.append(element)

        # ── door / window mock fallback ──
        total_wall_m = sum(el.length or 0.0 for el in wall_elements)
        door_count = max(1, int(math.ceil(total_wall_m * _DOOR_PER_METRE_WALL)))
        window_count = max(1, int(math.ceil(total_wall_m * _WINDOW_PER_METRE_WALL)))

        door_elements: list[BimElement] = []
        for d_idx in range(door_count):
            door_elements.append(
                self._mock_element(
                    label="door",
                    idx=d_idx + 1,
                    img_w=img_w,
                    img_h=img_h,
                    override_area=0.12,  # ~1.2m × 0.1m door area proxy
                )
            )
        for w_idx in range(window_count):
            door_elements.append(
                self._mock_element(
                    label="window",
                    idx=w_idx + 1,
                    img_w=img_w,
                    img_h=img_h,
                    override_area=0.08,  # ~0.8m × 0.1m window area proxy
                )
            )

        elements = wall_elements + room_elements + door_elements
        print(
            f"[VectorPDFParser] Detected {len(wall_elements)} walls, "
            f"{len(room_elements)} rooms, {len(door_elements)} doors/windows "
            f"(total wall length: {total_wall_m:.1f} m, "
            f"image: {img_w}×{img_h} px)"
        )
        return elements

    # ------------------------------------------------------------------
    # CV → BimElement helpers
    # ------------------------------------------------------------------

    def _cv_box_to_bim_element(
        self,
        box: tuple[int, int, int, int],
        label: str,
        idx: int,
        img_w: int,
        img_h: int,
        contour_area_px: float = 0.0,
    ) -> BimElement:
        """Convert a CV bounding box to a :class:`BimElement`."""
        ppm = self._ppm
        x0, y0, x1, y1 = box
        box_w_px = x1 - x0
        box_h_px = y1 - y0

        # Convert pixels → metres
        # At 300 DPI: 1 inch = 300 px = 0.0254 m, so 1 px = 0.0254/300 m
        # But we also need to apply ppm scaling.
        # ppm = pixels_per_metre (user-configured, default 100).
        # At 300 DPI, 100 px ≈ 0.847 m — a reasonable architectural scale.
        width_m = box_w_px / ppm
        height_m = box_h_px / ppm
        area_m2 = round(width_m * height_m, 4)

        ifc_cat = _LABEL_TO_IFC.get(label, "IfcBuildingElementProxy")
        mock_depth = _CATEGORY_MOCK_DEPTH.get(ifc_cat, 0.20)
        volume_m3 = round(area_m2 * mock_depth, 4)

        element_id = f"CV-{label.upper()}-{idx:03d}"

        return BimElement(
            id=element_id,
            category=ifc_cat,
            name=f"{label.title()} {idx}",
            location=f"CV@{x0},{y0}",
            volume=volume_m3,
            area=area_m2,
            length=max(width_m, height_m),
            material_name=_LABEL_TO_MATERIAL.get(label),
            material_family=_LABEL_TO_FAMILY.get(label),
            level="Level 0",
            classification_code="Ss_25_10_30",
            properties={
                "source": "vector_pdf_parser",
                "detection_layer": "raster_cv",
                "ai_confidence": 0.80,
                "bounding_box_px": [x0, y0, x1, y1],
                "contour_area_px": contour_area_px,
                "image_dimensions_px": [img_w, img_h],
                "mock_depth_m": mock_depth,
                "pixels_per_metre": ppm,
                "dpi": self._dpi,
            },
        )

    def _mock_element(
        self,
        label: str,
        idx: int,
        img_w: int,
        img_h: int,
        override_area: float = 0.12,
    ) -> BimElement:
        """Create a heuristic/mock BimElement (door or window).

        Used when CV detection cannot identify individual doors/windows
        but the BOQ pipeline needs them for realistic estimates.
        """
        ifc_cat = _LABEL_TO_IFC.get(label, "IfcBuildingElementProxy")
        mock_depth = _CATEGORY_MOCK_DEPTH.get(ifc_cat, 0.05)
        area_m2 = override_area
        volume_m3 = round(area_m2 * mock_depth, 4)
        element_id = f"CV-{label.upper()}-{idx:03d}"

        return BimElement(
            id=element_id,
            category=ifc_cat,
            name=f"{label.title()} {idx}",
            location=f"Heuristic-{idx}",
            volume=volume_m3,
            area=area_m2,
            length=1.0,
            material_name=_LABEL_TO_MATERIAL.get(label),
            material_family=_LABEL_TO_FAMILY.get(label),
            level="Level 0",
            classification_code="Ss_25_10_30",
            properties={
                "source": "vector_pdf_parser",
                "detection_layer": "mock_heuristic",
                "ai_confidence": 0.50,
                "mock_depth_m": mock_depth,
                "pixels_per_metre": self._ppm,
                "dpi": self._dpi,
                "heuristic_note": (
                    "Generated via mock fallback "
                    f"(1 door/10m wall, 1 window/15m wall)"
                ),
            },
        )


# ---------------------------------------------------------------------------
# Top-level convenience helper
# ---------------------------------------------------------------------------


def detect_elements_from_pdf(pdf_path: str) -> list[BimElement]:
    """Parse a PDF and return the raw :class:`BimElement` list.

    Convenience wrapper that creates a default ``VectorPDFParser``, parses,
    and returns elements.
    """
    parser = VectorPDFParser()
    return parser.parse(pdf_path)