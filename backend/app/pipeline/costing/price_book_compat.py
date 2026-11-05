"""Backward-compatible shims for the old price-book API.

This module provides drop-in replacement classes that delegate to the
new unified :class:`costing.price_book.PriceBook`.  Existing code that
imports ``PriceBookImporter``, ``PriceBookManager``, ``UnitRatePricer``,
or ``RegionalPricingAdjuster`` can switch to these without changes.

Usage (old → new)::

    # Old import                         # New compat import
    from price_book_importer import ...  → from costing.price_book_compat import ...
    from price_book_manager import ...   → from costing.price_book_compat import ...
    from unit_rate_pricer import ...     → from costing.price_book_compat import ...
    from regional_pricing import ...     → from costing.price_book_compat import ...
"""

from __future__ import annotations

from datetime import date
from pathlib import Path
from typing import Any

from costing.price_book import (
    PriceBook,
    _REGIONAL_MULTIPLIERS,
    _DEFAULT_MULTIPLIER,
    _map_headers,
    _build_price_item,
    _find_match,
)


# ---------------------------------------------------------------------------
# PriceBookImporter compat
# ---------------------------------------------------------------------------


class PriceBookImporter:
    """Drop-in replacement for the old :class:`price_book_importer.PriceBookImporter`.

    Delegates to :class:`PriceBook.load_from_csv`, ``.load_from_excel``,
    and ``.load_from_json``, then returns the items as plain dicts.
    """

    @staticmethod
    def import_from_csv(file_path: str) -> list[dict[str, Any]]:
        """Read a CSV price book and return items as dicts."""
        book = PriceBook("_importer")
        book.load_from_csv(file_path)
        return [_item_to_dict(it) for it in book.get_all_items()]

    @staticmethod
    def import_from_excel(file_path: str) -> list[dict[str, Any]]:
        """Read an Excel price book and return items as dicts."""
        book = PriceBook("_importer")
        book.load_from_excel(file_path)
        return [_item_to_dict(it) for it in book.get_all_items()]

    @staticmethod
    def import_from_json(file_path: str) -> list[dict[str, Any]]:
        """Read a JSON price book and return items as dicts."""
        book = PriceBook("_importer")
        book.load_from_json(file_path)
        return [_item_to_dict(it) for it in book.get_all_items()]


# ---------------------------------------------------------------------------
# PriceBookManager compat
# ---------------------------------------------------------------------------


class PriceBookManager:
    """Drop-in replacement for the old :class:`price_book_manager.PriceBookManager`.

    Manages a named registry of :class:`PriceBook` instances internally
    while exposing the original dict-based API.
    """

    __slots__ = ("_books",)

    def __init__(self) -> None:
        self._books: dict[str, PriceBook] = {}

    def add_price_book(self, name: str, items: list[dict[str, Any]]) -> None:
        """Register (or replace) a named price book from dict items."""
        book = PriceBook(name)
        for item in items:
            book.add_items([item])
        self._books[name] = book

    def get_price_book(self, name: str) -> list[dict[str, Any]]:
        """Return all items in the named price book as dicts."""
        book = self._books.get(name)
        if book is None:
            raise KeyError(f"Price book '{name}' not found.")
        return [_item_to_dict(it) for it in book.get_all_items()]

    def search_items(
        self,
        query: str,
        price_book_name: str | None = None,
    ) -> list[dict[str, Any]]:
        """Case-insensitive substring search across registered books."""
        q = query.lower()
        books_to_search: dict[str, PriceBook]
        if price_book_name is not None:
            if price_book_name not in self._books:
                raise KeyError(f"Price book '{price_book_name}' not found.")
            books_to_search = {price_book_name: self._books[price_book_name]}
        else:
            books_to_search = self._books

        results: list[dict[str, Any]] = []
        for book_name, book in books_to_search.items():
            for item in book.get_all_items():
                if (
                    q in item.item_code.lower()
                    or q in item.description.lower()
                    or q in (item.trade or "").lower()
                    or q in (item.material_type or "").lower()
                ):
                    match = _item_to_dict(item)
                    match["_price_book"] = book_name
                    results.append(match)
        return results

    def get_item_by_code(
        self,
        item_code: str,
        price_book_name: str,
    ) -> dict[str, Any]:
        """Return a single item by *item_code* within *price_book_name*."""
        book = self._books.get(price_book_name)
        if book is None:
            raise KeyError(f"Price book '{price_book_name}' not found.")
        item = book.get_item(item_code)
        if item is None:
            raise KeyError(
                f"Item '{item_code}' not found in price book "
                f"'{price_book_name}'."
            )
        return _item_to_dict(item)

    def update_rate(
        self,
        item_code: str,
        new_rate: float,
        price_book_name: str,
    ) -> None:
        """Update the rate of an existing item in-place."""
        book = self._books.get(price_book_name)
        if book is None:
            raise KeyError(f"Price book '{price_book_name}' not found.")
        book.update_rate(item_code, new_rate)

    def list_price_books(self) -> list[str]:
        """Return the names of all registered price books."""
        return sorted(self._books.keys())


