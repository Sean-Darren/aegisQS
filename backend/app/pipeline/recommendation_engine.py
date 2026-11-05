from __future__ import annotations

import uuid
from typing import Any


class RecommendationEngine:
    """Generate deterministic recommendations from assessment reports, BOQs, and estimates."""

    _REC_CATEGORIES = ("COST_SAVING", "QUALITY_IMPROVEMENT", "RISK_MITIGATION", "EFFICIENCY")

    @staticmethod
    def generate_recommendations(
        assessment_report: dict[str, Any],
        boq: dict[str, Any] | None = None,
        estimate: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        """Return a list of actionable recommendations."""
        recommendations: list[dict[str, Any]] = []

        issues: list[dict[str, Any]] = assessment_report.get("issues", [])
        category_scores: dict[str, float] = assessment_report.get("category_scores", {})
        overall_score: float = assessment_report.get("overall_score", 100.0)

        # --- Generic materials ---
        generic_material_issues = [
            i for i in issues
            if ("generic" in str(i.get("message", "")).lower()
                or "missing material" in str(i.get("message", "")).lower()
                or i.get("category") == "Materials")
        ]
        if generic_material_issues:
            recommendations.append(RecommendationEngine._make_rec(
                "QUALITY_IMPROVEMENT",
                "Resolve Generic or Missing Material Specifications",
                f"{len(generic_material_issues)} element(s) have generic or missing material specifications. "
                "This impacts quantity take-off accuracy, procurement, and cost certainty.",
                "HIGH",
                [
                    "Identify all elements with generic or missing material assignments.",
                    "Coordinate with the design team to assign correct material specifications.",
                    "Re-run the material mapping pass after updating the BIM model.",
                    "Validate against the project material schedule.",
                ],
            ))

        # --- Missing levels ---
        missing_level_issues = [
            i for i in issues
            if "missing level" in str(i.get("message", "")).lower()
        ]
        if missing_level_issues:
            recommendations.append(RecommendationEngine._make_rec(
                "QUALITY_IMPROVEMENT",
                "Assign Missing Level Information",
                f"{len(missing_level_issues)} element(s) are missing level assignments. "
                "This prevents accurate work-package allocation and phase planning.",
                "HIGH",

                [
                    "Audit all elements without level assignments in the BIM model.",
                    "Assign the correct building level to each element.",
                    "Re-export the model and re-run the readiness assessment.",
                    "Confirm work-package allocations after levels are populated.",
                ],
            ))

        # --- Zero volume elements ---
        zero_volume_issues = [
            i for i in issues
            if "zero" in str(i.get("message", "")).lower()
            and ("volume" in str(i.get("message", "")).lower()
                 or "area" in str(i.get("message", "")).lower())
        ]
        if zero_volume_issues:
            recommendations.append(RecommendationEngine._make_rec(
                "RISK_MITIGATION",
                "Fix Zero-Volume or Zero-Area Elements",
                f"{len(zero_volume_issues)} element(s) have zero or negative volume/area. "
                "Quantities cannot be calculated, creating significant cost risk.",
                "HIGH",
                [
                    "Locate all zero-volume elements in the BIM model.",
                    "Verify geometry in the authoring tool and correct modelling errors.",
                    "Re-measure quantities after geometry corrections.",
                    "Add a provisional sum for affected items until resolved.",
                ],
            ))

        # --- Unmapped BOQ items ---
        if boq:
            if isinstance(boq, list):
                boq_items = boq
            elif isinstance(boq, dict):
                boq_items = boq.get("boq_items", [])
            else:
                boq_items = []
            unmapped = [
                b for b in boq_items
                if b.get("confidence") in ("NO_MATCH", "ESTIMATED", "UNMAPPED")
            ]
            if unmapped:
                recommendations.append(RecommendationEngine._make_rec(
                    "COST_SAVING",
                    "Map Unmatched BOQ Items to Price Book",
                    f"{len(unmapped)} BOQ item(s) could not be matched to a price book entry. "
                    "Unpriced items represent cost uncertainty.",
                    "HIGH",
                    [
                        "Review BOQ items with NO_MATCH or ESTIMATED confidence.",
                        "Add missing entries to the price book or adjust item descriptions.",
                        "Re-run the unit-rate pricing pass.",
                        "Consider obtaining quotes for specialist items not in the price book.",
                    ],
                ))

        # --- High contingency ---
        if estimate:
            contingency = estimate.get("contingency", {})
            if isinstance(contingency, dict):
                pct = contingency.get("percentage", 0.0)
            else:
                pct = float(contingency) if contingency else 0.0
            if pct >= 15.0:
                recommendations.append(RecommendationEngine._make_rec(
                    "COST_SAVING",
                    "Reduce High Contingency Allowance",
                    f"The contingency is {pct}%, which is above the standard range. "
                    "High contingency may indicate unresolved scope or measurement uncertainty.",
                    "MEDIUM",
                    [
                        "Identify the root causes driving the high contingency.",
                        "Resolve outstanding readiness issues to reduce risk.",
                        "Consider a two-stage tender to refine pricing.",
                        "Review against benchmark projects of similar type and scale.",
                    ],
                ))

        # --- Repeated issues (same category appearing frequently) ---
        cat_counts: dict[str, int] = {}
        for i in issues:
            cat = i.get("category", "Unknown")
            cat_counts[cat] = cat_counts.get(cat, 0) + 1
        for cat, count in cat_counts.items():
            if count >= 5:
                recommendations.append(RecommendationEngine._make_rec(
                    "EFFICIENCY",
                    f"Address Recurring Issues in '{cat}'",
                    f"{count} issues are concentrated in the '{cat}' category. "
                    "A systemic fix may resolve many issues at once.",
                    "MEDIUM",
                    [
                        f"Review all {cat} issues for common root causes.",
                        "Implement a process or template change to prevent recurrence.",
                        "Train the modelling team on the identified issue pattern.",
                        "Add automated validation checks for this category.",
                    ],
                ))

        # --- Low overall score ---
        if overall_score < 50.0:
            recommendations.append(RecommendationEngine._make_rec(
                "RISK_MITIGATION",
                "Critical Model Quality — Comprehensive Remediation Required",
                f"The overall readiness score is {overall_score:.0f}/100. "
                "The model is not ready for quantity take-off or procurement.",
                "HIGH",
                [
                    "Escalate to project leadership — the model requires major rework.",
                    "Prioritise BLOCKER and HIGH-severity issues first.",
                    "Consider engaging a BIM consultant for model remediation.",
                    "Re-baseline the programme to account for rework time.",
                ],
            ))

        # If no specific recommendations, add a positive one
        if not recommendations:
            recommendations.append(RecommendationEngine._make_rec(
                "EFFICIENCY",
                "Model is Ready — Proceed to Next Stage",
                "No significant issues detected. The model meets readiness criteria "
                "for quantity take-off and cost estimation.",
                "LOW",
                [
                    "Proceed with BOQ generation.",
                    "Lock the model for this design stage.",
                    "Communicate readiness status to the commercial team.",
                ],
            ))

        return recommendations

    @staticmethod
    def _make_rec(
        category: str,
        title: str,
        description: str,
        priority: str,
        action_steps: list[str],
    ) -> dict[str, Any]:
        """Build a recommendation dict with a unique ID."""
        return {
            "recommendation_id": str(uuid.uuid4()),
            "category": category,
            "title": title,
            "description": description,
            "estimated_impact": RecommendationEngine._impact_from_priority(priority),
            "priority": priority,
            "action_steps": action_steps,
        }

    @staticmethod
    def _impact_from_priority(priority: str) -> str:
        """Map priority to a qualitative impact description."""
        mapping = {
            "HIGH": "Significant improvement to cost certainty and model quality.",
            "MEDIUM": "Moderate improvement; addresses known uncertainty areas.",
            "LOW": "Minor improvement; housekeeping or best-practice alignment.",
        }
        return mapping.get(priority, mapping["LOW"])
