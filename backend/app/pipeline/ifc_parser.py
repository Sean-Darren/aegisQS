"""IFC file parser — extract BIM elements, materials, and metadata.

Uses **IfcOpenShell** to parse ``.ifc`` files (IFC2X3 / IFC4 / IFC4X3) and
returns a :class:`ParseResult` containing :class:`BimElement` instances,
raw material information, and project metadata.

Example usage::

    from ifc_parser import IfcParser

    parser = IfcParser("model.ifc")
    result = parser.parse()

    print(f"Parsed {len(result.elements)} elements")
    print(f"Schema: {result.metadata.schema_version}")
    print(f"Warnings: {len(result.warnings)}")
    print(f"Errors: {len(result.errors)}")

    for elem in result.elements[:3]:
        print(f"  {elem.id}: {elem.category} '{elem.name}' "
              f"vol={elem.volume} m³ level={elem.level}")
"""

from __future__ import annotations

from collections.abc import Iterator
from datetime import datetime
from pathlib import Path
from typing import Any

from core.models_pydantic import BimElement

from ifc_models import (
    IfcMetadata,
    MaterialInfo,
    ParseResult,
)
from ifc_material_extractor import (
    IfcMaterialExtractor,
    deduplicate_materials,
)


# ---------------------------------------------------------------------------
# Category mapping — IFC class → simplified category
# ---------------------------------------------------------------------------

IFC_CATEGORY_MAP: dict[str, str] = {
    "IfcWall": "IfcWall",
    "IfcWallStandardCase": "IfcWall",
    "IfcSlab": "IfcSlab",
    "IfcSlabStandardCase": "IfcSlab",
    "IfcSlabElementedCase": "IfcSlab",
    "IfcBeam": "IfcBeam",
    "IfcBeamStandardCase": "IfcBeam",
    "IfcColumn": "IfcColumn",
    "IfcColumnStandardCase": "IfcColumn",
    "IfcDoor": "IfcDoor",
    "IfcDoorStandardCase": "IfcDoor",
    "IfcWindow": "IfcWindow",
    "IfcWindowStandardCase": "IfcWindow",
    "IfcRoof": "IfcRoof",
    "IfcStair": "IfcStair",
    "IfcStairFlight": "IfcStair",
    "IfcRailing": "IfcRailing",
    "IfcPlate": "IfcPlate",
    "IfcPlateStandardCase": "IfcPlate",
    "IfcMember": "IfcMember",
    "IfcMemberStandardCase": "IfcMember",
    "IfcFooting": "IfcFooting",
    "IfcPile": "IfcPile",
    "IfcCovering": "IfcCovering",
    "IfcCurtainWall": "IfcCurtainWall",
    "IfcBuildingElementProxy": "IfcBuildingElementProxy",
}

# IFC class names that represent physical building elements.
_PHYSICAL_ELEMENT_CLASSES: tuple[str, ...] = tuple(IFC_CATEGORY_MAP.keys())

# Standard quantity names — Net is preferred over Gross.
_QUANTITY_NAMES: dict[str, list[str]] = {
    "volume": ["NetVolume", "GrossVolume", "Volume"],
    "area": [
        "NetSideArea",
        "NetFootprintArea",
        "NetArea",
        "GrossSideArea",
        "GrossFootprintArea",
        "GrossArea",
        "Area",
    ],
    "length": ["NetLength", "GrossLength", "Length"],
}

# SI unit prefix multipliers (prefix name → numeric factor).
_SI_PREFIX_MULTIPLIERS: dict[str, float] = {
    "EXA": 1e18,
    "PETA": 1e15,
    "TERA": 1e12,
    "GIGA": 1e9,
    "MEGA": 1e6,
    "KILO": 1e3,
    "HECTO": 1e2,
    "DECA": 1e1,
    "": 1.0,
    "DECI": 1e-1,
    "CENTI": 1e-2,
    "MILLI": 1e-3,
    "MICRO": 1e-6,
    "NANO": 1e-9,
}

