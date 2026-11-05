from __future__ import annotations

from typing import Any


class AutoApprovalWorkflow:
    """Deterministic decision engine that evaluates whether a model
    assessment can proceed to pricing automatically or requires manual review.

    No authentication, no digital signatures — pure business logic.
    """

    @staticmethod
    def evaluate_for_auto_approval(assessment: dict[str, Any]) -> dict[str, Any]:
        """Return an auto-approval decision for *assessment*.

        Parameters
        ----------
        assessment:
            Dict with keys gate_state (str) and overall_score (float).

        Returns
        -------
        dict
            Keys: auto_approved, approval_reason, next_step,
            conditions.
        """
        gate = str(assessment.get("gate_state", "")).upper().strip()
        score = float(assessment.get("overall_score", 0.0))

        # ---- NOT_READY → BLOCK ----
        if gate == "NOT_READY":
            return {
                "auto_approved": False,
                "approval_reason": (
                    f"Gate is NOT_READY (score {score:.1f}/100).  "
                    "BLOCKER-level issues exist that prevent reliable quantity "
                    "take-off and pricing."
                ),
                "next_step": "BLOCK_PRICING",
                "conditions": [
                    "Resolve all BLOCKER-severity issues before re-assessment.",
                    "Ensure no element has zero/negative volume or missing critical classification.",
                    "Re-run the readiness assessment after model corrections.",
                ],
            }

        # ---- CONDITIONAL → manual review ----
        if gate == "CONDITIONAL":
            if score >= 75.0:
                reason = (
                    f"Gate is CONDITIONAL with a strong score ({score:.1f}/100).  "
                    "Risk acceptance is required before pricing can commence."
                )
            else:
                reason = (
                    f"Gate is CONDITIONAL with a marginal score ({score:.1f}/100).  "
                    "Significant issues remain — manual QS review is required."
                )

            return {
                "auto_approved": False,
                "approval_reason": reason,
                "next_step": "MANUAL_QS_REVIEW",
                "conditions": [
                    "Risk acceptance required before pricing.",
                    "Review all HIGH-severity issues and accept or resolve each one.",
                    "Confirm material mappings for all elements with FUZZY or NO_MATCH confidence.",
                    "Validate quantities against design-stage benchmarks.",
                ],
            }

        # ---- READY → auto-approve if score >= 90 ----
        if gate == "READY":
            if score >= 90.0:
                return {
                    "auto_approved": True,
                    "approval_reason": (
                        f"Gate is READY with an excellent score ({score:.1f}/100).  "
                        "Model meets all readiness criteria for pricing."
                    ),
                    "next_step": "PROCEED_TO_PRICING",
                    "conditions": [
                        "Lock the model version for this pricing exercise.",
                        "Generate BOQ from the approved model snapshot.",
                        "Notify the commercial team that pricing can commence.",
                    ],
                }
            else:
                return {
                    "auto_approved": False,
                    "approval_reason": (
                        f"Gate is READY but score ({score:.1f}/100) is below the "
                        "auto-approval threshold (90).  Manual review recommended."
                    ),
                    "next_step": "MANUAL_QS_REVIEW",
                    "conditions": [
                        "Review remaining MEDIUM/LOW issues for completeness.",
                        "Consider accepting low-risk issues to proceed.",
                        "Re-run assessment — a score ≥ 90 is eligible for auto-approval.",
                    ],
                }

        # ---- Unknown gate → block (safe default) ----
        return {
            "auto_approved": False,
            "approval_reason": f"Unknown gate state '{gate}'. Cannot determine readiness.",
            "next_step": "BLOCK_PRICING",
            "conditions": [
                "Run the readiness assessment to obtain a valid gate state.",
                "Verify that the assessment report was generated correctly.",
            ],
        }
