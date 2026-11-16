"""Application singletons shared by routes."""

from __future__ import annotations

import secrets
from typing import Any, Mapping

from fastapi import HTTPException, Request, WebSocket

from app.config import Settings
from app.state import JobManager

settings = Settings.load()
settings.ensure_pipeline_path()

manager = JobManager()


def get_settings() -> Settings:
    return settings


def get_manager() -> JobManager:
    return manager


def _origin_allowed(origin: str | None) -> bool:
    """Treat the configured CORS origins as the browser allowlist."""
    if not origin:
        return False
    incoming = origin.rstrip("/")
    return any(
        allowed.rstrip("/") == incoming for allowed in settings.cors_origins
    )


def _token_valid(token: str | None) -> bool:
    return bool(
        settings.api_key
        and token
        and secrets.compare_digest(token, settings.api_key)
    )


def _bearer_token(headers: Mapping[str, str]) -> str | None:
    scheme, _, value = (headers.get("authorization") or "").partition(" ")
    if scheme.lower() == "bearer" and value.strip():
        return value.strip()
    return None


def client_is_allowed(
    headers: Mapping[str, str],
    token_query: str | None = None,
) -> bool:
    """Gate worker access.

    Accepted clients:
    - server-to-server calls bearing ``Authorization: Bearer <AEGIS...EY>``
      matching the configured ``AEGISQS_API_KEY``;
    - browser calls (including WebSocket handshakes) whose ``Origin`` is one
      of the configured CORS origins;
    - any client when ``AEGISQS_ALLOW_UNAUTHENTICATED`` is enabled, which is
      intended for local development only.
    """
    if settings.allow_unauthenticated:
        return True
    if _token_valid(_bearer_token(headers)):
        return True
    if _token_valid(token_query):
        return True
    return _origin_allowed(headers.get("origin"))


def ensure_authenticated(request: Request) -> None:
    """FastAPI dependency enforcing :func:`client_is_allowed` on REST routes."""
    if not client_is_allowed(request.headers):
        raise HTTPException(
            status_code=403,
            detail="BIM worker access denied for this client.",
        )


def websocket_allowed(websocket: WebSocket) -> bool:
    """WS variant of :func:`client_is_allowed` (token may arrive as ?token=)."""
    token: Any = websocket.query_params.get("token")
    return client_is_allowed(websocket.headers, token)
