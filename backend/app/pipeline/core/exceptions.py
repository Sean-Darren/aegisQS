"""Central exception hierarchy for AegisQS.

All application-level errors derive from :class:`AegisQSError`.  Validation
errors have their own subtree so callers can distinguish bad input from
pipeline execution failures.
"""

from __future__ import annotations


class AegisQSError(Exception):
    """Base class for all AegisQS errors."""


class ValidationError(AegisQSError, ValueError):
    """Base class for all input/data validation failures."""


class ModelValidationError(ValidationError):
    """Raised when a Pydantic model fails validation."""


class StageValidationError(ValidationError):
    """Raised when a pipeline stage receives invalid data."""


class PipelineError(AegisQSError):
    """Base class for pipeline execution failures."""


class StageError(PipelineError):
    """Raised when a pipeline stage fails during execution."""


class CriticalStageError(StageError):
    """Raised when a critical pipeline stage fails and halts execution."""
