"""Reusable, deterministic validation helpers.

Each validator raises :class:`core.exceptions.ValidationError` (or a subclass)
when the input is invalid, and returns a normalised value otherwise.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import TypeVar
from uuid import UUID

from core.exceptions import ValidationError


E = TypeVar("E", bound=Enum)


def validate_positive_float(value: float) -> float:
    """Return *value* if it is a finite number strictly greater than zero."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValidationError(f"Expected a number, got {value!r}")

    numeric = float(value)
    if numeric <= 0.0:
        raise ValidationError(f"Expected a positive number, got {value!r}")
    return numeric


def validate_non_empty_string(value: str) -> str:
    """Return a stripped non-empty string."""
    if not isinstance(value, str):
        raise ValidationError(f"Expected a string, got {value!r}")

    stripped = value.strip()
    if not stripped:
        raise ValidationError(f"Expected a non-empty string, got {value!r}")
    return stripped


def validate_ifc_category(value: str) -> str:
    """Return *value* after validating that it starts with ``Ifc``."""
    category = validate_non_empty_string(value)
    if not category.startswith("Ifc"):
        raise ValidationError(
            f"Invalid IFC category {value!r}; expected a value starting with 'Ifc'"
        )
    return category


def validate_enum(value: str, enum_class: type[E]) -> E:
    """Coerce *value* to an enum member of *enum_class*."""
    try:
        return enum_class(value)
    except ValueError:
        allowed = ", ".join(item.value for item in enum_class)
        raise ValidationError(
            f"Invalid enum value {value!r}; expected one of: {allowed}"
        ) from None


def validate_date_string(value: str) -> datetime:
    """Parse an ISO-8601 date/time string into a ``datetime``."""
    if not isinstance(value, str):
        raise ValidationError(f"Expected a date string, got {value!r}")

    normalised = value.strip()
    if not normalised:
        raise ValidationError("Expected a non-empty ISO date string")

    if normalised.endswith("Z"):
        normalised = normalised[:-1] + "+00:00"

    try:
        return datetime.fromisoformat(normalised)
    except ValueError:
        raise ValidationError(f"Invalid ISO date string {value!r}") from None


def validate_uuid(value: str) -> UUID:
    """Parse *value* into a :class:`uuid.UUID`."""
    if not isinstance(value, str):
        raise ValidationError(f"Expected a UUID string, got {value!r}")

    try:
        return UUID(value)
    except ValueError:
        raise ValidationError(f"Invalid UUID string {value!r}") from None
