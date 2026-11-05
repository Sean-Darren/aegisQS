"""Unified price-book module — load, query, price, manage, and export.

Consolidates the functionality previously split across:
  - :mod:`price_book_importer` (CSV / Excel / JSON loading)
  - :mod:`price_book_manager` (in-memory registry, search, update)
  - :mod:`unit_rate_pricer` (tiered BOQ‑to‑price‑book matching)
  - :mod:`regional_pricing` (regional cost multipliers)
"""

from __future__ import annotations

import csv
import difflib
import json
import threading
from collections.abc import Sequence
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

from core.enums import Confidence, MaterialFamily
from core.models_pydantic import AegisQSBaseModel, BOQItem, PricedItem

# ---------------------------------------------------------------------------
# PricingConfidence is an alias for the shared Confidence enum
# ---------------------------------------------------------------------------

PricingConfidence = Confidence

# ---------------------------------------------------------------------------
# Regional multipliers (as used by the old RegionalPricingAdjuster)
# ---------------------------------------------------------------------------
_REGIONAL_MULTIPLIERS: dict[str, float] = {
    "london": 1.25,
    "south east": 1.15,
    "north west": 0.95,
    "scotland": 0.90,
}
_DEFAULT_MULTIPLIER = 1.0

# ---------------------------------------------------------------------------
# Expected canonical keys (used by header normalisation)
# ---------------------------------------------------------------------------
_EXPECTED_KEYS = frozenset({
    "item_code", "description", "unit", "rate", "trade", "material_type",
})

# ---------------------------------------------------------------------------
# PriceItem — Pydantic model
# ---------------------------------------------------------------------------


class PriceItem(AegisQSBaseModel):
    """A single line-item in a price book.

    All fields except *item_code*, *description*, *unit*, and *rate* are
    optional (defaulting to ``None`` or a sensible default).
    """

    item_code: str
    description: str
    unit: str
    rate: float
    trade: str | None = None
    material_type: str | None = None
    material_family: MaterialFamily | None = None
    last_updated: str = ""
    metadata: dict[str, Any] = {}

    def __init__(self, **data: Any) -> None:
        # Ensure last_updated defaults to today's date when empty
        if not data.get("last_updated"):
            data["last_updated"] = date.today().isoformat()
        super().__init__(**data)


# ---------------------------------------------------------------------------
# PriceBook — unified class
# ---------------------------------------------------------------------------


