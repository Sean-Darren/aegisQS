"""CLI bridge that renders an IFC model to a 2D plan PNG on stdout.

The Next.js drawing viewer needs a raster image before it can paint an IFC
revision.  The local fallback route writes the uploaded IFC to a temp file,
then invokes this script so the Python rendering logic can run on the same
server that already hosts the Hugging Face revision bridge.
"""

from __future__ import annotations

import io
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from PIL import Image  # noqa: E402

from app.image_material_detector import _render_ifc_rgb  # noqa: E402


def main() -> int:
    if len(sys.argv) != 2:
        print(
            "usage: render_ifc_preview.py IFC_PATH",
            file=sys.stderr,
        )
        return 2

    path = Path(sys.argv[1])
    if path.suffix.lower() != ".ifc":
        print("expected an .ifc file", file=sys.stderr)
        return 2

    rgb = _render_ifc_rgb(path)
    image = Image.fromarray(rgb)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    sys.stdout.buffer.write(buffer.getvalue())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
