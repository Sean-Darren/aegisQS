from __future__ import annotations

from typing import Any, TypedDict

from models import Severity

# Maps each property key to (comparison_strategy, severity_if_violated)
# - "gte": actual must be >= required
# - "lte": actual must be <= required
# - "exact": values must be equal
_RULES: dict[str, tuple[str, Severity]] = {
    "fire_rating_minutes": ("gte", Severity.BLOCKER),
    "thermal_conductivity": ("lte", Severity.HIGH),
    "acoustic_rating": ("gte", Severity.MEDIUM),
    "concrete_grade": ("exact", Severity.BLOCKER),
    "steel_grade": ("exact", Severity.BLOCKER),
    "density_kg_m3": ("gte", Severity.MEDIUM),
}


class ViolationDict(TypedDict):
    property_name: str
    required_value: Any
    actual_value: Any
    severity: str


class ComplianceResult(TypedDict):
    is_compliant: bool
    violations: list[ViolationDict]


class SpecComplianceChecker:
    """Check whether extracted material properties meet a required specification."""

    @staticmethod
    def check_compliance(
        required_spec: dict[str, Any],
        actual_properties: dict[str, Any],
    ) -> ComplianceResult:
        """Return ``is_compliant`` and a list of ``violations``.

        Parameters
        ----------
        required_spec:
            Dict of required property values (same keys as
            :class:`MaterialPropertyExtractor` output).
        actual_properties:
            Dict of actual (extracted) property values.

        Returns
        -------
        ComplianceResult
            ``{"is_compliant": bool, "violations": list[ViolationDict]}``
        """
        violations: list[ViolationDict] = []

        for prop_name, required_val in required_spec.items():
            rule = _RULES.get(prop_name)
            if rule is None:
                continue  # unknown property → skip silently

            strategy, severity = rule
            actual_val = actual_properties.get(prop_name)

            # --- property entirely missing from actual ---
            if actual_val is None:
                violations.append(
                    ViolationDict(
                        property_name=prop_name,
                        required_value=required_val,
                        actual_value=None,
                        severity=severity.value,
                    )
                )
                continue

            # --- compare ---
            if _violates(strategy, required_val, actual_val):
                violations.append(
                    ViolationDict(
                        property_name=prop_name,
                        required_value=required_val,
                        actual_value=actual_val,
                        severity=severity.value,
                    )
                )

        return ComplianceResult(
            is_compliant=len(violations) == 0,
            violations=violations,
        )


def _violates(strategy: str, required: Any, actual: Any) -> bool:
    """Return ``True`` when *actual* fails to satisfy *required*."""
    if strategy == "gte":
        return actual < required
    if strategy == "lte":
        return actual > required
    if strategy == "exact":
        return actual != required
    return False
