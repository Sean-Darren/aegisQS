"""Composition layer that wraps the existing deterministic BIM pipeline."""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path
from typing import Any, Callable

ProgressCallback = Callable[[str, int, str], None]

SUPPORTED_EXTENSIONS = {".ifc", ".json", ".pdf", ".png", ".jpg", ".jpeg"}

_PIPELINE_PATH_ENSURED = False


def _ensure_pipeline_imports() -> None:
    """Make sure the BIM pipeline root is on sys.path before importing from it."""
    global _PIPELINE_PATH_ENSURED
    if _PIPELINE_PATH_ENSURED:
        return
    from app.config import Settings

    Settings.load().ensure_pipeline_path()
    _PIPELINE_PATH_ENSURED = True


def _json_safe(value: Any) -> Any:
    """Recursively convert numpy/other non-JSON types to native Python types."""
    import numpy as np

    if isinstance(value, np.generic):
        return value.item()
    if isinstance(value, dict):
        return {str(k): _json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(v) for v in value]
    if isinstance(value, set):
        return [_json_safe(v) for v in value]
    if isinstance(value, Path):
        return str(value)
    if hasattr(value, "value") and isinstance(getattr(value, "value", None), str):
        # enum-ish objects
        return str(value.value)
    return value


def _emit(
    progress: ProgressCallback | None,
    stage: str,
    percent: int,
    message: str,
) -> None:
    if progress:
        progress(stage, percent, message)


def _mock_elements() -> list[dict[str, Any]]:
    """Return the deterministic demo elements when a model yields nothing."""
    from auto_assess import _MOCK_ELEMENTS

    return [dict(element) for element in _MOCK_ELEMENTS]


def _hf_elements_for_pdf(path: Path) -> list[dict[str, Any]]:
    """Run OWL-ViT zero-shot detection on a PDF when vector/CV parsing fails.

    ``HuggingFace2DParser.parse`` already accepts ``.pdf`` and renders the
    first page through ``pdf2image`` before running the vision model.
    """
    from hf_2d_parser import HuggingFace2DParser

    # Model-download, rendering or OOM failures must surface so the job
    # fails with the real error. Swallowing them here silently priced real
    # drawings from the hardcoded demo dataset.
    elements = HuggingFace2DParser().parse(str(path))
    return [el.model_dump() for el in elements]


def _parse_elements(path: Path) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    suffix = path.suffix.lower()

    if suffix == ".ifc":
        from ifc_parser import IfcParser

        parsed = IfcParser(str(path)).parse()
        elements = [el.model_dump() for el in parsed.elements]
        if elements:
            return elements, {"file_type": "IFC"}
        return _mock_elements(), {"file_type": "IFC", "fallback": "mock"}

    if suffix == ".json":
        data = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(data, dict) and "elements" in data:
            data = data["elements"]
        if not isinstance(data, list):
            data = [data]
        if data:
            return data, {"file_type": "JSON"}
        return _mock_elements(), {"file_type": "JSON", "fallback": "mock"}

    if suffix == ".pdf":
        from vector_pdf_parser import VectorPDFParser

        elements = VectorPDFParser().parse(str(path))
        element_dicts = [el.model_dump() for el in elements]
        if element_dicts:
            return element_dicts, {"file_type": "2D_PDF"}

        # First fallback: run the Hugging Face zero-shot detector on the
        # rendered page.  This recovers material metadata for drawings the
        # vector/CV layer could not interpret.
        hf_elements = _hf_elements_for_pdf(path)
        if hf_elements:
            return hf_elements, {"file_type": "2D_PDF", "fallback": "hf_2d"}

        # Last resort: keep the pipeline deterministic and never hand back an
        # empty element list to the readiness/BOQ stages.
        return _mock_elements(), {"file_type": "2D_PDF", "fallback": "mock"}

    if suffix in (".png", ".jpg", ".jpeg"):
        from hf_2d_parser import HuggingFace2DParser

        elements = HuggingFace2DParser().parse(str(path))
        element_dicts = [el.model_dump() for el in elements]
        if element_dicts:
            return element_dicts, {"file_type": "2D_DRAWING"}
        return _mock_elements(), {"file_type": "2D_DRAWING", "fallback": "mock"}

    raise ValueError(
        f"Unsupported model file type: {suffix}. "
        "Expected one of .ifc, .json, .pdf, .png, .jpg, .jpeg.",
    )


def _assess(
    elements: list[dict[str, Any]],
    specs: list[dict[str, Any]] | None,
) -> dict[str, Any]:
    from models import BimElement, MaterialSpec
    from default_material_library import MaterialLibrary
    from readiness_engine import ReadinessEngine
    from auto_assess import ZeroTouchAssessmentService

    # Architectural spaces are spatial containers, not materialised
    # construction elements. Missing material on a space should not tank
    # the readiness score the same way a missing wall material would.
    assess_elements = [
        el for el in elements
        if not (
            str(el.get("category") or "").lower() == "ifcspace"
            and not el.get("material_name")
        )
    ]
    # Fallback to the full set in the unlikely case everything was filtered.
    bim_elements = [BimElement(**element) for element in (assess_elements or elements)]
    material_specs = (
        [MaterialSpec(**spec) for spec in specs]
        if specs
        else MaterialLibrary().get_all_specs()
    )
    report = ReadinessEngine(bim_elements, material_specs).run()
    report_dict = ZeroTouchAssessmentService._serialize_report(report)
    report_dict["element_count"] = len(bim_elements)
    report_dict["spec_count"] = len(material_specs)
    return report_dict


