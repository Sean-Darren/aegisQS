from __future__ import annotations

import json
from dataclasses import asdict, is_dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from default_material_library import MaterialLibrary
from ifc_parser import IfcParser
from models import BimElement, MaterialSpec, AssessmentReport, GateState, Severity
from readiness_engine import ReadinessEngine


# ---------------------------------------------------------------------------
# Rich mock data that exercises every code path
# ---------------------------------------------------------------------------

_MOCK_ELEMENTS: list[dict[str, Any]] = [
    {
        "id": "EL-001", "category": "IfcWall", "name": "External Wall Type A",
        "location": "Grid A1", "material_name": "Concrete C32/40",
        "volume": 12.5, "area": 42.0, "level": "Level 0",
        "classification_code": "Ss_25_10_30",
    },
    {
        "id": "EL-002", "category": "IfcWall", "name": "Internal Partition B",
        "location": "Grid B2", "material_name": "Concrete C32/40",
        "volume": 3.2, "area": 18.0, "level": "Level 0",
        "classification_code": "Ss_25_10_30",
    },
    {
        "id": "EL-003", "category": "IfcBeam", "name": "Roof Beam RB-01",
        "location": "Grid C3", "material_name": "Steel S355",
        "volume": 0.9, "area": 5.4, "level": "Level 1",
    },
    {
        "id": "EL-004", "category": "IfcColumn", "name": "Corner Column CC-A",
        "location": "Grid A1", "material_name": "Concrete C32/40",
        "volume": 0.8, "area": 2.4, "level": "Level 0",
    },
    # ---- element with issues built-in ----
    {
        "id": "EL-005", "category": "IfcSlab", "name": "",          # → MEDIUM name issue
        "location": "Grid D4", "material_name": "",                   # → HIGH material issue
        "volume": 0.0,                                                     # → BLOCKER geometry
        "area": 0.0,
        "level": None,                                                     # → HIGH classification
    },
    {
        "id": "EL-006", "category": "IfcPipeSegment", "name": "CHW Supply Pipe",
        "location": "Plant Room", "material_name": "Unknown Alloy",  # → MEDIUM no-match
        "volume": 0.2, "area": 2.0, "level": "Level 0",
    },
    {
        "id": "EL-007", "category": "IfcRoof", "name": "Main Roof Assembly",
        "location": "Roof Level", "material_name": "Timber C24",
        "volume": 1.8, "area": 120.0, "level": "Roof",
    },
]

_MOCK_SPECS: list[dict[str, Any]] = [
    {"id": "SPEC-001", "name": "Concrete C32/40", "aliases": ["conc", "concrete", "c32"], "unit": "m3", "properties": {"compressive_strength": "40 MPa"}},
    {"id": "SPEC-002", "name": "Steel S355",      "aliases": ["steel", "s355"],          "unit": "kg", "properties": {"yield_strength": "355 MPa"}},
    {"id": "SPEC-003", "name": "Timber C24",      "aliases": ["timber", "wood", "c24"], "unit": "m3", "properties": {"grade": "C24"}},
]


