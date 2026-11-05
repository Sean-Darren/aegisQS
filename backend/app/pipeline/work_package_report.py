from __future__ import annotations

from collections import defaultdict
from typing import Any

# Default unit rates for value estimation (fallback when no cost data).
_DEFAULT_RATES: dict[str, dict[str, Any]] = {
    "IfcWall":    {"unit": "m²", "rate": 45.0},
    "IfcSlab":    {"unit": "m²", "rate": 65.0},
    "IfcFloor":   {"unit": "m²", "rate": 65.0},
    "IfcRoof":    {"unit": "m²", "rate": 55.0},
    "IfcBeam":    {"unit": "m³", "rate": 250.0},
    "IfcColumn":  {"unit": "m³", "rate": 280.0},
    "IfcFooting": {"unit": "m³", "rate": 180.0},
    "IfcPile":    {"unit": "m³", "rate": 200.0},
    "IfcStair":   {"unit": "m³", "rate": 300.0},
    "IfcDoor":    {"unit": "count", "rate": 800.0},
    "IfcWindow":  {"unit": "count", "rate": 600.0},
}
_FALLBACK_RATE = 100.0  # $/m³


class WorkPackageReportGenerator:
    """Generate enriched work-package reports with breakdowns and value estimates."""

    @staticmethod
    def generate_report(
        assignments: dict[str, str],
        elements: list[dict[str, Any]],
        summaries: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """Return one report dict per work package.

        Parameters
        ----------
        assignments:
            ``{element_id: wp_id}`` from :class:`WorkPackageAssigner`.
        elements:
            Element dicts with at least ``"id"``, ``"category"``,
            ``"volume"``, ``"area"``, and optionally ``"material_name"``,
            ``"unit_cost"``.
        summaries:
            ``work_package_summaries`` list from
            :class:`WorkPackageAssigner.assign_work_packages`.
        """
        # Build element lookup
        el_by_id: dict[str, dict[str, Any]] = {el["id"]: el for el in elements if "id" in el}

        # Group element IDs by WP
        wp_elements: dict[str, list[str]] = defaultdict(list)
        for el_id, wp_id in assignments.items():
            wp_elements[wp_id].append(el_id)

        # Build a lookup for WP name
        wp_name: dict[str, str] = {s["wp_id"]: s.get("name", s["wp_id"]) for s in summaries}

        reports: list[dict[str, Any]] = []

        for wp_id, el_ids in wp_elements.items():
            total_volume = 0.0
            total_area = 0.0
            element_breakdown: dict[str, int] = defaultdict(int)
            material_breakdown: dict[str, dict[str, Any]] = defaultdict(
                lambda: {"count": 0, "volume_m3": 0.0, "area_m2": 0.0}
            )
            estimated_value = 0.0

            for el_id in el_ids:
                el = el_by_id.get(el_id)
                if el is None:
                    continue

                cat = str(el.get("category") or "Unknown")
                vol = float(el.get("volume") or 0.0)
                area = float(el.get("area") or 0.0)
                mat = str(el.get("material_name") or "Unspecified")
                unit_cost = el.get("unit_cost")

                total_volume += vol
                total_area += area
                element_breakdown[cat] += 1

                mb = material_breakdown[mat]
                mb["count"] += 1
                mb["volume_m3"] += vol
                mb["area_m2"] += area

                # Estimate value
                if unit_cost is not None:
                    try:
                        # unit_cost per m³ (or whatever the element's primary unit is)
                        estimated_value += float(unit_cost) * max(vol, area, 1.0)
                    except (TypeError, ValueError):
                        pass
                else:
                    rate_info = _DEFAULT_RATES.get(cat)
                    if rate_info:
                        unit = rate_info["unit"]
                        rate = rate_info["rate"]
                        if unit == "m²":
                            estimated_value += area * rate
                        elif unit == "count":
                            estimated_value += rate
                        else:  # m³ fallback
                            estimated_value += vol * rate
                    else:
                        estimated_value += vol * _FALLBACK_RATE

            # Build sorted breakdowns
            sorted_element_bd = dict(
                sorted(element_breakdown.items(), key=lambda kv: kv[1], reverse=True)
            )
            sorted_material_bd = {
                mat: {
                    "count": d["count"],
                    "volume_m3": round(d["volume_m3"], 2),
                    "area_m2": round(d["area_m2"], 2),
                }
                for mat, d in sorted(
                    material_breakdown.items(),
                    key=lambda kv: kv[1]["volume_m3"],
                    reverse=True,
                )
            }

            reports.append(
                {
                    "id": wp_id,
                    "name": wp_name.get(wp_id, wp_id),
                    "element_count": len(el_ids),
                    "total_volume_m3": round(total_volume, 2),
                    "total_area_m2": round(total_area, 2),
                    "element_breakdown": sorted_element_bd,
                    "material_breakdown": sorted_material_bd,
                    "estimated_value": round(estimated_value, 2),
                }
            )

        # Sort reports by WP id for stable output
        reports.sort(key=lambda r: r["id"])
        return reports
