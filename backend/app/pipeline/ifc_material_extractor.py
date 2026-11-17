"""Deep IFC material extraction — walking all four material association patterns.

IFC has four distinct ways to associate materials with building elements.
This module implements a single entry-point,
:class:`IfcMaterialExtractor`, that detects and handles every pattern:

1. **Layer set**  — ``IfcMaterialLayerSetUsage`` (layered walls, slabs).
2. **Constituent set** — ``IfcMaterialConstituentSetUsage`` (composites).
3. **Profile set** — ``IfcMaterialProfileSetUsage`` (structural profiles).
4. **Single material** — plain ``IfcMaterial``.

It also provides module-level helpers for material name normalisation and
deduplication, and extracts physical properties (density, thermal
conductivity, etc.) from IFC material property sets.

Example usage::

    import ifcopenshell
    from ifc_material_extractor import (
        IfcMaterialExtractor,
        normalize_material_name,
        deduplicate_materials,
    )

    ifc_file = ifcopenshell.open("model.ifc")
    extractor = IfcMaterialExtractor(ifc_file)

    walls = ifc_file.by_type("IfcWall")
    for wall in walls:
        info = extractor.extract_material_for_element(wall)
        print(f"  {wall.GlobalId}: {info.material_name} [{info.source}]")

    # Or batch + deduplicate
    all_info = extractor.extract_all_materials(ifc_file.by_type("IfcWall"))
    print(f"{len(all_info)} unique materials found")
"""

from __future__ import annotations

import re
from typing import Any

from ifc_models import (
    MaterialConstituent,
    MaterialInfo,
    MaterialLayer,
)

# ---------------------------------------------------------------------------
# SI prefix multipliers (for unit conversion in the extractor)
# ---------------------------------------------------------------------------

_SI_PREFIX_MULTIPLIERS: dict[str, float] = {
    "EXA": 1e18, "PETA": 1e15, "TERA": 1e12, "GIGA": 1e9,
    "MEGA": 1e6, "KILO": 1e3, "HECTO": 1e2, "DECA": 1e1, "": 1.0,
    "DECI": 1e-1, "CENTI": 1e-2, "MILLI": 1e-3, "MICRO": 1e-6, "NANO": 1e-9,
}

# Patterns to strip from material name prefixes.
_PREFIX_RE = re.compile(r"^(?:Mat_|Material[_:\s]+|M_)", re.IGNORECASE)
# Trailing version numbers: " v2", " v2.0", " 2", etc.
_VERSION_RE = re.compile(r"\s+v?\d+(?:\.\d+)?$", re.IGNORECASE)
# Separator pattern: dash with surrounding spaces, en-dash, em-dash.
_SEPARATOR_RE = re.compile(r"\s*[-–—]\s*")
# Multi-space collapse.
_MULTISPACE_RE = re.compile(r"\s{2,}")


# ---------------------------------------------------------------------------
# public helpers
# ---------------------------------------------------------------------------


def normalize_material_name(name: str) -> str:
    """Clean a raw IFC material name into a canonical display form.

    Transformations
    ---------------
    * Strip leading / trailing whitespace.
    * Remove common prefixes: ``Mat_``, ``Material:``, ``M_``, ``Material_``.
    * Replace spaced dashes (`` - ``), en-dashes, and em-dashes with a
      single space.
    * Collapse multiple consecutive spaces.
    * Strip trailing version numbers (`` v2``, `` v2.0``, `` 2.0``).
    * Trim again after prefix removal.

    Parameters
    ----------
    name:
        Raw material name from an IFC entity.

    Returns
    -------
    str
        A cleaned, display-quality name.  Case is **preserved**; callers
        should apply ``.casefold()`` when using the result as a dedup key.
    """
    if not name or not isinstance(name, str):
        return ""
    s = name.strip()
    if not s:
        return ""
    s = _PREFIX_RE.sub("", s)
    s = _SEPARATOR_RE.sub(" ", s)
    s = _MULTISPACE_RE.sub(" ", s)
    s = _VERSION_RE.sub("", s)
    return s.strip()


