from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from typing import Any


class AutoRemediationEngine:
    """Apply auto-fix suggestions to in-memory element data.

    Does NOT modify IFC or model files on disk.  All mutations happen on
    the engine's internal copies of the element dicts.
    """

    @staticmethod
    def apply_fixes(
        elements: list[dict[str, Any]],
        fixes: list[dict[str, Any]],
        approved_by: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Apply *fixes* to *elements* in memory, returning before/after data.

        Parameters
        ----------
        elements:
            Element dicts to mutate (copied first — originals are unchanged).
        fixes:
            List of fix dicts, each with at least element_id,
            fix_type, suggested_value, fix_instructions.
        approved_by:
            None → no fixes are applied (returns unchanged elements).
            A dict with actor metadata (e.g. name, role) →
            record the approval and apply fixes.

        Returns
        -------
        dict
            Keys: fixed_elements, failed_fixes, changes,
            approval_metadata.
        """
        # Work on a copy so the caller's originals are untouched
        fixed_elements = deepcopy(elements)

        # Build an index for O(1) element lookup by id
        element_index: dict[str, dict[str, Any]] = {
            str(el.get("id", "")): el for el in fixed_elements
        }

        changes: list[dict[str, Any]] = []
        failed_fixes: list[dict[str, Any]] = []

        now = datetime.now(timezone.utc).isoformat()

        # If no approver, do not apply any fix
        if approved_by is None:
            return {
                "fixed_elements": fixed_elements,
                "failed_fixes": [
                    {
                        **fix,
                        "reason": "No approval provided — fixes not applied.",
                    }
                    for fix in fixes
                ],
                "changes": [],
                "approval_metadata": {
                    "approved": False,
                    "reason": "approved_by is None — fixes require explicit approval.",
                    "timestamp": now,
                },
            }

        for fix in fixes:
            element_id = str(fix.get("element_id", ""))
            fix_type = str(fix.get("fix_type", ""))
            suggested_value = fix.get("suggested_value")
            fix_instructions = str(fix.get("fix_instructions", ""))

            el = element_index.get(element_id)
            if el is None:
                failed_fixes.append({
                    **fix,
                    "reason": f"Element '{element_id}' not found.",
                })
                continue

            if not fix.get("auto_fixable", False):
                failed_fixes.append({
                    **fix,
                    "reason": f"Fix type '{fix_type}' is not auto-fixable.",
                })
                continue

            # ----- Apply the fix based on type -----
            old_value: Any = None
            new_value: Any = None
            field: str | None = None

            if fix_type == "level_suggestion":
                field = "level"
                old_value = el.get("level")
                new_value = suggested_value
                if suggested_value is not None:
                    el["level"] = suggested_value

            elif fix_type == "material_suggestion":
                field = "material_name"
                old_value = el.get("material_name")
                new_value = suggested_value
                if suggested_value is not None:
                    el["material_name"] = suggested_value

            elif fix_type == "name_suggestion":
                field = "name"
                old_value = el.get("name")
                new_value = suggested_value
                if suggested_value is not None:
                    el["name"] = suggested_value

            elif fix_type == "geometry_fix":
                failed_fixes.append({
                    **fix,
                    "reason": "Geometry fixes cannot be auto-applied — requires manual correction in authoring tool.",
                })
                continue

            else:
                failed_fixes.append({
                    **fix,
                    "reason": f"Unknown fix type '{fix_type}'.",
                })
                continue

            # Record the change
            if field is not None:
                changes.append({
                    "element_id": element_id,
                    "field": field,
                    "fix_type": fix_type,
                    "old_value": old_value,
                    "new_value": new_value,
                    "timestamp": now,
                })

        return {
            "fixed_elements": fixed_elements,
            "failed_fixes": failed_fixes,
            "changes": changes,
            "approval_metadata": {
                "approved": True,
                "approved_by": deepcopy(approved_by),
                "timestamp": now,
                "total_fixes_requested": len(fixes),
                "total_fixes_applied": len(changes),
                "total_fixes_failed": len(failed_fixes),
            },
        }
