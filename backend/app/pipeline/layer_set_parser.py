from __future__ import annotations

import re
from typing import TypedDict

# Matches:  optional name text, then optional "(digits mm)" at end
# Group 1: material name (stripped of trailing parenthetical)
# Group 2: thickness digits (if present)
_LAYER_RE = re.compile(
    r"^\s*(.+?)\s*(?:\(\s*(\d+(?:\.\d+)?)\s*mm\s*\))?\s*$",
    re.IGNORECASE,
)

_SEPARATOR = " | "


class LayerDict(TypedDict):
    material_name: str
    thickness_mm: float
    percentage_of_total: float
    total_thickness_mm: float


class LayerSetParser:
    """Parse pipe-delimited wall / slab build-up strings into structured layers."""

    @staticmethod
    def parse_layer_set(layer_string: str) -> list[LayerDict]:
        """Return one dict per layer with computed percentages.

        Parameters
        ----------
        layer_string:
            e.g. ``"Plaster (15mm) | Concrete Block (100mm) | Insulation (50mm)"``

        Returns
        -------
        list[LayerDict]
            Each dict contains ``material_name``, ``thickness_mm``,
            ``percentage_of_total``, and ``total_thickness_mm``.
        """
        # ---- split into raw segments ----
        raw_segments = [s for s in layer_string.split(_SEPARATOR) if s.strip()]

        # ---- parse each segment ----
        parsed: list[tuple[str, float]] = []
        for seg in raw_segments:
            m = _LAYER_RE.match(seg)
            if m is None:
                continue  # unparseable segment → skip
            name = m.group(1).strip()
            thick_str = m.group(2)
            thickness = float(thick_str) if thick_str else 0.0
            parsed.append((name, thickness))

        total = sum(t for _, t in parsed)

        # ---- build result ----
        result: list[LayerDict] = []
        for name, thickness in parsed:
            pct = (thickness / total * 100.0) if total > 0.0 else 0.0
            result.append(
                LayerDict(
                    material_name=name,
                    thickness_mm=thickness,
                    percentage_of_total=round(pct, 2),
                    total_thickness_mm=round(total, 2),
                )
            )

        return result
