"""Dataclasses for IFC parsing results.

These models represent the raw output of the IFC parser before any
downstream enrichment (material classification, readiness checks, etc.).

All models are plain :mod:`dataclasses` with sensible defaults so that a
partial or degraded parse can still return a complete, usable object graph.

Example usage::

    from ifc_models import IfcMetadata, ParseResult

    metadata = IfcMetadata(
        project_name="Tower A",
        schema_version="IFC4",
        units={"length": "m", "area": "m²", "volume": "m³"},
    )
    result = ParseResult(metadata=metadata)
    print(result.metadata.project_name)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


# ---------------------------------------------------------------------------
# IFC Metadata
# ---------------------------------------------------------------------------


@dataclass
class IfcMetadata:
    """Metadata extracted from the IFC file header and project entity.

    Attributes
    ----------
    project_name:
        ``IfcProject.Name``, or ``"Unnamed"`` when absent.
    schema_version:
        One of ``"IFC2X3"``, ``"IFC4"``, ``"IFC4X3"``, or ``"Unknown"``.
    author:
        Author name from ``IfcOwnerHistory``, if present.
    organization:
        Originating organisation or application, if present.
    creation_date:
        File creation timestamp parsed from the IFC header, if available.
    units:
        Mapping of unit type → symbol, e.g.
        ``{"length": "m", "area": "m²", "volume": "m³"}``.
    """

    project_name: str = "Unnamed"
    schema_version: str = "Unknown"
    author: str | None = None
    organization: str | None = None
    creation_date: datetime | None = None
    units: dict[str, str] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Material layer / constituent
# ---------------------------------------------------------------------------


@dataclass
class MaterialLayer:
    """A single layer within an ``IfcMaterialLayerSet``.

    Attributes
    ----------
    name:
        The layer name (e.g. ``"Core"``, ``"Insulation"``).
    material_name:
        The name of the referenced ``IfcMaterial``, when available.
    thickness:
        Layer thickness in the file's native unit (from ``LayerThickness``),
        or ``None`` when unspecified.
    is_ventilated:
        Whether the layer is ventilated (``IsVentilated``).
    category:
        Optional category string from the layer (e.g. ``"Load Bearing"``,
        ``"Insulation"``).
    """

    name: str = ""
    material_name: str | None = None
    thickness: float | None = None
    is_ventilated: bool = False
    category: str | None = None


@dataclass
class MaterialConstituent:
    """A single constituent within an ``IfcMaterialConstituentSet``.

    Attributes
    ----------
    name:
        Constituent name.
    material:
        Name of the referenced ``IfcMaterial`` (empty when absent).
    fraction:
        Fraction of the total (``0.0`` to ``1.0``), or ``None`` when
        unspecified.
    """

    name: str = ""
    material: str = ""
    fraction: float | None = None


@dataclass
class MaterialInfo:
    """Raw material information for a single element, before classification.

    Attributes
    ----------
    element_id:
        ``GlobalId`` of the owning element.
    material_name:
        Direct material name from ``IfcMaterial``, or ``None``.
    material_layers:
        Layers when the element has an ``IfcMaterialLayerSet``.
    material_constituents:
        Constituents when the element has an ``IfcMaterialConstituentSet``.
    source:
        How the material was associated:
        ``"IfcMaterial"`` | ``"IfcMaterialLayerSet"`` |
        ``"IfcMaterialConstituentSet"`` |
        ``"IfcMaterialProfileSet"`` | ``"None"``.
    material_properties:
        Extracted physical properties (density, thermal conductivity, etc.).
        Empty dict when none are available.
    composite_material_name:
        For layered elements, a human-readable composite name such as
        ``"Wall: Brick Outer | Insulation | Block Inner"``.
        ``None`` for non-layered elements.
    original_material_name:
        The raw, unnormalised material name as it appears in the IFC file,
        preserved before any cleaning or normalisation.
    """

    element_id: str = ""
    material_name: str | None = None
    material_layers: list[MaterialLayer] | None = None
    material_constituents: list[MaterialConstituent] | None = None
    source: str = "None"
    material_properties: dict[str, Any] = field(default_factory=dict)
    composite_material_name: str | None = None
    original_material_name: str | None = None


# ---------------------------------------------------------------------------
# Parse result
# ---------------------------------------------------------------------------


@dataclass
class ParseResult:
    """Complete result of parsing an IFC file.

    Attributes
    ----------
    elements:
        All physical building elements extracted as :class:`BimElement`
        objects.
    materials:
        Raw material information for every element that has material data.
    metadata:
        Project-level metadata.
    warnings:
        Non-critical issues encountered during parsing (e.g. missing optional
        data, defaulted values).
    errors:
        Critical issues encountered (e.g. unparseable geometry, corrupt file).
    """

    elements: list = field(default_factory=list)
    materials: list[MaterialInfo] = field(default_factory=list)
    metadata: IfcMetadata = field(default_factory=IfcMetadata)
    warnings: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


__all__ = [
    "IfcMetadata",
    "MaterialConstituent",
    "MaterialInfo",
    "MaterialLayer",
    "ParseResult",
]
