from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class ActorContext:
    """Immutable actor metadata for audit-trail and workflow-log entries.

    This is **not** an authentication or user model — it is a pure-data
    record of *who* performed an action, suitable for serialisation into
    logs, reports, and audit entries.
    """

    name: str
    role: str
    organisation: str | None = None
    email: str | None = None

    def __post_init__(self) -> None:
        if not self.name.strip():
            raise ValueError("Actor name must not be empty.")
        if not self.role.strip():
            raise ValueError("Actor role must not be empty.")

    def to_dict(self) -> dict[str, Any]:
        """Return a JSON-serialisable ``dict`` representation."""
        return {
            "name": self.name,
            "role": self.role,
            "organisation": self.organisation,
            "email": self.email,
        }
