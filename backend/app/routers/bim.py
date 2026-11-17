"""REST endpoints for BIM model assessment jobs."""

from __future__ import annotations

import asyncio
import io
import json
import uuid
from pathlib import Path
from typing import Any

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    Response,
    UploadFile,
)

from app.config import Settings
from app.dependencies import ensure_authenticated, get_manager, get_settings
from app.schemas.bim import (
    JobCreated,
    JobSnapshot,
    JobStatus,
    JobTicket,
    RevisionComparisonResponse,
)
from app.revision_detector import estimate_revision_difference
from app.image_material_detector import _render_ifc_rgb
from app.service import SUPPORTED_EXTENSIONS, run_assessment
from app.state import JobManager

router = APIRouter()

#: Formats the revision detector can actually render and diff.
#: ``.ifc`` is rendered to a 2D plan image before diffing.
REVISION_EXTENSIONS = {".ifc", ".pdf", ".png", ".jpg", ".jpeg"}


async def _read_upload(file: UploadFile, limit: int) -> bytes:
    """Read an upload in chunks, refusing files larger than ``limit`` bytes."""
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(1024 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > limit:
            raise HTTPException(
                status_code=413,
                detail=(
                    "Uploaded file exceeds the "
                    f"{max(limit // (1024 * 1024), 1)} MB size limit."
                ),
            )
        chunks.append(chunk)
    return b"".join(chunks)


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
        # Assessment uploads are single-use; remove them so the upload
        # directory cannot grow without bound.
        Path(file_path).unlink(missing_ok=True)
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
    _auth: None = Depends(ensure_authenticated),
) -> JobCreated:
    filename = file.filename or "model.bin"
    suffix = Path(filename).suffix.lower()
    if suffix not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail=(
                f"Unsupported file type '{suffix or filename}'. Expected one "
                "of: .ifc, .json, .pdf, .png, .jpg, .jpeg."
            ),
        )
    job = manager.create_job(filename)
    job_id = job["job_id"]

    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    destination = settings.upload_dir / f"{job_id}{suffix}"
    destination.write_bytes(await _read_upload(file, settings.max_upload_bytes))

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
    _auth: None = Depends(ensure_authenticated),
) -> JobSnapshot:
    job = manager.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Assessment job not found.")
    return JobSnapshot(**job)


@router.post(
    "/assessments/{job_id}/progress-ticket",
    response_model=JobTicket,
)
async def create_progress_ticket(
    job_id: str,
    manager: JobManager = Depends(get_manager),
    _auth: None = Depends(ensure_authenticated),
) -> JobTicket:
    """Mint a single-use ticket the browser can spend on its WS connection."""
    if not manager.get(job_id):
        raise HTTPException(status_code=404, detail="Assessment job not found.")
    return JobTicket(
        ticket=manager.issue_progress_ticket(job_id),
        expires_in=120,
    )


@router.post("/revision-comparisons", response_model=RevisionComparisonResponse)
async def compare_revisions(
    base: UploadFile = File(...),
    target: UploadFile = File(...),
    settings: Settings = Depends(get_settings),
    _auth: None = Depends(ensure_authenticated),
) -> RevisionComparisonResponse:
    """Run Hugging Face CLIP on two revisions and estimate their difference."""
    base_name = base.filename or "base.bin"
    target_name = target.filename or "target.bin"
    base_suffix = Path(base_name).suffix.lower()
    target_suffix = Path(target_name).suffix.lower()
    unsupported = [
        suffix
        for suffix in (base_suffix, target_suffix)
        if suffix not in REVISION_EXTENSIONS
    ]
    if unsupported:
        raise HTTPException(
            status_code=415,
            detail=(
                "Unsupported revision file type. Expected one of: "
                ".pdf, .png, .jpg, .jpeg."
            ),
        )

    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    job_root = settings.upload_dir / f"revision-{uuid.uuid4().hex}"
    job_root.mkdir(parents=True, exist_ok=True)
    base_path = job_root / f"base{base_suffix or '.png'}"
    target_path = job_root / f"target{target_suffix or '.png'}"

    try:
        base_path.write_bytes(await _read_upload(base, settings.max_upload_bytes))
        target_path.write_bytes(
            await _read_upload(target, settings.max_upload_bytes)
        )
        try:
            # CLIP/torch inference is CPU-bound and can run for many
            # seconds; keep it off the event loop so other requests and
            # WebSocket progress connections stay responsive.
            result = await asyncio.to_thread(
                estimate_revision_difference,
                str(base_path),
                str(target_path),
            )
        except Exception as exc:
            raise HTTPException(
                status_code=422,
                detail=f"Revision comparison failed: {exc}",
            ) from exc
        return RevisionComparisonResponse(**result)
    finally:
        try:
            base_path.unlink(missing_ok=True)
            target_path.unlink(missing_ok=True)
            job_root.rmdir()
        except OSError:
            pass


@router.post("/render-preview")
async def render_ifc_preview(
    file: UploadFile = File(...),
    settings: Settings = Depends(get_settings),
    _auth: None = Depends(ensure_authenticated),
) -> Response:
    """Return a lightweight 2D plan PNG for an uploaded IFC model.

    The drawing comparison viewer can only paint PDF or raster pixels, so
    IFC revisions need a raster preview before they can be illustrated.
    """
    suffix = Path(file.filename or "model.bin").suffix.lower()
    if suffix != ".ifc":
        raise HTTPException(
            status_code=415,
            detail="Only .ifc files can be rendered to a 2D preview.",
        )

    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    destination = settings.upload_dir / f"preview-{uuid.uuid4().hex}{suffix}"
    destination.write_bytes(await _read_upload(file, settings.max_upload_bytes))

    try:
        rgb = await asyncio.to_thread(_render_ifc_rgb, destination)
        from PIL import Image

        image = Image.fromarray(rgb)
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        return Response(content=buffer.getvalue(), media_type="image/png")
    finally:
        destination.unlink(missing_ok=True)
