"""Small CLI bridge used by the Next.js revision-comparison route.

When ``AEGISQS_BIM_WORKER_URL`` is not set, the Next server can still run the
real Hugging Face detector locally through this script instead of returning
an empty card list.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.revision_detector import estimate_revision_difference  # noqa: E402


def _json_safe(value):
    if isinstance(value, dict):
        return {str(k): _json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(v) for v in value]
    if isinstance(value, float):
        return round(float(value), 4)
    return value


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: revision_compare.py BASE_PATH TARGET_PATH", file=sys.stderr)
        return 2

    result = estimate_revision_difference(sys.argv[1], sys.argv[2])
    print(json.dumps(_json_safe(result)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
