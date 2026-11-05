"""Shared enum definitions used by Pydantic models and the wider engine."""

from __future__ import annotations

from enum import Enum


class Severity(Enum):
    """Issue severity levels."""

    BLOCKER = "BLOCKER"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class GateState(Enum):
    """Readiness gate states."""

    NOT_READY = "NOT_READY"
    CONDITIONAL = "CONDITIONAL"
    READY = "READY"


class MaterialFamily(Enum):
    """High-level material families for classification and aggregation."""

    CONCRETE = "CONCRETE"
    STEEL = "STEEL"
    TIMBER = "TIMBER"
    MASONRY = "MASONRY"
    INSULATION = "INSULATION"
    GLAZING = "GLAZING"
    FINISHES = "FINISHES"
    MEMBRANES = "MEMBRANES"
    MEP = "MEP"
    OTHER = "OTHER"


class Confidence(Enum):
    """Pricing match confidence levels."""

    EXACT = "EXACT"
    SEARCH = "SEARCH"
    ESTIMATED = "ESTIMATED"
    NO_MATCH = "NO_MATCH"
