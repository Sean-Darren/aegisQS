from __future__ import annotations

from geometry_validator import GeometryValidator
from material_mapper import MaterialMapper
from models import (
    AssessmentReport,
    BimElement,
    MaterialFamily,
    MaterialSpec,
    ReadinessIssue,
    Severity,
)
from scoring_engine import ScoringEngine
from assessment.material_classifier import MaterialClassifier

# Material association is critical for load-bearing/volume-measured building
# elements.  Fixtures, MEP proxies, stairs, railings and similar count-based
# items are often exported without a material relationship; that should not
# make the whole model fail readiness.
_MATERIAL_REQUIRED_CATEGORIES: frozenset[str] = frozenset({
    "IfcWall",
    "IfcSlab",
    "IfcRoof",
    "IfcColumn",
    "IfcBeam",
    "IfcFooting",
    "IfcPile",
    "IfcCovering",
    "IfcCurtainWall",
    "IfcMember",
})


class ReadinessEngine:
    """Single entry-point that orchestrates the full BIM readiness assessment."""

    __slots__ = ("_elements", "_specs", "_mat_counter", "_classifier")

    _elements: list[BimElement]
    _specs: list[MaterialSpec]
    _mat_counter: int

    def __init__(
        self,
        elements: list[BimElement],
        specs: list[MaterialSpec],
        material_classifier: MaterialClassifier | None = None,
    ) -> None:
        self._elements = elements
        self._specs = specs
        self._mat_counter = 0
        # A classifier is still created by default so the existing readiness
        # behaviour is unchanged; callers may inject a pre-configured one.
        self._classifier = (
            material_classifier
            if material_classifier is not None
            else MaterialClassifier()
        )

    # ------------------------------------------------------------------
    # public API
    # ------------------------------------------------------------------

    def run(self) -> AssessmentReport:
        """Execute the full pipeline and return an :class:`AssessmentReport`."""

        # ---- 1. geometry / classification validation ----
        geo_validator = GeometryValidator()
        geo_issues = geo_validator.validate_elements(self._elements)

        # ---- 2. material mapping ----
        mapper = MaterialMapper(self._specs)
        raw_mappings: dict[str, tuple[str, str]] = {}  # element_id → (spec_id, confidence)
        for elem in self._elements:
            raw_mappings[elem.id] = mapper.map_element(elem)

        # ---- 2a. classify every element material (when a classifier is
        #         configured) and attach the result to the element before
        #         material issues are built. ----
        if self._classifier is not None:
            for elem in self._elements:
                if elem.material_name:
                    classification = self._classifier.classify(
                        elem.material_name
                    )
                    self._store_classification(elem, classification)

        # ---- 3. material issues from mapping confidence ----
        mat_issues = self._build_material_issues(raw_mappings)

        # ---- 4. combine all issues ----
        all_issues = geo_issues + mat_issues

        # ---- 5. scoring ----
        scores = ScoringEngine.calculate_scores(all_issues)

        # ---- 6. gate evaluation ----
        gate = ScoringEngine.evaluate_gate(all_issues)

        # ---- 7. build material_mappings for the report ----
        spec_lookup: dict[str, MaterialSpec] = {s.id: s for s in self._specs}
        material_mappings: dict[str, MaterialSpec] = {}
        for elem_id, (spec_id, confidence) in raw_mappings.items():
            if confidence in ("EXACT", "FUZZY") and spec_id in spec_lookup:
                spec = spec_lookup[spec_id]
                # Enrich the spec copy with a classified family when it is
                # still the default OTHER — never mutate the caller's object.
                if spec.material_family == MaterialFamily.OTHER:
                    classified = self._classifier.classify(spec.name)
                    if classified.family != MaterialFamily.OTHER:
                        spec = spec.model_copy(
                            update={"material_family": classified.family}
                        )
                material_mappings[elem_id] = spec

        # ---- 8. summary ----
        summary = self._build_summary(all_issues, scores["overall"], gate)

        return AssessmentReport(
            overall_score=scores["overall"],
            gate_state=gate,
            category_scores=scores["categories"],
            issues=all_issues,
            material_mappings=material_mappings,
            summary=summary,
        )

    # ------------------------------------------------------------------
    # internal helpers
    # ------------------------------------------------------------------

    def _next_mat_id(self) -> str:
        self._mat_counter += 1
        return f"MAT-{self._mat_counter:03d}"

    def _build_material_issues(
        self, mappings: dict[str, tuple[str, str]]
    ) -> list[ReadinessIssue]:
        issues: list[ReadinessIssue] = []
        element_by_id: dict[str, BimElement] = {e.id: e for e in self._elements}

        for elem_id, (_spec_id, confidence) in mappings.items():
            element = element_by_id.get(elem_id)
            family = self._get_element_family(element)

            if confidence == "MISSING_DATA":
                if (
                    element is not None
                    and element.category not in _MATERIAL_REQUIRED_CATEGORIES
                ):
                    continue
                issues.append(
                    ReadinessIssue(
                        id=self._next_mat_id(),
                        element_id=elem_id,
                        severity=Severity.HIGH,
                        category="Materials",
                        message="Missing material specification",
                        commercial_impact="Cannot verify material compliance or calculate material quantities",
                        material_family=None,
                    )
                )
            elif confidence == "NO_MATCH":
                if (
                    element is not None
                    and element.category not in _MATERIAL_REQUIRED_CATEGORIES
                ):
                    continue
                issues.append(
                    ReadinessIssue(
                        id=self._next_mat_id(),
                        element_id=elem_id,
                        severity=Severity.MEDIUM,
                        category="Materials",
                        message="Material not found in specification library",
                        commercial_impact="Manual review required to confirm material acceptability",
                        material_family=family,
                    )
                )
            elif confidence == "FUZZY":
                issues.append(
                    ReadinessIssue(
                        id=self._next_mat_id(),
                        element_id=elem_id,
                        severity=Severity.LOW,
                        category="Materials",
                        message="Material matched with low confidence (fuzzy match)",
                        commercial_impact="Verify material assignment; possible data-entry error",
                        material_family=family,
                    )
                )
            # EXACT → no issue

        return issues

    def _get_element_family(self, element: BimElement | None) -> MaterialFamily | None:
        """Return the family previously stored for *element*, if available.

        When the element has no stored classification, no material name, or
        the stored value cannot be parsed, return ``None``.
        """
        if element is None or not element.material_name:
            return None
        try:
            classification = element.properties.get(
                "material_classification", {}
            )
            if isinstance(classification, dict):
                family_value = classification.get("family")
                if family_value is not None:
                    return MaterialFamily(str(family_value))
        except Exception:
            # A malformed properties payload should never crash the report.
            return None
        return None

    @staticmethod
    def _store_classification(element: BimElement, result: object) -> None:
        """Attach a serialisable classification summary to the element."""
        try:
            element.properties["material_classification"] = {
                "family": result.family.value,
                "confidence": result.confidence,
                "matched_pattern": result.matched_pattern,
                "matched_keywords": list(result.matched_keywords),
                "original_name": result.original_name,
            }
        except Exception:
            # Classification is best-effort; never fail the assessment because
            # enrichment storage is unavailable.
            pass

    @staticmethod
    def _build_summary(
        issues: list[ReadinessIssue],
        overall_score: float,
        gate_state: object,
    ) -> str:
        blocker_count = sum(1 for i in issues if i.severity == Severity.BLOCKER)
        high_count = sum(1 for i in issues if i.severity == Severity.HIGH)
        medium_count = sum(1 for i in issues if i.severity == Severity.MEDIUM)
        low_count = sum(1 for i in issues if i.severity == Severity.LOW)

        gate_name = getattr(gate_state, "value", str(gate_state))

        return (
            f"Gate: {gate_name} | Score: {overall_score:.1f} | "
            f"Issues: {blocker_count}B/{high_count}H/{medium_count}M/{low_count}L"
        )
