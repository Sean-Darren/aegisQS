from __future__ import annotations

import uuid
from copy import deepcopy
from datetime import datetime, timezone
from typing import Any

_VALID_STATUSES: frozenset[str] = frozenset({
    "OPEN",
    "ASSIGNED",
    "IN_PROGRESS",
    "RESOLVED",
    "EXCLUDED",
    "RISK_ACCEPTED",
    "CLOSED",
})

_MIN_REASON_LENGTH = 20

# Allowed transitions from each status
_TRANSITIONS: dict[str, frozenset[str]] = {
    "OPEN":          frozenset({"ASSIGNED", "IN_PROGRESS", "EXCLUDED", "RISK_ACCEPTED"}),
    "ASSIGNED":      frozenset({"IN_PROGRESS", "EXCLUDED", "RISK_ACCEPTED", "OPEN"}),
    "IN_PROGRESS":   frozenset({"RESOLVED", "EXCLUDED", "RISK_ACCEPTED", "ASSIGNED"}),
    "RESOLVED":      frozenset({"CLOSED", "OPEN"}),
    "EXCLUDED":      frozenset({"OPEN"}),
    "RISK_ACCEPTED": frozenset({"CLOSED", "OPEN"}),
    "CLOSED":        frozenset({"OPEN"}),
}


class IssueTracker:
    """In-memory readiness-issue manager with workflow and audit trail."""

    __slots__ = ("_issues",)

    _issues: dict[str, dict[str, Any]]

    def __init__(self) -> None:
        self._issues = {}

    # ------------------------------------------------------------------
    # public API
    # ------------------------------------------------------------------

    def create_issue(
        self,
        project_id: str,
        issue_data: dict[str, Any],
    ) -> dict[str, Any]:
        """Create a new issue with status ``OPEN``.

        Parameters
        ----------
        project_id:
            Owning project identifier.
        issue_data:
            Dict with keys matching :class:`ReadinessIssue` fields
            (``element_id``, ``severity``, ``category``, ``message``,
            ``commercial_impact``).  An optional ``issue_id`` key is
            honoured; otherwise a UUID is generated.
        """
        now = datetime.now(timezone.utc).isoformat()

        issue: dict[str, Any] = {
            "issue_id": issue_data.get("issue_id") or str(uuid.uuid4()),
            "project_id": project_id,
            "element_id": issue_data.get("element_id", ""),
            "severity": issue_data.get("severity", "LOW"),
            "category": issue_data.get("category", ""),
            "message": issue_data.get("message", ""),
            "commercial_impact": issue_data.get("commercial_impact", ""),
            "status": "OPEN",
            "assigned_to": None,
            "created_at": now,
            "updated_at": now,
            "status_history": [],
        }

        self._issues[issue["issue_id"]] = issue
        return deepcopy(issue)

    def get_issue(self, issue_id: str) -> dict[str, Any] | None:
        """Return an issue by ID, or ``None``."""
        issue = self._issues.get(issue_id)
        return deepcopy(issue) if issue is not None else None

    def list_issues(
        self,
        project_id: str,
        filters: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        """Return issues for *project_id*, optionally filtered.

        *filters* is a dict of ``{field: value}`` pairs.  Only issues
        whose field values match exactly are returned.
        """
        result: list[dict[str, Any]] = []
        for issue in self._issues.values():
            if issue["project_id"] != project_id:
                continue
            if filters:
                if not all(
                    issue.get(key) == value for key, value in filters.items()
                ):
                    continue
            result.append(deepcopy(issue))
        return sorted(result, key=lambda i: i["created_at"], reverse=True)

    def update_status(
        self,
        issue_id: str,
        new_status: str,
        actor: dict[str, Any],
        notes: str = "",
    ) -> dict[str, Any]:
        """Transition an issue to *new_status* with audit trail.

        Raises ``KeyError`` if the issue does not exist.
        Raises ``ValueError`` if the status or transition is invalid.
        """
        issue = self._issues.get(issue_id)
        if issue is None:
            raise KeyError(f"Issue '{issue_id}' not found.")

        new_status = new_status.upper().strip()
        if new_status not in _VALID_STATUSES:
            raise ValueError(
                f"Invalid status '{new_status}'. "
                f"Valid: {', '.join(sorted(_VALID_STATUSES))}"
            )

        old_status = issue["status"]
        allowed = _TRANSITIONS.get(old_status, frozenset())
        if new_status not in allowed:
            raise ValueError(
                f"Cannot transition from '{old_status}' to '{new_status}'. "
                f"Allowed: {', '.join(sorted(allowed))}"
            )

        return _apply_transition(issue, new_status, actor, notes)

    def exclude_issue(
        self,
        issue_id: str,
        actor: dict[str, Any],
        reason: str,
    ) -> dict[str, Any]:
        """Exclude an issue with a mandatory reason (≥ 20 chars).

        Raises ``ValueError`` if *reason* is too short.
        """
        reason = reason.strip()
        if len(reason) < _MIN_REASON_LENGTH:
            raise ValueError(
                f"Exclusion reason must be at least {_MIN_REASON_LENGTH} "
                f"characters (got {len(reason)})."
            )
        return self.update_status(issue_id, "EXCLUDED", actor, reason)

    def accept_risk(
        self,
        issue_id: str,
        actor: dict[str, Any],
        reason: str,
    ) -> dict[str, Any]:
        """Accept risk on an issue with a mandatory reason (≥ 20 chars).

        Raises ``ValueError`` if *reason* is too short.
        """
        reason = reason.strip()
        if len(reason) < _MIN_REASON_LENGTH:
            raise ValueError(
                f"Risk-acceptance reason must be at least {_MIN_REASON_LENGTH} "
                f"characters (got {len(reason)})."
            )
        return self.update_status(issue_id, "RISK_ACCEPTED", actor, reason)

    def mark_resolved(
        self,
        issue_id: str,
        actor: dict[str, Any],
        resolution_notes: str,
    ) -> dict[str, Any]:
        """Mark an issue as resolved with notes."""
        return self.update_status(issue_id, "RESOLVED", actor, resolution_notes)


# ------------------------------------------------------------------
# helpers
# ------------------------------------------------------------------


def _apply_transition(
    issue: dict[str, Any],
    new_status: str,
    actor: dict[str, Any],
    notes: str,
) -> dict[str, Any]:
    """Mutate *issue* in-place and record an audit event."""
    now = datetime.now(timezone.utc).isoformat()
    old_status = issue["status"]

    event: dict[str, Any] = {
        "timestamp": now,
        "actor": dict(actor),
        "old_status": old_status,
        "new_status": new_status,
        "notes": notes,
    }

    issue["status"] = new_status
    issue["updated_at"] = now
    issue["status_history"].append(event)

    return deepcopy(issue)
