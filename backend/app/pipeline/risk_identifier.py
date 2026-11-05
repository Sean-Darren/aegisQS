from __future__ import annotations

from typing import Any

# Default probabilities by severity / confidence
_SEVERITY_PROBABILITY: dict[str, float] = {
    "BLOCKER":  0.80,
    "HIGH":     0.50,
    "MEDIUM":   0.25,
    "LOW":      0.10,
}
_CONFIDENCE_PROBABILITY: dict[str, float] = {
    "NO_MATCH":       0.60,
    "MISSING_DATA":   0.70,
    "ESTIMATED":      0.35,
    "SEARCH":         0.20,
}

# Mitigation templates
_MITIGATIONS: dict[str, str] = {
    "GENERIC_MATERIAL": (
        "Engage supplier for technical datasheet; verify specification "
        "against project requirements before procurement."
    ),
    "MISSING_DATA": (
        "Request material information from design team; update BIM model "
        "with complete material specification."
    ),
    "UNMAPPED_ITEM": (
        "Obtain quotation from specialist contractor; add missing item "
        "to the price book for future estimates."
    ),
    "LOW_CONFIDENCE": (
        "Validate rate with at least two market sources; update unit rate "
        "database with confirmed pricing."
    ),
    "COMPLIANCE_ISSUE": (
        "Escalate to project director for risk-acceptance decision; "
        "document in audit trail with formal justification."
    ),
}


class RiskIdentifier:
    """Identify project risks from assessment issues and BOQ confidence gaps."""

    def __init__(self) -> None:
        self._counter = 0

    def identify_risks(
        self,
        assessment_report: dict[str, Any],
        priced_boq: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """Return a consolidated risk register.

        Parameters
        ----------
        assessment_report:
            Output of :class:`ReadinessEngine.run` (or any dict with an
            ``"issues"`` key containing severity-tagged items).
        priced_boq:
            Output of :class:`UnitRatePricer.price_items` (items with
            ``confidence``, ``total_price``, ``item_id``).
        """
        risks: list[dict[str, Any]] = []

        # ---- 1. Risks from assessment issues (BLOCKER / HIGH) ----
        issues: list[dict[str, Any]] = assessment_report.get("issues") or []
        for iss in issues:
            severity = str(iss.get("severity") or "").upper()
            if severity not in ("BLOCKER", "HIGH"):
                continue

            # Determine risk type from issue category / message
            category = str(iss.get("category") or "")
            message = str(iss.get("message") or "")
            if "material" in category.lower() or "material" in message.lower():
                risk_type = "GENERIC_MATERIAL"
            elif "missing" in message.lower():
                risk_type = "MISSING_DATA"
            else:
                risk_type = "COMPLIANCE_ISSUE"

            cost_impact = _estimate_impact(
                priced_boq,
                str(iss.get("element_id") or ""),
                severity,
            )

            risks.append(
                {
                    "risk_id": self._next_id(),
                    "risk_type": risk_type,
                    "description": (
                        f"[{severity}] {iss.get('category', 'Unknown')}: "
                        f"{iss.get('message', 'No details')}"
                    ),
                    "affected_items": [iss.get("element_id")],
                    "estimated_cost_impact": cost_impact,
                    "probability": _SEVERITY_PROBABILITY.get(severity, 0.25),
                    "mitigation": _MITIGATIONS.get(
                        risk_type, _MITIGATIONS["COMPLIANCE_ISSUE"]
                    ),
                }
            )

        # ---- 2. Risks from BOQ confidence gaps ----
        for item in priced_boq:
            confidence = str(item.get("confidence") or "").upper()
            if confidence == "EXACT":
                continue

            risk_type_map = {
                "NO_MATCH":      "UNMAPPED_ITEM",
                "MISSING_DATA":  "MISSING_DATA",
                "ESTIMATED":     "LOW_CONFIDENCE",
                "SEARCH":        "LOW_CONFIDENCE",
            }
            risk_type = risk_type_map.get(confidence, "LOW_CONFIDENCE")

            total_price = float(item.get("total_price") or 0.0)
            item_id = str(item.get("item_id") or "")

            risks.append(
                {
                    "risk_id": self._next_id(),
                    "risk_type": risk_type,
                    "description": (
                        f"[{confidence}] {item.get('description', item_id)} "
                        f"— priced with {confidence.lower()} confidence"
                    ),
                    "affected_items": [item_id],
                    "estimated_cost_impact": round(total_price * 0.15, 2),
                    "probability": _CONFIDENCE_PROBABILITY.get(confidence, 0.25),
                    "mitigation": _MITIGATIONS.get(
                        risk_type, _MITIGATIONS["LOW_CONFIDENCE"]
                    ),
                }
            )

        # Sort by probability descending (highest risk first)
        risks.sort(key=lambda r: r["probability"], reverse=True)
        return risks

    # ------------------------------------------------------------------
    # internal
    # ------------------------------------------------------------------

    def _next_id(self) -> str:
        self._counter += 1
        return f"RISK-{self._counter:03d}"


def _estimate_impact(
    priced_boq: list[dict[str, Any]],
    element_id: str,
    severity: str,
) -> float:
    """Estimate cost impact of a compliance issue on an element."""
    if not element_id:
        return 0.0
    # Look for BOQ items containing this element
    matching_total = 0.0
    for item in priced_boq:
        el_ids = item.get("element_ids") or []
        if element_id in el_ids:
            matching_total += float(item.get("total_price") or 0.0)

    multiplier = {"BLOCKER": 0.25, "HIGH": 0.10}.get(severity, 0.05)
    return round(matching_total * multiplier, 2)
