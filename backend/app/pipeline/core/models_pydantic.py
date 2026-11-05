"""Pydantic v2 models for the AegisQS BIM pipeline.

The models centralise validation at construction time.  They are strict by
default (``extra='forbid'``) and validate on assignment, which prevents
invalid data from silently propagating through pipeline stages.
"""

from __future__ import annotations

from typing import Any

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
    ValidationError as PydanticValidationError,
)

from core.enums import Confidence, GateState, MaterialFamily, Severity
from core.exceptions import ModelValidationError, ValidationError
from core.validators import (
    validate_ifc_category,
    validate_non_empty_string,
)


def _format_pydantic_error(exc: PydanticValidationError) -> str:
    """Return a compact, user-facing message for a Pydantic validation error."""
    lines = [str(exc)]
    try:
        for err in exc.errors():
            field = ".".join(str(part) for part in err.get("loc", []))
            msg = err.get("msg", "invalid value")
            input_value = err.get("input", "")
            lines.append(f"  - {field or '<model>'}: {msg} (input={input_value!r})")
    except Exception:  # pragma: no cover - defensive fallback
        pass
    return "\n".join(lines)


class AegisQSBaseModel(BaseModel):
    """Shared base that enforces assignment validation and strict extras."""

    model_config = ConfigDict(
        validate_assignment=True,
        extra="forbid",
        use_enum_values=False,
    )

    def __init__(self, **data: Any) -> None:
        try:
            super().__init__(**data)
        except PydanticValidationError as exc:
            raise ModelValidationError(_format_pydantic_error(exc)) from exc

    def __setattr__(self, name: str, value: Any) -> None:
        try:
            super().__setattr__(name, value)
        except PydanticValidationError as exc:
            raise ModelValidationError(_format_pydantic_error(exc)) from exc

    @classmethod
    def model_validate(cls, obj: Any, **kwargs: Any) -> "AegisQSBaseModel":
        try:
            return super().model_validate(obj, **kwargs)
        except PydanticValidationError as exc:
            raise ModelValidationError(_format_pydantic_error(exc)) from exc

    @classmethod
    def model_validate_json(
        cls,
        json_data: str | bytes | bytearray,
        **kwargs: Any,
    ) -> "AegisQSBaseModel":
        try:
            return super().model_validate_json(json_data, **kwargs)
        except PydanticValidationError as exc:
            raise ModelValidationError(_format_pydantic_error(exc)) from exc


class BimElement(AegisQSBaseModel):
    """A single BIM element extracted from a model.

    ``extra='allow'`` intentionally keeps this model forward-compatible with
    vendor-specific element attributes such as IFC property sets.
    """

    model_config = ConfigDict(
        validate_assignment=True,
        extra="allow",
        use_enum_values=False,
    )

    id: str = Field(..., min_length=1)
    category: str
    name: str
    location: str
    volume: float = Field(..., ge=0.0)
    material_name: str | None = None
    material_family: MaterialFamily | None = None
    level: str | None = None
    area: float | None = Field(default=None, ge=0.0)
    length: float | None = Field(default=None, ge=0.0)
    classification_code: str | None = None
    properties: dict[str, Any] = Field(default_factory=dict)

    @field_validator("id")
    @classmethod
    def _validate_id(cls, value: str) -> str:
        return validate_non_empty_string(value)

    @field_validator("category")
    @classmethod
    def _validate_category(cls, value: str) -> str:
        return validate_ifc_category(value)


