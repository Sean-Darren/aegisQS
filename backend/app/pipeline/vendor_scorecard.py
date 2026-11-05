from __future__ import annotations

from typing import Any


_GRADE_THRESHOLDS: list[tuple[float, str]] = [
    (90, "A"),
    (80, "B"),
    (70, "C"),
    (60, "D"),
]


class VendorScorecardGenerator:
    """Generate a quality scorecard for a vendor based on historical assessments."""

    @staticmethod
    def generate_scorecard(
        vendor_name: str, assessments: list[dict[str, Any]]
    ) -> dict[str, Any]:
        """Produce a vendor scorecard from a list of assessments.

        Each assessment must contain at least ``"overall_score"``.
        """
        if not assessments:
            return {
                "vendor_name": vendor_name,
                "total_assessments": 0,
                "average_score": 0.0,
                "pass_rate": 0.0,
                "common_issues": [],
                "trend": "insufficient_data",
                "quality_grade": "N/A",
                "recommendations": ["No assessments available for analysis."],
            }

        scores = [a.get("overall_score", 0.0) for a in assessments]
        avg_score = sum(scores) / len(scores)

        # Pass rate: assessments with score >= 70
        passed = sum(1 for s in scores if s >= 70.0)
        pass_rate = round(passed / len(scores) * 100, 1)

        # Quality grade
        grade = "F"
        for threshold, letter in _GRADE_THRESHOLDS:
            if avg_score >= threshold:
                grade = letter
                break

        # Common issues
        issue_counter: dict[str, int] = {}
        for a in assessments:
            for issue in a.get("issues", []):
                cat = issue.get("category", "Unknown")
                issue_counter[cat] = issue_counter.get(cat, 0) + 1

        common_issue_items: list[dict[str, Any]] = [
            {"category": k, "count": v} for k, v in issue_counter.items()
        ]
        common_issues = sorted(
            common_issue_items,
            key=lambda x: int(x["count"]),
            reverse=True,
        )[:5]

        # Trend: compare latest 3 vs previous 3
        trend = VendorScorecardGenerator._calculate_trend(scores)

        # Recommendations
        recommendations = VendorScorecardGenerator._build_recommendations(
            avg_score, grade, trend, common_issues, pass_rate
        )

        return {
            "vendor_name": vendor_name,
            "total_assessments": len(assessments),
            "average_score": round(avg_score, 1),
            "pass_rate": pass_rate,
            "common_issues": common_issues,
            "trend": trend,
            "quality_grade": grade,
            "recommendations": recommendations,
        }

    @staticmethod
    def _calculate_trend(scores: list[float]) -> str:
        """Compare the latest 3 scores to the previous 3 (if available)."""
        if len(scores) < 3:
            return "insufficient_data"

        latest = scores[-3:]
        previous = scores[-6:-3] if len(scores) >= 6 else scores[: max(0, len(scores) - 3)]

        if not previous:
            return "stable"

        latest_avg = sum(latest) / len(latest)
        prev_avg = sum(previous) / len(previous)

        if latest_avg > prev_avg + 5:
            return "improving"
        elif latest_avg < prev_avg - 5:
            return "declining"
        else:
            return "stable"

    @staticmethod
    def _build_recommendations(
        avg_score: float,
        grade: str,
        trend: str,
        common_issues: list[dict[str, Any]],
        pass_rate: float,
    ) -> list[str]:
        """Generate actionable recommendations based on the scorecard."""
        recs: list[str] = []

        if grade in ("D", "F"):
            recs.append(
                f"Vendor quality grade is {grade} ({avg_score:.1f}). "
                "Consider requiring a performance improvement plan or sourcing alternatives."
            )
        elif grade == "C":
            recs.append(
                f"Vendor quality grade is C ({avg_score:.1f}). "
                "Monitor closely and require corrective actions for recurring issues."
            )

        if trend == "declining":
            recs.append(
                "Quality trend is declining. Review recent submissions for systemic issues "
                "and schedule a vendor performance review."
            )
        elif trend == "improving":
            recs.append("Quality trend is improving. Continue current practices.")

        if pass_rate < 70.0:
            recs.append(
                f"Pass rate is low ({pass_rate:.1f}%). "
                "Investigate root causes of failing assessments."
            )

        if common_issues:
            top_issue = common_issues[0]
            recs.append(
                f"Most common issue category: '{top_issue['category']}' "
                f"({top_issue['count']} occurrences). Target this area for improvement."
            )

        if not recs:
            recs.append(
                "Vendor performance is satisfactory. Continue routine monitoring."
            )

        return recs
