from __future__ import annotations

from typing import Any


class UnitRatePricer:
    """Price BOQ line-items against a price book with tiered matching."""

    @staticmethod
    def price_items(
        boq_items: list[dict[str, Any]],
        price_book: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """Return priced BOQ items with match confidence.

        Matching strategy (first successful pass wins):

        1. **EXACT** — BOQ ``item_id`` equals a price-book ``item_code``.
        2. **SEARCH** — BOQ description shares a significant word with a
           price-book description **and** their units match.
        3. **ESTIMATED** — Same ``trade`` / ``material_type`` and same
           ``unit`` in the price book (first match used).
        4. **NO_MATCH** — No suitable price-book item found; rate = 0.

        Parameters
        ----------
        boq_items:
            Line-items from :class:`BOQItemMapper`.  Expected keys:
            ``item_id``, ``description``, ``quantity``, ``unit``.
        price_book:
            Price-book entries.  Expected keys: ``item_code``,
            ``description``, ``unit``, ``rate``, ``trade``,
            ``material_type``.
        """
        priced: list[dict[str, Any]] = []

        for boq in boq_items:
            entry = dict(boq)
            boq_id = str(entry.get("item_id", ""))
            boq_desc = str(entry.get("description", "")).lower()
            boq_unit = str(entry.get("unit", "")).lower()
            quantity = float(entry.get("quantity") or 0.0)

            match = _find_match(boq_id, boq_desc, boq_unit, price_book)

            if match is None:
                entry["rate_applied"] = 0.0
                entry["total_price"] = 0.0
                entry["price_book_item_code"] = None
                entry["confidence"] = "NO_MATCH"
            else:
                pb_item, confidence = match
                rate = float(pb_item.get("rate") or 0.0)
                entry["rate_applied"] = rate
                entry["total_price"] = round(quantity * rate, 2)
                entry["price_book_item_code"] = pb_item.get("item_code")
                entry["confidence"] = confidence

            priced.append(entry)

        return priced


# ------------------------------------------------------------------
# matching helpers
# ------------------------------------------------------------------


def _find_match(
    boq_id: str,
    boq_desc: str,
    boq_unit: str,
    price_book: list[dict[str, Any]],
) -> tuple[dict[str, Any], str] | None:
    """Return ``(price_book_item, confidence)`` or ``None``."""

    # ---- Pass 1: exact code match ----
    for pb in price_book:
        if str(pb.get("item_code", "")).strip() == boq_id.strip():
            return (pb, "EXACT")

    # ---- Pass 2: description word overlap + same unit ----
    boq_words = set(boq_desc.split())
    # Remove very short / stop words
    boq_words = {w for w in boq_words if len(w) > 2}

    for pb in price_book:
        pb_unit = str(pb.get("unit", "")).lower()
        if pb_unit != boq_unit:
            continue
        pb_desc = str(pb.get("description", "")).lower()
        pb_words = {w for w in pb_desc.split() if len(w) > 2}
        if boq_words & pb_words:
            return (pb, "SEARCH")

    # ---- Pass 3: same trade/material_type + same unit ----
    for pb in price_book:
        pb_unit = str(pb.get("unit", "")).lower()
        if pb_unit != boq_unit:
            continue
        pb_trade = str(pb.get("trade", "")).lower()
        pb_mat = str(pb.get("material_type", "")).lower()
        # Check if boq description shares trade or material keywords
        if pb_trade and pb_trade in boq_desc:
            return (pb, "ESTIMATED")
        if pb_mat and pb_mat in boq_desc:
            return (pb, "ESTIMATED")

    # ---- Pass 4: same unit only (loosest match) ----
    for pb in price_book:
        if str(pb.get("unit", "")).lower() == boq_unit:
            return (pb, "ESTIMATED")

    return None
