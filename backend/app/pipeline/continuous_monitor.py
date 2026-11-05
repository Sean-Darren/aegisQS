from __future__ import annotations

from typing import Any


_CRITICAL_THRESHOLD = 50.0
_EXCELLENT_THRESHOLD = 90.0
_DEGRADING_DELTA = 10.0
_STABLE_DELTA = 3.0
_MIN_DATA_POINTS_FOR_TREND = 2


class ModelHealthMonitor:
    """Monitor model health across sequential assessments.

    Produces a health snapshot: current status, trend, alerts, and
    recommended actions.  Purely deterministic — no authentication,
    no machine learning.
    """

    @staticmethod
    def monitor_model_health(
        model_id: str, assessments: list[dict[str, Any]]
    ) -> dict[str, Any]:
        """Evaluate model health from a chronological list of assessments.

        Parameters
        ----------
        model_id:
            Identifier for the model being monitored.
        assessments:
            List of assessment dicts in chronological order (oldest first).
            Each must have overall_score (float).

        Returns
        -------
        dict
            Keys: model_id, current_health, trend, alerts,
            recommended_action.
        """
        if not assessments:
            return ModelHealthMonitor._no_data_result(model_id)

        scores = [float(a.get("overall_score", 0.0)) for a in assessments]
        current_score = scores[-1]

        # ---- determine trend ----
        trend = ModelHealthMonitor._compute_trend(scores)

        # ---- determine current health ----
        if current_score < _CRITICAL_THRESHOLD:
            current_health = "CRITICAL"
        elif trend["direction"] == "declining" and abs(trend["delta"]) >= _DEGRADING_DELTA:
            current_health = "DEGRADING"
        elif current_score >= _EXCELLENT_THRESHOLD and trend["direction"] in ("stable", "improving"):
            current_health = "EXCELLENT"
        else:
            current_health = "GOOD"

        # ---- build alerts ----
        alerts = ModelHealthMonitor._build_alerts(current_health, current_score, trend, assessments)

        # ---- recommended action ----
        action = ModelHealthMonitor._recommend_action(current_health, trend, alerts)

        return {
            "model_id": model_id,
            "current_health": current_health,
            "trend": trend,
            "alerts": alerts,
            "recommended_action": action,
        }

    # ------------------------------------------------------------------
    # internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _no_data_result(model_id: str) -> dict[str, Any]:
        return {
            "model_id": model_id,
            "current_health": "UNKNOWN",
            "trend": {"direction": "insufficient_data", "delta": 0.0, "data_points": 0},
            "alerts": [
                {
                    "alert_type": "NO_DATA",
                    "message": "No assessments available for this model.",
                    "severity": "HIGH",
                }
            ],
            "recommended_action": "Run the readiness assessment to establish a baseline.",
        }

    @staticmethod
    def _compute_trend(scores: list[float]) -> dict[str, Any]:
        """Determine score direction and magnitude of change."""
        if len(scores) < _MIN_DATA_POINTS_FOR_TREND:
            return {
                "direction": "insufficient_data",
                "delta": 0.0,
                "first_score": scores[0] if scores else 0.0,
                "last_score": scores[-1] if scores else 0.0,
                "data_points": len(scores),
            }

        first = scores[0]
        last = scores[-1]
        delta = round(last - first, 1)

        if delta > _STABLE_DELTA:
            direction = "improving"
        elif delta < -_STABLE_DELTA:
            direction = "declining"
        else:
            direction = "stable"

        return {
            "direction": direction,
            "delta": delta,
            "first_score": first,
            "last_score": last,
            "data_points": len(scores),
        }

    @staticmethod
    def _build_alerts(
        health: str,
        current_score: float,
        trend: dict[str, Any],
        assessments: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """Generate structured alerts based on health status and trend."""
        alerts: list[dict[str, Any]] = []

        if health == "CRITICAL":
            alerts.append({
                "alert_type": "CRITICAL_SCORE",
                "message": (
                    f"Model score is {current_score:.1f}/100 — below the critical "
                    f"threshold of {_CRITICAL_THRESHOLD:.0f}.  Pricing and procurement "
                    "should be blocked."
                ),
                "severity": "CRITICAL",
            })
            # Count unresolved blockers
            latest = assessments[-1] if assessments else {}
            blockers = sum(
                1 for i in latest.get("issues", [])
                if str(i.get("severity", "")).upper() == "BLOCKER"
            )
            if blockers > 0:
                alerts.append({
                    "alert_type": "UNRESOLVED_BLOCKERS",
                    "message": f"{blockers} BLOCKER issue(s) remain unresolved.",
                    "severity": "CRITICAL",
                })

        if health == "DEGRADING":
            delta = trend.get("delta", 0.0)
            alerts.append({
                "alert_type": "SCORE_DEGRADATION",
                "message": (
                    f"Score has dropped by {abs(delta):.1f} points "
                    f"(from {trend.get('first_score', 0):.1f} → "
                    f"{trend.get('last_score', 0):.1f}).  "
                    "Investigate recent model changes."
                ),
                "severity": "HIGH",
            })

        if trend.get("direction") == "declining" and health not in ("CRITICAL", "DEGRADING"):
            alerts.append({
                "alert_type": "DECLINING_TREND",
                "message": (
                    f"Score is trending downward "
                    f"({trend.get('delta', 0):+.1f} points).  "
                    "Monitor closely and address emerging issues."
                ),
                "severity": "MEDIUM",
            })

        # Check for repeated issue categories across assessments
        cat_freq = ModelHealthMonitor._repeated_categories(assessments)
        for cat, count in cat_freq.items():
            if count >= 3:
                alerts.append({
                    "alert_type": "REPEATED_ISSUE_CATEGORY",
                    "message": (
                        f"'{cat}' issues appear in {count} consecutive assessments — "
                        "systemic problem likely."
                    ),
                    "severity": "HIGH",
                })

        return alerts

    @staticmethod
    def _repeated_categories(assessments: list[dict[str, Any]]) -> dict[str, int]:
        """Count how many assessments contain each issue category."""
        from collections import Counter
        cat_set: dict[str, int] = {}
        for a in assessments:
            seen: set[str] = set()
            for i in a.get("issues", []):
                cat = str(i.get("category", ""))
                if cat and cat not in seen:
                    seen.add(cat)
                    cat_set[cat] = cat_set.get(cat, 0) + 1
        return cat_set

    @staticmethod
    def _recommend_action(
        health: str,
        trend: dict[str, Any],
        alerts: list[dict[str, Any]],
    ) -> str:
        """Return a single recommended action based on health and alerts."""
        if health == "CRITICAL":
            return (
                "BLOCK all downstream processes.  Escalate to project leadership.  "
                "Resolve all BLOCKER issues and re-assess before proceeding."
            )
        if health == "DEGRADING":
            return (
                "Pause pricing activities.  Identify the root cause of score decline "
                "by comparing the latest assessment against the previous one.  "
                "Address new issues before re-assessment."
            )
        if health == "EXCELLENT":
            return (
                "Model is in excellent health.  Proceed with pricing and procurement.  "
                "Lock the current model version as the baseline."
            )
        # GOOD
        return (
            "Model is in acceptable condition.  Review alerts and address "
            "outstanding MEDIUM/LOW issues.  Continue with standard workflow."
        )
