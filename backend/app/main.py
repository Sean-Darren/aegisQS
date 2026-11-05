"""AegisQS BIM worker entry point."""

from __future__ import annotations

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.dependencies import manager, settings
from app.routers.bim import router as bim_router

app = FastAPI(title="AegisQS BIM Worker", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(bim_router, prefix="/api/v1/bim", tags=["bim"])


@app.get("/health")
async def health() -> dict[str, str | bool]:
    return {"status": "ok", "mock_mode": settings.mock_mode}


@app.websocket("/ws/bim/{job_id}")
async def bim_progress(websocket: WebSocket, job_id: str) -> None:
    await websocket.accept()
    await manager.connect(job_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(job_id, websocket)