# Files larger than this are treated as "large" and iterated lazily.
_LAZY_LOAD_THRESHOLD_BYTES = 10 * 1024 * 1024  # 10 MB


# ---------------------------------------------------------------------------
# IfcParser
# ---------------------------------------------------------------------------


class IfcParser:
    """Parse an IFC file and extract elements, materials, and metadata.

    The parser is tolerant by design: a missing or corrupt file is reported
    through :attr:`IfcParser.warnings` / :attr:`IfcParser.errors` rather than
    raising, so downstream code always receives a :class:`ParseResult`.

    Parameters
    ----------
    file_path:
        Path to a ``.ifc`` (or ``.ifcxml`` / ``.ifczip``) file.

    Raises
    ------
    FileNotFoundError
        If the file does not exist.
    ValueError
        If the file does not have a recognised IFC extension.
    ImportError
        If IfcOpenShell is not installed.
    """

    # ------------------------------------------------------------------
    # construction
    # ------------------------------------------------------------------

    def __init__(self, file_path: str) -> None:
        self._file_path = Path(file_path)
        self._warnings: list[str] = []
        self._errors: list[str] = []
        self._recorded_warnings: set[str] = set()
        self._material_extractor: IfcMaterialExtractor | None = None
        self._extracted_materials: list[MaterialInfo] = []
        self._ifc_file: Any = None
        self._schema_version = "Unknown"

        # Unit conversion factors (IFC units → metres / m² / m³).
        self._length_factor: float = 1.0
        self._area_factor: float = 1.0
        self._volume_factor: float = 1.0

        # --- validation (hard failures) ---
        if not self._file_path.exists():
            raise FileNotFoundError(f"IFC file not found: {file_path}")

        suffix = self._file_path.suffix.lower()
        if suffix not in (".ifc", ".ifcxml", ".ifczip"):
            raise ValueError(
                f"Expected an .ifc / .ifcXML / .ifcZIP file, got: {suffix}"
            )

        try:
            import ifcopenshell  # type: ignore[import-untyped]
        except ImportError:
            raise ImportError(
                "IfcOpenShell is required for IFC parsing. "
                "Install it with: pip install ifcopenshell"
            )

        self._ifcopenshell = ifcopenshell

        # --- open the file (soft failure: keep a usable partial parser) ---
        try:
            self._ifc_file = ifcopenshell.open(str(self._file_path))
            self._schema_version = str(self._ifc_file.schema).upper()
        except Exception as exc:
            self._errors.append(
                f"Failed to open IFC file '{self._file_path}': {exc}"
            )
        else:
            self._material_extractor = IfcMaterialExtractor(self._ifc_file)

    # ------------------------------------------------------------------
    # public API
    # ------------------------------------------------------------------

    def parse(self) -> ParseResult:
        """Run every extraction step and return a :class:`ParseResult`.

        Returns
        -------
        ParseResult
            Elements, raw materials, metadata, and any warnings/errors.
            A corrupt or unreadable file returns an empty result with the
            failure recorded in ``errors``.
        """
        metadata = self.extract_metadata()

        if self._ifc_file is not None:
            self._compute_unit_factors(metadata)

        elements = self.extract_elements()
        materials = deduplicate_materials(self._extracted_materials)

        return ParseResult(
            elements=elements,
            materials=materials,
            metadata=metadata,
            warnings=list(self._warnings),
            errors=list(self._errors),
        )

    def extract_elements(self) -> list[BimElement]:
        """Extract all physical building elements from the IFC file.

        Elements are pulled one physical class at a time and de-duplicated by
        GlobalId.  Extraction failures on individual elements are recorded in
        ``errors`` but never abort the whole parse.

        Returns
        -------
        list[BimElement]
            Every successfully extracted physical element.
        """
        if self._ifc_file is None:
            return []

        self._extracted_materials = []
        elements: list[BimElement] = []
        seen: set[str] = set()

        for entity in self._iter_physical_elements():
            guid = str(entity.GlobalId)
            if guid in seen:
                continue
            seen.add(guid)

            try:
                elem = self._extract_single_element(entity)
            except Exception as exc:
                self._errors.append(
                    f"Failed to extract element {guid}: {exc}"
                )
                continue

            if elem is None:
                continue

            elements.append(elem)
            self._record_element_warnings(elem)

        return elements

    def extract_metadata(self) -> IfcMetadata:
        """Extract project-level metadata from the IFC file.

        Returns
        -------
        IfcMetadata
            Project name, schema version, author, organisation, units, and
            creation date.  Defaults are used for anything unavailable.
        """
        metadata = IfcMetadata(schema_version=self._schema_version)

        if self._ifc_file is None:
            return metadata

        # Project name and units
        projects = self._ifc_file.by_type("IfcProject")
        if projects:
            proj = projects[0]
            metadata.project_name = str(proj.Name) if proj.Name else "Unnamed"
            metadata.units = self._extract_units(proj)

        # Author / organisation from owner history
        owner_histories = self._ifc_file.by_type("IfcOwnerHistory")
        if owner_histories:
            oh = owner_histories[0]
            if oh.OwningUser:
                user = oh.OwningUser
                person = getattr(user, "ThePerson", None)
                if person:
                    given = getattr(person, "GivenName", None)
                    family = getattr(person, "FamilyName", None)
                    if given or family:
                        metadata.author = f"{given or ''} {family or ''}".strip()
                org = getattr(user, "TheOrganization", None)
                if org and org.Name:
                    metadata.organization = str(org.Name)

            if oh.OwningApplication and not metadata.organization:
                app = oh.OwningApplication
                if getattr(app, "ApplicationFullName", None):
                    metadata.organization = str(app.ApplicationFullName)

        # Creation date from the IFC header
        metadata.creation_date = self._extract_creation_date()

        return metadata

    # ------------------------------------------------------------------
    # properties
    # ------------------------------------------------------------------

    @property
    def file_path(self) -> Path:
        """The resolved path to the IFC file."""
        return self._file_path

    @property
    def schema_version(self) -> str:
        """The IFC schema identifier (e.g. ``"IFC4"``)."""
        return self._schema_version

    @property
    def warnings(self) -> list[str]:
        """Non-critical parse warnings collected so far."""
        return list(self._warnings)

    @property
    def errors(self) -> list[str]:
        """Critical parse errors collected so far."""
        return list(self._errors)

    @property
    def is_lazy_loaded(self) -> bool:
        """Whether the file exceeds the lazy-load threshold (10 MB)."""
        try:
            return self._file_path.stat().st_size > _LAZY_LOAD_THRESHOLD_BYTES
        except OSError:
            return False

    # ------------------------------------------------------------------
    # element iteration
    # ------------------------------------------------------------------

    def _iter_physical_elements(self) -> Iterator[Any]:
        """Yield physical building elements one class at a time.

        Iterating per-class (instead of collecting every entity up front)
        keeps memory bounded on large files.  ``IfcWallStandardCase`` is a
        subtype of ``IfcWall``, so duplicates are de-duplicated by GlobalId by
        the caller.
        """
        if self._ifc_file is None:
            return

        for cls_name in _PHYSICAL_ELEMENT_CLASSES:
            try:
                for entity in self._ifc_file.by_type(cls_name):
                    yield entity
            except Exception:
                # Class not present in this schema version — skip it.
                continue

    # ------------------------------------------------------------------
    # single element extraction
    # ------------------------------------------------------------------

    def _extract_single_element(self, entity: Any) -> BimElement | None:
        """Extract one :class:`BimElement` from an IFC entity."""
        import ifcopenshell.util.element

        global_id = str(entity.GlobalId)
        ifc_class = entity.is_a()
        category = IFC_CATEGORY_MAP.get(ifc_class, ifc_class)

        # Name: prefer Name, then ObjectType, then the IFC class name.
        name = str(entity.Name) if entity.Name else None
        if not name:
            obj_type = getattr(entity, "ObjectType", None)
            name = str(obj_type) if obj_type else None
        if not name:
            name = ifc_class

        # Spatial containment → location and storey/level.
        location = ""
        level: str | None = None
        try:
            container = ifcopenshell.util.element.get_container(entity)
            if container is not None and container.Name:
                location = str(container.Name)
                level = str(container.Name)
        except Exception:
            pass

        quantities: dict[str, float] = {}
        try:
            quantities = self._extract_quantities(entity)
        except Exception:
            pass

        volume = quantities.get("volume", 0.0)
        area = quantities.get("area")
        length = quantities.get("length")

        properties: dict[str, Any] = {}
        try:
            properties = self._extract_properties(entity)
        except Exception:
            pass

        # --- deep material extraction via IfcMaterialExtractor ---
        material_name: str | None = None
        if self._material_extractor is not None:
            try:
                mat_info = self._material_extractor.extract_material_for_element(
                    entity
                )
                self._extracted_materials.append(mat_info)
                # For layered elements use composite name; otherwise simple name.
                material_name = (
                    mat_info.composite_material_name
                    or mat_info.material_name
                )
                # Store full material info and original name in properties.
                from dataclasses import asdict
                properties["material_info"] = asdict(mat_info)
                if mat_info.original_material_name:
                    properties["original_material_name"] = (
                        mat_info.original_material_name
                    )
            except Exception as exc:
                self._add_warning(
                    f"Material extraction failed for element {global_id}: {exc}"
                )

        classification_code: str | None = None
        try:
            classification_code = self._extract_classification(entity)
        except Exception:
            pass

        return BimElement(
            id=global_id,
            category=category,
            name=name,
            location=location,
            volume=volume,
            material_name=material_name,
            level=level,
            area=area,
            length=length,
            classification_code=classification_code,
            properties=properties,
        )

    def _record_element_warnings(self, elem: BimElement) -> None:
        """Record non-critical warnings for elements missing optional data."""
        if elem.volume is None or elem.volume <= 0.0:
            self._add_warning(
                f"Element {elem.id} ({elem.category}) has no usable volume "
                "quantity; defaulted to 0.0."
            )
        if not elem.level:
            self._add_warning(
                f"Element {elem.id} ({elem.category}) has no storey/level "
                "assignment."
            )
        if not elem.material_name:
            self._add_warning(
                f"Element {elem.id} ({elem.category}) has no material."
            )
        if elem.name == elem.category:
            self._add_warning(
                f"Element {elem.id} ({elem.category}) has no name; using "
                "type fallback."
            )

    def _add_warning(self, message: str) -> None:
        """Append a warning only once (de-duplicated)."""
        if message not in self._recorded_warnings:
            self._recorded_warnings.add(message)
            self._warnings.append(message)

    # ------------------------------------------------------------------
    # quantities
    # ------------------------------------------------------------------

    def _extract_quantities(self, entity: Any) -> dict[str, float]:
        """Extract volume / area / length from IFC quantity sets.

        Net quantities are preferred over Gross, and values are converted
        from the file's native units to metres / m² / m³.
        """
        import ifcopenshell.util.element

        result: dict[str, float] = {}

        qtos = ifcopenshell.util.element.get_psets(entity, qtos_only=True)
        if not qtos:
            return result

        for _qto_name, qdict in qtos.items():
            for qty_type, candidate_names in _QUANTITY_NAMES.items():
                if qty_type in result:
                    continue  # already found; prefer earlier quantity sets
                for cname in candidate_names:
                    if cname in qdict:
                        val = qdict[cname]
                        if isinstance(val, (int, float)):
                            factor = {
                                "volume": self._volume_factor,
                                "area": self._area_factor,
                                "length": self._length_factor,
                            }[qty_type]
                            result[qty_type] = round(float(val) * factor, 12)
                        break

        return result

    # ------------------------------------------------------------------
    # properties
    # ------------------------------------------------------------------

    def _extract_properties(self, entity: Any) -> dict[str, Any]:
        """Extract all IFC property sets, excluding quantity sets.

        Returns a nested dict ``{pset_name: {prop_name: value, ...}, ...}``.
        """
        import ifcopenshell.util.element

        all_psets = ifcopenshell.util.element.get_psets(entity)
        props: dict[str, Any] = {}
        for key, value in all_psets.items():
            if key.startswith("Qto_") or key.endswith("BaseQuantities"):
                continue
            props[key] = {
                k: v
                for k, v in value.items()
                if k != "id"  # skip internal id field
            }
        return props

    # ------------------------------------------------------------------
    # classification
    # ------------------------------------------------------------------

    def _extract_classification(self, entity: Any) -> str | None:
        """Extract a classification code from ``IfcRelAssociatesClassification``.

        Returns the ``Identification`` of the first classification reference,
        or ``None``.
        """
        for assoc in entity.HasAssociations or []:
            if assoc.is_a("IfcRelAssociatesClassification"):
                ref = assoc.RelatingClassification
                if ref and ref.Identification:
                    return str(ref.Identification)
        return None

    # ------------------------------------------------------------------
    # units
    # ------------------------------------------------------------------

    def _extract_units(self, project: Any) -> dict[str, str]:
        """Build a unit map from ``IfcUnitAssignment``."""
        units: dict[str, str] = {}
        if not project.UnitsInContext:
            return units

        for unit in project.UnitsInContext.Units or []:
            unit_type = getattr(unit, "UnitType", None)
            if unit_type is None:
                continue

            if unit.is_a("IfcSIUnit"):
                name = getattr(unit, "Name", "") or ""
                prefix = getattr(unit, "Prefix", "") or ""
                units[str(unit_type)] = f"{prefix}{name}"

            elif unit.is_a("IfcConversionBasedUnit"):
                units[str(unit_type)] = str(unit.Name or "")

        return units

    def _compute_unit_factors(self, metadata: IfcMetadata) -> None:
        """Compute conversion factors from IFC units to metres / m² / m³.

        Area and volume factors are derived from the length factor when the
        file only declares a ``LENGTHUNIT`` (the most common case).
        """
        projects = self._ifc_file.by_type("IfcProject")
        if not projects or not projects[0].UnitsInContext:
            return

        length_set = False
        for unit in projects[0].UnitsInContext.Units or []:
            unit_type = str(getattr(unit, "UnitType", "")).upper()

            if unit.is_a("IfcSIUnit"):
                prefix = getattr(unit, "Prefix", "") or ""
                multiplier = _SI_PREFIX_MULTIPLIERS.get(prefix.upper(), 1.0)

                if "LENGTH" in unit_type:
                    self._length_factor = multiplier
                    length_set = True
                elif "AREA" in unit_type:
                    self._area_factor = multiplier * multiplier
                elif "VOLUME" in unit_type:
                    self._volume_factor = multiplier * multiplier * multiplier

        # Derive area/volume factors from length when not explicitly defined.
        if length_set:
            self._area_factor = self._length_factor * self._length_factor
            self._volume_factor = (
                self._length_factor * self._length_factor * self._length_factor
            )

    # ------------------------------------------------------------------
    # metadata helpers
    # ------------------------------------------------------------------

    def _extract_creation_date(self) -> datetime | None:
        """Return the IFC header file timestamp as a ``datetime``, if present."""
        try:
            header = self._ifc_file.header
        except Exception:
            return None

        file_name = getattr(header, "file_name", None)
        if not file_name:
            return None

        # file_name is a tuple: (name, timestamp, author, org, ...)
        raw = file_name[1] if len(file_name) > 1 else None
        return _coerce_datetime(raw)


# ---------------------------------------------------------------------------
# module-level helpers
# ---------------------------------------------------------------------------


def _coerce_datetime(value: Any) -> datetime | None:
    """Best-effort conversion of a header timestamp to ``datetime``."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value

    text = str(value).strip()
    if not text:
        return None

    for fmt in (
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d",
        "%d/%m/%Y",
    ):
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            continue

    try:
        return datetime.fromisoformat(text)
    except ValueError:
        return None


__all__ = ["IfcParser", "IFC_CATEGORY_MAP"]