class PriceBook:
    """Unified price book that loads, queries, prices, manages, and exports.

    Thread-safe: all mutating operations are guarded by :class:`threading.RLock`.

    Parameters
    ----------
    name:
        A friendly name for this price book (default ``"default"``).
    """

    __slots__ = (
        "_items",
        "_lock",
        "_name",
        "_created_at",
        "_last_loaded_from",
    )

    # ------------------------------------------------------------------
    # construction
    # ------------------------------------------------------------------

    def __init__(self, name: str = "default") -> None:
        self._name: str = name
        self._items: dict[str, PriceItem] = {}
        self._lock = threading.RLock()
        self._created_at: str = datetime.now(timezone.utc).isoformat()
        self._last_loaded_from: str | None = None

    # ------------------------------------------------------------------
    # metadata properties
    # ------------------------------------------------------------------

    @property
    def name(self) -> str:
        """Friendly name of this price book."""
        return self._name

    @property
    def created_at(self) -> str:
        """ISO timestamp when this instance was created."""
        return self._created_at

    @property
    def updated_at(self) -> str:
        """ISO timestamp of the last mutation."""
        with self._lock:
            return datetime.now(timezone.utc).isoformat()

    @property
    def item_count(self) -> int:
        """Total number of items currently stored."""
        with self._lock:
            return len(self._items)

    @property
    def last_loaded_from(self) -> str | None:
        """Path the last ``load_from_*`` call read from, or ``None``."""
        return self._last_loaded_from

    # ------------------------------------------------------------------
    # loading
    # ------------------------------------------------------------------

    def load_from_csv(
        self,
        path: str,
        delimiter: str = ",",
    ) -> None:
        """Load items from a CSV file.

        The first row is treated as the header.  Column names are
        normalised case-insensitively and underscores / hyphens are folded
        to the canonical key (``item_code``, ``description``, ``unit``,
        ``rate``, ``trade``, ``material_type``, ``last_updated``).

        Raises
        ------
        FileNotFoundError
            If *path* does not exist.
        """
        file_path = Path(path)
        if not file_path.is_file():
            raise FileNotFoundError(f"CSV file not found: {path}")

        with file_path.open("r", newline="", encoding="utf-8-sig") as fh:
            reader = csv.DictReader(fh, delimiter=delimiter)
            if reader.fieldnames is None:
                return
            mapped = _map_headers(reader.fieldnames)
            with self._lock:
                for row in reader:
                    item = _build_price_item(row, mapped)
                    self._items[item.item_code] = item
                self._last_loaded_from = str(file_path.resolve())

    def load_from_excel(
        self,
        path: str,
        sheet_name: str = "Sheet1",
    ) -> None:
        """Load items from an Excel (``.xlsx``) file via **openpyxl**.

        Row 1 is treated as the header.  If *sheet_name* is not found
        the first visible sheet is used.

        Raises
        ------
        ImportError
            If ``openpyxl`` is not installed.
        FileNotFoundError
            If *path* does not exist.
        """
        try:
            import openpyxl  # type: ignore[import-untyped]
        except ImportError:
            raise ImportError(
                "openpyxl is required for Excel import.  Install it with: "
                "pip install openpyxl"
            )

        file_path = Path(path)
        if not file_path.is_file():
            raise FileNotFoundError(f"Excel file not found: {path}")

        wb = openpyxl.load_workbook(file_path, read_only=True, data_only=True)
        try:
            ws = wb[sheet_name] if sheet_name in wb.sheetnames else wb.active
            if ws is None:
                return

            rows_iter = ws.iter_rows(values_only=True)
            header = [
                str(c).strip() if c is not None else ""
                for c in next(rows_iter, [])
            ]
            if not header:
                return

            mapped = _map_headers(header)
            with self._lock:
                for raw in rows_iter:
                    row_dict = {
                        header[i]: raw[i] if i < len(raw) else None
                        for i in range(len(header))
                    }
                    item = _build_price_item(row_dict, mapped)
                    self._items[item.item_code] = item
                self._last_loaded_from = str(file_path.resolve())
        finally:
            wb.close()

    def load_from_json(self, path: str) -> None:
        """Load items from a JSON file.

        The file must contain a top-level array of objects.

        Raises
        ------
        FileNotFoundError
            If *path* does not exist.
        ValueError
            If the JSON root is not an array.
        """
        file_path = Path(path)
        if not file_path.is_file():
            raise FileNotFoundError(f"JSON file not found: {path}")

        with file_path.open("r", encoding="utf-8") as fh:
            raw = json.load(fh)

        if not isinstance(raw, list):
            raise ValueError(
                "JSON price book must be a top-level array of items."
            )

        with self._lock:
            for obj in raw:
                if not isinstance(obj, dict):
                    continue
                mapped = _map_headers(list(obj.keys()))
                item = _build_price_item(obj, mapped)
                self._items[item.item_code] = item
            self._last_loaded_from = str(file_path.resolve())

    def load_from_dataframe(self, df: Any) -> None:
        """Load items from a ``pandas.DataFrame``.

        Column names are normalised using the same rules as the CSV loader.
        Requires ``pandas`` to be installed.

        Raises
        ------
        ImportError
            If ``pandas`` is not installed.
        """
        try:
            import pandas as pd  # type: ignore[import-untyped]
        except ImportError:
            raise ImportError(
                "pandas is required for DataFrame import.  Install it with: "
                "pip install pandas"
            )

        if not isinstance(df, pd.DataFrame):
            raise TypeError(f"Expected a DataFrame, got {type(df).__name__}")

        mapped = _map_headers(list(df.columns))
        with self._lock:
            for _, row in df.iterrows():
                row_dict = row.to_dict()
                item = _build_price_item(row_dict, mapped)
                self._items[item.item_code] = item
            self._last_loaded_from = "<DataFrame>"

    # ------------------------------------------------------------------
    # query
    # ------------------------------------------------------------------

    def get_item(self, code: str) -> PriceItem | None:
        """Return the item with *code*, or ``None``.

        Matching is **case-sensitive** (exact item_code equality).
        """
        with self._lock:
            return self._items.get(code)

    def get_items(self, codes: list[str]) -> list[PriceItem]:
        """Return all items whose codes appear in *codes*."""
        results: list[PriceItem] = []
        with self._lock:
            for code in codes:
                item = self._items.get(code)
                if item is not None:
                    results.append(item)
        return results

    def search(self, query: str, limit: int = 10) -> list[PriceItem]:
        """Case-insensitive substring search across item_code, description,
        trade, and material_type.

        Returns at most *limit* results.
        """
        q = query.lower()
        results: list[PriceItem] = []
        with self._lock:
            for item in self._items.values():
                if (
                    q in item.item_code.lower()
                    or q in item.description.lower()
                    or q in (item.trade or "").lower()
                    or q in (item.material_type or "").lower()
                ):
                    results.append(item)
                    if len(results) >= limit:
                        break
        return results

    def search_by_description(
        self,
        query: str,
        limit: int = 10,
        cutoff: float = 0.6,
    ) -> list[PriceItem]:
        """Fuzzy description search using :func:`difflib.SequenceMatcher`.

        Items are ranked by similarity ratio (descending).  Only results
        above *cutoff* are returned.
        """
        q = query.lower()
        scored: list[tuple[float, PriceItem]] = []
        with self._lock:
            for item in self._items.values():
                ratio = difflib.SequenceMatcher(
                    None, q, item.description.lower()
                ).ratio()
                if ratio >= cutoff:
                    scored.append((ratio, item))
        scored.sort(key=lambda x: x[0], reverse=True)
        return [item for _, item in scored[:limit]]

    def search_by_material(
        self,
        material_family: MaterialFamily,
        limit: int = 10,
    ) -> list[PriceItem]:
        """Return items whose ``material_family`` matches."""
        results: list[PriceItem] = []
        with self._lock:
            for item in self._items.values():
                if item.material_family == material_family:
                    results.append(item)
                    if len(results) >= limit:
                        break
        return results

    def search_by_trade(
        self,
        trade: str,
        limit: int = 10,
    ) -> list[PriceItem]:
        """Case-insensitive substring search within the ``trade`` field."""
        q = trade.lower()
        results: list[PriceItem] = []
        with self._lock:
            for item in self._items.values():
                if q in (item.trade or "").lower():
                    results.append(item)
                    if len(results) >= limit:
                        break
        return results

    def get_all_items(self) -> list[PriceItem]:
        """Return every item in the price book (defensive copy)."""
        with self._lock:
            return list(self._items.values())

    def get_item_count(self) -> int:
        """Return the number of items."""
        return self.item_count

    # ------------------------------------------------------------------
    # pricing
    # ------------------------------------------------------------------

    def price_item(
        self,
        boq_item: BOQItem | dict[str, Any],
        region: str = "default",
    ) -> dict[str, Any]:
        """Price a single BOQ item and return a dict with pricing info.

        Uses the same tiered matching strategy as :meth:`price_items`.
        """
        items: list[BOQItem] = [boq_item] if isinstance(boq_item, BOQItem) else []  # type: ignore[assignment]
        dicts: list[dict[str, Any]] = [boq_item] if isinstance(boq_item, dict) else []
        if items:
            results = self.price_items(items, region)
        else:
            results = self.price_items(dicts, region)
        return results[0]

    def price_boq(
        self,
        boq_items: list[BOQItem] | list[dict[str, Any]],
        region: str = "default",
    ) -> list[dict[str, Any]]:
        """Price every item in a BOQ."""
        return self.price_items(boq_items, region)

    def price_items(
        self,
        boq_items: list[BOQItem] | list[dict[str, Any]],
        region: str = "default",
    ) -> list[dict[str, Any]]:
        """Price BOQ line-items with tiered matching.

        Matching strategy (first successful pass wins):

        1. **EXACT** — BOQ ``item_id`` equals a price-book ``item_code``.
        2. **SEARCH** — BOQ description shares a significant word (>2 chars)
           with a price-book description **and** units match.
        3. **ESTIMATED** — BOQ shares trade/material keywords + same unit,
           or falls back to any item with the same unit.
        4. **NO_MATCH** — No suitable item found; rate = 0.

        Regional multipliers are applied after matching (London 1.25,
        South East 1.15, etc.).

        Parameters
        ----------
        boq_items:
            Line-items (as dicts or :class:`BOQItem` instances).
        region:
            Region name for cost adjustment.

        Returns
        -------
        list[dict]
            Priced items (always ``dict`` to match the old API contract).
        """
        multiplier = _REGIONAL_MULTIPLIERS.get(
            region.strip().lower(), _DEFAULT_MULTIPLIER
        )

        with self._lock:
            pb_items = list(self._items.values())

        priced: list[dict[str, Any]] = []

        for boq in boq_items:
            if isinstance(boq, BOQItem):
                entry: dict[str, Any] = boq.model_dump()
            else:
                entry = dict(boq)

            boq_id = str(entry.get("item_id", ""))
            boq_desc = str(entry.get("description", "")).lower()
            boq_unit = str(entry.get("unit", "")).lower()
            quantity = float(entry.get("quantity") or 0.0)

            match = _find_match(boq_id, boq_desc, boq_unit, pb_items)

            if match is None:
                entry["rate_applied"] = 0.0
                entry["total_price"] = 0.0
                entry["price_book_item_code"] = None
                entry["confidence"] = "NO_MATCH"
            else:
                pb_item, confidence = match
                rate = pb_item.rate * multiplier
                entry["rate_applied"] = round(rate, 2)
                entry["total_price"] = round(quantity * rate, 2)
                entry["price_book_item_code"] = pb_item.item_code
                entry["confidence"] = confidence

            priced.append(entry)

        return priced

    # ------------------------------------------------------------------
    # management
    # ------------------------------------------------------------------

    def add_item(self, item: PriceItem | dict[str, Any]) -> None:
        """Add a single item.

        Raises
        ------
        ValueError
            If an item with the same ``item_code`` already exists.
        """
        pi = _coerce_to_price_item(item)
        with self._lock:
            if pi.item_code in self._items:
                raise ValueError(
                    f"Item with code {pi.item_code!r} already exists. "
                    f"Use update_item() to modify an existing item."
                )
            self._items[pi.item_code] = pi

    def add_items(self, items: list[PriceItem] | list[dict[str, Any]]) -> None:
        """Add multiple items.  Skips codes that already exist (no error)."""
        with self._lock:
            for raw in items:
                pi = _coerce_to_price_item(raw)
                if pi.item_code not in self._items:
                    self._items[pi.item_code] = pi

    def update_item(self, code: str, **kwargs: Any) -> None:
        """Update specific fields of an existing item.

        Raises
        ------
        KeyError
            If *code* is not found.
        """
        with self._lock:
            if code not in self._items:
                raise KeyError(f"Item with code {code!r} not found.")
            existing = self._items[code]
            data: dict[str, Any] = {}
            for field in PriceItem.model_fields:
                data[field] = getattr(existing, field)
            data.update(kwargs)
            data["last_updated"] = date.today().isoformat()
            self._items[code] = PriceItem(**data)

    def update_rate(self, code: str, new_rate: float) -> None:
        """Update the rate for *code*.

        Convenience shortcut for ``update_item(code, rate=new_rate)``.
        """
        self.update_item(code, rate=new_rate)

    def remove_item(self, code: str) -> None:
        """Remove the item with *code*.

        Raises
        ------
        KeyError
            If *code* is not found.
        """
        with self._lock:
            if code not in self._items:
                raise KeyError(f"Item with code {code!r} not found.")
            del self._items[code]

    def clear(self) -> None:
        """Remove every item from the price book."""
        with self._lock:
            self._items.clear()

    def merge(self, other: PriceBook, overwrite: bool = False) -> None:
        """Absorb every item from *other* into this price book.

        If *overwrite* is ``True``, items in *other* replace existing
        items with the same code; otherwise they are skipped.
        """
        with self._lock, other._lock:
            for code, item in other._items.items():
                if code in self._items and not overwrite:
                    continue
                self._items[code] = item

    # ------------------------------------------------------------------
    # export
    # ------------------------------------------------------------------

    def to_csv(self, path: str, delimiter: str = ",") -> None:
        """Write all items to a CSV file."""
        with self._lock:
            items = list(self._items.values())

        if not items:
            return

        fieldnames = [
            "item_code", "description", "unit", "rate",
            "trade", "material_type", "material_family", "last_updated",
        ]

        with Path(path).open("w", newline="", encoding="utf-8") as fh:
            writer = csv.DictWriter(fh, fieldnames=fieldnames, delimiter=delimiter)
            writer.writeheader()
            for item in items:
                row = {
                    "item_code": item.item_code,
                    "description": item.description,
                    "unit": item.unit,
                    "rate": item.rate,
                    "trade": item.trade or "",
                    "material_type": item.material_type or "",
                    "material_family": (
                        item.material_family.value
                        if item.material_family
                        else ""
                    ),
                    "last_updated": item.last_updated,
                }
                writer.writerow(row)

    def to_excel(self, path: str, sheet_name: str = "Price Book") -> None:
        """Write all items to an Excel ``.xlsx`` file via **openpyxl**."""
        try:
            import openpyxl  # type: ignore[import-untyped]
        except ImportError:
            raise ImportError(
                "openpyxl is required for Excel export.  Install it with: "
                "pip install openpyxl"
            )

        with self._lock:
            items = list(self._items.values())

        wb = openpyxl.Workbook()
        ws = wb.active
        if ws is not None:
            ws.title = sheet_name

        headers = [
            "item_code", "description", "unit", "rate",
            "trade", "material_type", "material_family", "last_updated",
        ]
        ws.append(headers)

        for item in items:
            ws.append([
                item.item_code,
                item.description,
                item.unit,
                item.rate,
                item.trade or "",
                item.material_type or "",
                item.material_family.value if item.material_family else "",
                item.last_updated,
            ])

        wb.save(path)

    def to_json(self, path: str) -> None:
        """Write all items to a JSON file as a top-level array."""
        with self._lock:
            payload = [
                {
                    "item_code": item.item_code,
                    "description": item.description,
                    "unit": item.unit,
                    "rate": item.rate,
                    "trade": item.trade,
                    "material_type": item.material_type,
                    "material_family": (
                        item.material_family.value
                        if item.material_family
                        else None
                    ),
                    "last_updated": item.last_updated,
                }
                for item in self._items.values()
            ]

        with Path(path).open("w", encoding="utf-8") as fh:
            json.dump(payload, fh, indent=2, default=str)

    def to_dataframe(self) -> Any:
        """Return all items as a ``pandas.DataFrame``.

        Requires ``pandas`` to be installed.
        """
        try:
            import pandas as pd  # type: ignore[import-untyped]
        except ImportError:
            raise ImportError(
                "pandas is required for DataFrame export.  Install it with: "
                "pip install pandas"
            )

        with self._lock:
            rows = [
                {
                    "item_code": item.item_code,
                    "description": item.description,
                    "unit": item.unit,
                    "rate": item.rate,
                    "trade": item.trade,
                    "material_type": item.material_type,
                    "material_family": (
                        item.material_family.value
                        if item.material_family
                        else None
                    ),
                    "last_updated": item.last_updated,
                }
                for item in self._items.values()
            ]

        return pd.DataFrame(rows)

    # ------------------------------------------------------------------
    # magic methods
    # ------------------------------------------------------------------

    def __len__(self) -> int:
        """``len(book)`` → number of items."""
        return self.item_count

    def __contains__(self, code: str) -> bool:
        """``code in book`` → ``True`` if the code exists."""
        with self._lock:
            return code in self._items

    def __repr__(self) -> str:
        return (
            f"<PriceBook name={self._name!r} items={self.item_count}>"
        )