class MaterialSpec(AegisQSBaseModel):
    """A material specification entry in the project spec library."""

    id: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)
    aliases: list[str] = Field(default_factory=list)
    unit: str | None = None
    properties: dict[str, Any] = Field(default_factory=dict)
    material_family: MaterialFamily = MaterialFamily.OTHER

    @field_validator("id", "name")
    @classmethod
    def _validate_non_empty(cls, value: str) -> str:
        return validate_non_empty_string(value)

    @field_validator("unit")
    @classmethod
    def _validate_unit_if_present(cls, value: str | None) -> str | None:
        if value is not None and not value.strip():
            raise ValidationError("Unit must be non-empty when provided")
        return value.strip() if value is not None else None

    @field_validator("material_family", mode="before")
    @classmethod
    def _validate_family(cls, value: Any) -> MaterialFamily:
        if isinstance(value, MaterialFamily):
            return value
        if value is None:
            return MaterialFamily.OTHER
        return MaterialFamily(str(value))


class ReadinessIssue(AegisQSBaseModel):
    """An issue discovered during readiness assessment."""

    id: str = Field(..., min_length=1)
    element_id: str = Field(..., min_length=1)
    severity: Severity
    category: str = Field(..., min_length=1)
    message: str = Field(..., min_length=1)
    commercial_impact: str
    material_family: MaterialFamily | None = None

    @field_validator("id", "element_id", "category", "message")
    @classmethod
    def _validate_non_empty(cls, value: str) -> str:
        return validate_non_empty_string(value)

    @field_validator("severity", mode="before")
    @classmethod
    def _validate_severity(cls, value: Any) -> Severity:
        if isinstance(value, Severity):
            return value
        return Severity(str(value))

    @field_validator("material_family", mode="before")
    @classmethod
    def _validate_issue_family(cls, value: Any) -> MaterialFamily | None:
        if value is None or isinstance(value, MaterialFamily):
            return value
        return MaterialFamily(str(value))


class AssessmentReport(AegisQSBaseModel):
    """The consolidated output of a readiness assessment."""

    overall_score: float = Field(..., ge=0.0, le=100.0)
    gate_state: GateState
    category_scores: dict[str, float] = Field(default_factory=dict)
    issues: list[ReadinessIssue] = Field(default_factory=list)
    material_mappings: dict[str, MaterialSpec] = Field(default_factory=dict)
    summary: str = ""

    @field_validator("gate_state", mode="before")
    @classmethod
    def _validate_gate_state(cls, value: Any) -> GateState:
        if isinstance(value, GateState):
            return value
        return GateState(str(value))

    @model_validator(mode="after")
    def _validate_report_consistency(self) -> "AssessmentReport":
        """Enforce category-score bounds after all fields are parsed."""
        for category, score in self.category_scores.items():
            if not isinstance(score, (int, float)) or score < 0.0 or score > 100.0:
                raise ValueError(
                    f"Category score for {category!r} must be between 0 and 100, "
                    f"got {score!r}"
                )
        return self


class BOQItem(AegisQSBaseModel):
    """A bill-of-quantities line item."""

    item_id: str = Field(..., min_length=1)
    description: str = ""
    classification: str = ""
    unit: str = ""
    quantity: float = Field(..., ge=0.0)
    rate: float = Field(..., ge=0.0)
    element_ids: list[str] = Field(default_factory=list)
    material_family: MaterialFamily | None = None

    @field_validator("item_id")
    @classmethod
    def _validate_item_id(cls, value: str) -> str:
        return validate_non_empty_string(value)

    @field_validator("material_family", mode="before")
    @classmethod
    def _validate_material_family(cls, value: Any) -> MaterialFamily | None:
        if value is None or isinstance(value, MaterialFamily):
            return value
        return MaterialFamily(str(value))


class PricedItem(AegisQSBaseModel):
    """A BOQ line item after unit-rate pricing has been applied."""

    item_id: str = ""
    description: str = ""
    quantity: float = Field(default=0.0, ge=0.0)
    unit: str = ""
    rate: float = Field(default=0.0, ge=0.0)
    total_price: float = Field(..., ge=0.0)
    confidence: Confidence
    price_book_item_code: str | None = None

    @field_validator("confidence", mode="before")
    @classmethod
    def _validate_confidence(cls, value: Any) -> Confidence:
        if isinstance(value, Confidence):
            return value
        return Confidence(str(value))
