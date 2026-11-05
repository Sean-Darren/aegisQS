from __future__ import annotations

from typing import Any


class AutoFixSuggester:
    """Generate fix suggestions for BIM readiness issues.

    Does NOT modify any model files — only produces structured suggestions
    that a downstream tool or human can apply.
    """

    # Mapping of element category → typical level assignment pattern
    _CATEGORY_LEVEL_HINTS: dict[str, str] = {
        "IfcFooting": "Foundation",
        "IfcFoundation": "Foundation",
        "IfcPile": "Foundation",
        "IfcSlab": "Level 0",
        "IfcWall": "Level 0",
        "IfcColumn": "Level 0",
        "IfcBeam": "Level 1",
        "IfcRoof": "Roof",
        "IfcStair": "Level 0",
        "IfcRailing": "Level 0",
        "IfcDoor": "Level 0",
        "IfcWindow": "Level 0",
        "IfcPipeSegment": "Level 0",
        "IfcDuctSegment": "Level 0",
        "IfcCableCarrierSegment": "Level 0",
    }

    # Recognised material patterns for fuzzy matching suggestions
    _KNOWN_MATERIALS: list[dict[str, Any]] = [
        {"name": "Concrete C32/40", "keywords": ["concrete", "c32", "c40", "reinforced concrete", "rc"]},
        {"name": "Concrete C25/30", "keywords": ["concrete", "c25", "c30"]},
        {"name": "Steel S355", "keywords": ["steel", "s355", "structural steel"]},
        {"name": "Steel S275", "keywords": ["steel", "s275", "mild steel"]},
        {"name": "Reinforcement B500B", "keywords": ["rebar", "reinforcement", "b500", "steel bar"]},
        {"name": "Blockwork", "keywords": ["block", "blockwork", "cmu", "concrete block", "masonry"]},
        {"name": "Brick", "keywords": ["brick", "clay brick", "facing brick", "engineering brick"]},
        {"name": "Plaster", "keywords": ["plaster", "plastering", "render", "gypsum"]},
        {"name": "Insulation", "keywords": ["insulation", "pir", "mineral wool", "eps", "xps"]},
        {"name": "Timber C24", "keywords": ["timber", "c24", "wood", "softwood"]},
        {"name": "Glazing", "keywords": ["glass", "glazing", "double glazed", "triple glazed"]},
        {"name": "Aluminium", "keywords": ["aluminium", "aluminum", "aluminium alloy"]},
    ]

    @staticmethod
    def generate_fix(issue: dict[str, Any], element: dict[str, Any]) -> dict[str, Any]:
        """Analyse an issue + element and return a fix suggestion.

        Parameters
        ----------
        issue:
            Dict with at least category, message, severity.
        element:
            Dict with at least id, category, material_name,
            level, volume.

        Returns
        -------
        dict
            Fields: fix_type, fix_instructions, suggested_value,
            confidence (0.0–1.0), auto_fixable (bool).
        """
        message_lower = str(issue.get("message", "")).lower()
        category = str(issue.get("category", ""))

        # --- Material-related issues ---

        # Missing material specification
        if "missing material" in message_lower or category == "Materials":
            mat_name = str(element.get("material_name") or "").strip()
            # Try to infer from element properties
            inferred = AutoFixSuggester._infer_material(element)
            if inferred:
                return AutoFixSuggester._build_result(
                    "material_suggestion",
                    f"Assign material '{inferred['name']}' to element {element.get('id')}.",
                    inferred["name"],
                    min(inferred["confidence"], 0.85),
                    True,
                )
            else:
                return AutoFixSuggester._build_result(
                    "material_suggestion",
                    f"No material assigned to element {element.get('id')}. "
                    "Review the model in the authoring tool and assign a material.",
                    None,
                    0.0,
                    False,
                )

        # Generic material
        if "missing element name" in message_lower or "name" in message_lower:
            cat = str(element.get("category", ""))
            suggested_name = AutoFixSuggester._suggest_name(element)
            return AutoFixSuggester._build_result(
                "name_suggestion",
                f"Assign a meaningful name to element {element.get('id')} "
                f"(currently '{element.get('name')}').",
                suggested_name,
                0.7,
                True,
            )

        # Missing level
        if "missing level" in message_lower or "level" in message_lower:
            cat = str(element.get("category", ""))
            suggested_level = AutoFixSuggester._suggest_level(element)
            return AutoFixSuggester._build_result(
                "level_suggestion",
                f"Assign level '{suggested_level}' to element {element.get('id')} "
                f"(category: {cat}).",
                suggested_level,
                0.6,
                True,
            )

        # Zero / negative volume or area
        if ("zero" in message_lower or "negative" in message_lower) and            ("volume" in message_lower or "area" in message_lower):
            return AutoFixSuggester._build_result(
                "geometry_fix",
                f"Element {element.get('id')} has invalid geometry. "
                "This cannot be auto-fixed — the geometry must be corrected in the authoring tool.",
                None,
                0.0,
                False,
            )

        # Unrecognized material
        if "unrecognized" in message_lower or "no_match" in message_lower            or "unmapped" in message_lower:
            mat_name = str(element.get("material_name") or "").strip()
            closest = AutoFixSuggester._find_closest_material(mat_name)
            if closest:
                return AutoFixSuggester._build_result(
                    "material_suggestion",
                    f"Replace unrecognized material '{mat_name}' with '{closest['name']}' "
                    f"for element {element.get('id')}.",
                    closest["name"],
                    closest["confidence"],
                    True,
                )
            else:
                return AutoFixSuggester._build_result(
                    "material_suggestion",
                    f"Material '{mat_name}' is not recognized. "
                    "Register it in the material specification library or assign a known material.",
                    None,
                    0.0,
                    False,
                )

        # Generic fallback
        return AutoFixSuggester._build_result(
            "manual_review",
            f"Issue '{issue.get('message')}' on element {element.get('id')} "
            "requires manual review — no automated suggestion available.",
            None,
            0.0,
            False,
        )

    # ------------------------------------------------------------------
    # internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _build_result(
        fix_type: str,
        instructions: str,
        suggested_value: Any,
        confidence: float,
        auto_fixable: bool,
    ) -> dict[str, Any]:
        return {
            "fix_type": fix_type,
            "fix_instructions": instructions,
            "suggested_value": suggested_value,
            "confidence": round(confidence, 2),
            "auto_fixable": auto_fixable,
        }

    @staticmethod
    def _infer_material(element: dict[str, Any]) -> dict[str, Any] | None:
        """Try to infer a material from element category and properties."""
        cat = str(element.get("category", "")).lower()

        if "wall" in cat:
            return {"name": "Blockwork", "confidence": 0.4}
        if "beam" in cat or "column" in cat:
            return {"name": "Concrete C32/40", "confidence": 0.4}
        if "slab" in cat:
            return {"name": "Concrete C32/40", "confidence": 0.4}
        if "roof" in cat:
            return {"name": "Timber C24", "confidence": 0.3}
        if "pipe" in cat:
            return {"name": "Copper", "confidence": 0.3}
        if "duct" in cat:
            return {"name": "Galvanised Steel", "confidence": 0.3}
        if "door" in cat or "window" in cat:
            return {"name": "Aluminium", "confidence": 0.3}
        if "stair" in cat:
            return {"name": "Concrete C32/40", "confidence": 0.3}
        if "footing" in cat or "foundation" in cat or "pile" in cat:
            return {"name": "Concrete C32/40", "confidence": 0.5}

        return None

    @staticmethod
    def _suggest_level(element: dict[str, Any]) -> str:
        """Suggest the most common level for the element type."""
        cat = str(element.get("category", ""))
        return AutoFixSuggester._CATEGORY_LEVEL_HINTS.get(cat, "Level 0")

    @staticmethod
    def _suggest_name(element: dict[str, Any]) -> str:
        """Generate a readable name from element metadata."""
        cat = str(element.get("category", "Element")).replace("Ifc", "")
        eid = str(element.get("id", "?"))
        level = str(element.get("level") or "")
        if level:
            return f"{cat}_{level}_{eid}"
        return f"{cat}_{eid}"

    @staticmethod
    def _levenshtein_distance(s1: str, s2: str) -> int:
        """Standard DP Levenshtein distance."""
        if len(s1) < len(s2):
            return AutoFixSuggester._levenshtein_distance(s2, s1)
        if len(s2) == 0:
            return len(s1)
        prev = list(range(len(s2) + 1))
        for i, c1 in enumerate(s1):
            curr = [i + 1]
            for j, c2 in enumerate(s2):
                insert = prev[j + 1] + 1
                delete = curr[j] + 1
                sub = prev[j] + (0 if c1 == c2 else 1)
                curr.append(min(insert, delete, sub))
            prev = curr
        return prev[-1]

    @staticmethod
    def _normalize(text: str) -> str:
        """Lowercase, strip non-alphanumeric, collapse spaces."""
        import re
        return re.sub(r"[^a-z0-9 ]", "", text.lower().strip()).strip()

    @staticmethod
    def _find_closest_material(material_name: str) -> dict[str, Any] | None:
        """Find the closest known material using keyword and fuzzy matching."""
        if not material_name or not material_name.strip():
            return None

        norm_name = AutoFixSuggester._normalize(material_name)

        best_match = None
        best_score = 999999

        for mat in AutoFixSuggester._KNOWN_MATERIALS:
            # Check keyword matches
            for kw in mat["keywords"]:
                if kw in norm_name:
                    # Keyword match — high confidence
                    return {"name": mat["name"], "confidence": 0.9}

            # Levenshtein on the material name
            norm_mat = AutoFixSuggester._normalize(mat["name"])
            dist = AutoFixSuggester._levenshtein_distance(norm_name, norm_mat)
            if dist < best_score:
                best_score = dist
                best_match = mat

        if best_match and best_score <= 5:
            confidence = max(0.1, 1.0 - (best_score / max(len(norm_name), 1)))
            return {"name": best_match["name"], "confidence": round(confidence, 2)}

        return None
