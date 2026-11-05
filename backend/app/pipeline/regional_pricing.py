from __future__ import annotations

from typing import Any

_REGIONAL_MULTIPLIERS: dict[str, float] = {
    "london":      1.25,
    "south east":  1.15,
    "north west":  0.95,
    "scotland":    0.90,
}
_DEFAULT_MULTIPLIER = 1.0


class RegionalPricingAdjuster:
    """Adjust price-book rates by regional cost multipliers."""

    @staticmethod
    def adjust_for_region(
        price_book: list[dict[str, Any]],
        region: str,
    ) -> list[dict[str, Any]]:
        """Return a new price book with region-adjusted rates.

        Each item is shallow-copied.  The original ``rate`` is preserved
        as ``original_rate`` and a ``region`` field is added.  The
        ``rate`` field is replaced with the adjusted value rounded to
        two decimal places.

        Parameters
        ----------
        price_book:
            List of price-book item dicts (each must have a ``"rate"`` key).
        region:
            Region name.  Supported values (case-insensitive):
            ``"London"``, ``"South East"``, ``"North West"``,
            ``"Scotland"``.  Unrecognised regions use a 1.0× multiplier.
        """
        multiplier = _REGIONAL_MULTIPLIERS.get(
            region.strip().lower(), _DEFAULT_MULTIPLIER
        )

        adjusted: list[dict[str, Any]] = []
        for item in price_book:
            entry = dict(item)
            original = float(entry.get("rate") or 0.0)
            entry["original_rate"] = original
            entry["rate"] = round(original * multiplier, 2)
            entry["region"] = region.strip()
            adjusted.append(entry)

        return adjusted
