from __future__ import annotations

import uuid
from copy import deepcopy
from datetime import datetime, timezone
from typing import Any

_VALID_TARGET_TYPES: frozenset[str] = frozenset({
    "ISSUE",
    "ELEMENT",
    "MODEL",
    "ESTIMATE",
    "BOQ_ITEM",
})


class CommentThreadManager:
    """In-memory comment store with soft-delete and audit preservation."""

    __slots__ = ("_comments",)

    _comments: dict[str, dict[str, Any]]

    def __init__(self) -> None:
        self._comments = {}

    # ------------------------------------------------------------------
    # public API
    # ------------------------------------------------------------------

    def add_comment(
        self,
        target_type: str,
        target_id: str,
        actor: dict[str, Any],
        message: str,
    ) -> dict[str, Any]:
        """Post a new comment against a target.

        Parameters
        ----------
        target_type:
            One of ``ISSUE``, ``ELEMENT``, ``MODEL``, ``ESTIMATE``,
            ``BOQ_ITEM``.
        target_id:
            Identifier of the target entity.
        actor:
            Dict with at least ``name`` and ``role`` (e.g. from
            :meth:`ActorContext.to_dict`).
        message:
            Comment body (non-empty).
        """
        target_type = target_type.upper().strip()
        if target_type not in _VALID_TARGET_TYPES:
            raise ValueError(
                f"Invalid target_type '{target_type}'. "
                f"Valid: {', '.join(sorted(_VALID_TARGET_TYPES))}"
            )

        message = message.strip()
        if not message:
            raise ValueError("Comment message must not be empty.")

        comment_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()

        comment: dict[str, Any] = {
            "comment_id": comment_id,
            "target_type": target_type,
            "target_id": target_id,
            "actor": dict(actor),
            "message": message,
            "created_at": now,
            "deleted": False,
        }

        self._comments[comment_id] = comment
        return deepcopy(comment)

    def get_comments(
        self,
        target_type: str,
        target_id: str,
    ) -> list[dict[str, Any]]:
        """Return all comments for a target, oldest first.

        Deleted comments are included (with ``deleted=True``) to preserve
        audit history.  Filter client-side if only active comments are
        desired.
        """
        target_type = target_type.upper().strip()
        results: list[dict[str, Any]] = []

        for comment in self._comments.values():
            if (
                comment["target_type"] == target_type
                and comment["target_id"] == target_id
            ):
                results.append(deepcopy(comment))

        results.sort(key=lambda c: c["created_at"])
        return results

    def delete_comment(
        self,
        comment_id: str,
        actor: dict[str, Any],
        reason: str,
    ) -> dict[str, Any]:
        """Soft-delete a comment (marks ``deleted=True``).

        The comment is **not** removed from storage.  Actor and reason
        are recorded in a ``deleted_by`` and ``deleted_reason`` field.

        Raises ``KeyError`` if *comment_id* does not exist.
        """
        comment = self._comments.get(comment_id)
        if comment is None:
            raise KeyError(f"Comment '{comment_id}' not found.")

        if comment["deleted"]:
            raise ValueError(f"Comment '{comment_id}' is already deleted.")

        now = datetime.now(timezone.utc).isoformat()
        comment["deleted"] = True
        comment["deleted_at"] = now
        comment["deleted_by"] = dict(actor)
        comment["deleted_reason"] = reason.strip()

        return deepcopy(comment)
