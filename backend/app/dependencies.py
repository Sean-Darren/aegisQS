"""Application singletons shared by routes."""

from __future__ import annotations

from app.config import Settings
from app.state import JobManager

settings = Settings.load()
settings.ensure_pipeline_path()

manager = JobManager()


def get_settings() -> Settings:
    return settings


def get_manager() -> JobManager:
    return manager
