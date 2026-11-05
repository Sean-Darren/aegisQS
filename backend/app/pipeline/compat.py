"""Backward-compatible dataclass models.

The application has migrated to the Pydantic models in
:mod:`core.models_pydantic`, but this module preserves the original
dataclass shapes for any external caller or checkpoint created before the
migration.  New code should prefer importing from :mod:`models`.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from core.enums import Confidence, GateState, MaterialFamily, Severity


@dataclass
class BimElement:
    id: str
    category: str
    name: str
    location: str
    volume: float
    material_name: Optional[str] = None
    material_family: Optional[MaterialFamily] = None
    level: Optional[str] = None
    area: Optional[float] = None
    length: Optional[float] = None
    classification_code: Optional[str] = None
    properties: dict = field(default_factory=dict)


@dataclass
class MaterialSpec:
    id: str
    name: str
    aliases: list = field(default_factory=list)
    unit: Optional[str] = None
    properties: dict = field(default_factory=dict)
    material_family: MaterialFamily = MaterialFamily.OTHER


@dataclass
class ReadinessIssue:
    id: str
    element_id: str
    severity: Severity
    category: str
    message: str
    commercial_impact: str
    material_family: Optional[MaterialFamily] = None


@dataclass
class AssessmentReport:
    overall_score: float
    gate_state: GateState
    category_scores: dict = field(default_factory=dict)
    issues: list = field(default_factory=list)
    material_mappings: dict = field(default_factory=dict)
    summary: str = ""


@dataclass
class BOQItem:
    item_id: str
    quantity: float
    rate: float
    description: str = ""
    classification: str = ""
    unit: str = ""
    element_ids: list = field(default_factory=list)
    material_family: Optional[MaterialFamily] = None


@dataclass
class PricedItem:
    total_price: float
    confidence: Confidence
    item_id: str = ""
    description: str = ""
    quantity: float = 0.0
    unit: str = ""
    rate: float = 0.0
    price_book_item_code: Optional[str] = None


__all__ = [
    "AssessmentReport",
    "BimElement",
    "BOQItem",
    "Confidence",
    "GateState",
    "MaterialFamily",
    "MaterialSpec",
    "PricedItem",
    "ReadinessIssue",
    "Severity",
]
