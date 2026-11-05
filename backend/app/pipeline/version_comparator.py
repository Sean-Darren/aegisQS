from __future__ import annotations

from typing import Any


class VersionComparator:
    """Compare two assessment reports and produce a structured diff."""

    @staticmethod
    def compare_assessments(
        old_report: dict[str, Any],
        new_report: dict[str, Any],
    ) -> dict[str, Any]:
        """Return a detailed comparison of two assessment reports.

        Issues are matched on the composite key
        ``(element_id, category, message)``.

        Parameters
        ----------
        old_report:
            Previous :class:`AssessmentReport` (or compatible dict with
            ``overall_score``, ``gate_state``, ``issues``).
        new_report:
            Current assessment report in the same shape.

        Returns
        -------
        dict
        """
        old_score = float(old_report.get("overall_score") or 0.0)
        new_score = float(new_report.get("overall_score") or 0.0)

        old_gate = str(old_report.get("gate_state") or "")
        new_gate = str(new_report.get("gate_state") or "")

        old_issues: list[dict[str, Any]] = old_report.get("issues") or []
        new_issues_list: list[dict[str, Any]] = new_report.get("issues") or []

        # Index by composite key
        old_index = {_issue_key(i): i for i in old_issues}
        new_index = {_issue_key(i): i for i in new_issues_list}

        old_keys = set(old_index)
        new_keys = set(new_index)

        resolved_keys = old_keys - new_keys
        new_issue_keys = new_keys - old_keys
        persistent_keys = old_keys & new_keys

        resolved_issues = [old_index[k] for k in resolved_keys]
        new_issues = [new_index[k] for k in new_issue_keys]
        persistent_issues = [new_index[k] for k in persistent_keys]

        score_change = round(new_score - old_score, 2)
        gate_improved = _gate_rank(new_gate) > _gate_rank(old_gate)
        gate_change = old_gate != new_gate

        summary = _build_summary(
            old_score, new_score, score_change,
            old_gate, new_gate, gate_change, gate_improved,
            len(resolved_issues), len(new_issues), len(persistent_issues),
        )

        return {
            "score_change": score_change,
            "old_score": old_score,
            "new_score": new_score,
            "old_gate": old_gate,
            "new_gate": new_gate,
            "gate_improved": gate_improved,
            "gate_changed": gate_change,
            "new_issues": new_issues,
            "resolved_issues": resolved_issues,
            "persistent_issues": persistent_issues,
            "summary": summary,
        }


# ------------------------------------------------------------------
# helpers
# ------------------------------------------------------------------


def _issue_key(issue: dict[str, Any]) -> tuple[str, str, str]:
    """Return a stable composite key for deduplication."""
    return (
        str(issue.get("element_id") or ""),
        str(issue.get("category") or ""),
        str(issue.get("message") or ""),
    )


_GATE_ORDER: dict[str, int] = {
    "NOT_READY":    0,
    "CONDITIONAL":  1,
    "READY":        2,
}


def _gate_rank(gate: str) -> int:
    """Numerical rank for gate comparison (higher = better)."""
    return _GATE_ORDER.get(gate.upper().strip(), -1)


def _build_summary(
    old_score: float,
    new_score: float,
    score_change: float,
    old_gate: str,
    new_gate: str,
    gate_change: bool,
    gate_improved: bool,
    resolved_count: int,
    new_count: int,
    persistent_count: int,
) -> str:
    """Generate a human-readable comparison summary."""
    direction = "improved" if score_change > 0 else "declined"
    parts = [
        f"Score {direction} from {old_score:.0f} to {new_score:.0f} "
        f"({score_change:+.1f})."
    ]

    if resolved_count:
        parts.append(f"{resolved_count} issue(s) resolved.")
    if new_count:
        parts.append(f"{new_count} new issue(s) introduced.")
    if persistent_count:
        parts.append(f"{persistent_count} issue(s) remain outstanding.")

    if gate_change:
        verb = "improved" if gate_improved else "regressed"
        parts.append(f"Gate {verb} from {old_gate} to {new_gate}.")
    else:
        parts.append(f"Gate unchanged at {new_gate}.")

    return " ".join(parts)