# ---------------------------------------------------------------------------
# internal helpers
# ---------------------------------------------------------------------------


def _map_headers(headers: Sequence[str]) -> dict[str, str]:
    """Map case-insensitive / variant header names to canonical keys."""
    mapping: dict[str, str] = {}
    for h in headers:
        key = str(h).strip().lower().replace(" ", "_").replace("-", "_")
        if key in _EXPECTED_KEYS or key == "last_updated":
            mapping[key] = h
    return mapping


def _build_price_item(
    row: dict[str, Any],
    mapped_fields: dict[str, str],
) -> PriceItem:
    """Build a :class:`PriceItem` from a raw dict row."""
    item_data: dict[str, Any] = {}

    for canonical, col_name in mapped_fields.items():
        val = row.get(col_name)
        if canonical == "rate":
            try:
                item_data["rate"] = (
                    float(str(val)) if val not in (None, "") else 0.0
                )
            except (TypeError, ValueError):
                item_data["rate"] = 0.0
        elif canonical == "last_updated":
            item_data["last_updated"] = _coerce_date(val)
        else:
            item_data[canonical] = str(val).strip() if val is not None else ""

    for key in _EXPECTED_KEYS:
        item_data.setdefault(key, "")
    item_data.setdefault("rate", 0.0)
    item_data.setdefault("last_updated", date.today().isoformat())

    return PriceItem(**item_data)


