from __future__ import annotations

from datetime import datetime, timezone

_MIN_REASON_LENGTH = 20


class AuditManager:
    """Immutable-style audit log for risk-acceptance decisions."""

    __slots__ = ("_log",)

    _log: list[dict]

    def __init__(self) -> None:
        self._log = []

    # ------------------------------------------------------------------
    # public API
    # ------------------------------------------------------------------

    def accept_risk(
        self,
        issue_ids: list[str],
        reviewer_name: str,
        role: str,
        reason: str,
    ) -> dict:
        """Record a formal risk acceptance.

        Parameters
        ----------
        issue_ids:
            IDs of the :class:`ReadinessIssue` entries being accepted.
        reviewer_name:
            Full name of the person accepting the risk.
        role:
            Job title or authority role (e.g. ``"Project Director"``).
        reason:
            Justification — must be at least 20 characters.

        Returns
        -------
        dict
            ``{"status": "success", "new_gate_state": "CONDITIONAL",
            "log_entry": {...}}``

        Raises
        ------
        ValueError
            If *reason* is shorter than 20 characters.
        """
        reason = reason.strip()
        if len(reason) < _MIN_REASON_LENGTH:
            raise ValueError(
                f"Reason must be at least {_MIN_REASON_LENGTH} characters "
                f"(got {len(reason)})."
            )

        entry: dict = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "reviewer_name": reviewer_name,
            "role": role,
            "reason": reason,
            "affected_issue_ids": list(issue_ids),  # defensive copy
            "action": "RISK_ACCEPTED",
        }

        self._log.append(entry)

        return {
            "status": "success",
            "new_gate_state": "CONDITIONAL",
            "log_entry": _deepish_copy(entry),
        }

    def get_logs(self) -> list[dict]:
        """Return a shallow copy of every audit entry, oldest first."""
        return [_deepish_copy(e) for e in self._log]


def _deepish_copy(entry: dict) -> dict:
    """Shallow copy the dict, but also copy any list values."""
    return {k: (list(v) if isinstance(v, list) else v) for k, v in entry.items()}
