"""In-memory job store and WebSocket progress hub."""

from __future__ import annotations

import asyncio
import threading
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import WebSocket

from app.schemas.bim import JobStatus


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class JobManager:
    """Thread-safe store for assessment jobs and their socket subscribers."""

    def __init__(self) -> None:
        self._jobs: dict[str, dict[str, Any]] = {}
        self._subscribers: dict[str, set[WebSocket]] = {}
        self._lock = threading.RLock()

    def create_job(self, filename: str) -> dict[str, Any]:
        job_id = uuid.uuid4().hex
        job = {
            "job_id": job_id,
            "filename": filename,
            "status": JobStatus.queued,
            "progress": 0,
            "message": "Queued",
            "error": None,
            "result": None,
            "created_at": _now(),
            "updated_at": _now(),
        }
        with self._lock:
            self._jobs[job_id] = job
        return dict(job)

    def update(self, job_id: str, **fields: Any) -> dict[str, Any]:
        with self._lock:
            job = self._jobs[job_id]
            job.update(fields)
            job["updated_at"] = _now()
            return dict(job)

    def get(self, job_id: str) -> dict[str, Any] | None:
        with self._lock:
            job = self._jobs.get(job_id)
            return dict(job) if job else None

    async def connect(self, job_id: str, ws: WebSocket) -> None:
        with self._lock:
            self._subscribers.setdefault(job_id, set()).add(ws)
        snapshot = self.get(job_id)
        if snapshot:
            await ws.send_json(self._event_for(snapshot))

    def disconnect(self, job_id: str, ws: WebSocket) -> None:
        with self._lock:
            subscribers = self._subscribers.get(job_id)
            if subscribers is None:
                return
            subscribers.discard(ws)
            if not subscribers:
                self._subscribers.pop(job_id, None)

    async def broadcast(self, job_id: str, event: dict[str, Any]) -> None:
        with self._lock:
            subscribers = list(self._subscribers.get(job_id, ()))
        for ws in subscribers:
            try:
                await ws.send_json(event)
            except Exception:
                self.disconnect(job_id, ws)

    def emit_from_thread(
        self,
        loop: asyncio.AbstractEventLoop,
        job_id: str,
        event: dict[str, Any],
    ) -> None:
        future = asyncio.run_coroutine_threadsafe(
            self.broadcast(job_id, event),
            loop,
        )
        try:
            future.result(timeout=5)
        except Exception:
            # Progress delivery must never fail the assessment itself.
            pass

    @staticmethod
    def _event_for(job: dict[str, Any]) -> dict[str, Any]:
        status = job["status"]
        if status == JobStatus.completed:
            return {
                "type": "bim.completed",
                "job_id": job["job_id"],
                "status": status,
                "progress": 100,
                "message": job.get("message", "Assessment complete"),
            }
        if status == JobStatus.failed:
            return {
                "type": "bim.failed",
                "job_id": job["job_id"],
                "status": status,
                "progress": job.get("progress", 0),
                "message": job.get("message", "Assessment failed"),
                "error": job.get("error"),
            }
        return {
            "type": "bim.progress",
            "job_id": job["job_id"],
            "status": status,
            "progress": job.get("progress", 0),
            "message": job.get("message", ""),
        }