def _quantities(elements: list[dict[str, Any]]) -> dict[str, Any]:
    from quantity_calculator import QuantityCalculator

    return QuantityCalculator.calculate_quantities(elements)


# Friendly labels and preferred unit/quantity field for common IFC categories.
_CATEGORY_DESCRIPTIONS: dict[str, tuple[str, str, str]] = {
    "IfcWall": ("wall", "m3", "volume"),
    "IfcWallStandardCase": ("wall", "m3", "volume"),
    "IfcCurtainWall": ("curtain wall", "m2", "area"),
    "IfcColumn": ("column", "m3", "volume"),
    "IfcBeam": ("beam", "m3", "volume"),
    "IfcSlab": ("slab", "m2", "area"),
    "IfcRoof": ("roof", "m2", "area"),
    "IfcDoor": ("door", "count", "count"),
    "IfcWindow": ("window", "count", "count"),
    "IfcPipeSegment": ("pipe", "m", "length"),
    "IfcDuctSegment": ("duct", "m", "length"),
    "IfcSpace": ("space", "m2", "area"),
    "IfcFooting": ("footing", "m3", "volume"),
    "IfcStair": ("stair", "count", "count"),
    "IfcRailing": ("railing", "m", "length"),
}

_MATERIAL_PRICE_HINTS: dict[str, tuple[str, float, str]] = {
    "concrete": ("Concrete", 150.0, "m3"),
    "steel": ("Steel", 3.5, "kg"),
    "timber": ("Timber", 420.0, "m3"),
    "brick": ("Masonry", 95.0, "m2"),
    "masonry": ("Masonry", 95.0, "m2"),
    "glass": ("Glazing", 320.0, "m2"),
    "glazing": ("Glazing", 320.0, "m2"),
    "aluminium": ("Aluminium", 45.0, "kg"),
    "aluminum": ("Aluminium", 45.0, "kg"),
    "copper": ("Copper", 28.0, "kg"),
    "plaster": ("Plaster", 18.0, "m2"),
    "render": ("Render", 22.0, "m2"),
    "insulation": ("Insulation", 12.0, "m2"),
    "membrane": ("Membrane", 16.0, "m2"),
    "asphalt": ("Asphalt", 26.0, "m2"),
    "gypsum": ("Gypsum", 14.0, "m2"),
    "block": ("Blockwork", 60.0, "m2"),
    "stone": ("Stone", 210.0, "m2"),
}


def _friendly_category(category: str) -> str:
    return _CATEGORY_DESCRIPTIONS.get(category, (category, "count", "count"))[0]


def _unit_and_field(category: str) -> tuple[str, str]:
    _, unit, field = _CATEGORY_DESCRIPTIONS.get(
        category,
        (category, "count", "count"),
    )
    return unit, field


def _price_hint_for_material(material_name: str | None) -> tuple[str, float, str] | None:
    if not material_name:
        return None
    mat = material_name.lower()
    for keyword, hint in _MATERIAL_PRICE_HINTS.items():
        if keyword in mat:
            return hint
    return None


def _is_house_pdf(elements: list[dict[str, Any]], metadata: dict[str, Any]) -> bool:
    """Return True when this looks like the raster house-drawing PDF.

    The current vector_pdf_parser CV fallback produces elements with the
    ``source`` property set to ``vector_pdf_parser`` and a ``raster_cv``
    detection layer. For those drawings, the generic line-item mapper is too
    coarse to represent the actual material breakdown of a house.
    """
    if str(metadata.get("file_type") or "").upper() in ("PDF", "2D_PDF"):
        for el in elements:
            props = el.get("properties") if isinstance(el, dict) else {}
            if isinstance(props, dict):
                if (
                    props.get("source") == "vector_pdf_parser"
                    and props.get("detection_layer") == "raster_cv"
                ):
                    return True
    return False


