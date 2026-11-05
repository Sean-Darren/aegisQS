from __future__ import annotations

import re
from typing import Any

# Unit → element quantity field
_UNIT_TO_FIELD: dict[str, str] = {
    "m3":    "volume",
    "m³":    "volume",
    "m2":    "area",
    "m²":    "area",
    "m":     "length",
    "lm":    "length",
    "count": "count",
    "no":    "count",
    "nr":    "count",
    "each":  "count",
    "kg":    "volume",   # proxy
    "t":     "volume",   # proxy
}
_FALLBACK_FIELD = "volume"

# Known material keywords for extracting hints from BOQ descriptions.
_KNOWN_MATERIALS: frozenset[str] = frozenset({
    "concrete", "steel", "timber", "masonry", "brick",
    "insulation", "plaster", "render", "screed",
    "aluminium", "aluminum", "glass", "membrane",
    "asphalt", "gravel", "sand", "cement", "gypsum",
    "blockwork", "block", "stone", "mortar", "grout",
})


class BOQItemMapper:
    """Map BIM elements onto Bill of Quantities line-items."""

    @staticmethod
    def map_to_boq(
        elements: list[dict[str, Any]],
        boq_template: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """Match elements to BOQ items and return priced line-items.

        Matching logic (per BOQ item):
            1. Element ``classification_code`` is compared against the
               BOQ ``classification`` using prefix matching (the
               element code must *start with* the BOQ classification).
            2. If the BOQ ``description`` contains any known material
               keyword, the element's ``material_name`` must contain
               at least one of those keywords (case-insensitive).

        Parameters
        ----------
        elements:
            Element dicts with ``"id"``, ``"classification_code"``,
            ``"material_name"``, ``"volume"``, ``"area"``, ``"length"``.
        boq_template:
            BOQ line-item templates.  Each dict must have ``"item_id"``,
            ``"description"``, ``"classification"``, ``"unit"``, and
            ``"rate"``.

        Returns
        -------
        list[dict]
            One dict per BOQ item with ``item_id``, ``description``,
            ``quantity``, ``unit``, ``rate``, ``total_price``, and
            ``element_ids``.  Items with zero matched elements are omitted.
        """
        result: list[dict[str, Any]] = []

        for boq in boq_template:
            classification = str(boq.get("classification", ""))
            unit = str(boq.get("unit", "m3")).lower()
            rate = float(boq.get("rate") or 0.0)
            desc = str(boq.get("description", ""))

            # Extract material keywords from the BOQ description
            desc_lower = desc.lower()
            material_hints = {m for m in _KNOWN_MATERIALS if m in desc_lower}

            qty_field = _UNIT_TO_FIELD.get(unit, _FALLBACK_FIELD)

            matched_ids: list[str] = []
            total_qty = 0.0

            for el in elements:
                # --- classification match ---
                el_class = str(el.get("classification_code") or "")
                if not _classification_matches(el_class, classification):
                    continue

                # --- material match ---
                if material_hints:
                    el_mat = str(el.get("material_name") or "").lower()
                    if not any(h in el_mat for h in material_hints):
                        continue

                # --- quantity ---
                if qty_field == "count":
                    total_qty += 1
                else:
                    total_qty += float(el.get(qty_field) or 0.0)

                matched_ids.append(str(el.get("id", "")))

            if matched_ids:
                result.append(
                    {
                        "item_id": boq["item_id"],
                        "description": desc,
                        "quantity": round(total_qty, 2),
                        "unit": unit,
                        "rate": rate,
                        "total_price": round(total_qty * rate, 2),
                        "element_ids": matched_ids,
                    }
                )

        return result


# ------------------------------------------------------------------
# helpers
# ------------------------------------------------------------------

def _classification_matches(element_code: str, boq_code: str) -> bool:
    """Return ``True`` when *element_code* starts with *boq_code*."""
    if not boq_code or not element_code:
        return False
    return element_code.lower().startswith(boq_code.lower())
