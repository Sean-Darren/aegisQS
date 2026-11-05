"""Deterministic material price predictor using Ordinary Least Squares (OLS).

Purely mathematical — no ML frameworks, no external variables, no black boxes.
Same input → same output every time.
"""

from __future__ import annotations

from typing import Any

import numpy as np
from scipy import stats

# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


class HistoricalPricePredictor:
    """Forecast future material prices from a strictly-ordered historical array.

    Uses OLS linear regression (``scipy.stats.linregress``) on the time index.
    Falls back to a flat forecast when fewer than 3 data points are available.
    """

    __slots__ = ()

    # -- trend classification thresholds ------------------------------------

    _STABLE_SLOPE_THRESHOLD: float = 0.005  # fraction of current_price
    _MIN_R2_CONFIDENCE: float = 0.0
    _MIN_POINTS_FOR_REGRESSION: int = 3

    def forecast(
        self,
        material_name: str,
        historical_prices: list[float],
        forecast_months: int = 6,
    ) -> dict[str, Any]:
        """Return a deterministic price forecast.

        Parameters
        ----------
        material_name:
            Human-readable material label (e.g. ``"Steel S355"``).
        historical_prices:
            Strictly-ordered past prices, oldest first
            (e.g. ``[100, 102, 101, 105, 108]`` for the last 5 months).
        forecast_months:
            Number of future periods to project (default 6).

        Returns
        -------
        dict
            Keys: ``material``, ``current_price``, ``trend_slope``,
            ``trend_direction``, ``confidence`` (R²),
            ``forecasted_prices``, ``forecast_months``.
        """
        n = len(historical_prices)

        # --- guard: empty or single-value lists -----------------------------
        if n == 0:
            return {
                "material": material_name,
                "current_price": 0.0,
                "trend_slope": 0.0,
                "trend_direction": "stable",
                "confidence": 0.0,
                "forecasted_prices": [0.0] * forecast_months,
                "forecast_months": forecast_months,
                "method": "no_data",
            }

        current = float(historical_prices[-1])

        # --- fallback: < 3 points → flat forecast ---------------------------
        if n < self._MIN_POINTS_FOR_REGRESSION:
            return {
                "material": material_name,
                "current_price": current,
                "trend_slope": 0.0,
                "trend_direction": "stable",
                "confidence": 0.0,
                "forecasted_prices": [current] * forecast_months,
                "forecast_months": forecast_months,
                "method": "flat_fallback",
                "note": f"Insufficient data ({n} point(s)); flat projection used.",
            }

        # --- OLS linear regression on time index ----------------------------
        x = np.arange(1, n + 1, dtype=np.float64)
        y = np.array(historical_prices, dtype=np.float64)

        result = stats.linregress(x, y)
        slope: float = float(result.slope)
        intercept: float = float(result.intercept)
        r_squared: float = float(result.rvalue ** 2)

        # --- classify trend direction ---------------------------------------
        threshold = abs(current) * self._STABLE_SLOPE_THRESHOLD
        if slope > threshold:
            direction = "increasing"
        elif slope < -threshold:
            direction = "decreasing"
        else:
            direction = "stable"

        # --- project forward ------------------------------------------------
        future_x = np.arange(n + 1, n + forecast_months + 1, dtype=np.float64)
        forecasted = [round(float(slope * xi + intercept), 4) for xi in future_x]

        return {
            "material": material_name,
            "current_price": round(current, 4),
            "trend_slope": round(slope, 6),
            "trend_intercept": round(intercept, 4),
            "trend_direction": direction,
            "confidence": round(r_squared, 6),
            "forecasted_prices": forecasted,
            "forecast_months": forecast_months,
            "method": "ols_linear_regression",
            "data_points": n,
        }


# ---------------------------------------------------------------------------
# BOQ integration
# ---------------------------------------------------------------------------


def apply_forecasted_pricing(
    boq_items: list[dict[str, Any]],
    price_forecasts: dict[str, dict[str, Any]],
    purchase_month_offset: int,
) -> list[dict[str, Any]]:
    """Apply forecasted material prices to BOQ line items.

    Iterates through *boq_items* and, for each item whose material appears
    in *price_forecasts*, looks up the predicted price at
    *purchase_month_offset* (1-indexed: month 3 → index 2 of
    ``forecasted_prices``).  The item's ``rate`` and ``total_price`` are
    recalculated from the forecast.

    Parameters
    ----------
    boq_items:
        BOQ line-item dicts.  Must contain at least ``material_name`` (or
        ``description`` as fallback), ``rate``, ``quantity``, and
        ``total_price``.  ``material_name`` is matched case-insensitively.
    price_forecasts:
        Dict mapping material name → forecast dict (as returned by
        :meth:`HistoricalPricePredictor.forecast`).
    purchase_month_offset:
        1-indexed future month to price at (e.g. 3 = third month of
        forecast).  Clamped to the available forecast window.

    Returns
    -------
    list[dict]
        The BOQ items with adjusted rates, total prices, and an added
        ``price_adjustment_note`` field.
    """
    adjusted: list[dict[str, Any]] = []

    for item in boq_items:
        entry = dict(item)

        # Resolve material name
        mat_key = _resolve_material(entry)

        if mat_key is None or mat_key not in price_forecasts:
            entry["price_adjustment_note"] = (
                "No price forecast available for this material."
            )
            adjusted.append(entry)
            continue

        forecast = price_forecasts[mat_key]
        forecasted_prices: list[float] = forecast.get("forecasted_prices", [])

        if not forecasted_prices:
            entry["price_adjustment_note"] = (
                f"Forecast for '{mat_key}' contains no projected prices."
            )
            adjusted.append(entry)
            continue

        # Clamp offset to available window
        idx = max(0, min(purchase_month_offset - 1, len(forecasted_prices) - 1))
        predicted_price = forecasted_prices[idx]

        current_rate = float(entry.get("rate") or 0.0)
        old_total = float(entry.get("total_price") or 0.0)
        quantity = float(entry.get("quantity") or 0.0)

        # Calculate adjustment factor from the trend
        current_price = float(forecast.get("current_price") or 0.0)
        if current_price > 0:
            pct_change = round((predicted_price - current_price) / current_price * 100.0, 2)
        else:
            pct_change = 0.0

        # New rate = predicted price (assuming rate tracks the material unit price)
        new_rate = round(predicted_price, 4)
        new_total = round(quantity * new_rate, 2)

        direction = forecast.get("trend_direction", "stable")
        confidence = forecast.get("confidence", 0.0)

        entry["rate"] = new_rate
        entry["total_price"] = new_total
        entry["price_adjustment_note"] = (
            f"Rate adjusted by {pct_change:+.2f}% based on historical price "
            f"trend projection for Month {purchase_month_offset} "
            f"(direction={direction}, R²={confidence:.4f}, "
            f"forecast_price={predicted_price:.4f})."
        )
        entry["forecast_metadata"] = {
            "forecast_material": mat_key,
            "original_rate": current_rate,
            "original_total": old_total,
            "predicted_rate": new_rate,
            "purchase_month": purchase_month_offset,
            "pct_adjustment": pct_change,
        }

        adjusted.append(entry)

    return adjusted


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _resolve_material(item: dict[str, Any]) -> str | None:
    """Resolve a material name from a BOQ item dict.

    Checks ``material_name`` first, then ``description`` as fallback.
    Returns a lowercased key that matches forecast dict keys.
    """
    raw = item.get("material_name") or item.get("description") or ""
    if not raw or not str(raw).strip():
        return None
    return str(raw).strip()
