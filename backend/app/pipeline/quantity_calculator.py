from __future__ import annotations

from collections import defaultdict
from typing import Any

_FALLBACK_CATEGORY = "Unclassified"
_FALLBACK_LEVEL = "Unassigned"
_FALLBACK_MATERIAL = "Unspecified"


class QuantityCalculator:
    """Aggregate quantities from element dictionaries grouped by type, level, and material."""

    @staticmethod
    def calculate_quantities(elements: list[dict[str, Any]]) -> dict[str, Any]:
        """Return grouped quantity aggregates.

        Parameters
        ----------
        elements:
            List of element dicts. Expected keys: ``category``, ``volume``,
            ``area``, ``length``, ``level``, ``material_name``.  All numeric
            fields default to ``0.0`` when missing or ``None``.

        Returns
        -------
        dict
            ``{"by_element_type": {...}, "by_level": {...},
            "by_material": {...}, "grand_totals": {...}}``
        """
        by_type: dict[str, _Bucket] = defaultdict(_Bucket)
        by_level: dict[str, _Bucket] = defaultdict(_Bucket)
        by_material: dict[str, _Bucket] = defaultdict(_Bucket)

        for el in elements:
            category = _coerce_key(el.get("category"), _FALLBACK_CATEGORY)
            level = _coerce_key(el.get("level"), _FALLBACK_LEVEL)
            material = _coerce_key(el.get("material_name"), _FALLBACK_MATERIAL)

            vol = _coerce_float(el.get("volume"), 0.0)
            area = _coerce_float(el.get("area"), 0.0)
            length = _coerce_float(el.get("length"), 0.0)

            by_type[category].add(vol, area, length)
            by_level[level].add(vol, area, length)
            by_material[material].add(vol, area, length)

        return {
            "by_element_type": _freeze(by_type),
            "by_level": _freeze(by_level),
            "by_material": _freeze(by_material),
            "grand_totals": _grand_totals(by_type),
        }


# ------------------------------------------------------------------
# internal helpers
# ------------------------------------------------------------------


class _Bucket:
    __slots__ = ("count", "volume", "area", "length")

    def __init__(self) -> None:
        self.count = 0
        self.volume = 0.0
        self.area = 0.0
        self.length = 0.0

    def add(self, volume: float, area: float, length: float) -> None:
        self.count += 1
        self.volume += volume
        self.area += area
        self.length += length

    def to_dict(self) -> dict[str, float]:
        return {
            "count": self.count,
            "total_volume_m3": round(self.volume, 2),
            "total_area_m2": round(self.area, 2),
            "total_length_m": round(self.length, 2),
        }


def _coerce_key(value: Any, fallback: str) -> str:
    """Return a non-empty string key, falling back to *fallback*."""
    if isinstance(value, str) and value.strip():
        return value.strip()
    return fallback


def _coerce_float(value: Any, fallback: float) -> float:
    """Return *value* as float, or *fallback* when unusable."""
    if value is None:
        return fallback
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def _freeze(buckets: dict[str, _Bucket]) -> dict[str, dict[str, float]]:
    """Convert bucket dict to plain dict-of-dicts."""
    return {key: b.to_dict() for key, b in buckets.items()}


def _grand_totals(buckets: dict[str, _Bucket]) -> dict[str, float]:
    total = _Bucket()
    for b in buckets.values():
        total.count += b.count
        total.volume += b.volume
        total.area += b.area
        total.length += b.length
    return total.to_dict()
