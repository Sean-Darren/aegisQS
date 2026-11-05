"""Convenience re-export for the deterministic material classifier.

The canonical implementation lives in :mod:`assessment.material_classifier`.
This module exists so callers can use the shorter import path::

    from material_classifier import MaterialClassifier

Keep the taxonomy and classification logic in the ``assessment`` module;
this shim only re-exports the public API.
"""

from __future__ import annotations

from assessment.material_classifier import ClassificationResult, MaterialClassifier
from models import MaterialFamily

__all__ = [
    "ClassificationResult",
    "MaterialClassifier",
    "MaterialFamily",
]
