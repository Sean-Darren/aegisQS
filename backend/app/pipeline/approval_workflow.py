from __future__ import annotations

import uuid
from copy import deepcopy
from datetime import datetime, timezone
from typing import Any

_VALID_STATUSES: frozenset[str] = frozenset({
    "NOT_STARTED",
    "IN_PROGRESS",
    "APPROVED",
    "REJECTED",
})


class ApprovalWorkflowEngine:
    """Manage multi-stage approval workflows for models, BOQs, and estimates.

    No authentication — the caller supplies an *actor* dict and the
    engine records it as-is in every audit event.
    """

    __slots__ = ("_workflows", "_instances")

    _workflows: dict[str, dict[str, Any]]
    _instances: dict[str, dict[str, Any]]

    def __init__(self) -> None:
        self._workflows = {}
        self._instances = {}

    # ------------------------------------------------------------------
    # public API
    # ------------------------------------------------------------------

    def create_workflow(
        self,
        name: str,
        stages: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Register a workflow template.

        Parameters
        ----------
        name:
            Human-readable workflow name.
        stages:
            Ordered list of stage dicts, each with ``name``,
            ``expected_role``, and ``order``.

        Returns
        -------
        dict
            The stored workflow template.
        """
        workflow_id = str(uuid.uuid4())

        # Normalise and sort stages by order
        sorted_stages = sorted(
            (
                {
                    "name": s["name"],
                    "expected_role": s.get("expected_role", ""),
                    "order": int(s.get("order", 0)),
                }
                for s in stages
            ),
            key=lambda s: s["order"],
        )

        workflow: dict[str, Any] = {
            "workflow_id": workflow_id,
            "name": name,
            "stages": sorted_stages,
            "stage_count": len(sorted_stages),
        }
        self._workflows[workflow_id] = workflow
        return deepcopy(workflow)

    def start_workflow(
        self,
        workflow_id: str,
        target_type: str,
        target_id: str,
    ) -> dict[str, Any]:
        """Create a new workflow instance in ``IN_PROGRESS``.

        Raises ``KeyError`` if *workflow_id* is not found.
        """
        workflow = self._workflows.get(workflow_id)
        if workflow is None:
            raise KeyError(f"Workflow '{workflow_id}' not found.")

        instance_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()

        # Deep-copy stages with per-stage state
        instance_stages: list[dict[str, Any]] = []
        for s in workflow["stages"]:
            instance_stages.append({
                "name": s["name"],
                "expected_role": s["expected_role"],
                "order": s["order"],
                "status": "NOT_STARTED",
                "events": [],
            })

        # Mark first stage as current
        if instance_stages:
            instance_stages[0]["status"] = "NOT_STARTED"

        instance: dict[str, Any] = {
            "instance_id": instance_id,
            "workflow_id": workflow_id,
            "workflow_name": workflow["name"],
            "target_type": target_type,
            "target_id": target_id,
            "status": "IN_PROGRESS",
            "current_stage_index": 0,
            "stages": instance_stages,
            "created_at": now,
            "updated_at": now,
        }

        self._instances[instance_id] = instance
        return deepcopy(instance)

    def approve_current_stage(
        self,
        instance_id: str,
        actor: dict[str, Any],
        comments: str = "",
    ) -> dict[str, Any]:
        """Approve the current stage and advance.

        If this is the last stage the workflow becomes ``APPROVED``.
        """
        instance = self._instances.get(instance_id)
        if instance is None:
            raise KeyError(f"Workflow instance '{instance_id}' not found.")
        if instance["status"] in ("APPROVED", "REJECTED"):
            raise ValueError(
                f"Workflow instance '{instance_id}' is already "
                f"{instance['status'].lower()}."
            )

        return _record_decision(instance, "APPROVED", actor, comments)

    def reject_current_stage(
        self,
        instance_id: str,
        actor: dict[str, Any],
        reason: str,
    ) -> dict[str, Any]:
        """Reject the current stage.

        The entire workflow instance becomes ``REJECTED``.
        """
        instance = self._instances.get(instance_id)
        if instance is None:
            raise KeyError(f"Workflow instance '{instance_id}' not found.")
        if instance["status"] in ("APPROVED", "REJECTED"):
            raise ValueError(
                f"Workflow instance '{instance_id}' is already "
                f"{instance['status'].lower()}."
            )

        reason = reason.strip()
        if not reason:
            raise ValueError("Rejection reason must not be empty.")

        return _record_decision(instance, "REJECTED", actor, reason)

    def get_status(self, instance_id: str) -> dict[str, Any]:
        """Return the current status of a workflow instance.

        Raises ``KeyError`` if *instance_id* is not found.
        """
        instance = self._instances.get(instance_id)
        if instance is None:
            raise KeyError(f"Workflow instance '{instance_id}' not found.")
        return deepcopy(instance)


# ------------------------------------------------------------------
# helpers
# ------------------------------------------------------------------


def _record_decision(
    instance: dict[str, Any],
    decision: str,
    actor: dict[str, Any],
    notes: str,
) -> dict[str, Any]:
    """Record an approval / rejection event and advance state."""
    now = datetime.now(timezone.utc).isoformat()
    idx = instance["current_stage_index"]
    stage = instance["stages"][idx]

    event: dict[str, Any] = {
        "timestamp": now,
        "actor": dict(actor),
        "stage_name": stage["name"],
        "decision": decision,
        "comments": notes,
    }
    stage["events"].append(event)
    stage["status"] = decision

    instance["updated_at"] = now

    if decision == "REJECTED":
        instance["status"] = "REJECTED"
    elif idx + 1 >= len(instance["stages"]):
        # Last stage approved → workflow approved
        instance["status"] = "APPROVED"
    else:
        # Advance to next stage
        instance["current_stage_index"] = idx + 1
        instance["stages"][idx + 1]["status"] = "NOT_STARTED"

    return deepcopy(instance)
