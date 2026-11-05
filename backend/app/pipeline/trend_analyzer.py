from __future__ import annotations

from typing import Any


class PerformanceTrendAnalyzer:
    """Analyze assessment score trends and issue-type patterns over time."""

    @staticmethod
    def analyze_trends(assessments: list[dict[str, Any]]) -> dict[str, Any]:
        """Return a trend analysis from a chronological list of assessments."""
        if not assessments:
            return {
                "score_trend": "no_data",
                "issue_type_trend": {},
                "severity_distribution": {},
                "insights": ["No assessments available for trend analysis."],
            }

        scores = [a.get("overall_score", 0.0) for a in assessments]
        score_trend = PerformanceTrendAnalyzer._score_trend(scores)
        severity_dist = PerformanceTrendAnalyzer._severity_distribution(assessments)
        issue_type_trend = PerformanceTrendAnalyzer._issue_type_trend(assessments)
        insights = PerformanceTrendAnalyzer._build_insights(
            scores, score_trend, severity_dist, issue_type_trend
        )

        return {
            "score_trend": score_trend,
            "issue_type_trend": issue_type_trend,
            "severity_distribution": severity_dist,
            "insights": insights,
        }

    @staticmethod
    def _score_trend(scores: list[float]) -> dict[str, Any]:
        """Determine if scores are improving, declining, or stable."""
        if len(scores) < 2:
            return {"direction": "stable", "change": 0.0, "detail": "Insufficient data points."}

        first = scores[0]
        last = scores[-1]
        change = round(last - first, 1)

        half = len(scores) // 2
        if half >= 1:
            first_half_avg = sum(scores[:half]) / half
            second_half_avg = sum(scores[half:]) / (len(scores) - half)
            window_change = round(second_half_avg - first_half_avg, 1)
        else:
            window_change = change

        if window_change > 5:
            direction = "improving"
        elif window_change < -5:
            direction = "declining"
        else:
            direction = "stable"

        return {
            "direction": direction,
            "first_score": first,
            "last_score": last,
            "change": change,
            "window_change": window_change,
            "data_points": len(scores),
        }

    @staticmethod
    def _severity_distribution(assessments: list[dict[str, Any]]) -> dict[str, int]:
        """Count severity level occurrences across all assessments."""
        counter: dict[str, int] = {}
        for a in assessments:
            for issue in a.get("issues", []):
                sev = issue.get("severity", "UNKNOWN")
                counter[sev] = counter.get(sev, 0) + 1
        return dict(sorted(counter.items(), key=lambda x: x[1], reverse=True))

    @staticmethod
    def _issue_type_trend(assessments: list[dict[str, Any]]) -> dict[str, Any]:
        """Track per-category issue counts per assessment."""
        if not assessments:
            return {}

        categories: dict[str, list[int]] = {}
        for idx, a in enumerate(assessments):
            cat_counts: dict[str, int] = {}
            for issue in a.get("issues", []):
                cat = issue.get("category", "Unknown")
                cat_counts[cat] = cat_counts.get(cat, 0) + 1
            for cat, count in cat_counts.items():
                if cat not in categories:
                    categories[cat] = [0] * len(assessments)
                categories[cat][idx] = count

        result: dict[str, Any] = {}
        for cat, counts in categories.items():
            first = next((c for c in counts if c > 0), 0)
            last = next((c for c in reversed(counts) if c > 0), 0)
            change = last - first
            if change > 0:
                trend_dir = "increasing"
            elif change < 0:
                trend_dir = "decreasing"
            else:
                trend_dir = "stable"

            result[cat] = {"counts": counts, "trend": trend_dir, "change": change}

        return result

    @staticmethod
    def _build_insights(
        scores: list[float],
        score_trend: dict[str, Any],
        severity_dist: dict[str, int],
        issue_type_trend: dict[str, Any],
    ) -> list[str]:
        """Generate plain-English insights from the trend data."""
        insights: list[str] = []
        direction = score_trend.get("direction", "stable")

        if direction == "improving":
            insights.append(
                f"Score trend is improving (+{score_trend.get('window_change', 0):.1f} points "
                f"between first and second half of assessments)."
            )
        elif direction == "declining":
            insights.append(
                f"Score trend is declining ({score_trend.get('window_change', 0):.1f} points "
                f"between first and second half of assessments)."
            )
        else:
            insights.append(
                f"Score trend is stable (change: {score_trend.get('change', 0):.1f} points "
                f"across {len(scores)} assessments)."
            )

        if severity_dist:
            top_sev = list(severity_dist.keys())[0]
            insights.append(
                f"Most common severity: {top_sev} ({severity_dist[top_sev]} occurrences)."
            )

        for cat, data in issue_type_trend.items():
            counts = data.get("counts", [])
            if len(counts) >= 2:
                first_half = counts[: len(counts) // 2]
                second_half = counts[len(counts) // 2 :]
                first_avg = sum(first_half) / max(len(first_half), 1)
                second_avg = sum(second_half) / max(len(second_half), 1)
                if first_avg > 0 and second_avg > 0:
                    pct_change = ((second_avg - first_avg) / first_avg) * 100
                    if pct_change > 20:
                        insights.append(
                            f"Category '{cat}' is increasing significantly "
                            f"({pct_change:.1f}% rise in issue count between halves)."
                        )

        if not insights:
            insights.append("No significant trends detected.")

        return insights
