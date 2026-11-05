from __future__ import annotations

from collections import defaultdict
from typing import Any

_DEFAULT_CONTINGENCY_PCT = 10.0

# Trade codes derived from Uniclass 2015 classification prefixes
_TRADE_PREFIX_MAP: dict[str, str] = {
    "EF": "Elemental Functions",
    "Ss": "Systems",
    "Pr": "Products",
    "TE": "Tools and Equipment",
    "Zz": "CAD",
    "PM": "Project Management",
    "FI": "Form of Information",
    "WR": "Work Results",
    "SL": "Spaces / Locations",
    "En": "Entities",
    "Ac": "Activities",
    "Co": "Complexes",
}


class BOQGenerator:
    """Generate a complete Bill of Quantities with summaries and breakdowns."""

    @staticmethod
    def generate_boq(
        boq_items: list[dict[str, Any]],
        contingency_pct: float = _DEFAULT_CONTINGENCY_PCT,
        work_package_assignments: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        """Produce a structured BOQ from line-items.

        Parameters
        ----------
        boq_items:
            Line-items from :class:`BOQItemMapper.map_to_boq`.
        contingency_pct:
            Contingency percentage applied to the subtotal (default 10%).
        work_package_assignments:
            Optional ``{element_id: wp_id}`` mapping.  When provided,
            ``breakdown_by_work_package`` is populated.

        Returns
        -------
        dict
            ``{"boq_items": [...], "summary": {...},
            "breakdown_by_trade": {...},
            "breakdown_by_work_package": {...},
            "contingency": {...}}``
        """
        total_items = len(boq_items)
        total_value = 0.0

        # --- trade breakdown ---
        trade_buckets: dict[str, dict[str, Any]] = defaultdict(
            lambda: {"item_count": 0, "total_value": 0.0, "items": []}
        )

        # --- work-package breakdown (optional) ---
        wp_buckets: dict[str, dict[str, Any]] = defaultdict(
            lambda: {"element_count": 0, "total_value": 0.0, "items": []}
        )

        # --- material-family breakdown (optional) ---
        material_buckets: dict[str, dict[str, Any]] = defaultdict(
            lambda: {"item_count": 0, "total_value": 0.0, "items": []}
        )

        enriched_items: list[dict[str, Any]] = []

        for item in boq_items:
            item_value = float(item.get("total_price") or 0.0)
            total_value += item_value

            material_family = item.get("material_family") or item.get("family")

            # Trade classification from item_id or classification
            trade = _classify_trade(item.get("item_id", ""))

            trade_buckets[trade]["item_count"] += 1
            trade_buckets[trade]["total_value"] += item_value
            trade_buckets[trade]["items"].append(item["item_id"])

            # Work-package allocation
            if work_package_assignments:
                element_ids = item.get("element_ids", [])
                for el_id in element_ids:
                    wp_id = work_package_assignments.get(el_id)
                    if wp_id:
                        # Distribute item value evenly across its elements
                        per_element_value = (
                            item_value / len(element_ids) if element_ids else 0.0
                        )
                        wp_buckets[wp_id]["element_count"] += 1
                        wp_buckets[wp_id]["total_value"] += per_element_value
                        if item["item_id"] not in wp_buckets[wp_id]["items"]:
                            wp_buckets[wp_id]["items"].append(item["item_id"])

            # Enrich item with trade
            enriched = dict(item)
            enriched["trade"] = trade
            if material_family:
                enriched["material_family"] = material_family
                material_buckets[str(material_family)]["item_count"] += 1
                material_buckets[str(material_family)]["total_value"] += item_value
                material_buckets[str(material_family)]["items"].append(item["item_id"])
            enriched_items.append(enriched)

        # --- round & sort trade breakdown ---
        breakdown_trade: dict[str, dict[str, Any]] = {}
        for trade, bucket in sorted(trade_buckets.items()):
            breakdown_trade[trade] = {
                "item_count": bucket["item_count"],
                "total_value": round(bucket["total_value"], 2),
                "items": bucket["items"],
            }

        # --- round & sort WP breakdown ---
        breakdown_wp: dict[str, dict[str, Any]] = {}
        for wp_id, bucket in sorted(wp_buckets.items()):
            breakdown_wp[wp_id] = {
                "element_count": bucket["element_count"],
                "total_value": round(bucket["total_value"], 2),
                "items": bucket["items"],
            }

        # --- round & sort material-family breakdown ---
        breakdown_material: dict[str, dict[str, Any]] = {}
        for family, bucket in sorted(material_buckets.items()):
            breakdown_material[family] = {
                "item_count": bucket["item_count"],
                "total_value": round(bucket["total_value"], 2),
                "items": bucket["items"],
            }

        # --- contingency ---
        subtotal = round(total_value, 2)
        contingency_amount = round(subtotal * contingency_pct / 100.0, 2)
        total_with_contingency = round(subtotal + contingency_amount, 2)

        return {
            "boq_items": enriched_items,
            "summary": {
                "total_items": total_items,
                "total_value": subtotal,
            },
            "breakdown_by_trade": breakdown_trade,
            "breakdown_by_work_package": breakdown_wp,
            "breakdown_by_material": breakdown_material,
            "contingency": {
                "percentage": contingency_pct,
                "amount": contingency_amount,
                "total_with_contingency": total_with_contingency,
            },
        }


def _classify_trade(item_id: str) -> str:
    """Heuristic trade classification from a BOQ item identifier.

    Tries to extract a Uniclass-style prefix (e.g. ``Ss_25``) or falls
    back to a coarse grouping based on the item-id prefix.
    """
    import re

    # Pattern:  two letters + underscore + digits  → e.g. Ss_25
    m = re.match(r"([A-Za-z]{2})_(\d+)", item_id)
    if m:
        prefix = m.group(1)
        group = m.group(2)
        label = _TRADE_PREFIX_MAP.get(prefix, prefix)
        return f"{label} — {prefix}_{group}"

    # Fallback: first 4 chars of item_id
    return item_id[:4] if len(item_id) >= 4 else item_id
