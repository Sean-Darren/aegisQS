from __future__ import annotations

from collections import defaultdict

from models import GateState, ReadinessIssue, Severity

# penalty points per issue
_PENALTY: dict[Severity, int] = {
    Severity.BLOCKER: 20,
    Severity.HIGH: 5,
    Severity.MEDIUM: 2,
}


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
    """Apply the penalty formula to a group of issues (all-int arithmetic, no drift)."""
    counts: dict[Severity, int] = defaultdict(int)
    for iss in issues:
        if iss.severity in _PENALTY:
            counts[iss.severity] += 1

    deductions = sum(
        _PENALTY[sev] * cnt for sev, cnt in counts.items()
    )
    return float(max(0, 100 - deductions))