def deduplicate_materials(
    materials: list[MaterialInfo],
) -> list[MaterialInfo]:
    """Deduplicate a list of MaterialInfo by case-folded normalised name.

    Groups materials whose ``material_name`` (or ``composite_material_name``
    as fallback) normalise to the same key.  When multiple entries share a
    key their ``material_properties`` dicts are merged and layer/constituent
    information is kept from the first entry that provides it.
    """
    grouped: dict[str, MaterialInfo] = {}
    order: list[str] = []

    for m in materials:
        display = m.material_name or m.composite_material_name or ""
        key = normalize_material_name(display).casefold()
        if not key:
            key = f"__none__{m.element_id}"

        if key not in grouped:
            grouped[key] = MaterialInfo(
                element_id=m.element_id,
                material_name=m.material_name,
                composite_material_name=m.composite_material_name,
                original_material_name=m.original_material_name,
                material_layers=list(m.material_layers) if m.material_layers else None,
                material_constituents=list(m.material_constituents) if m.material_constituents else None,
                source=m.source,
                material_properties=dict(m.material_properties),
            )
            order.append(key)
        else:
            existing = grouped[key]
            existing.material_properties.update(m.material_properties)
            if not existing.material_layers and m.material_layers:
                existing.material_layers = list(m.material_layers)
            if not existing.material_constituents and m.material_constituents:
                existing.material_constituents = list(m.material_constituents)

    return [grouped[k] for k in order]


# ---------------------------------------------------------------------------
# IfcMaterialExtractor
# ---------------------------------------------------------------------------


