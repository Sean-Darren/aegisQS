from __future__ import annotations

import csv
import json
from collections.abc import Sequence
from datetime import date, datetime
from pathlib import Path
from typing import Any

_EXPECTED_KEYS = frozenset({
    "item_code", "description", "unit", "rate", "trade", "material_type",
})


class PriceBookImporter:
    """Import price-book data from CSV, Excel, or JSON files."""

    # ------------------------------------------------------------------
    # public API
    # ------------------------------------------------------------------

    @staticmethod
    def import_from_csv(file_path: str) -> list[dict[str, Any]]:
        """Read a CSV price book.

        Expected columns (case-insensitive header): ``item_code``,
        ``description``, ``unit``, ``rate``, ``trade``, ``material_type``.
        An optional ``last_updated`` column is honoured if present.
        """
        path = Path(file_path)
        if not path.is_file():
            raise FileNotFoundError(f"CSV file not found: {file_path}")

        with path.open("r", newline="", encoding="utf-8-sig") as fh:
            reader = csv.DictReader(fh)
            if reader.fieldnames is None:
                return []
            mapped_fields = _map_headers(reader.fieldnames)
            rows: list[dict[str, Any]] = []
            for row in reader:
                item = _build_item(row, mapped_fields)
                rows.append(item)
            return rows

    @staticmethod
    def import_from_excel(file_path: str) -> list[dict[str, Any]]:
        """Read an Excel (.xlsx) price book via **openpyxl**.

        The first worksheet is used.  Row 1 is treated as the header.
        """
        try:
            import openpyxl  # type: ignore[import-untyped]
        except ImportError:
            raise ImportError(
                "openpyxl is required for Excel import.  Install it with: "
                "pip install openpyxl"
            )

        path = Path(file_path)
        if not path.is_file():
            raise FileNotFoundError(f"Excel file not found: {file_path}")

        wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
        try:
            ws = wb.active
            if ws is None:
                return []

            rows_iter = ws.iter_rows(values_only=True)
            header = [
                str(c).strip() if c is not None else ""
                for c in next(rows_iter, [])
            ]
            if not header:
                return []

            mapped_fields = _map_headers(header)
            items: list[dict[str, Any]] = []

            for raw in rows_iter:
                row_dict = {
                    header[i]: raw[i] if i < len(raw) else None
                    for i in range(len(header))
                }
                item = _build_item(row_dict, mapped_fields)
                items.append(item)

            return items
        finally:
            wb.close()

    @staticmethod
    def import_from_json(file_path: str) -> list[dict[str, Any]]:
        """Read a JSON price book.

        The file must contain a top-level array of objects.  Each object
        is normalised to the standard price-book schema.
        """
        path = Path(file_path)
        if not path.is_file():
            raise FileNotFoundError(f"JSON file not found: {file_path}")

        with path.open("r", encoding="utf-8") as fh:
            raw = json.load(fh)

        if not isinstance(raw, list):
            raise ValueError(
                "JSON price book must be a top-level array of items."
            )

        items: list[dict[str, Any]] = []
        for obj in raw:
            if not isinstance(obj, dict):
                continue
            mapped_fields = _map_headers(list(obj.keys()))
            item = _build_item(obj, mapped_fields)
            items.append(item)

        return items


# ------------------------------------------------------------------
# helpers
# ------------------------------------------------------------------


def _map_headers(headers: Sequence[str]) -> dict[str, str]:
    """Map case-insensitive / variant header names to canonical keys."""
    mapping: dict[str, str] = {}
    for h in headers:
        key = str(h).strip().lower().replace(" ", "_").replace("-", "_")
        if key in _EXPECTED_KEYS or key == "last_updated":
            mapping[key] = h
    return mapping


def _build_item(
    row: dict[str, Any],
    mapped_fields: dict[str, str],
) -> dict[str, Any]:
    """Build a normalised price-book dict from a raw row."""
    item: dict[str, Any] = {}

    for canonical, col_name in mapped_fields.items():
        val = row.get(col_name)
        if canonical == "rate":
            try:
                item["rate"] = float(str(val)) if val not in (None, "") else 0.0
            except (TypeError, ValueError):
                item["rate"] = 0.0
        elif canonical == "last_updated":
            item["last_updated"] = _coerce_date(val)
        else:
            item[canonical] = str(val).strip() if val is not None else ""

    # Ensure every expected key exists
    for key in _EXPECTED_KEYS:
        item.setdefault(key, "")
    item.setdefault("rate", 0.0)
    item.setdefault("last_updated", date.today().isoformat())

    return item


def _coerce_date(val: Any) -> str:
    """Normalise a date value to ISO-8601 string (``YYYY-MM-DD``)."""
    if val is None or val == "":
        return date.today().isoformat()
    if isinstance(val, (date, datetime)):
        return val.isoformat()[:10]
    # Try to parse common string formats
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(str(val).strip(), fmt).date().isoformat()
        except ValueError:
            continue
    return str(val).strip()
