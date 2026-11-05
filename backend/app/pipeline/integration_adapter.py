from __future__ import annotations

import json
import os
import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


class IntegrationAdapter(ABC):
    """Abstract interface for pushing / pulling data to external systems."""

    @abstractmethod
    def push_estimate(self, estimate: dict[str, Any]) -> dict[str, Any]:
        """Send an estimate to the target system.

        Returns a confirmation dict with at least ``status`` and
        ``remote_id``.
        """

    @abstractmethod
    def push_boq(self, boq: dict[str, Any]) -> dict[str, Any]:
        """Send a BOQ to the target system."""

    @abstractmethod
    def pull_model_metadata(self, source_id: str) -> dict[str, Any]:
        """Fetch model metadata from the source system."""

    @abstractmethod
    def sync_decision_log(self, decisions: list[dict[str, Any]]) -> dict[str, Any]:
        """Sync decision log entries to the target system."""


class LocalMockAdapter(IntegrationAdapter):
    """Filesystem-backed adapter — writes payloads as JSON and reads them back.

    Useful for local development, integration testing, and demos.
    No external APIs, no credentials, no network.
    """

    __slots__ = ("_base_dir",)

    _base_dir: Path

    def __init__(self, base_dir: str = ".integration_data") -> None:
        self._base_dir = Path(base_dir)
        self._base_dir.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------
    # IntegrationAdapter implementation
    # ------------------------------------------------------------------

    def push_estimate(self, estimate: dict[str, Any]) -> dict[str, Any]:
        remote_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()

        payload: dict[str, Any] = {
            "type": "estimate",
            "remote_id": remote_id,
            "pushed_at": now,
            "data": estimate,
        }
        self._write("estimates", remote_id, payload)

        return {"status": "success", "remote_id": remote_id, "pushed_at": now}

    def push_boq(self, boq: dict[str, Any]) -> dict[str, Any]:
        remote_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()

        payload: dict[str, Any] = {
            "type": "boq",
            "remote_id": remote_id,
            "pushed_at": now,
            "data": boq,
        }
        self._write("boqs", remote_id, payload)

        return {"status": "success", "remote_id": remote_id, "pushed_at": now}

    def pull_model_metadata(self, source_id: str) -> dict[str, Any]:
        """Read previously pushed model metadata.

        If no file exists, returns a default stub.
        """
        data = self._read("models", source_id)
        if data is not None:
            return data

        # Stub for demo / testing
        now = datetime.now(timezone.utc).isoformat()
        stub: dict[str, Any] = {
            "source_id": source_id,
            "model_name": f"Model-{source_id}",
            "retrieved_at": now,
            "element_count": 0,
            "file_size_bytes": 0,
            "note": "LocalMockAdapter stub — no real model data available.",
        }
        return stub

    def sync_decision_log(
        self,
        decisions: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Write decisions as a batch log file."""
        batch_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()

        payload: dict[str, Any] = {
            "type": "decision_log_sync",
            "batch_id": batch_id,
            "synced_at": now,
            "count": len(decisions),
            "decisions": decisions,
        }
        self._write("decisions", batch_id, payload)

        return {
            "status": "success",
            "batch_id": batch_id,
            "synced_count": len(decisions),
            "synced_at": now,
        }

    # ------------------------------------------------------------------
    # filesystem helpers
    # ------------------------------------------------------------------

    def _write(self, folder: str, item_id: str, data: dict[str, Any]) -> None:
        dir_path = self._base_dir / folder
        dir_path.mkdir(parents=True, exist_ok=True)
        file_path = dir_path / f"{item_id}.json"
        with file_path.open("w", encoding="utf-8") as fh:
            json.dump(data, fh, indent=2, ensure_ascii=False, default=str)

    def _read(self, folder: str, item_id: str) -> dict[str, Any] | None:
        file_path = self._base_dir / folder / f"{item_id}.json"
        if not file_path.is_file():
            return None
        with file_path.open("r", encoding="utf-8") as fh:
            return json.load(fh)

    # ------------------------------------------------------------------
    # convenience for tests
    # ------------------------------------------------------------------

    def list_pushed(self, folder: str) -> list[str]:
        """Return sorted list of item IDs pushed to a folder."""
        dir_path = self._base_dir / folder
        if not dir_path.is_dir():
            return []
        return sorted(
            p.stem for p in dir_path.glob("*.json") if p.is_file()
        )

    def clear(self) -> None:
        """Remove all pushed data (useful between test runs)."""
        import shutil
        if self._base_dir.exists():
            shutil.rmtree(self._base_dir)
            self._base_dir.mkdir(parents=True, exist_ok=True)