def _boq(elements: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Generate BOQ line-items from the parsed elements themselves.

    This replaces the original template-only mapper so descriptions and
    quantities reflect the uploaded model instead of a fixed three-item
    template. Elements are grouped by category + material, and priced
    using material keyword hints.
    """
    grouped: dict[tuple[str, str], dict[str, Any]] = {}

    for el in elements:
        if not isinstance(el, dict):
            continue
        category = str(el.get("category") or "IfcElement")
        material = str(el.get("material_name") or "Unspecified")
        unit, field = _unit_and_field(category)

        if field == "count":
            qty = 1.0
        else:
            qty = float(el.get(field) or 0.0)

        key = (category, material)
        if key not in grouped:
            grouped[key] = {
                "category": category,
                "material_name": material,
                "unit": unit,
                "quantity": 0.0,
                "element_ids": [],
            }
        grouped[key]["quantity"] += qty
        grouped[key]["element_ids"].append(str(el.get("id") or ""))

    boq_items: list[dict[str, Any]] = []
    for i, (_, group) in enumerate(sorted(grouped.items(), key=lambda kv: kv[0][0])):
        if group["quantity"] <= 0 or not group["element_ids"]:
            continue
        friendly = _friendly_category(group["category"])
        material = group["material_name"]
        description = f"{material} {friendly}" if material != "Unspecified" else f"{friendly}"

        hint = _price_hint_for_material(group["material_name"])
        rate = hint[1] if hint else 0.0
        trade = hint[0] if hint else "Unclassified"
        total = round(group["quantity"] * rate, 2)

        boq_items.append(
            {
                "item_id": f"BOQ-{i + 1:03d}",
                "description": description,
                "quantity": round(group["quantity"], 2),
                "unit": group["unit"],
                "rate": rate,
                "total_price": total,
                "element_ids": group["element_ids"],
                "rate_applied": rate,
                "price_book_item_code": hint[0] if hint else "",
                "confidence": "SEARCH" if hint else "NO_MATCH",
                "trade": trade,
                "material_family": hint[0] if hint else "",
            }
        )

    return boq_items


def _guarantee_boq(
    boq_items: list[dict[str, Any]],
    elements: list[dict[str, Any]],
    metadata: dict[str, Any],
) -> list[dict[str, Any]]:
    """Ensure a non-empty BOQ is always returned to the UI.

    Every upstream path (house detector, generic mapper) can legitimately
    produce ``[]`` when a model has no measurable elements.  Rather than
    rendering "No BOQ items generated", emit a deterministic placeholder
    line-item that still describes the analysed model.
    """
    if boq_items:
        return boq_items

    file_type = str(metadata.get("file_type") or "MODEL").upper()
    element_ids = [str(el.get("id") or "model") for el in elements] or ["model"]
    return [
        {
            "item_id": "BOQ-001",
            "material_code": "MAT-001",
            "bim_element": "Unclassified model",
            "description": f"{file_type} model assessment",
            "quantity": 1.0,
            "unit": "No.",
            "rate": 0.0,
            "total_price": 0.0,
            "element_ids": element_ids,
            "rate_applied": 0.0,
            "price_book_item_code": "MAT-001",
            "confidence": "NO_MATCH",
            "trade": "Unclassified",
            "material_family": "Unspecified",
        }
    ]


def _price(boq_items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Pricing is already applied during generation; keep for compatibility."""
    return boq_items


def run_assessment(
    job_id: str,
    file_path: str,
    specs: list[dict[str, Any]] | None = None,
    progress: ProgressCallback | None = None,
    mock_mode: bool = False,
) -> dict[str, Any]:
    """Run the full BIM assessment and return a JSON-safe result dict."""
    path = Path(file_path)
    _ensure_pipeline_imports()

    if mock_mode:
        from auto_assess import _MOCK_ELEMENTS, _MOCK_SPECS

        _emit(progress, "validating", 5, "Validating model file (mock)")
        time.sleep(0.1)
        _emit(progress, "parsing", 20, "Using deterministic mock model")
        elements: list[dict[str, Any]] = [dict(element) for element in _MOCK_ELEMENTS]
        resolved_specs = list(_MOCK_SPECS)
        metadata: dict[str, Any] = {"file_type": "MOCK"}
    else:
        _emit(progress, "validating", 5, "Validating model file")
        if path.suffix.lower() not in SUPPORTED_EXTENSIONS:
            raise ValueError(
                f"Unsupported model file type: {path.suffix}. "
                "Expected one of .ifc, .json, .pdf, .png, .jpg, .jpeg.",
            )
        _emit(progress, "parsing", 15, "Parsing BIM model")
        elements, metadata = _parse_elements(path)
        resolved_specs = specs or []

    house_boq: list[dict[str, Any]] | None = None
    image_boq: list[dict[str, Any]] | None = None
    if not mock_mode:
        from app.material_detector import detect_house_material_boq
        from app.image_material_detector import detect_image_material_boq

        house_boq = (
            detect_house_material_boq(str(path))
            if _is_house_pdf(elements, metadata)
            else None
        )
        image_boq = (
            detect_image_material_boq(str(path))
            if str(metadata.get("file_type") or "").upper() == "2D_DRAWING"
            else None
        )

    _emit(progress, "readiness", 45, "Running readiness assessment")
    report = _assess(elements, resolved_specs)

    _emit(progress, "quantities", 60, "Aggregating quantities")
    quantities = _quantities(elements)

    _emit(progress, "boq", 75, "Generating bill of quantities")
    boq_items = (
        house_boq
        if house_boq is not None
        else image_boq
        if image_boq is not None
        else _boq(elements)
    )
    boq_items = _guarantee_boq(boq_items, elements, metadata)

    _emit(progress, "pricing", 90, "Applying unit rates")
    priced_items = _price(boq_items)

    _emit(progress, "completed", 100, "Assessment complete")

    return _json_safe(
        {
            "report": report,
            "elements": elements,
            "quantities": quantities,
            "boq": priced_items,
            "metadata": metadata,
        },
    )
