from __future__ import annotations

import uuid
from collections import defaultdict
from copy import deepcopy
from datetime import datetime, timezone
from typing import Any, Callable

_VALID_EVENT_TYPES: frozenset[str] = frozenset({
    "MODEL_SUBMITTED",
    "ASSESSMENT_COMPLETED",
    "ISSUE_CREATED",
    "ISSUE_RESOLVED",
    "RISK_ACCEPTED",
    "BOQ_GENERATED",
    "ESTIMATE_GENERATED",
    "APPROVAL_COMPLETED",
})

Handler = Callable[[dict[str, Any]], None]


class EventBus:
    """In-memory publish / subscribe event bus with event storage."""

    __slots__ = ("_subscribers", "_events")

    _subscribers: dict[str, list[Handler]]
    _events: list[dict[str, Any]]

    def __init__(self) -> None:
        self._subscribers = defaultdict(list)
        self._events = []

    # ------------------------------------------------------------------
    # public API
    # ------------------------------------------------------------------

    def publish(self, event_type: str, payload: dict[str, Any]) -> dict[str, Any]:
        """Publish an event, store it, and invoke all matching handlers.

        Parameters
        ----------
        event_type:
            One of the valid event types.
        payload:
            Arbitrary dict associated with the event.

        Returns
        -------
        dict
            The stored event envelope.

        Raises
        ------
        ValueError
            If *event_type* is not recognised.
        """
        event_type = event_type.upper().strip()
        if event_type not in _VALID_EVENT_TYPES:
            raise ValueError(
                f"Invalid event_type '{event_type}'. "
                f"Valid: {', '.join(sorted(_VALID_EVENT_TYPES))}"
            )

        event: dict[str, Any] = {
            "event_id": str(uuid.uuid4()),
            "event_type": event_type,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "payload": deepcopy(payload),
        }
        self._events.append(event)

        # Dispatch to all matching handlers
        for handler in self._subscribers.get(event_type, []):
            try:
                handler(deepcopy(event))
            except Exception:
                # Swallow handler errors — do not break the bus
                pass

        return deepcopy(event)

    def subscribe(self, event_type: str, handler: Handler) -> None:
        """Register *handler* to be called when *event_type* is published.

        Parameters
        ----------
        event_type:
            Event type to listen for (case-insensitive).
        handler:
            Callable accepting a single ``dict`` (the event envelope).
        """
        event_type = event_type.upper().strip()
        self._subscribers[event_type].append(handler)

    def list_events(self) -> list[dict[str, Any]]:
        """Return all stored events, oldest first."""
        return deepcopy(self._events)
