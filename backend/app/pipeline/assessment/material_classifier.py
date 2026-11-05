"""Deterministic, regex-based material family classification.

Maps free-text material names (e.g. ``"reinforced concrete C32/40"``) to a
:class:`MaterialFamily` with a confidence score, the strongest matching
pattern, and every keyword that contributed to the decision.

The classifier is pure Python, case-insensitive, and fully deterministic —
the same input always produces the same output.  Regex patterns are
pre-compiled once and repeated classifications are memoised for fast batch
processing.

Taxonomy reference
------------------
Each family maps to a list of ``(pattern, weight)`` tuples.  A higher weight
means a more specific / reliable signal.  The strongest pattern wins:

CONCRETE
    concrete 0.70, C32/40 grade 0.95, RC 0.85, reinforced 0.80,
    precast 0.85, ready-mix 0.85, cement 0.70, mortar 0.80, grout 0.70.

STEEL
    steel 0.90, S355 grade 0.90, structural 0.95, metal 0.60, rebar 0.90,
    section 0.50, UB/UC/RSJ 0.85, stainless 0.85, galvanised 0.85, mild 0.60.

TIMBER
    timber 0.90, wood 0.80, softwood 0.90, hardwood 0.90, plywood 0.90,
    OSB 0.85, glulam 0.90, CLT 0.85, C16/C24 grade 0.85, lumber 0.80,
    engineered timber 0.90, chipboard 0.85, MDF 0.85.

MASONRY
    brick 0.85, block 0.85, masonry 0.90, stone 0.90, AAC 0.90, CMU 0.85,
    terracotta 0.80, blockwork 0.85, concrete block 0.90.

INSULATION
    insulation 0.80, mineral wool 0.95, foam 0.70, EPS 0.85, XPS 0.85,
    PIR 0.85, Rockwool 0.85, fibreglass 0.85, polyurethane 0.80.

GLAZING
    glazing 0.90, glass 0.85, double glazing 0.85, triple glazing 0.85,
    window 0.70, curtain wall 0.85, glazed 0.80, single glazing 0.80.

FINISHES
    plaster 0.90, paint 0.85, tile 0.85, flooring 0.50, finish 0.60,
    plasterboard 0.90, screed 0.90, carpet 0.85, wallpaper 0.85, render 0.80.

MEMBRANES
    membrane 0.90, waterproofing 0.90, vapour barrier 0.90, DPC 0.85,
    damp proof 0.85, roofing felt 0.85, breather 0.80, bitumen 0.80,
    tanking 0.80.

MEP
    duct 0.90, pipe 0.90, cable 0.85, HVAC 0.90, plumbing 0.90, conduit 0.85,
    electrical 0.80, mechanical 0.80, ventilation 0.80, ductwork 0.90.

Example usage::

    from assessment.material_classifier import MaterialClassifier

    classifier = MaterialClassifier()
    result = classifier.classify("reinforced concrete C32/40")
    print(result.family, result.confidence, result.matched_pattern)
"""

from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass, field
from typing import Any

from models import MaterialFamily


# ---------------------------------------------------------------------------
# confidence constants
# ---------------------------------------------------------------------------

_UNKNOWN_CONFIDENCE = 0.5   # no pattern matched → OTHER fallback


@dataclass
class ClassificationResult:
    """Result of classifying a single material name.

    Attributes
    ----------
    family:
        The most likely :class:`MaterialFamily`.
    confidence:
        A float in ``[0.0, 1.0]`` describing match strength.
    matched_pattern:
        The strongest matching keyword / phrase found in the input, or
        ``None`` when the material could not be classified.
    matched_keywords:
        All matched substrings that contributed to the decision, ordered by
        position in the input and de-duplicated.
    original_name:
        The raw material name supplied by the caller.
    """

    family: MaterialFamily
    confidence: float
    matched_pattern: str | None
    matched_keywords: list[str] = field(default_factory=list)
    original_name: str = ""


