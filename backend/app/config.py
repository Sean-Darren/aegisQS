"""Environment configuration for the AegisQS BIM worker."""

from __future__ import annotations

import os
import sys
from dataclasses import dataclass
from pathlib import Path

DEFAULT_PIPELINE_ROOT = "/Users/glennjeffersonchandra/AegisQS/data-AegisQS/BIM"
DEFAULT_UPLOAD_DIR = "/tmp/aegisqs-bim-uploads"
DEFAULT_CORS_ORIGINS = "http://localhost:3000"


@dataclass(frozen=True)
class Settings:
    pipeline_root: Path
    upload_dir: Path
    cors_origins: tuple[str, ...]
    mock_mode: bool

    @classmethod
    def load(
        cls,
        env: dict[str, str] | None = None,
    ) -> "Settings":
        values = os.environ if env is None else env
        pipeline_root = Path(
            values.get("AEGISQS_PIPELINE_ROOT", DEFAULT_PIPELINE_ROOT),
        ).expanduser().resolve()
        upload_dir = Path(
            values.get("AEGISQS_UPLOAD_DIR", DEFAULT_UPLOAD_DIR),
        ).expanduser().resolve()
        cors_origins = tuple(
            origin.strip()
            for origin in values.get(
                "AEGISQS_CORS_ORIGINS", DEFAULT_CORS_ORIGINS,
            ).split(",")
            if origin.strip()
        )
        mock_mode = values.get("AEGISQS_MOCK_MODE", "0").strip().lower() in {
            "1", "true", "yes", "on",
        }
        return cls(pipeline_root, upload_dir, cors_origins, mock_mode)

    def ensure_pipeline_path(self) -> None:
        """Expose the existing deterministic pipeline to Python imports."""
        root = str(self.pipeline_root)
        if not self.pipeline_root.exists():
            raise RuntimeError(
                f"Pipeline root does not exist: {self.pipeline_root}. "
                "Set AEGISQS_PIPELINE_ROOT to the BIM pipeline directory.",
            )
        if root not in sys.path:
            sys.path.insert(0, root)