class ZeroTouchAssessmentService:
    """Zero-touch BIM readiness assessment service.

    Parses a model data file (IFC or JSON), runs the full readiness
    pipeline, saves the report to disk, and returns the result dict.
    """

    # Public entry point -------------------------------------------------

    @staticmethod
    def assess_model(
        file_path: str,
        specs: list[MaterialSpec | dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        """Run a zero-touch assessment on the model at *file_path*.

        Parameters
        ----------
        file_path:
            Path to a ``.ifc`` or ``.json`` model data file.  JSON files
            that are missing or unreadable fall back to a built-in mock
            dataset for backward compatibility.
        specs:
            Optional list of :class:`MaterialSpec` instances or spec
            dictionaries.  When *None* or empty, the built-in default
            material library is used.

        Returns
        -------
        dict
            The full assessment report as a JSON-safe dictionary.
        """
        path = Path(file_path)
        suffix = path.suffix.lower()

        # 1. Parse elements from the appropriate source.
        ifc_metadata_dict: dict[str, Any] | None = None
        file_type: str
        schema_version: str | None = None
        parse_warnings: list[str] = []
        parse_errors: list[str] = []

        if suffix == ".ifc":
            file_type = "IFC"
            parser = IfcParser(str(path))
            parse_result = parser.parse()
            bim_elements = parse_result.elements
            ifc_metadata_dict = ZeroTouchAssessmentService._ifc_metadata_to_dict(
                parse_result.metadata
            )
            schema_version = parse_result.metadata.schema_version
            parse_warnings = list(parser.warnings)
            parse_errors = list(parser.errors)

        elif suffix == ".json":
            file_type = "JSON"
            elements_raw = ZeroTouchAssessmentService._parse_elements(str(path))
            bim_elements = [BimElement(**el) for el in elements_raw]

        elif suffix == ".pdf":
            # ── 2D PDF: PyMuPDF vector extraction + CV raster fallback ──
            from vector_pdf_parser import VectorPDFParser

            file_type = "2D_PDF"
            parser = VectorPDFParser()
            bim_elements = parser.parse(str(path))
            print(
                f"[ZeroTouchAssessmentService] Parsed {len(bim_elements)} "
                f"element(s) from PDF: {path.name}"
            )

        elif suffix in (".png", ".jpg", ".jpeg"):
            # ── 2D raster image: Hugging Face zero-shot object detection ──
            from hf_2d_parser import HuggingFace2DParser

            file_type = "2D_DRAWING"
            parser = HuggingFace2DParser()
            bim_elements = parser.parse(str(path))
            print(
                f"[ZeroTouchAssessmentService] Parsed {len(bim_elements)} "
                f"element(s) from 2D drawing: {path.name}"
            )

        else:
            raise ValueError(
                f"Unsupported model file type: {suffix}. "
                "Expected a .ifc, .json, .png, .jpg, .jpeg, or .pdf file."
            )

        # 2. Resolve specs — fall back to the built-in default library when
        #    the caller has not supplied any project specifications.
        if not specs:
            material_specs = MaterialLibrary().get_all_specs()
        else:
            material_specs = [
                s if isinstance(s, MaterialSpec) else MaterialSpec(**s)
                for s in specs
            ]

        # 3. Run the readiness engine
        engine = ReadinessEngine(bim_elements, material_specs)
        report: AssessmentReport = engine.run()

        # 4. Serialise the report and attach source/file metadata.
        report_dict = ZeroTouchAssessmentService._serialize_report(report)
        report_dict["source_file"] = str(path.resolve())
        report_dict["element_count"] = len(bim_elements)
        report_dict["spec_count"] = len(material_specs)
        report_dict["metadata"] = {
            "file_type": file_type,
            "schema_version": schema_version,
            "ifc_metadata": ifc_metadata_dict,
            "parse_warnings": parse_warnings,
            "parse_errors": parse_errors,
        }

        # 5. Persist to disk
        output_path = ZeroTouchAssessmentService._save_report(report_dict, file_path)
        report_dict["saved_to"] = str(output_path)

        return report_dict

    # Internal helpers ----------------------------------------------------

    @staticmethod
    def _parse_elements(file_path: str) -> list[dict[str, Any]]:
        """Try to read elements from a JSON file; fall back to mock data."""
        path = Path(file_path)

        if path.exists() and path.suffix.lower() == ".json":
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                if isinstance(data, list):
                    return data
                if isinstance(data, dict):
                    # Support both top-level list and {"elements": [...]}
                    if "elements" in data:
                        return data["elements"]
                    # Single element?
                    return [data]
            except (json.JSONDecodeError, OSError):
                pass  # fall through to mock

        # ---- mock fallback ----
        print(
            f"[ZeroTouchAssessmentService] File '{file_path}' not found or unreadable; "
            f"using built-in mock dataset ({len(_MOCK_ELEMENTS)} elements)."
        )
        return _MOCK_ELEMENTS

    @staticmethod
    def _serialize_report(report: AssessmentReport) -> dict[str, Any]:
        """Convert an AssessmentReport dataclass to a JSON-safe dict."""
        family_summary: dict[str, int] = {}

        # Count mapped material families first, then add issue-level
        # families only for elements that were not mapped (e.g. NO_MATCH).
        # This avoids double-counting an element that has both a fuzzy
        # mapping and a low-confidence material issue.
        mapped_element_ids = set(report.material_mappings.keys())
        for spec in report.material_mappings.values():
            if spec.material_family is not None:
                key = spec.material_family.value
                family_summary[key] = family_summary.get(key, 0) + 1

        for issue in report.issues:
            if issue.material_family is None:
                continue
            if issue.element_id in mapped_element_ids:
                continue
            key = issue.material_family.value
            family_summary[key] = family_summary.get(key, 0) + 1

        return {
            "overall_score": report.overall_score,
            "gate_state": report.gate_state.value if isinstance(report.gate_state, GateState) else str(report.gate_state),
            "category_scores": report.category_scores,
            "issues": [
                {
                    "id": i.id,
                    "element_id": i.element_id,
                    "severity": i.severity.value if isinstance(i.severity, Severity) else str(i.severity),
                    "category": i.category,
                    "message": i.message,
                    "commercial_impact": i.commercial_impact,
                    "material_family": (
                        i.material_family.value if i.material_family else None
                    ),
                }
                for i in report.issues
            ],
            "material_mappings": {
                elem_id: {
                    "spec_id": spec.id,
                    "spec_name": spec.name,
                    "unit": spec.unit,
                }
                for elem_id, spec in report.material_mappings.items()
            },
            "material_family_summary": family_summary,
            "summary": report.summary,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

    @staticmethod
    def _ifc_metadata_to_dict(metadata: Any) -> dict[str, Any] | None:
        """Convert an :class:`IfcMetadata` instance to a JSON-safe dict."""
        if metadata is None:
            return None
        result = asdict(metadata) if is_dataclass(metadata) else dict(metadata)
        creation_date = result.get("creation_date")
        if creation_date is not None and hasattr(creation_date, "isoformat"):
            result["creation_date"] = creation_date.isoformat()
        return result

    @staticmethod
    def _save_report(report_dict: dict[str, Any], source_path: str) -> Path:
        """Write the report as a JSON file next to the source.

        The output filename follows the pattern
        <stem>_assessment_<timestamp>.json.
        """
        stem = Path(source_path).stem or "model"
        ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        output_path = Path(f"{stem}_assessment_{ts}.json")

        output_path.write_text(
            json.dumps(report_dict, indent=2, ensure_ascii=False, default=str),
            encoding="utf-8",
        )
        print(f"[ZeroTouchAssessmentService] Report saved → {output_path}")
        return output_path.resolve()
