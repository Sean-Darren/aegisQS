from __future__ import annotations

import re
from typing import Any

# ---------------------------------------------------------------------------
# compiled patterns
# ---------------------------------------------------------------------------

# Fire rating: "60 min" or "REI 90"  → fire_rating_minutes (int)
_FIRE_RATING_RE = re.compile(
    r"REI\s*(\d+)|(\d+)\s*min",
    re.IGNORECASE,
)

# Thermal conductivity: "0.04 W/mK"  → thermal_conductivity (float)
_THERMAL_CONDUCTIVITY_RE = re.compile(
    r"(\d+(?:\.\d+)?)\s*W/(?:m·K|mK|m\.K)",
    re.IGNORECASE,
)

# Acoustic rating: "STC 50"  → acoustic_rating (int)
_ACOUSTIC_RATING_RE = re.compile(
    r"STC\s*(\d+)",
    re.IGNORECASE,
)

# Concrete grade: "C32/40"  → concrete_grade (str)
_CONCRETE_GRADE_RE = re.compile(
    r"\bC(\d{1,3}/\d{1,3})\b",
)

# Steel grade: "S355" or "B500"  → steel_grade (str)
_STEEL_GRADE_RE = re.compile(
    r"\b([SB]\d{2,4}(?:[A-Za-z]{1,4})?)\b",
)

# Density: "2400 kg/m3"  → density_kg_m3 (float)
_DENSITY_RE = re.compile(
    r"(\d+(?:\.\d+)?)\s*kg/m3",
    re.IGNORECASE,
)


class MaterialPropertyExtractor:
    """Extract structured properties from free-text material description strings."""

    @staticmethod
    def extract_properties(material_string: str) -> dict[str, Any]:
        """Return a dict of only the properties found in *material_string*.

        Supported keys
        --------------
        ``fire_rating_minutes``   : int
        ``thermal_conductivity``  : float
        ``acoustic_rating``       : int
        ``concrete_grade``        : str   (e.g. ``"C32/40"``)
        ``steel_grade``           : str   (e.g. ``"S355"``)
        ``density_kg_m3``         : float
        """
        props: dict[str, Any] = {}

        # ---- fire rating ----
        m = _FIRE_RATING_RE.search(material_string)
        if m:
            props["fire_rating_minutes"] = int(
                m.group(1) if m.group(1) is not None else m.group(2)
            )

        # ---- thermal conductivity ----
        m = _THERMAL_CONDUCTIVITY_RE.search(material_string)
        if m:
            props["thermal_conductivity"] = float(m.group(1))

        # ---- acoustic rating ----
        m = _ACOUSTIC_RATING_RE.search(material_string)
        if m:
            props["acoustic_rating"] = int(m.group(1))

        # ---- concrete grade ----
        m = _CONCRETE_GRADE_RE.search(material_string)
        if m:
            props["concrete_grade"] = f"C{m.group(1)}"

        # ---- steel grade ----
        m = _STEEL_GRADE_RE.search(material_string)
        if m:
            props["steel_grade"] = m.group(1)

        # ---- density ----
        m = _DENSITY_RE.search(material_string)
        if m:
            props["density_kg_m3"] = float(m.group(1))

        return props