class IfcMaterialExtractor:
    """Deep material extraction for any IFC building element.

    Walks ``HasAssociations`` on an element, finds the
    ``IfcRelAssociatesMaterial`` entity, and dispatches to the correct
    parser for the association type.

    Parameters
    ----------
    ifc_file:
        An open IfcOpenShell file handle.
    """

    __slots__ = ("_ifc_file", "_length_factor")

    def __init__(self, ifc_file: Any) -> None:
        self._ifc_file = ifc_file
        self._length_factor = self._derive_length_factor()

    # ------------------------------------------------------------------
    # public API
    # ------------------------------------------------------------------

    def extract_material_for_element(self, element: Any) -> MaterialInfo:
        """Extract material information for a single IFC element.

        Tries each material association pattern in priority order
        (layer → constituent → profile → single material) and returns
        the first successful extraction.
        """
        guid = str(element.GlobalId)
        assoc = self._get_material_association(element)
        if assoc is None:
            return MaterialInfo(element_id=guid, source="None")

        ifc_type = assoc.is_a()

        # 1. Layer set usage (IFC4) or direct layer set (IFC2X3)
        if ifc_type == "IfcMaterialLayerSetUsage":
            return self._dispatch_layer_set_usage(assoc, guid, element)
        if ifc_type == "IfcMaterialLayerSet":
            return self._dispatch_layer_set(assoc, guid, element)

        # 2. Constituent set usage (IFC4) or direct constituent set
        if ifc_type == "IfcMaterialConstituentSetUsage":
            return self._dispatch_constituent_set_usage(assoc, guid)
        if ifc_type == "IfcMaterialConstituentSet":
            return self._dispatch_constituent_set(assoc, guid)

        # 3. Profile set usage (IFC4) or direct profile set
        if ifc_type == "IfcMaterialProfileSetUsage":
            return self._dispatch_profile_set_usage(assoc, guid)
        if ifc_type == "IfcMaterialProfileSet":
            return self._dispatch_profile_set(assoc, guid)

        # 4. Single material or material list (IFC2X3 legacy)
        if ifc_type == "IfcMaterial":
            return self._dispatch_single_material(assoc, guid)
        if ifc_type == "IfcMaterialList":
            return self._dispatch_material_list(assoc, guid)

        # Unknown — treat as bare single material
        return self._dispatch_single_material(assoc, guid)

    def extract_all_materials(
        self, elements: list[Any],
    ) -> list[MaterialInfo]:
        """Batch-extract and deduplicate materials for every *element*."""
        raw: list[MaterialInfo] = []
        for el in elements:
            raw.append(self.extract_material_for_element(el))
        return deduplicate_materials(raw)

    # ------------------------------------------------------------------
    # association detection
    # ------------------------------------------------------------------

    def _get_material_association(self, element: Any) -> Any | None:
        """Return the RelatingMaterial from IfcRelAssociatesMaterial."""
        for assoc in element.HasAssociations or []:
            if assoc.is_a("IfcRelAssociatesMaterial"):
                return assoc.RelatingMaterial
        return None

    # ------------------------------------------------------------------
    # pattern dispatchers
    # ------------------------------------------------------------------

    def _dispatch_layer_set_usage(
        self, usage: Any, guid: str, element: Any,
    ) -> MaterialInfo:
        layer_set = usage.ForLayerSet
        direction_sense = getattr(usage, "DirectionSense", "POSITIVE")
        return self._build_layered_result(layer_set, guid, element, direction_sense)

    def _dispatch_layer_set(
        self, layer_set: Any, guid: str, element: Any,
    ) -> MaterialInfo:
        return self._build_layered_result(layer_set, guid, element, None)

    def _build_layered_result(
        self, layer_set: Any, guid: str, element: Any, direction_sense: Any,
    ) -> MaterialInfo:
        layers = self._parse_material_layer_set(layer_set, direction_sense)
        composite = self._build_composite_name(element, layers)
        primary = self._primary_material_name(layers)
        return MaterialInfo(
            element_id=guid,
            material_name=primary,
            composite_material_name=composite,
            material_layers=layers,
            source="IfcMaterialLayerSet",
        )

    def _dispatch_constituent_set_usage(self, usage: Any, guid: str) -> MaterialInfo:
        return self._dispatch_constituent_set(usage.ForConstituentSet, guid)

    def _dispatch_constituent_set(self, cset: Any, guid: str) -> MaterialInfo:
        constituents = self._parse_material_constituent_set(cset)
        primary = constituents[0].material if constituents else None
        return MaterialInfo(
            element_id=guid,
            material_name=primary,
            material_constituents=constituents,
            source="IfcMaterialConstituentSet",
        )

    def _dispatch_profile_set_usage(self, usage: Any, guid: str) -> MaterialInfo:
        return self._dispatch_profile_set(usage.ForProfileSet, guid)

    def _dispatch_profile_set(self, profile_set: Any, guid: str) -> MaterialInfo:
        info = self._parse_material_profile_set(profile_set)
        info.element_id = guid
        return info

    def _dispatch_single_material(self, material: Any, guid: str) -> MaterialInfo:
        return self._parse_single_material(material, guid)

    def _dispatch_material_list(self, mat_list: Any, guid: str) -> MaterialInfo:
        names = [str(m.Name) for m in (mat_list.Materials or []) if m.Name]
        return MaterialInfo(
            element_id=guid,
            material_name=", ".join(names) if names else None,
            source="IfcMaterial",
        )

    # ------------------------------------------------------------------
    # layer set parser
    # ------------------------------------------------------------------

    def _parse_material_layer_set(
        self, layer_set: Any, direction_sense: Any = None,
    ) -> list[MaterialLayer]:
        """Parse IfcMaterialLayerSet into a list of MaterialLayer.

        Layers sorted by natural order.  Reversed when *direction_sense*
        is ``"NEGATIVE"``.  Thicknesses are converted to metres.
        """
        raw: list[MaterialLayer] = []
        for layer in layer_set.MaterialLayers or []:
            mat = layer.Material
            layer_name = getattr(layer, "Name", None)
            mat_name = getattr(mat, "Name", None) if mat is not None else None
            layer_thickness = getattr(layer, "LayerThickness", None)
            raw.append(MaterialLayer(
                name=str(layer_name or "") if layer_name else (
                    str(mat_name) if mat_name else ""
                ),
                material_name=str(mat_name) if mat_name else None,
                thickness=(
                    float(layer_thickness) * self._length_factor
                    if layer_thickness is not None else None
                ),
                is_ventilated=bool(getattr(layer, "IsVentilated", False)),
                category=getattr(layer, "Category", None),
            ))

        if direction_sense is not None and str(direction_sense).upper() == "NEGATIVE":
            raw.reverse()
        return raw

    # ------------------------------------------------------------------
    # constituent set parser
    # ------------------------------------------------------------------

    def _parse_material_constituent_set(
        self, cset: Any,
    ) -> list[MaterialConstituent]:
        """Parse IfcMaterialConstituentSet into constituent list."""
        constituents: list[MaterialConstituent] = []
        for c in cset.MaterialConstituents or []:
            mat = c.Material
            constituents.append(MaterialConstituent(
                name=str(c.Name or ""),
                material=str(mat.Name) if mat and mat.Name else "",
                fraction=float(c.Fraction) if c.Fraction is not None else None,
            ))
        return constituents

    # ------------------------------------------------------------------
    # profile set parser
    # ------------------------------------------------------------------

    def _parse_material_profile_set(self, profile_set: Any) -> MaterialInfo:
        """Parse IfcMaterialProfileSet (steel sections etc.)."""
        profiles: list[str] = []
        material_names: list[str] = []
        for mp in profile_set.MaterialProfiles or []:
            mat = mp.Material
            if mat and mat.Name:
                material_names.append(str(mat.Name))
            # Prefer the physical section name (e.g. "UB305x165x40"),
            # falling back to the profile label and then the profile type.
            profile = getattr(mp, "Profile", None)
            name = None
            if profile is not None:
                name = getattr(profile, "ProfileName", None) or getattr(
                    profile, "ProfileType", None
                )
            if not name:
                name = mp.Name
            if name:
                profiles.append(str(name))

        primary = material_names[0] if material_names else None
        if primary and profiles:
            composite = f"{primary} ({' + '.join(profiles)})"
        elif primary:
            composite = primary
        else:
            composite = None

        return MaterialInfo(
            element_id="",
            material_name=primary or composite,
            composite_material_name=composite,
            source="IfcMaterialProfileSet",
        )

    # ------------------------------------------------------------------
    # single material parser
    # ------------------------------------------------------------------

    def _parse_single_material(self, material: Any, guid: str) -> MaterialInfo:
        """Parse a plain IfcMaterial entity."""
        raw_name = str(material.Name) if material.Name else None
        return MaterialInfo(
            element_id=guid,
            material_name=normalize_material_name(raw_name or ""),
            original_material_name=raw_name,
            source="IfcMaterial",
            material_properties=self._extract_material_properties(material),
        )

    # ------------------------------------------------------------------
    # composite name builder
    # ------------------------------------------------------------------

    def _build_composite_name(
        self, element: Any, layers: list[MaterialLayer],
    ) -> str | None:
        """Build a composite name like ``"Wall: Brick | Insulation | Block"``."""
        if not layers:
            return None
        elem_type = element.is_a().replace("Ifc", "")
        parts = [(l.name or l.material_name or "") for l in layers]
        parts = [p for p in parts if p]
        return f"{elem_type}: " + " | ".join(parts) if parts else None

    # ------------------------------------------------------------------
    # primary material selection
    # ------------------------------------------------------------------

    @staticmethod
    def _primary_material_name(layers: list[MaterialLayer]) -> str | None:
        """Return the material name of the thickest load-bearing layer."""
        load_bearing = [
            l for l in layers
            if l.category and "load" in l.category.lower()
        ]
        candidates = load_bearing or layers
        if not candidates:
            return None
        thickest = max(
            candidates,
            key=lambda l: l.thickness if l.thickness is not None else -1.0,
        )
        return thickest.material_name or thickest.name or None

    # ------------------------------------------------------------------
    # material properties
    # ------------------------------------------------------------------

    def _extract_material_properties(self, material: Any) -> dict[str, Any]:
        """Extract physical properties from material property sets.

        Supports IFC4 generic IfcMaterialProperties and IFC2X3 typed
        properties (IfcGeneralMaterialProperties, IfcThermalMaterialProperties).
        """
        props: dict[str, Any] = {}

        # IFC4: HasProperties inverse
        for mp in getattr(material, "HasProperties", []) or []:
            for p in mp.Properties or []:
                name = str(getattr(p, "Name", ""))
                value = getattr(p, "NominalValue", None)
                unwrapped = _unwrap_ifc_value(value)
                if name and unwrapped is not None:
                    props[name.lower().replace(" ", "_")] = unwrapped

        # IFC2X3 fallback: search by_type
        for mp in self._ifc_file.by_type("IfcMaterialProperties"):
            if getattr(mp, "Material", None) is not material:
                continue
            for ifc_attr, key in [
                ("MassDensity", "density"),
                ("SpecificHeatCapacity", "specific_heat_capacity"),
                ("ThermalConductivity", "thermal_conductivity"),
                ("MolecularWeight", "molecular_weight"),
                ("Porosity", "porosity"),
                ("YoungModulus", "young_modulus"),
                ("ShearModulus", "shear_modulus"),
                ("PoissonRatio", "poisson_ratio"),
                ("ThermalExpansionCoefficient", "thermal_expansion_coefficient"),
            ]:
                val = getattr(mp, ifc_attr, None)
                if val is not None:
                    props[key] = float(val)

        return props

    # ------------------------------------------------------------------
    # unit conversion
    # ------------------------------------------------------------------

    def _derive_length_factor(self) -> float:
        """Derive the length conversion factor from IFC unit assignment."""
        projects = self._ifc_file.by_type("IfcProject")
        if not projects or not projects[0].UnitsInContext:
            return 1.0
        for unit in projects[0].UnitsInContext.Units or []:
            if not unit.is_a("IfcSIUnit"):
                continue
            if "LENGTH" in str(getattr(unit, "UnitType", "")).upper():
                prefix = getattr(unit, "Prefix", "") or ""
                return _SI_PREFIX_MULTIPLIERS.get(prefix.upper(), 1.0)
        return 1.0


# ---------------------------------------------------------------------------
# module-level helpers
# ---------------------------------------------------------------------------


def _unwrap_ifc_value(value: Any) -> Any:
    """Unwrap an IfcOpenShell entity value to a Python primitive."""
    if value is None:
        return None
    wrapped = getattr(value, "wrappedValue", None)
    if wrapped is not None:
        return wrapped
    vof = getattr(value, "value_of", None)
    if callable(vof):
        try:
            return vof()
        except Exception:
            pass
    return str(value)


__all__ = [
    "IfcMaterialExtractor",
    "deduplicate_materials",
    "normalize_material_name",
]
