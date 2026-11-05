from __future__ import annotations

from collections import defaultdict
from typing import Any

# Default cost-split ratios (must sum to 1.0)
_MATERIAL_RATIO = 0.60
_LABOR_RATIO = 0.30
_EQUIPMENT_RATIO = 0.10
_OVERHEAD_PCT = 15.0


class CostBreakdownCalculator:
    """Decompose priced BOQ totals into material, labour, equipment, and overhead."""

    @staticmethod
    def calculate_breakdown(
        priced_boq: list[dict[str, Any]],
        work_package_assignments: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        """Produce a full cost-breakdown report.

        Parameters
        ----------
        priced_boq:
            Line-items from :class:`UnitRatePricer.price_items`.  Each
            must have ``total_price`` and optionally ``element_ids``,
            ``trade``.
        work_package_assignments:
            Optional ``{element_id: wp_id}`` mapping.  When provided,
            ``breakdown_by_work_package`` is populated by distributing
            item costs evenly across constituent elements.

        Returns
        -------
        dict
        """
        subtotal = 0.0
        trade_buckets: dict[str, float] = defaultdict(float)
        wp_buckets: dict[str, float] = defaultdict(float)

        for item in priced_boq:
            price = float(item.get("total_price") or 0.0)
            subtotal += price

            # Trade breakdown
            trade = str(item.get("trade") or "Unclassified")
            trade_buckets[trade] += price

            # Work-package breakdown (optional)
            if work_package_assignments:
                element_ids = item.get("element_ids", [])
                if element_ids:
                    per_el = price / len(element_ids)
                    for el_id in element_ids:
                        wp_id = work_package_assignments.get(el_id)
                        if wp_id:
                            wp_buckets[wp_id] += per_el

        subtotal = round(subtotal, 2)

        material = round(subtotal * _MATERIAL_RATIO, 2)
        labor = round(subtotal * _LABOR_RATIO, 2)
        equipment = round(subtotal * _EQUIPMENT_RATIO, 2)

        overhead = round(subtotal * _OVERHEAD_PCT / 100.0, 2)
        total = round(subtotal + overhead, 2)

        # Round and sort breakdowns
        breakdown_trade = dict(
            sorted(
                ((t, round(v, 2)) for t, v in trade_buckets.items()),
                key=lambda kv: kv[1],
                reverse=True,
            )
        )

        breakdown_wp = dict(
            sorted(
                ((wp, round(v, 2)) for wp, v in wp_buckets.items()),
                key=lambda kv: kv[1],
                reverse=True,
            )
        )

        return {
            "material_costs": material,
            "labor_costs": labor,
            "equipment_costs": equipment,
            "overhead_and_profit": overhead,
            "subtotal": subtotal,
            "total": total,
            "breakdown_by_trade": breakdown_trade,
            "breakdown_by_work_package": breakdown_wp,
        }
