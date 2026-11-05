from __future__ import annotations

from collections import defaultdict
from typing import Any

from models import MaterialFamily, MaterialSpec

# When a MaterialSpec specifies a unit, pick the matching quantity field.
_UNIT_TO_QUANTITY_KEY: dict[str, str] = {
    "m3": "volume",
    "m²": "area",
    "m2": "area",
    "m":  "length",
    "kg": "volume",   # best proxy without density data
    "t":  "volume",
}
_FALLBACK_QUANTITY_KEY = "volume"


class MaterialScheduleGenerator:
    """Generate a consolidated material schedule from elements and specs."""

    @staticmethod
    def generate_schedule(
        elements: list[dict[str, Any]],
        material_mappings: dict[str, MaterialSpec],
        group_by: str = "spec_id",
    ) -> list[dict[str, Any]] | dict[str, list[dict[str, Any]]]:
        """Return a material schedule grouped by spec, family, or both.

        ``group_by`` may be:

        * ``"spec_id"`` — the default, one row per mapped spec.
        * ``"family"`` — aggregate quantities by :class:`MaterialFamily`.
        * ``"both"`` — a dictionary containing both ``"by_spec_id"`` and
          ``"by_family"`` schedules.
        """
        if group_by == "family":
            return MaterialScheduleGenerator.generate_family_summary(
                elements, material_mappings
            )
        if group_by == "both":
            return {
                "by_spec_id": MaterialScheduleGenerator._generate_spec_schedule(
                    elements, material_mappings
                ),
                "by_family": MaterialScheduleGenerator.generate_family_summary(
                    elements, material_mappings
                ),
            }
        if group_by != "spec_id":
            raise ValueError(
                f"Unknown material schedule grouping: {group_by!r}"
            )
        return MaterialScheduleGenerator._generate_spec_schedule(
            elements, material_mappings
        )

    @staticmethod
    def _generate_spec_schedule(
        elements: list[dict[str, Any]],
        material_mappings: dict[str, MaterialSpec],
    ) -> list[dict[str, Any]]:
        """Build the default per-spec material schedule.

        Parameters
        ----------
        elements:
            Element dicts with at least ``"id"``, ``"category"``,
            ``"volume"``, ``"area"``, ``"length"``, and optionally
            ``"material_name"``.
        material_mappings:
            Mapping of ``element_id`` → :class:`MaterialSpec` (from
            :class:`ReadinessEngine`).  Elements not present here are
            still included but lack a spec reference.
        """
        # Group buckets: material_key → {spec, elements list, unit}
        groups: dict[str, dict[str, Any]] = {}

        for el in elements:
            el_id = el.get("id", "")
            spec = material_mappings.get(el_id)

            if spec is not None:
                material_key = spec.id
                material_name = spec.name
                unit = spec.unit or "m3"
                material_family = spec.material_family
            else:
                material_key = f"__unmapped__{el.get('material_name', 'Unknown')}"
                material_name = el.get("material_name") or "Unknown"
                unit = "m3"
                material_family = MaterialFamily.OTHER

            qty_key = _UNIT_TO_QUANTITY_KEY.get(unit.lower(), _FALLBACK_QUANTITY_KEY)
            qty = float(el.get(qty_key) or 0.0)
            category = str(el.get("category") or "Unknown")

            if material_key not in groups:
                groups[material_key] = {
                    "material_id": spec.id if spec else None,
                    "material_name": material_name,
                    "spec_reference": spec.id if spec else None,
                    "material_family": material_family,
                    "unit": unit,
                    "total_quantity": 0.0,
                    "element_count": 0,
                    "element_types": set(),
                }

            g = groups[material_key]
            g["total_quantity"] += qty
            g["element_count"] += 1
            g["element_types"].add(category)

        # Build result list
        schedule: list[dict[str, Any]] = []
        for g in groups.values():
            schedule.append(
                {
                    "material_id": g["material_id"],
                    "material_name": g["material_name"],
                    "spec_reference": g["spec_reference"],
                    "material_family": g["material_family"].value,
                    "family": g["material_family"].value,
                    "total_quantity": round(g["total_quantity"], 2),
                    "unit": g["unit"],
                    "element_count": g["element_count"],
                    "element_types": sorted(g["element_types"]),
                }
            )

        # Sort by total_quantity descending
        schedule.sort(key=lambda e: e["total_quantity"], reverse=True)
        return schedule

    @staticmethod
    def generate_family_summary(
        elements: list[dict[str, Any]],
        material_mappings: dict[str, MaterialSpec],
    ) -> list[dict[str, Any]]:
        """Aggregate the material schedule up to material-family level.

        Returns a list of family summaries sorted by total quantity
        descending.  Each summary contains:

        ``family``, ``total_quantity``, ``unit``, ``element_count``,
        ``element_types``, and ``materials`` (unique material names).
        """
        family_groups: dict[MaterialFamily, dict[str, Any]] = {}

        for el in elements:
            el_id = el.get("id", "")
            spec = material_mappings.get(el_id)

            # Prefer the element-level classification (when the readiness
            # engine has stored one), then fall back to the mapped spec.
            classification = (
                el.get("properties", {}).get("material_classification", {})
                if isinstance(el.get("properties"), dict)
                else {}
            )
            family_value = classification.get("family")
            if family_value is not None:
                family = MaterialFamily(str(family_value))
            elif spec is not None:
                family = spec.material_family
            else:
                family = MaterialFamily.OTHER

            unit = spec.unit if spec is not None else "m3"
            if not unit:
                unit = "m3"

            qty_key = _UNIT_TO_QUANTITY_KEY.get(unit.lower(), _FALLBACK_QUANTITY_KEY)
            qty = float(el.get(qty_key) or 0.0)
            category = str(el.get("category") or "Unknown")
            material_name = (
                spec.name if spec is not None
                else el.get("material_name") or "Unknown"
            )

            group = family_groups.setdefault(family, {
                "family": family,
                "total_quantity": 0.0,
                "unit": unit,
                "element_count": 0,
                "element_types": set(),
                "materials": set(),
            })

            group["total_quantity"] += qty
            group["unit"] = unit
            group["element_count"] += 1
            group["element_types"].add(category)
            group["materials"].add(material_name)

        summary: list[dict[str, Any]] = []
        for group in family_groups.values():
            summary.append({
                "family": group["family"].value,
                "total_quantity": round(group["total_quantity"], 2),
                "unit": group["unit"],
                "element_count": group["element_count"],
                "element_types": sorted(group["element_types"]),
                "materials": sorted(group["materials"]),
            })

        summary.sort(key=lambda e: e["total_quantity"], reverse=True)
        return summary
