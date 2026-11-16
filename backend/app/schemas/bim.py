"""JSON contracts returned by the BIM worker."""

from __future__ import annotations

from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class JobStatus(str, Enum):
    queued = "queued"
    validating = "validating"
    parsing = "parsing"
    readiness = "readiness"
    quantities = "quantities"
    boq = "boq"
    pricing = "pricing"
    completed = "completed"
    failed = "failed"


class JobCreated(BaseModel):
    job_id: str
    status: JobStatus


class JobTicket(BaseModel):
    """Single-use credential for the /ws/bim/{job_id} progress socket."""

    ticket: str
    expires_in: int = Field(ge=1)


class JobSnapshot(BaseModel):
    model_config = ConfigDict(extra="allow")

    job_id: str
    filename: str
    status: JobStatus
    progress: int = Field(ge=0, le=100)
    message: str = ""
    error: str | None = None
    result: dict[str, Any] | None = None
    created_at: str
    updated_at: str


class ProgressEvent(BaseModel):
    type: Literal["bim.progress", "bim.completed", "bim.failed"]
    job_id: str
    status: JobStatus
    progress: int = Field(ge=0, le=100)
    message: str = ""
    error: str | None = None


class RevisionBBox(BaseModel):
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)
    w: float = Field(ge=0, le=1)
    h: float = Field(ge=0, le=1)


class RevisionChange(BaseModel):
    bbox: RevisionBBox
    kind: Literal["added", "removed", "modified"]
    summary: str
    confidence: float = Field(ge=0, le=1)
    textBefore: str | None = None
    textAfter: str | None = None


class RevisionComparisonResponse(BaseModel):
    model_version: str
    base_materials: list[dict[str, Any]]
    target_materials: list[dict[str, Any]]
    changes: list[RevisionChange]