def _coerce_date(val: Any) -> str:
    """Normalise a date value to ISO-8601 string (``YYYY-MM-DD``)."""
    if val is None or val == "":
        return date.today().isoformat()
    if isinstance(val, (date, datetime)):
        return val.isoformat()[:10]
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%Y/%m/%d"):
        try:
            return (
                datetime.strptime(str(val).strip(), fmt).date().isoformat()
            )
        except ValueError:
            continue
    return str(val).strip()


def _find_match(
    boq_id: str,
    boq_desc: str,
    boq_unit: str,
    pb_items: list[PriceItem],
) -> tuple[PriceItem, str] | None:
    """Return ``(price_item, confidence_str)`` or ``None``."""

    # ---- Pass 1: exact code match ----
    for pb in pb_items:
        if pb.item_code.strip() == boq_id.strip():
            return (pb, "EXACT")

    # ---- Pass 2: description word overlap + same unit ----
    boq_words = {w for w in boq_desc.split() if len(w) > 2}

    for pb in pb_items:
        pb_unit = pb.unit.lower()
        if pb_unit != boq_unit:
            continue
        pb_desc = pb.description.lower()
        pb_words = {w for w in pb_desc.split() if len(w) > 2}
        if boq_words & pb_words:
            return (pb, "SEARCH")

    # ---- Pass 3: same trade/material_type + same unit ----
    for pb in pb_items:
        pb_unit = pb.unit.lower()
        if pb_unit != boq_unit:
            continue
        pb_trade = (pb.trade or "").lower()
        pb_mat = (pb.material_type or "").lower()
        if pb_trade and pb_trade in boq_desc:
            return (pb, "ESTIMATED")
        if pb_mat and pb_mat in boq_desc:
            return (pb, "ESTIMATED")

    # ---- Pass 4: same unit only (loosest) ----
    for pb in pb_items:
        if pb.unit.lower() == boq_unit:
            return (pb, "ESTIMATED")

    return None


def _coerce_to_price_item(raw: PriceItem | dict[str, Any]) -> PriceItem:
    """Return a :class:`PriceItem` regardless of input type."""
    if isinstance(raw, PriceItem):
        return raw
    return PriceItem(**raw)