class MaterialClassifier:
    """Regex taxonomy that classifies material names into families.

    Every pattern carries an explicit weight.  Classification chooses the
    family whose strongest matching pattern has the highest weight.  Ties are
    broken deterministically by the latest match position in the input.
    """

    # Family → list of (regex pattern, confidence weight).
    TAXONOMY: dict[MaterialFamily, list[tuple[str, float]]] = {
        MaterialFamily.CONCRETE: [
            (r"\bconcrete\b", 0.70),
            (r"\bc\d{2}/\d{2}\b", 0.95),   # C32/40, C40/50
            (r"\brc\b", 0.85),
            (r"\breinforced\b", 0.80),
            (r"\bprecast\b", 0.85),
            (r"\bready.?mix\b", 0.85),
            (r"\bcement\b", 0.70),
            (r"\bmortar\b", 0.80),
            (r"\bgrout\b", 0.70),
            (r"\bself.?levelling\b", 0.70),
        ],
        MaterialFamily.STEEL: [
            (r"\bsteel\b", 0.90),
            (r"\bs\d{3}\b", 0.90),          # S275, S355
            (r"\bstructural\b", 0.95),
            (r"\bmetal\b", 0.60),
            (r"\brebar\b", 0.90),
            (r"\bsection\b", 0.50),
            (r"\bub\b|\buc\b|\brsj\b", 0.85),
            (r"\bstainless\b", 0.85),
            (r"\bgalvanised\b|\bgalvanized\b", 0.85),
            (r"\bmild\b", 0.60),
            (r"\balloy\b", 0.60),
        ],
        MaterialFamily.TIMBER: [
            (r"\btimber\b", 0.90),
            (r"\bwood\b", 0.80),
            (r"\bsoftwood\b", 0.90),
            (r"\bhardwood\b", 0.90),
            (r"\bplywood\b", 0.90),
            (r"\bosb\b", 0.85),
            (r"\bglulam\b", 0.90),
            (r"\bclt\b", 0.85),
            (r"\bc\d{2}\b", 0.85),          # C16, C24 timber grades
            (r"\blumber\b", 0.80),
            (r"\bengineered timber\b", 0.90),
            (r"\bchipboard\b", 0.85),
            (r"\bmdf\b", 0.85),
        ],
        MaterialFamily.MASONRY: [
            (r"\bbrick\b", 0.85),
            (r"\bblock\b", 0.85),
            (r"\bmasonry\b", 0.90),
            (r"\bstone\b", 0.90),
            (r"\baac\b", 0.90),
            (r"\bcmu\b", 0.85),
            (r"\bterracotta\b", 0.80),
            (r"\bblockwork\b", 0.85),
            (r"\bconcrete block\b", 0.90),
        ],
        MaterialFamily.INSULATION: [
            (r"\binsulation\b", 0.80),
            (r"\bmineral wool\b", 0.95),
            (r"\bfoam\b", 0.70),
            (r"\beps\b", 0.85),
            (r"\bxps\b", 0.85),
            (r"\bpir\b", 0.85),
            (r"\brockwool\b", 0.85),
            (r"\bfibreglass\b|\bfiberglass\b", 0.85),
            (r"\bpolyurethane\b", 0.80),
        ],
        MaterialFamily.GLAZING: [
            (r"\bglazing\b", 0.90),
            (r"\bglass\b", 0.85),
            (r"\bdouble.?glaz", 0.85),
            (r"\btriple.?glaz", 0.85),
            (r"\bwindow\b", 0.70),
            (r"\bcurtain wall\b", 0.85),
            (r"\bglazed\b", 0.80),
            (r"\bsingle.?glaz", 0.80),
        ],
        MaterialFamily.FINISHES: [
            (r"\bplaster\b", 0.90),
            (r"\bpaint\b", 0.85),
            (r"\btile\b", 0.85),
            (r"\bflooring\b", 0.50),
            (r"\bfinish\b", 0.60),
            (r"\bplasterboard\b", 0.90),
            (r"\bscreed\b", 0.90),
            (r"\bcarpet\b", 0.85),
            (r"\bwallpaper\b", 0.85),
            (r"\brender\b", 0.80),
            (r"\btiling\b", 0.85),
        ],
        MaterialFamily.MEMBRANES: [
            (r"\bmembrane\b", 0.90),
            (r"\bwaterproof\b", 0.90),
            (r"\bvapour barrier\b|\bvapor barrier\b", 0.90),
            (r"\bdpc\b", 0.85),
            (r"\bdamp proof\b", 0.85),
            (r"\broofing felt\b", 0.85),
            (r"\bbreather\b", 0.80),
            (r"\bbitumen\b", 0.80),
            (r"\btanking\b", 0.80),
        ],
        MaterialFamily.MEP: [
            (r"\bduct\b", 0.90),
            (r"\bpipe\b", 0.90),
            (r"\bcable\b", 0.85),
            (r"\bhvac\b", 0.90),
            (r"\bplumbing\b", 0.90),
            (r"\bconduit\b", 0.85),
            (r"\belectrical\b", 0.80),
            (r"\bmechanical\b", 0.80),
            (r"\bventilation\b", 0.80),
            (r"\bductwork\b", 0.90),
            (r"\bpipework\b", 0.90),
        ],
    }

    _compiled: dict[MaterialFamily, list[tuple[re.Pattern[str], float]]] = {}

    def __init__(self) -> None:
        self._cache: dict[str, ClassificationResult] = {}
        if not MaterialClassifier._compiled:
            MaterialClassifier._compiled = {
                family: [
                    (re.compile(pattern, re.IGNORECASE), weight)
                    for pattern, weight in patterns
                ]
                for family, patterns in self.TAXONOMY.items()
            }

    # ------------------------------------------------------------------
    # public API
    # ------------------------------------------------------------------

    def classify(self, material_name: str | None) -> ClassificationResult:
        """Classify a single material name string."""
        original = "" if material_name is None else str(material_name)
        key = original.strip().lower()

        cached = self._cache.get(key)
        if cached is not None:
            return ClassificationResult(
                family=cached.family,
                confidence=cached.confidence,
                matched_pattern=cached.matched_pattern,
                matched_keywords=list(cached.matched_keywords),
                original_name=original,
            )

        result = self._classify_uncached(original)
        self._cache[key] = result
        return result

    def classify_batch(
        self,
        material_names: list[str | None],
    ) -> list[ClassificationResult]:
        """Classify many material names at once.

        Repeated names are served from the memoisation cache, so a batch with
        many duplicates is substantially faster than classifying each name
        independently.
        """
        return [self.classify(name) for name in material_names]

    def classify_composite(self, composite_name: str | None) -> ClassificationResult:
        """Classify a composite material name such as ``"Brick | Insulation | Block"``.

        Each ``|``-separated component is classified individually.  The
        primary (load-bearing) component is the first one, so the returned
        family reflects that layer.  Confidence is the arithmetic mean of the
        component confidences.
        """
        original = "" if composite_name is None else str(composite_name)
        text = original.strip()
        if not text:
            return ClassificationResult(
                MaterialFamily.OTHER,
                _UNKNOWN_CONFIDENCE,
                None,
                [],
                original_name=original,
            )

        parts = [part.strip() for part in re.split(r"\s*\|\s*", text) if part.strip()]
        if not parts:
            return self.classify(original)
        if len(parts) == 1:
            return self.classify(parts[0])

        # Strip a leading element-type prefix such as "Wall:" from the first
        # (primary) layer before classifying it.
        primary_text = re.sub(r"^[A-Za-z]+:\s*", "", parts[0]).strip()
        primary_result = self.classify(primary_text)
        component_results = [primary_result]
        component_results.extend(self.classify(part) for part in parts[1:])

        avg_confidence = sum(r.confidence for r in component_results) / len(
            component_results
        )
        keywords: list[str] = []
        for result in component_results:
            for keyword in result.matched_keywords:
                if keyword not in keywords:
                    keywords.append(keyword)

        return ClassificationResult(
            family=primary_result.family,
            confidence=round(avg_confidence, 4),
            matched_pattern=primary_result.matched_pattern,
            matched_keywords=keywords,
            original_name=original,
        )

    def get_family_stats(
        self,
        classifications: list[ClassificationResult],
    ) -> dict[MaterialFamily, int]:
        """Count classifications by family."""
        return dict(Counter(c.family for c in classifications))

    def get_family_distribution(
        self,
        classifications: list[ClassificationResult],
    ) -> dict[MaterialFamily, int]:
        """Alias for :meth:`get_family_stats`."""
        return self.get_family_stats(classifications)

    def is_confident(
        self,
        result: ClassificationResult,
        threshold: float = 0.7,
    ) -> bool:
        """Return ``True`` when *result* confidence meets or exceeds *threshold*."""
        return result.confidence >= threshold

    def suggest_improvements(
        self,
        classifications: list[ClassificationResult],
    ) -> list[str]:
        """Return actionable taxonomy-improvement suggestions.

        Unclassified materials (``OTHER`` with a fallback confidence at or
        below ``0.5``) are collected, de-duplicated, and reported.
        """
        suggestions: list[str] = []
        seen: set[str] = set()
        for result in classifications:
            if result.family != MaterialFamily.OTHER:
                continue
            if result.confidence > _UNKNOWN_CONFIDENCE:
                continue
            name = (result.original_name or "").strip()
            if not name or name in seen:
                continue
            seen.add(name)
            suggestions.append(
                f"Add a taxonomy rule for unclassified material: {name!r}"
            )
        return suggestions

    # ------------------------------------------------------------------
    # internal helpers
    # ------------------------------------------------------------------

    def _classify_uncached(self, original: str) -> ClassificationResult:
        """Perform the actual taxonomy match for a single raw name."""
        text = original.strip().lower()
        if not text:
            return ClassificationResult(
                MaterialFamily.OTHER,
                _UNKNOWN_CONFIDENCE,
                None,
                [],
                original_name=original,
            )

        best_family: MaterialFamily = MaterialFamily.OTHER
        best_weight = -1.0
        best_pattern: str | None = None
        best_keywords: list[str] = []

        for family in MaterialFamily:
            if family == MaterialFamily.OTHER:
                continue

            compiled = MaterialClassifier._compiled.get(family)
            if not compiled:
                continue

            matches: list[tuple[str, int, float]] = []
            for pattern, weight in compiled:
                match = pattern.search(text)
                if match:
                    matches.append(
                        (match.group(0).lower(), match.start(), weight)
                    )

            if not matches:
                continue

            # Strongest pattern for this family: highest weight, then the
            # latest match position for deterministic tie-breaking.
            best = max(matches, key=lambda item: (item[2], item[1]))
            if best[2] <= best_weight:
                continue

            best_weight = best[2]
            best_family = family
            best_pattern = best[0]
            best_keywords = self._ordered_keywords(matches)

        if best_family == MaterialFamily.OTHER:
            return ClassificationResult(
                MaterialFamily.OTHER,
                _UNKNOWN_CONFIDENCE,
                None,
                [],
                original_name=original,
            )

        return ClassificationResult(
            family=best_family,
            confidence=best_weight,
            matched_pattern=best_pattern,
            matched_keywords=best_keywords,
            original_name=original,
        )

    @staticmethod
    def _ordered_keywords(
        matches: list[tuple[str, int, float]],
    ) -> list[str]:
        """Return matched substrings ordered by position and de-duplicated."""
        ordered = sorted(matches, key=lambda item: item[1])
        seen: set[str] = set()
        result: list[str] = []
        for text, _start, _weight in ordered:
            if text not in seen:
                seen.add(text)
                result.append(text)
        return result


__all__ = [
    "ClassificationResult",
    "MaterialClassifier",
]