# ---------------------------------------------------------------------------
# UnitRatePricer compat
# ---------------------------------------------------------------------------


class UnitRatePricer:
    """Drop-in replacement for the old :class:`unit_rate_pricer.UnitRatePricer`.

    Delegates to :class:`PriceBook.price_items` using an internal
    :class:`PriceBook` populated from the supplied price-book list.
    """

    @staticmethod
    def price_items(
        boq_items: list[dict[str, Any]],
        price_book: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """Price BOQ items against a price book (both as dicts).

        Matching strategy (first successful pass wins):

        1. **EXACT** — BOQ ``item_id`` equals price-book ``item_code``.
        2. **SEARCH** — Description word overlap (>2 chars) + same unit.
        3. **ESTIMATED** — Same trade/material + same unit, or same unit.
        4. **NO_MATCH** — No match found; rate = 0.
        """
        book = PriceBook("_pricer")
        _populate_from_dicts(book, price_book)
        return book.price_items(boq_items, region="default")


# ---------------------------------------------------------------------------
# RegionalPricingAdjuster compat
# ---------------------------------------------------------------------------


class RegionalPricingAdjuster:
    """Drop-in replacement for the old :class:`regional_pricing.RegionalPricingAdjuster`."""

    @staticmethod
    def adjust_for_region(
        price_book: list[dict[str, Any]],
        region: str,
    ) -> list[dict[str, Any]]:
        """Return a new price book with region-adjusted rates.

        Multipliers: London 1.25, South East 1.15, North West 0.95,
        Scotland 0.90.
        """
        multiplier = _REGIONAL_MULTIPLIERS.get(
            region.strip().lower(), _DEFAULT_MULTIPLIER
        )
        adjusted: list[dict[str, Any]] = []
        for item in price_book:
            entry = dict(item)
            original = float(entry.get("rate") or 0.0)
            entry["original_rate"] = original
            entry["rate"] = round(original * multiplier, 2)
            entry["region"] = region.strip()
            adjusted.append(entry)
        return adjusted


# ---------------------------------------------------------------------------
# internal helpers
# ---------------------------------------------------------------------------


def _item_to_dict(item: Any) -> dict[str, Any]:
    """Convert a :class:`PriceItem` or dict to a plain dict."""
    if hasattr(item, "model_dump"):
        return item.model_dump()
    if isinstance(item, dict):
        return item
    return {
        "item_code": getattr(item, "item_code", ""),
        "description": getattr(item, "description", ""),
        "unit": getattr(item, "unit", ""),
        "rate": getattr(item, "rate", 0.0),
        "trade": getattr(item, "trade", None),
        "material_type": getattr(item, "material_type", None),
        "material_family": getattr(item, "material_family", None),
        "last_updated": getattr(item, "last_updated", ""),
    }


def _populate_from_dicts(
    book: PriceBook,
    items: list[dict[str, Any]],
) -> None:
    """Load *items* (dicts) into *book*."""
    for item in items:
        entry = {
            "item_code": str(item.get("item_code", "")).strip(),
            "description": str(item.get("description", "")).strip(),
            "unit": str(item.get("unit", "")).strip(),
            "rate": float(item.get("rate") or 0.0),
            "trade": str(item.get("trade", "")).strip() or None,
            "material_type": str(item.get("material_type", "")).strip() or None,
            "last_updated": str(
                item.get("last_updated") or date.today().isoformat()
            ),
        }
        try:
            book.add_item(entry)
        except ValueError:
            pass  # duplicate code, skip
