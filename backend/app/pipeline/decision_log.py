from __future__ import annotations

import hashlib
import json
import uuid
from copy import deepcopy
from datetime import datetime, timezone
from typing import Any

_VALID_DECISION_TYPES: frozenset[str] = frozenset({
    "RISK_ACCEPTED",
    "SCOPE_EXCLUDED",
    "MODEL_LOCKED",
    "BOQ_APPROVED",
    "ESTIMATE_APPROVED",
    "MANUAL_OVERRIDE",
})

_MIN_REASON_LENGTH = 20


class DecisionLog:
    """Immutable-audit decision log with SHA-256 payload hashing."""

    __slots__ = ("_decisions",)

    _decisions: dict[str, dict[str, Any]]

    def __init__(self) -> None:
        self._decisions = {}

    # ------------------------------------------------------------------
    # public API
    # ------------------------------------------------------------------

    def record_decision(
        self,
        project_id: str,
        decision_type: str,
        actor: dict[str, Any],
        reason: str,
        affected_scope: dict[str, Any],
    ) -> dict[str, Any]:
        """Record a commercial decision with an integrity hash.

        Parameters
        ----------
        project_id:
            Owning project.
        decision_type:
            One of the valid decision types.
        actor:
            Dict with at least ``name`` and ``role``.
        reason:
            Justification (≥ 20 characters).
        affected_scope:
            Arbitrary dict describing what is affected (e.g.
            ``{"issue_ids": ["ISS-001"], "elements": ["e3"]}``).

        Raises
        ------
        ValueError
            If *decision_type* is invalid or *reason* is too short.
        """
        decision_type = decision_type.upper().strip()
        if decision_type not in _VALID_DECISION_TYPES:
            raise ValueError(
                f"Invalid decision_type '{decision_type}'. "
                f"Valid: {', '.join(sorted(_VALID_DECISION_TYPES))}"
            )

        reason = reason.strip()
        if len(reason) < _MIN_REASON_LENGTH:
            raise ValueError(
                f"Reason must be at least {_MIN_REASON_LENGTH} characters "
                f"(got {len(reason)})."
            )

        decision_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()

        # Build payload for hashing (deterministic JSON)
        payload: dict[str, Any] = {
            "decision_id": decision_id,
            "project_id": project_id,
            "decision_type": decision_type,
            "actor": dict(actor),
            "reason": reason,
            "affected_scope": deepcopy(affected_scope),
            "timestamp": now,
        }

        payload_str = json.dumps(payload, sort_keys=True, ensure_ascii=False)
        decision_hash = hashlib.sha256(payload_str.encode("utf-8")).hexdigest()

        decision: dict[str, Any] = {
            **payload,
            "decision_hash": decision_hash,
        }

        self._decisions[decision_id] = decision
        return deepcopy(decision)

    def list_decisions(self, project_id: str) -> list[dict[str, Any]]:
        """Return all decisions for *project_id*, newest first."""
        results = [
            deepcopy(d)
            for d in self._decisions.values()
            if d["project_id"] == project_id
        ]
        results.sort(key=lambda d: d["timestamp"], reverse=True)
        return results

    def get_decision(self, decision_id: str) -> dict[str, Any] | None:
        """Return a single decision by ID, or ``None``."""
        decision = self._decisions.get(decision_id)
        return deepcopy(decision) if decision is not None else None
