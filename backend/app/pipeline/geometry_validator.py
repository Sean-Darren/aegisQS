from __future__ import annotations

from models import BimElement, ReadinessIssue, Severity

GENERIC_NAMES: frozenset[str] = frozenset({"Default", "Unnamed"})
AREA_SENSITIVE_CATEGORIES: frozenset[str] = frozenset({"IfcWall", "IfcSlab", "IfcRoof"})
VOLUME_SENSITIVE_CATEGORIES: frozenset[str] = frozenset({
    "IfcWall",
    "IfcColumn",
    "IfcBeam",
    "IfcFooting",
    "IfcPile",
})


class GeometryValidator:
    """Validates BIM elements for geometric and classification readiness issues."""

    _counter: int

    def __init__(self) -> None:
        self._counter = 0

    def _next_id(self) -> str:
        self._counter += 1
        return f"ISS-{self._counter:03d}"

    def validate_elements(self, elements: list[BimElement]) -> list[ReadinessIssue]:
        issues: list[ReadinessIssue] = []

        for elem in elements:
            # --- BLOCKER: zero or negative volume for volume-measured
            # building elements.  Count/area/length-based elements (doors,
            # windows, stairs, railings, MEP proxies, etc.) do not require a
            # volume and should not block readiness just because IFC exports
            # them without one.
            if (
                elem.category in VOLUME_SENSITIVE_CATEGORIES
                and elem.volume <= 0.0
            ):
                issues.append(
                    ReadinessIssue(
                        id=self._next_id(),
                        element_id=elem.id,
                        severity=Severity.BLOCKER,
                        category="Geometry",
                        message="Zero/negative volume",
                        commercial_impact="Cannot calculate quantities",
                    )
                )

            # --- HIGH: missing level assignment ---
            if not elem.level:
                issues.append(
                    ReadinessIssue(
                        id=self._next_id(),
                        element_id=elem.id,
                        severity=Severity.HIGH,
                        category="Classification",
                        message="Missing level assignment",
                        commercial_impact="Cannot allocate to work package",
                    )
                )

            # --- HIGH: zero/negative area for area-sensitive categories ---
            if (
                elem.category in AREA_SENSITIVE_CATEGORIES
                and (elem.area is None or elem.area <= 0.0)
                and not (
                    elem.category == "IfcSlab"
                    and elem.name
                    and elem.name.lower().startswith("stair")
                )
            ):
                issues.append(
                    ReadinessIssue(
                        id=self._next_id(),
                        element_id=elem.id,
                        severity=Severity.HIGH,
                        category="Geometry",
                        message="Zero/negative area",
                        commercial_impact="Cannot measure surface area",
                    )
                )

            # --- MEDIUM: missing or generic name ---
            name = elem.name
            if not name or name in GENERIC_NAMES:
                issues.append(
                    ReadinessIssue(
                        id=self._next_id(),
                        element_id=elem.id,
                        severity=Severity.MEDIUM,
                        category="Classification",
                        message="Missing element name",
                        commercial_impact="Hard to identify in reports",
                    )
                )

        return issues
