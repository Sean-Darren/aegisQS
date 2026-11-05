from __future__ import annotations

from datetime import date
from typing import Any


class PriceBookManager:
    """In-memory registry of named price books with search and update."""

    __slots__ = ("_books",)

    _books: dict[str, list[dict[str, Any]]]

    def __init__(self) -> None:
        self._books = {}

    # ------------------------------------------------------------------
    # public API
    # ------------------------------------------------------------------

    def add_price_book(self, name: str, items: list[dict[str, Any]]) -> None:
        """Register (or replace) a named price book.

        Each item dict should have at least ``item_code`` and ``rate``.
        Missing keys are filled with sensible defaults.
        """
        normalised: list[dict[str, Any]] = []
        for item in items:
            entry: dict[str, Any] = {
                "item_code": str(item.get("item_code", "")).strip(),
                "description": str(item.get("description", "")).strip(),
                "unit": str(item.get("unit", "")).strip(),
                "rate": float(item.get("rate") or 0.0),
                "trade": str(item.get("trade", "")).strip(),
                "material_type": str(item.get("material_type", "")).strip(),
                "last_updated": str(
                    item.get("last_updated") or date.today().isoformat()
                ),
            }
            normalised.append(entry)
        self._books[name] = normalised

    def get_price_book(self, name: str) -> list[dict[str, Any]]:
        """Return all items in the named price book.

        Raises ``KeyError`` if the book does not exist.
        """
        if name not in self._books:
            raise KeyError(f"Price book '{name}' not found.")
        return list(self._books[name])  # defensive copy

    def search_items(
        self,
        query: str,
        price_book_name: str | None = None,
    ) -> list[dict[str, Any]]:
        """Case-insensitive substring search across item_code, description,
        trade, and material_type.

        If *price_book_name* is given, only that book is searched;
        otherwise all registered books are searched.

        Returns a list of matching items, each annotated with a
        ``"_price_book"`` key indicating its source book.
        """
        q = query.lower()
        books_to_search: dict[str, list[dict[str, Any]]]
        if price_book_name is not None:
            if price_book_name not in self._books:
                raise KeyError(f"Price book '{price_book_name}' not found.")
            books_to_search = {price_book_name: self._books[price_book_name]}
        else:
            books_to_search = self._books

        results: list[dict[str, Any]] = []
        for book_name, items in books_to_search.items():
            for item in items:
                if (
                    q in item["item_code"].lower()
                    or q in item["description"].lower()
                    or q in item["trade"].lower()
                    or q in item["material_type"].lower()
                ):
                    match = dict(item)
                    match["_price_book"] = book_name
                    results.append(match)

        return results

    def get_item_by_code(
        self,
        item_code: str,
        price_book_name: str,
    ) -> dict[str, Any]:
        """Return a single item by *item_code* within *price_book_name*.

        Raises ``KeyError`` if the book or item is not found.
        """
        if price_book_name not in self._books:
            raise KeyError(f"Price book '{price_book_name}' not found.")
        for item in self._books[price_book_name]:
            if item["item_code"] == item_code:
                return dict(item)
        raise KeyError(
            f"Item '{item_code}' not found in price book '{price_book_name}'."
        )

    def update_rate(
        self,
        item_code: str,
        new_rate: float,
        price_book_name: str,
    ) -> None:
        """Update the rate of an existing item in-place.

        Raises ``KeyError`` if the book or item is not found.
        """
        if price_book_name not in self._books:
            raise KeyError(f"Price book '{price_book_name}' not found.")
        for item in self._books[price_book_name]:
            if item["item_code"] == item_code:
                item["rate"] = float(new_rate)
                item["last_updated"] = date.today().isoformat()
                return
        raise KeyError(
            f"Item '{item_code}' not found in price book '{price_book_name}'."
        )

    def list_price_books(self) -> list[str]:
        """Return the names of all registered price books."""
        return sorted(self._books.keys())
