"""REST endpoints for BIM model assessment jobs."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
)

from app.config import Settings
from app.dependencies import get_manager, get_settings
from app.schemas.bim import JobCreated, JobSnapshot, JobStatus
from app.service import run_assessment
from app.state import JobManager

router = APIRouter()


def _progress_sender(
    manager: JobManager,
    loop: asyncio.AbstractEventLoop,
    job_id: str,
) -> Any:
    def send(stage: str, percent: int, message: str) -> None:
        manager.update(
            job_id,
            status=JobStatus(stage),
            progress=percent,
            message=message,
        )
        snapshot = manager.get(job_id)
        if snapshot:
            manager.emit_from_thread(loop, job_id, manager._event_for(snapshot))

    return send


def _run_job(
    manager: JobManager,
    settings: Settings,
    loop: asyncio.AbstractEventLoop,
    job_id: str,
    file_path: str,
    specs: list[dict[str, Any]] | None,
) -> None:
    try:
        result = run_assessment(
            job_id,
            file_path,
            specs=specs,
            progress=_progress_sender(manager, loop, job_id),
            mock_mode=settings.mock_mode,
        )
        manager.update(
            job_id,
            status=JobStatus.completed,
            progress=100,
            message="Assessment complete",
            result=result,
        )
    except Exception as exc:
        manager.update(
            job_id,
            status=JobStatus.failed,
            message="Assessment failed",
            error=str(exc),
        )
    finally:
        snapshot = manager.get(job_id)
        if snapshot:
            manager.emit_from_thread(loop, job_id, manager._event_for(snapshot))


@router.post("/assessments", response_model=JobCreated)
async def create_assessment(
    background_tasks: BackgroundTasks,
    manager: JobManager = Depends(get_manager),
    settings: Settings = Depends(get_settings),
    file: UploadFile = File(...),
    specs: str = Form(""),
) -> JobCreated:
    filename = file.filename or "model.bin"
    job = manager.create_job(filename)
    job_id = job["job_id"]

    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    suffix = Path(filename).suffix.lower() or ".bin"
    destination = settings.upload_dir / f"{job_id}{suffix}"
    destination.write_bytes(await file.read())

    spec_list: list[dict[str, Any]] | None = None
    if specs:
        try:
            parsed = json.loads(specs)
            if isinstance(parsed, list):
                spec_list = parsed
        except json.JSONDecodeError as exc:
            manager.update(
                job_id,
                status=JobStatus.failed,
                message="Invalid specs JSON",
                error=str(exc),
            )
            raise HTTPException(status_code=400, detail="Invalid specs JSON") from exc

    loop = asyncio.get_running_loop()
    background_tasks.add_task(
        _run_job,
        manager,
        settings,
        loop,
        job_id,
        str(destination),
        spec_list,
    )
    return JobCreated(job_id=job_id, status=JobStatus.queued)


@router.get("/assessments/{job_id}", response_model=JobSnapshot)
async def get_assessment(
    job_id: str,
    manager: JobManager = Depends(get_manager),
) -> JobSnapshot:
    job = manager.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Assessment job not found.")
    return JobSnapshot(**job)
