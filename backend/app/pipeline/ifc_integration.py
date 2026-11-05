"""IFC integration helpers for the AegisQS BIM pipeline.

This module is the thin convenience layer that turns the standalone IFC
parser into a drop-in workflow:

* :func:`parse_ifc_to_assessment` — full zero-touch readiness assessment.
* :func:`extract_material_schedule_from_ifc` — just the material schedule.
* :func:`classify_ifc_materials` — material family classification only.

The functions are deliberately small and deterministic.  Each one accepts a
path to a ``.ifc`` file and returns JSON-friendly or plain Python objects.
If IfcOpenShell is not installed, the ``.ifc`` functions raise ``ImportError``
only when they actually attempt to parse IFC; importing this module remains
safe for JSON-only projects.

Example usage::

    from ifc_integration import (
        classify_ifc_materials,
        extract_material_schedule_from_ifc,
        parse_ifc_to_assessment,
    )

    report = parse_ifc_to_assessment("model.ifc")
    print(report["gate_state"], report["metadata"]["schema_version"])

    schedule = extract_material_schedule_from_ifc("model.ifc")
    for row in schedule:
        print(row["material_name"], row["total_quantity"], row["unit"])

    classifications = classify_ifc_materials("model.ifc")
    for element_id, result in classifications.items():
        print(element_id, result.original_name, result.family.value)
"""

from __future__ import annotations

from typing import Any

from assessment.material_classifier import ClassificationResult, MaterialClassifier
from auto_assess import ZeroTouchAssessmentService
from default_material_library import MaterialLibrary
from ifc_parser import IfcParser
from material_mapper import MaterialMapper
from material_schedule import MaterialScheduleGenerator
from models import BimElement, MaterialSpec


def _resolve_specs(
    specs: list[MaterialSpec | dict[str, Any]] | None,
) -> list[MaterialSpec]:
    """Return material specs, falling back to the built-in default library."""
    if not specs:
        return MaterialLibrary().get_all_specs()

    return [
        spec if isinstance(spec, MaterialSpec) else MaterialSpec(**spec)
        for spec in specs
    ]


def _elements_to_dicts(elements: list[BimElement]) -> list[dict[str, Any]]:
    """Convert Pydantic :class:`BimElement` objects to mutable JSON-style dicts."""
    return [element.model_dump() for element in elements]


def parse_ifc_to_assessment(
    file_path: str,
    specs: list[MaterialSpec | dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Run a zero-touch assessment directly from an IFC file.

    Parameters
    ----------
    file_path:
        Path to a ``.ifc`` file.
    specs:
        Optional project material specifications.  When omitted or empty,
        the built-in default material library is used automatically.

    Returns
    -------
    dict
        The same JSON-safe assessment report returned by
        :meth:`ZeroTouchAssessmentService.assess_model`, with IFC metadata,
        schema version, parse warnings, and parse errors attached under
        ``metadata``.
    """
    return ZeroTouchAssessmentService.assess_model(
        file_path=file_path,
        specs=specs,
    )


def extract_material_schedule_from_ifc(
    file_path: str,
    specs: list[MaterialSpec | dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    """Extract a consolidated material schedule from an IFC file.

    The function parses the IFC model, maps materials to specifications using
    the default library when no custom specs are supplied, and returns the
    default per-spec material schedule.  It deliberately skips the full
    readiness assessment and only performs the mapping required for the
    schedule.

    Parameters
    ----------
    file_path:
        Path to a ``.ifc`` file.
    specs:
        Optional project material specifications.  When omitted or empty,
        the built-in default material library is used.

    Returns
    -------
    list[dict]
        Schedule rows sorted by total quantity descending.  Each row contains
        ``material_name``, ``material_family``, ``total_quantity``, ``unit``,
        ``element_count``, and ``element_types``.
    """
    parser = IfcParser(file_path)
    parse_result = parser.parse()

    resolved_specs = _resolve_specs(specs)
    mapper = MaterialMapper(resolved_specs)
    spec_lookup = {spec.id: spec for spec in resolved_specs}

    material_mappings: dict[str, MaterialSpec] = {}
    for element in parse_result.elements:
        spec_id, confidence = mapper.map_element(element)
        if confidence in {"EXACT", "FUZZY"} and spec_id in spec_lookup:
            material_mappings[element.id] = spec_lookup[spec_id]

    element_dicts = _elements_to_dicts(parse_result.elements)
    schedule = MaterialScheduleGenerator.generate_schedule(
        element_dicts,
        material_mappings,
        group_by="spec_id",
    )
    if not isinstance(schedule, list):
        # ``group_by="spec_id"`` is guaranteed to return a list; this guard
        # keeps the type checker and future refactors honest.
        raise RuntimeError("Unexpected material schedule response type")
    return schedule


def classify_ifc_materials(
    file_path: str,
) -> dict[str, ClassificationResult]:
    """Extract and classify every element material in an IFC file.

    The returned dictionary is keyed by IFC ``GlobalId`` so each element can
    be traced back to its classification.  Elements without a material name
    are omitted.

    Parameters
    ----------
    file_path:
        Path to a ``.ifc`` file.

    Returns
    -------
    dict[str, ClassificationResult]
        Mapping from IFC element GlobalId to its material classification.
    """
    parser = IfcParser(file_path)
    parse_result = parser.parse()
    classifier = MaterialClassifier()

    classified: dict[str, ClassificationResult] = {}
    for element in parse_result.elements:
        if not element.material_name:
            continue
        classified[element.id] = classifier.classify(element.material_name)

    return classified


__all__ = [
    "classify_ifc_materials",
    "extract_material_schedule_from_ifc",
    "parse_ifc_to_assessment",
]
