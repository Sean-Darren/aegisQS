from __future__ import annotations

from typing import Any

# ---------------------------------------------------------------------------
# NRM2 element-type → MasterFormat division + preferred unit
# ---------------------------------------------------------------------------

_NRM2_TO_MASTERFORMAT: dict[str, tuple[str, str]] = {
    # Walls
    "ifcwall":            ("04 - Masonry",               "m²"),
    "ifcwallstandardcase": ("04 - Masonry",               "m²"),
    "ifccurtainwall":     ("08 - Openings and Glazing",   "m²"),
    # Slabs / floors
    "ifcslab":            ("03 - Concrete",               "m²"),
    "ifcfloor":           ("03 - Concrete",               "m²"),
    # Beams
    "ifcbeam":            ("03 - Concrete",               "m³"),
    # Columns
    "ifccolumn":          ("03 - Concrete",               "m³"),
    # Foundations
    "ifcfooting":         ("03 - Concrete",               "m³"),
    "ifcpile":            ("03 - Concrete",               "m³"),
    # Stairs
    "ifcstair":           ("03 - Concrete",               "m³"),
    "ifcstairflight":     ("03 - Concrete",               "m³"),
    # Roof
    "ifcroof":            ("07 - Thermal and Moisture",   "m²"),
    # Doors / windows
    "ifcdoor":            ("08 - Openings and Glazing",   "count"),
    "ifcwindow":          ("08 - Openings and Glazing",   "count"),
    # Finishes
    "ifccovering":        ("09 - Finishes",               "m²"),
}

# Fallback when a type is not in the lookup table
_FALLBACK_DIVISION = "00 - Unclassified"
_FALLBACK_UNIT = "m³"

# Preferred quantity keys per unit
_UNIT_KEY: dict[str, str] = {
    "m²":    "total_area_m2",
    "m³":    "total_volume_m3",
    "m":     "total_length_m",
    "count": "count",
}


class MeasurementStandardConverter:
    """Convert quantity aggregates between measurement standards."""

    @staticmethod
    def convert_quantities(
        quantities: dict[str, Any],
        from_standard: str,
        to_standard: str,
    ) -> dict[str, Any]:
        """Convert *quantities* from one standard to another.

        Currently supports only ``"NRM2"`` → ``"MasterFormat"``.

        Parameters
        ----------
        quantities:
            Output of :meth:`QuantityCalculator.calculate_quantities` (or
            any dict with a ``"by_element_type"`` key).
        from_standard:
            Source standard (``"NRM2"``).
        to_standard:
            Target standard (``"MasterFormat"``).

        Returns
        -------
        dict
            ``{"standard": "MasterFormat", "divisions": {...}}``
        """
        if (from_standard, to_standard) != ("NRM2", "MasterFormat"):
            raise ValueError(
                f"Conversion {from_standard!r} → {to_standard!r} is not supported. "
                f"Only 'NRM2' → 'MasterFormat' is available."
            )

        by_type: dict[str, dict[str, float]] = quantities.get("by_element_type", {})

        # Group into MasterFormat divisions
        divisions: dict[str, dict[str, Any]] = {}

        for type_name, bucket in by_type.items():
            division, unit = _lookup_division(type_name.lower())
            qty_key = _UNIT_KEY.get(unit, "total_volume_m3")
            qty = bucket.get(qty_key, 0.0)

            if division not in divisions:
                divisions[division] = {
                    "items": [],
                    "totals": {"count": 0, "primary_quantity": 0.0, "unit": unit},
                }

            divisions[division]["items"].append(
                {
                    "source_type": type_name,
                    "quantity": qty,
                    "unit": unit,
                    "description": f"{type_name} — {qty} {unit}",
                }
            )

            div_totals = divisions[division]["totals"]
            div_totals["count"] += int(bucket.get("count", 0))
            div_totals["primary_quantity"] = round(
                div_totals["primary_quantity"] + qty, 2
            )

        return {
            "standard": "MasterFormat",
            "divisions": dict(sorted(divisions.items())),
        }


def _lookup_division(type_name: str) -> tuple[str, str]:
    """Return ``(division, preferred_unit)`` for a lowercased type name."""
    return _NRM2_TO_MASTERFORMAT.get(type_name, (_FALLBACK_DIVISION, _FALLBACK_UNIT))
