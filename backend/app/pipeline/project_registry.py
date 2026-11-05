from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from typing import Any


class ProjectRegistry:
    """In-memory registry of project metadata."""

    __slots__ = ("_projects",)

    _projects: dict[str, dict[str, Any]]

    def __init__(self) -> None:
        self._projects = {}

    # ------------------------------------------------------------------
    # public API
    # ------------------------------------------------------------------

    def create_project(
        self,
        project_id: str,
        name: str,
        client_name: str,
        description: str = "",
    ) -> dict[str, Any]:
        """Register a new project.

        Raises ``ValueError`` if *project_id* already exists.
        """
        if project_id in self._projects:
            raise ValueError(f"Project '{project_id}' already exists.")

        now = datetime.now(timezone.utc).isoformat()
        project: dict[str, Any] = {
            "project_id": project_id,
            "name": name,
            "client_name": client_name,
            "description": description,
            "status": "ACTIVE",
            "created_at": now,
            "updated_at": now,
        }
        self._projects[project_id] = project
        return deepcopy(project)

    def get_project(self, project_id: str) -> dict[str, Any] | None:
        """Return a project by ID, or ``None`` if not found."""
        project = self._projects.get(project_id)
        return deepcopy(project) if project is not None else None

    def list_projects(self) -> list[dict[str, Any]]:
        """Return all projects, sorted by ``created_at`` descending."""
        return sorted(
            (deepcopy(p) for p in self._projects.values()),
            key=lambda p: p["created_at"],
            reverse=True,
        )

    def update_project(
        self,
        project_id: str,
        updates: dict[str, Any],
    ) -> dict[str, Any]:
        """Update mutable fields of an existing project.

        Only ``name``, ``client_name``, and ``description`` may be
        updated.  ``project_id`` and ``created_at`` are immutable.

        Raises ``KeyError`` if *project_id* does not exist.
        """
        project = self._projects.get(project_id)
        if project is None:
            raise KeyError(f"Project '{project_id}' not found.")

        allowed = {"name", "client_name", "description"}
        for key, value in updates.items():
            if key in allowed:
                project[key] = value

        project["updated_at"] = datetime.now(timezone.utc).isoformat()
        return deepcopy(project)

    def archive_project(self, project_id: str) -> dict[str, Any]:
        """Set a project's status to ``ARCHIVED``.

        Raises ``KeyError`` if *project_id* does not exist.
        """
        project = self._projects.get(project_id)
        if project is None:
            raise KeyError(f"Project '{project_id}' not found.")

        project["status"] = "ARCHIVED"
        project["updated_at"] = datetime.now(timezone.utc).isoformat()
        return deepcopy(project)
