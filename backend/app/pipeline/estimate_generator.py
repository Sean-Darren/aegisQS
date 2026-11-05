from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from typing import Any

_ESTIMATE_CONTINGENCIES: dict[str, float] = {
    "budget": 15.0,
    "tender": 10.0,
    "final":  5.0,
}

_DEFAULT_ASSUMPTIONS: list[str] = [
    "Prices are based on current market rates at the time of estimate.",
    "All quantities are derived from the BIM model and subject to design changes.",
    "Waste factors are applied per material type as noted.",
    "Works are to be executed during normal working hours.",
    "Site access and welfare facilities are provided by the principal contractor.",
    "All measurements are in accordance with NRM2 unless otherwise stated.",
]

_DEFAULT_EXCLUSIONS: list[str] = [
    "VAT and other applicable taxes.",
    "Client-directed variations after contract award.",
    "Escalation / inflation beyond the estimate validity period (60 days).",
    "Professional fees (architect, engineer, QS) unless separately itemised.",
    "Statutory authority fees and charges.",
    "Ground contamination / hazardous material removal.",
    "Temporary works unless explicitly measured.",
]


class EstimateGenerator:
    """Generate a formal cost estimate from a priced and waste-adjusted BOQ."""

    @staticmethod
    def generate_estimate(
        priced_boq: dict[str, Any],
        estimate_type: str = "tender",
        project_name: str = "Unnamed Project",
        cost_breakdown: dict[str, Any] | None = None,
        work_package_summaries: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        """Produce a structured estimate document.

        Parameters
        ----------
        priced_boq:
            Output dict from :class:`WasteContingencyApplier.apply_factors`.
        estimate_type:
            ``"budget"`` (15% contingency), ``"tender"`` (10%), or
            ``"final"`` (5%).
        project_name:
            Human-readable project identifier.
        cost_breakdown:
            Optional output from :class:`CostBreakdownCalculator`.
        work_package_summaries:
            Optional work-package summaries for the BOQ summary section.

        Returns
        -------
        dict
        """
        est_type = estimate_type.strip().lower()
        if est_type not in _ESTIMATE_CONTINGENCIES:
            raise ValueError(
                f"Unknown estimate type {estimate_type!r}. "
                f"Choose from: {', '.join(_ESTIMATE_CONTINGENCIES)}."
            )

        contingency_pct = _ESTIMATE_CONTINGENCIES[est_type]

        # Extract values from the priced BOQ dict
        adjusted_boq: list[dict[str, Any]] = priced_boq.get("adjusted_boq", [])
        waste_summary: dict[str, Any] = priced_boq.get("waste_summary", {})

        # Base cost = sum of original_total_price across all items
        base_cost = round(
            sum(float(it.get("original_total_price") or 0.0) for it in adjusted_boq),
            2,
        )

        # Waste-adjusted cost = sum of total_price (after waste) across all items
        waste_adjusted_cost = round(
            sum(float(it.get("total_price") or 0.0) for it in adjusted_boq),
            2,
        )

        # Apply estimate-type contingency on waste-adjusted cost
        contingency_amount = round(waste_adjusted_cost * contingency_pct / 100.0, 2)
        total_estimate = round(waste_adjusted_cost + contingency_amount, 2)

        # BOQ summary
        boq_summary = _build_boq_summary(adjusted_boq, work_package_summaries)

        # Cost breakdown (use provided or compute basic)
        if cost_breakdown is None:
            cost_breakdown = _basic_cost_breakdown(waste_adjusted_cost, contingency_amount)

        return {
            "estimate_id": str(uuid.uuid4()),
            "estimate_type": est_type,
            "created_date": datetime.now(timezone.utc).isoformat(),
            "project_name": project_name,
            "base_cost": base_cost,
            "waste_adjusted_cost": waste_adjusted_cost,
            "contingency": {
                "percentage": contingency_pct,
                "amount": contingency_amount,
            },
            "total_estimate": total_estimate,
            "cost_breakdown": cost_breakdown,
            "boq_summary": boq_summary,
            "assumptions": list(_DEFAULT_ASSUMPTIONS),
            "exclusions": list(_DEFAULT_EXCLUSIONS),
        }


def _build_boq_summary(
    adjusted_boq: list[dict[str, Any]],
    wp_summaries: list[dict[str, Any]] | None,
) -> dict[str, Any]:
    """Build a concise BOQ summary."""
    total_items = len(adjusted_boq)
    items_by_confidence: dict[str, int] = {}
    for it in adjusted_boq:
        conf = str(it.get("confidence", "UNKNOWN"))
        items_by_confidence[conf] = items_by_confidence.get(conf, 0) + 1

    summary: dict[str, Any] = {
        "total_line_items": total_items,
        "by_confidence": items_by_confidence,
    }

    if wp_summaries:
        summary["work_packages"] = [
            {
                "wp_id": wp.get("wp_id", "?"),
                "name": wp.get("name", "?"),
                "element_count": wp.get("element_count", 0),
            }
            for wp in wp_summaries
        ]

    return summary


def _basic_cost_breakdown(
    subtotal: float,
    contingency: float,
) -> dict[str, Any]:
    """Fallback cost breakdown when none is provided."""
    return {
        "material_costs": round(subtotal * 0.60, 2),
        "labor_costs": round(subtotal * 0.30, 2),
        "equipment_costs": round(subtotal * 0.10, 2),
        "overhead_and_profit": contingency,
        "subtotal": subtotal,
        "total": round(subtotal + contingency, 2),
    }
