from __future__ import annotations

from typing import Any


class ModelQueryEngine:
    """Keyword-based query engine for BIM elements.

    Supports natural-language-like queries parsed via keyword matching:
    - "concrete walls"
    - "beams on Level 2"
    - "materials used in roof"
    - "elements with generic material"
    - "zero volume elements"
    """

    @staticmethod
    def query_elements(query: str, elements: list[dict[str, Any]]) -> dict[str, Any]:
        """Parse *query* and return matching elements with filter metadata."""
        query_lower = query.lower().strip()
        filters_detected: list[str] = []
        results = list(elements)

        # --- Category / type filters ---
        category_map: dict[str, list[str]] = {
            "wall": ["ifcwall", "ifcwallstandardcase", "wall"],
            "beam": ["ifcbeam", "beam"],
            "column": ["ifccolumn", "column"],
            "slab": ["ifcslab", "slab", "floor"],
            "roof": ["ifcroof", "roof"],
            "door": ["ifcdoor", "door"],
            "window": ["ifcwindow", "window"],
            "pipe": ["ifcpipesegment", "ifcpipefitting", "pipe"],
            "duct": ["ifcductsegment", "duct"],
            "footing": ["ifcfooting", "footing", "foundation"],
            "stair": ["ifcstair", "ifcstairflight", "stair"],
            "railing": ["ifcrailing", "railing"],
        }

        matched_categories: list[str] = []
        for keyword, cats in category_map.items():
            if keyword in query_lower:
                matched_categories.extend(cats)
                if keyword not in filters_detected:
                    filters_detected.append(f"category:{keyword}")

        if matched_categories:
            results = [
                e for e in results
                if str(e.get("category", "")).lower().replace(" ", "") in matched_categories
            ]

        # --- Material filters ---
        material_keywords = ["concrete", "steel", "timber", "wood", "aluminium", "aluminum",
                             "glass", "brick", "block", "plaster", "insulation", "masonry"]
        for mat in material_keywords:
            if mat in query_lower:
                filters_detected.append(f"material:{mat}")
                results = [
                    e for e in results
                    if mat in str(e.get("material_name", "")).lower()
                ]

        # --- Generic material ---
        if "generic material" in query_lower or "generic" in query_lower.split():
            filters_detected.append("material:generic")
            generic_names = {"", "default", "unnamed", "generic", "unknown", "none", None}
            results = [
                e for e in results
                if (e.get("material_name") or "").strip().lower() in generic_names
            ]

        # --- Zero volume ---
        if "zero volume" in query_lower:
            filters_detected.append("volume:zero")
            results = [
                e for e in results
                if float(e.get("volume", 0.0)) <= 0.0
            ]

        # --- Level filter ---
        import re
        level_match = re.search(r'on (level|l)\s*(\d+)', query_lower)
        if level_match:
            level_num = level_match.group(2)
            level_str = f"level {level_num}"
            filters_detected.append(f"level:{level_str}")
            results = [
                e for e in results
                if str(e.get("level", "")).lower().replace(" ", "") == level_str.replace(" ", "")
            ]

        # --- Materials used in ---
        if "materials used" in query_lower or "materials in" in query_lower:
            filters_detected.append("output:materials")

        # Build summary
        result_count = len(results)
        if result_count == 0:
            summary = f"No elements matched query: '{query}'."
        else:
            summary = f"Found {result_count} element(s) matching '{query}'."
            if filters_detected:
                summary += f" Filters applied: {', '.join(filters_detected)}."

        return {
            "query": query,
            "filters_detected": filters_detected,
            "results": results,
            "result_count": result_count,
            "summary": summary,
        }
