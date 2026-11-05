from __future__ import annotations

import re

from default_material_library import MaterialLibrary
from models import BimElement, MaterialSpec

_PUNCTUATION_RE = re.compile(r"[^\w\s]")
_WHITESPACE_RE = re.compile(r"\s+")


class MaterialMapper:
    """Maps BIM element material names to known MaterialSpec entries."""

    __slots__ = ("_specs",)

    _specs: list[MaterialSpec]

    def __init__(
        self,
        specs: list[MaterialSpec] | MaterialLibrary | None = None,
    ) -> None:
        """Initialise the mapper with a spec collection.

        ``specs`` may be a raw list of :class:`MaterialSpec`, a
        :class:`MaterialLibrary`, or ``None``.  When ``None``, the built-in
        default material library is used, so the mapper works out-of-the-box.
        """
        if specs is None:
            specs = MaterialLibrary().get_all_specs()
        elif isinstance(specs, MaterialLibrary):
            specs = specs.get_all_specs()
        self._specs = list(specs)

    # ------------------------------------------------------------------
    # internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _normalize(text: str) -> str:
        """Lowercase, strip punctuation, collapse whitespace."""
        lowered = text.lower()
        no_punct = _PUNCTUATION_RE.sub(" ", lowered)
        collapsed = _WHITESPACE_RE.sub(" ", no_punct)
        return collapsed.strip()

    @staticmethod
    def _levenshtein_distance(s1: str, s2: str) -> int:
        """Standard Levenshtein distance via dynamic programming."""
        if len(s1) < len(s2):
            s1, s2 = s2, s1

        if not s2:
            return len(s1)

        prev_row: list[int] = list(range(len(s2) + 1))

        for i, c1 in enumerate(s1, start=1):
            curr_row: list[int] = [i]
            for j, c2 in enumerate(s2, start=1):
                insertion = curr_row[j - 1] + 1
                deletion = prev_row[j] + 1
                substitution = prev_row[j - 1] + (0 if c1 == c2 else 1)
                curr_row.append(min(insertion, deletion, substitution))
            prev_row = curr_row

        return prev_row[-1]

    # ------------------------------------------------------------------
    # public API
    # ------------------------------------------------------------------

    def map_element(self, element: BimElement) -> tuple[str, str]:
        """Return ``(spec_id, confidence)`` for *element*.

        Confidence values
        -----------------
        ``EXACT``
            Normalized material name matches a spec name or alias exactly.
        ``FUZZY``
            Levenshtein distance ≤ 2 to the closest spec name or alias.
        ``MISSING_DATA``
            The element has no material name.
        ``NO_MATCH``
            A material name is present but no spec is within distance 2.
        """
        raw_name = element.material_name
        if not raw_name:
            return ("UNMAPPED", "MISSING_DATA")

        norm_name = self._normalize(raw_name)
        if not norm_name:
            return ("UNMAPPED", "MISSING_DATA")

        # ---- Pass 1: exact match ----
        for spec in self._specs:
            candidates: list[str] = [spec.name, *spec.aliases]
            for candidate in candidates:
                if self._normalize(candidate) == norm_name:
                    return (spec.id, "EXACT")

        # ---- Pass 2: fuzzy match (distance ≤ 2) ----
        best_spec_id: str | None = None
        best_distance: int = 999

        for spec in self._specs:
            candidates = [spec.name, *spec.aliases]
            for candidate in candidates:
                d = self._levenshtein_distance(norm_name, self._normalize(candidate))
                if d < best_distance:
                    best_distance = d
                    best_spec_id = spec.id

        if best_spec_id is not None and best_distance <= 2:
            return (best_spec_id, "FUZZY")

        # ---- Pass 4: no match within threshold ----
        return ("UNMAPPED", "NO_MATCH")
