from __future__ import annotations

from typing import Any

# Category → (role, discipline, reason)
_CATEGORY_ASSIGNMENTS: dict[str, tuple[str, str, str]] = {}

def _init_assignments() -> None:
    """Populate the category-assignment lookup on first use."""
    if _CATEGORY_ASSIGNMENTS:
        return

    arch_cats = ["IfcWall", "IfcDoor", "IfcWindow", "IfcRoof",
                 "IfcWallStandardCase", "IfcCurtainWall"]
    struct_cats = ["IfcBeam", "IfcColumn", "IfcSlab", "IfcFooting",
                   "IfcPile", "IfcStair", "IfcStairFlight",
                   "IfcRamp", "IfcRampFlight", "IfcMember",
                   "IfcPlate", "IfcReinforcingBar", "IfcTendon"]
    mep_cats = ["IfcPipeSegment", "IfcDuctSegment", "IfcCableCarrierSegment",
                "IfcPipeFitting", "IfcDuctFitting", "IfcCableSegment",
                "IfcFlowSegment", "IfcFlowFitting", "IfcCableFitting",
                "IfcAirTerminal", "IfcDamper", "IfcValve", "IfcPump",
                "IfcBoiler", "IfcChiller", "IfcCoolingTower",
                "IfcElectricMotor", "IfcTransformer"]

    for cat in arch_cats:
        _CATEGORY_ASSIGNMENTS[cat.lower()] = (
            "Architect",
            "Architecture",
            f"Architectural element ({cat})",
        )
    for cat in struct_cats:
        _CATEGORY_ASSIGNMENTS[cat.lower()] = (
            "Structural Engineer",
            "Structural",
            f"Structural element ({cat})",
        )
    for cat in mep_cats:
        _CATEGORY_ASSIGNMENTS[cat.lower()] = (
            "MEP Coordinator",
            "MEP",
            f"MEP element ({cat})",
        )

# Severity → priority
_SEVERITY_PRIORITY: dict[str, str] = {
    "BLOCKER": "URGENT",
    "HIGH":    "HIGH",
    "MEDIUM":  "NORMAL",
    "LOW":     "LOW",
}


class IssueAssigner:
    """Assign readiness issues to roles and disciplines based on element type."""

    @staticmethod
    def assign_issue(
        issue: dict[str, Any],
        element: dict[str, Any],
    ) -> dict[str, str]:
        """Return an assignment dict for *issue* given its *element*.

        Parameters
        ----------
        issue:
            Issue dict with at least ``"severity"``.
        element:
            Element dict with at least ``"category"``.

        Returns
        -------
        dict
            ``{"assigned_role": str, "assigned_discipline": str,
            "assignment_reason": str, "priority": str}``
        """
        _init_assignments()

        category = str(element.get("category") or "").strip()
        severity = str(issue.get("severity") or "LOW").strip().upper()

        role, discipline, reason = _CATEGORY_ASSIGNMENTS.get(
            category.lower(),
            ("BIM Coordinator", "BIM Management", f"Unrecognized category ({category})"),
        )

        priority = _SEVERITY_PRIORITY.get(severity, "LOW")

        return {
            "assigned_role": role,
            "assigned_discipline": discipline,
            "assignment_reason": reason,
            "priority": priority,
        }
