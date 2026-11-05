from __future__ import annotations

from typing import Any

_MAX_OVERRUN_PCT = 50.0

_SEVERITY_IMPACT: dict[str, float] = {
    "BLOCKER": 5.0,
    "HIGH":    2.0,
    "MEDIUM":  0.5,
}

_FLAG_IMPACTS: dict[str, tuple[str, float]] = {
    "material":  ("Material specification gaps", 10.0),
    "missing":   ("Missing data gaps",            8.0),
}


class CostOverrunPredictor:
    """Deterministic, rule-based cost-overrun predictor."""

    @staticmethod
    def predict_overrun(
        assessment_report: dict[str, Any],
        estimate: dict[str, Any],
    ) -> dict[str, Any]:
        """Return a predicted overrun percentage with risk factors.

        Parameters
        ----------
        assessment_report:
            Assessment report with an ``"issues"`` list.
        estimate:
            Estimate dict for contextualising recommendations.

        Returns
        -------
        dict
        """
        issues: list[dict[str, Any]] = assessment_report.get("issues") or []

        # ---- severity counts ----
        severity_counts: dict[str, int] = {}
        for iss in issues:
            sev = str(iss.get("severity") or "").upper()
            if sev in _SEVERITY_IMPACT:
                severity_counts[sev] = severity_counts.get(sev, 0) + 1

        severity_pct = sum(
            _SEVERITY_IMPACT[sev] * cnt for sev, cnt in severity_counts.items()
        )

        # ---- flags ----
        has_material = False
        has_missing = False
        for iss in issues:
            combo = (
                str(iss.get("category") or "").lower()
                + " "
                + str(iss.get("message") or "").lower()
            )
            if "material" in combo:
                has_material = True
            if "missing" in combo:
                has_missing = True

        flag_pct = 0.0
        if has_material:
            flag_pct += _FLAG_IMPACTS["material"][1]
        if has_missing:
            flag_pct += _FLAG_IMPACTS["missing"][1]

        total_pct = min(severity_pct + flag_pct, _MAX_OVERRUN_PCT)
        total_pct = round(total_pct, 1)

        confidence = _compute_confidence(issues)

        # ---- risk factors ----
        risk_factors: list[dict[str, Any]] = []
        for sev, cnt in sorted(severity_counts.items()):
            risk_factors.append({
                "factor": f"{sev} issues",
                "count": cnt,
                "impact_percent": round(_SEVERITY_IMPACT[sev] * cnt, 1),
            })
        if has_material:
            risk_factors.append({
                "factor": _FLAG_IMPACTS["material"][0],
                "count": 1,
                "impact_percent": _FLAG_IMPACTS["material"][1],
            })
        if has_missing:
            risk_factors.append({
                "factor": _FLAG_IMPACTS["missing"][0],
                "count": 1,
                "impact_percent": _FLAG_IMPACTS["missing"][1],
            })

        recommendations = _generate_recommendations(
            severity_counts, has_material, has_missing, total_pct, estimate
        )

        return {
            "predicted_overrun_percentage": total_pct,
            "confidence": confidence,
            "risk_factors": risk_factors,
            "recommendations": recommendations,
        }


def _compute_confidence(issues: list[dict[str, Any]]) -> str:
    total = len(issues)
    if total == 0:
        return "HIGH"
    blockers = sum(
        1 for i in issues
        if str(i.get("severity") or "").upper() == "BLOCKER"
    )
    if total <= 3 and blockers == 0:
        return "HIGH"
    if total <= 10:
        return "MEDIUM"
    return "LOW"


def _generate_recommendations(
    severity_counts: dict[str, int],
    has_material: bool,
    has_missing: bool,
    total_pct: float,
    estimate: dict[str, Any],
) -> list[str]:
    recs: list[str] = []

    if severity_counts.get("BLOCKER", 0) > 0:
        recs.append(
            f"Resolve {severity_counts['BLOCKER']} BLOCKER issue(s) before "
            f"progressing — each represents critical scope or measurement risk."
        )
    if severity_counts.get("HIGH", 0) > 0:
        recs.append(
            f"Address {severity_counts['HIGH']} HIGH-severity issue(s) to "
            f"reduce classification and allocation uncertainty."
        )
    if has_material:
        recs.append(
            "Complete material specification for all elements to eliminate "
            "generic material risk (currently +10% overrun exposure)."
        )
    if has_missing:
        recs.append(
            "Populate missing data fields (level, name, classification_code) "
            "across all elements to close the +8% data-gap exposure."
        )
    if total_pct >= 30.0:
        recs.append(
            f"Overrun prediction of {total_pct}% is high — consider adding "
            f"an explicit contingency line in the estimate."
        )
    elif total_pct >= 20.0:
        recs.append(
            f"Moderate overrun risk ({total_pct}%) — review estimate "
            f"contingency and validate against historical benchmarks."
        )

    base_total = float(estimate.get("total_estimate") or 0.0)
    if total_pct > 0 and base_total > 0:
        overrun_amount = round(base_total * total_pct / 100.0, 2)
        recs.append(
            f"Estimated cost exposure: ${overrun_amount:,.2f} "
            f"({total_pct}% of ${base_total:,.2f} base estimate)."
        )

    if not recs:
        recs.append("No significant overrun risks detected.")

    return recs
