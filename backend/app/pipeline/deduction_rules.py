from __future__ import annotations

from copy import deepcopy
from typing import Any

_NRM2_OPENING_THRESHOLD_M2 = 0.5


class DeductionRules:
    """Apply measurement deduction rules per standard (NRM2, etc.)."""

    @staticmethod
    def apply_deductions(
        elements: list[dict[str, Any]],
        standard: str = "NRM2",
    ) -> list[dict[str, Any]]:
        """Return a new list of element dicts with deductions applied.

        Each returned dict is a shallow copy of the original with two
        additional keys: ``"deducted_area_m2"``, ``"deduction_notes"``.
        Original keys are never mutated in-place.

        Parameters
        ----------
        elements:
            Element dicts.  Wall elements may contain an ``"openings"``
            key holding ``[{"id": str, "area": float}, ...]``.
        standard:
            Measurement standard identifier (currently only ``"NRM2"``).
        """
        if standard != "NRM2":
            raise ValueError(f"Unsupported standard: {standard!r}")

        result: list[dict[str, Any]] = []

        for el in elements:
            working = dict(el)  # shallow copy
            working.setdefault("deducted_area_m2", 0.0)

            # Normalise deduction_notes to a list
            raw_notes = working.get("deduction_notes")
            if not isinstance(raw_notes, list):
                raw_notes = [raw_notes] if raw_notes else []
            else:
                raw_notes = list(raw_notes)
            working["deduction_notes"] = raw_notes

            category = str(working.get("category", "")).lower()

            # ---- Rule 1: wall openings (>0.5 m²) ----
            if "wall" in category or "ifcwall" in category:
                working = _deduct_wall_openings(working)

            # ---- Rule 2: beam-column intersections (stub) ----
            elif "beam" in category or "ifcbeam" in category:
                working = _deduct_beam_column_intersections(working)

            # ---- Rule 3: slab openings (stub) ----
            elif "slab" in category or "ifcslab" in category:
                working = _deduct_slab_openings(working)

            result.append(working)

        return result


# ------------------------------------------------------------------
# Rule implementations
# ------------------------------------------------------------------


def _deduct_wall_openings(el: dict[str, Any]) -> dict[str, Any]:
    """NRM2: deduct opening area when individual opening > 0.5 m²."""
    openings: list[dict[str, Any]] = el.get("openings") or []
    if not openings:
        return el

    original_area = float(el.get("area") or 0.0)
    total_deduction = 0.0
    notes: list[str] = el["deduction_notes"]

    for op in openings:
        op_area = float(op.get("area") or 0.0)
        if op_area > _NRM2_OPENING_THRESHOLD_M2:
            total_deduction += op_area
            notes.append(
                f"NRM2: deducted opening '{op.get('id', '?')}' "
                f"({op_area:.2f} m² > {_NRM2_OPENING_THRESHOLD_M2} m² threshold)"
            )
        else:
            notes.append(
                f"NRM2: opening '{op.get('id', '?')}' "
                f"({op_area:.2f} m²) not deducted — below threshold"
            )

    deducted_area = round(original_area - total_deduction, 2)
    el["area"] = max(0.0, deducted_area)
    el["deducted_area_m2"] = round(total_deduction, 2)
    el["deduction_notes"] = notes
    return el


def _deduct_beam_column_intersections(el: dict[str, Any]) -> dict[str, Any]:
    """NRM2 stub: deduct beam volume at column intersections.

    TODO: implement when intersection geometry data is available.
    Currently records a note and performs no deduction.
    """
    el["deduction_notes"].append(
        "NRM2: beam-column intersection deduction not applied (stub)"
    )
    return el


def _deduct_slab_openings(el: dict[str, Any]) -> dict[str, Any]:
    """NRM2 stub: deduct void areas from slabs.

    TODO: implement when void / opening data for slabs is modelled.
    Currently records a note and performs no deduction.
    """
    el["deduction_notes"].append(
        "NRM2: slab void deduction not applied (stub)"
    )
    return el
