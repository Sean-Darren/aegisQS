"""Costing package — unified price book, BOQ generation, and pricing.

Modules:
  - :mod:`costing.price_book` — unified ``PriceBook`` class with loading,
    query, pricing, management, and export.
  - :mod:`costing.price_book_compat` — backward-compatible shims for code
    that still expects the old ``PriceBookImporter``, ``PriceBookManager``,
    ``UnitRatePricer``, or ``RegionalPricingAdjuster`` APIs.
"""

from costing.price_book import PriceBook, PriceItem, PricingConfidence

__all__ = [
    "PriceBook",
    "PriceItem",
    "PricingConfidence",
]
