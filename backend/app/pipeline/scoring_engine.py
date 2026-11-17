from __future__ import annotations

from collections import defaultdict

from models import GateState, ReadinessIssue, Severity

# penalty points per issue
_PENALTY: dict[Severity, int] = {
    Severity.BLOCKER: 20,
    Severity.HIGH: 5,
    Severity.MEDIUM: 2,
}


_MAX_MEDIUM_PENALTY = 50  # prevent large models from always scoring 0


class ScoringEngine:
    """Deterministic scoring and gate evaluation from readiness issues."""

    # ------------------------------------------------------------------
    # public API
    # ------------------------------------------------------------------

    @staticmethod
    def calculate_scores(issues: list[ReadinessIssue]) -> dict:
        """Return ``{"overall": float, "categories": dict[str, float]}``.

        Formula (per group): ``max(0, 100 - BLOCKER×20 - HIGH×5 - MEDIUM×2)``.
        The *overall* score applies the formula to all issues; *categories*
        applies it independently to each ``issue.category``.
        """
        overall = _score_group(issues)

        buckets: dict[str, list[ReadinessIssue]] = defaultdict(list)
        for iss in issues:
            buckets[iss.category].append(iss)

        categories: dict[str, float] = {
            cat: _score_group(group) for cat, group in buckets.items()
        }

        return {"overall": overall, "categories": categories}

    @staticmethod
    def evaluate_gate(issues: list[ReadinessIssue]) -> GateState:
        """Determine gate state from issue severities.

        * Any BLOCKER → ``NOT_READY``
        * Any HIGH (and no BLOCKER) → ``CONDITIONAL``
        * Otherwise → ``READY``
        """
        severities = {iss.severity for iss in issues}

        if Severity.BLOCKER in severities:
            return GateState.NOT_READY
        if Severity.HIGH in severities:
            return GateState.CONDITIONAL
        return GateState.READY

    @staticmethod
    def calculate_weighted_score(
        category_scores: dict[str, float],
        weights: dict[str, float],
    ) -> float:
        """Return the weighted sum of *category_scores* using *weights*.

        Result is rounded to two decimal places for deterministic output.
        Categories without a weight are silently skipped.
        """
        total = 0.0
        for cat, score in category_scores.items():
            w = weights.get(cat)
            if w is not None:
                total += score * w
        return round(total, 2)


# ------------------------------------------------------------------
# internal helpers
# ------------------------------------------------------------------


def _score_group(issues: list[ReadinessIssue]) -> float:
    """Apply the penalty formula to a group of issues.

    Medium-severity deductions are capped at :data:`_MAX_MEDIUM_PENALTY`
    because large imported IFC models naturally produce many unmatched
    material names even when the model is well-structured.
    Without a cap, the formula ``100 - BLOCKER×20 - HIGH×5 - MEDIUM×2``
    collapses to 0 for any model with more than 50 medium issues.
    """
    counts: dict[Severity, int] = defaultdict(int)
    for iss in issues:
        if iss.severity in _PENALTY:
            counts[iss.severity] += 1

    blocker_ded = _PENALTY.get(Severity.BLOCKER, 0) * counts.get(Severity.BLOCKER, 0)
    high_ded = _PENALTY.get(Severity.HIGH, 0) * counts.get(Severity.HIGH, 0)
    medium_raw = counts.get(Severity.MEDIUM, 0) * _PENALTY.get(Severity.MEDIUM, 2)
    medium_ded = min(medium_raw, _MAX_MEDIUM_PENALTY)
    deductions = blocker_ded + high_ded + medium_ded

    return float(max(0, 100 - deductions))
