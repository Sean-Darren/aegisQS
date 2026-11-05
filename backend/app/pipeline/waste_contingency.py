from __future__ import annotations

from typing import Any

_DEFAULT_WASTE = 0.02


class WasteContingencyApplier:
    """Apply material-specific waste factors and a global contingency to a priced BOQ."""

    @staticmethod
    def apply_factors(
        priced_boq: list[dict[str, Any]],
        waste_factors: dict[str, float],
        contingency_percentage: float,
    ) -> dict[str, Any]:
        """Return an adjusted BOQ with waste and contingency applied.

        Parameters
        ----------
        priced_boq:
            Line-items from :class:`UnitRatePricer.price_items`.  Each
            must have ``description``, ``quantity``, ``rate_applied``,
            and ``total_price``.
        waste_factors:
            Material → waste ratio mapping, e.g.
            ``{"concrete": 0.05, "steel": 0.03}``.  A ``"default"`` key
            is used as fallback (defaults to 0.02 if absent).
        contingency_percentage:
            Percentage added to the adjusted subtotal (e.g. ``10.0``).

        Returns
        -------
        dict
            ``{"adjusted_boq": [...], "waste_summary": {...},
            "contingency_summary": {...}, "grand_total": float}``
        """
        default_factor = float(waste_factors.get("default", _DEFAULT_WASTE))

        adjusted_items: list[dict[str, Any]] = []
        waste_buckets: dict[str, dict[str, float]] = {}

        adjusted_subtotal = 0.0

        for item in priced_boq:
            entry = dict(item)

            desc = str(entry.get("description", "")).lower()
            original_qty = float(entry.get("quantity") or 0.0)
            rate = float(entry.get("rate_applied") or 0.0)

            # Determine waste factor
            factor = _match_factor(desc, waste_factors, default_factor)

            # Apply waste
            waste_qty = round(original_qty * factor, 4)
            adjusted_qty = round(original_qty + waste_qty, 4)
            adjusted_price = round(adjusted_qty * rate, 2)
            waste_cost = round(waste_qty * rate, 2)

            adjusted_subtotal += adjusted_price

            # Track waste summary
            material_key = _material_key(desc, waste_factors)
            if material_key not in waste_buckets:
                waste_buckets[material_key] = {
                    "factor": factor,
                    "waste_quantity": 0.0,
                    "waste_cost": 0.0,
                }
            waste_buckets[material_key]["waste_quantity"] = round(
                waste_buckets[material_key]["waste_quantity"] + waste_qty, 4
            )
            waste_buckets[material_key]["waste_cost"] = round(
                waste_buckets[material_key]["waste_cost"] + waste_cost, 2
            )

            # Enrich item
            entry["waste_factor"] = factor
            entry["original_quantity"] = original_qty
            entry["waste_quantity"] = waste_qty
            entry["quantity"] = adjusted_qty
            entry["original_total_price"] = entry.get("total_price", 0.0)
            entry["total_price"] = adjusted_price

            adjusted_items.append(entry)

        adjusted_subtotal = round(adjusted_subtotal, 2)

        # Contingency
        contingency_amount = round(adjusted_subtotal * contingency_percentage / 100.0, 2)
        grand_total = round(adjusted_subtotal + contingency_amount, 2)

        # Waste summary
        waste_summary: dict[str, Any] = {
            material: {
                "factor": info["factor"],
                "waste_quantity": info["waste_quantity"],
                "waste_cost": info["waste_cost"],
            }
            for material, info in sorted(waste_buckets.items())
        }
        waste_summary["total_waste_cost"] = round(
            sum(v["waste_cost"] for v in waste_summary.values()), 2
        )

        return {
            "adjusted_boq": adjusted_items,
            "waste_summary": waste_summary,
            "contingency_summary": {
                "percentage": contingency_percentage,
                "amount": contingency_amount,
                "adjusted_subtotal": adjusted_subtotal,
            },
            "grand_total": grand_total,
        }


def _match_factor(
    description: str,
    factors: dict[str, float],
    default: float,
) -> float:
    """Return the waste factor whose key appears in *description*."""
    for key, factor in factors.items():
        if key == "default":
            continue
        if key.lower() in description:
            return float(factor)
    return default


def _material_key(
    description: str,
    factors: dict[str, float],
) -> str:
    """Return the material key that matched, or ``"default"``."""
    for key in factors:
        if key == "default":
            continue
        if key.lower() in description.lower():
            return key
    return "default"
