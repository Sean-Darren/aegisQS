"""In-memory job store and WebSocket progress hub."""

from __future__ import annotations

import asyncio
import threading
import time
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import WebSocket

from app.schemas.bim import JobStatus

#: Terminal jobs are dropped once the store exceeds this size.
MAX_RETAINED_JOBS = 200
#: Terminal jobs older than this are evicted on the next create.
JOB_RETENTION_SECONDS = 24 * 3600
#: Progress tickets are single-use and expire quickly.
TICKET_TTL_SECONDS = 120


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class JobManager:
    """Thread-safe store for assessment jobs and their socket subscribers."""

    def __init__(self) -> None:
        self._jobs: dict[str, dict[str, Any]] = {}
        self._subscribers: dict[str, set[WebSocket]] = {}
        self._tickets: dict[str, tuple[str, float]] = {}
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
            self._evict_locked()
        return dict(job)

    def _evict_locked(self) -> None:
        """Bound memory growth by dropping terminal jobs.

        Only completed/failed jobs are ever removed; queued or running jobs
        are kept regardless of age. Callers must hold ``self._lock``.
        """
        now = datetime.now(timezone.utc)
        for job_id, job in list(self._jobs.items()):
            if job["status"] not in (JobStatus.completed, JobStatus.failed):
                continue
            updated_at = datetime.fromisoformat(job["updated_at"])
            if (now - updated_at).total_seconds() > JOB_RETENTION_SECONDS:
                self._jobs.pop(job_id, None)
                self._subscribers.pop(job_id, None)
        if len(self._jobs) <= MAX_RETAINED_JOBS:
            return
        terminal = sorted(
            (job["updated_at"], job_id)
            for job_id, job in self._jobs.items()
            if job["status"] in (JobStatus.completed, JobStatus.failed)
        )
        for _, job_id in terminal[: len(self._jobs) - MAX_RETAINED_JOBS]:
            self._jobs.pop(job_id, None)
            self._subscribers.pop(job_id, None)

    def issue_progress_ticket(self, job_id: str) -> str:
        """Create a single-use, short-lived ticket for ``/ws/bim/{job_id}``.

        The REST caller is already authenticated (origin or bearer token);
        the ticket lets the browser open the progress socket without
        trusting its Origin header alone.
        """
        ticket = f"{uuid.uuid4().hex}{uuid.uuid4().hex}"
        with self._lock:
            self._purge_tickets_locked()
            self._tickets[ticket] = (
                job_id,
                time.monotonic() + TICKET_TTL_SECONDS,
            )
        return ticket

    def consume_progress_ticket(self, ticket: str, job_id: str) -> bool:
        """Atomically spend a ticket; valid only for its own job and TTL."""
        with self._lock:
            self._purge_tickets_locked()
            entry = self._tickets.pop(ticket, None)
        if entry is None:
            return False
        expected_job_id, expiry = entry
        return expected_job_id == job_id and time.monotonic() < expiry

    def _purge_tickets_locked(self) -> None:
        now = time.monotonic()
        for key, (_, expiry) in list(self._tickets.items()):
            if expiry <= now:
                self._tickets.pop(key, None)

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
