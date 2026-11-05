from __future__ import annotations

from typing import Any


class EstimateComparator:
    """Compare multiple estimates and highlight variances and insights."""

    @staticmethod
    def compare_estimates(estimates: list[dict[str, Any]]) -> dict[str, Any]:
        """Compare the first and last estimate in *estimates*.

        Parameters
        ----------
        estimates:
            List of estimate dicts from :class:`EstimateGenerator`.

        Returns
        -------
        dict
            ``{"estimates": [...], "comparison": {...},
            "variance_by_trade": {...},
            "variance_by_work_package": {...},
            "insights": [...]}``
        """
        if len(estimates) < 2:
            return {
                "estimates": _summarise_all(estimates),
                "comparison": {},
                "variance_by_trade": {},
                "variance_by_work_package": {},
                "insights": ["At least two estimates are required for comparison."],
            }

        first = estimates[0]
        last = estimates[-1]

        # --- summary strips ---
        summaries = _summarise_all(estimates)

        # --- top-level comparison ---
        comparison: dict[str, Any] = _compare_values(
            float(first.get("total_estimate") or 0.0),
            float(last.get("total_estimate") or 0.0),
        )
        comparison.update(
            {
                "first_estimate_id": first.get("estimate_id"),
                "first_estimate_type": first.get("estimate_type"),
                "last_estimate_id": last.get("estimate_id"),
                "last_estimate_type": last.get("estimate_type"),
            }
        )

        # --- trade variances ---
        first_trades = _get_breakdown(first, "breakdown_by_trade")
        last_trades = _get_breakdown(last, "breakdown_by_trade")
        variance_by_trade = _compare_breakdowns(first_trades, last_trades)

        # --- WP variances ---
        first_wp = _get_breakdown(first, "breakdown_by_work_package")
        last_wp = _get_breakdown(last, "breakdown_by_work_package")
        variance_by_wp = _compare_breakdowns(first_wp, last_wp)

        # --- insights ---
        insights = _generate_insights(variance_by_trade, variance_by_wp, comparison)

        return {
            "estimates": summaries,
            "comparison": comparison,
            "variance_by_trade": variance_by_trade,
            "variance_by_work_package": variance_by_wp,
            "insights": insights,
        }


# ------------------------------------------------------------------
# helpers
# ------------------------------------------------------------------


def _summarise_all(estimates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Return lightweight summaries of each estimate."""
    return [
        {
            "estimate_id": e.get("estimate_id"),
            "estimate_type": e.get("estimate_type"),
            "project_name": e.get("project_name"),
            "total_estimate": e.get("total_estimate"),
            "created_date": e.get("created_date"),
        }
        for e in estimates
    ]


def _compare_values(first_val: float, last_val: float) -> dict[str, float]:
    """Return absolute and percentage variance between two values."""
    absolute = round(last_val - first_val, 2)
    pct = round((absolute / first_val * 100.0), 2) if first_val != 0.0 else 0.0
    return {
        "first_value": first_val,
        "last_value": last_val,
        "absolute_variance": absolute,
        "percentage_variance": pct,
    }


def _get_breakdown(estimate: dict[str, Any], key: str) -> dict[str, float]:
    """Extract a named breakdown dict from an estimate's cost_breakdown."""
    cb = estimate.get("cost_breakdown") or {}
    return cb.get(key) or {}


def _compare_breakdowns(
    first_bd: dict[str, float],
    last_bd: dict[str, float],
) -> dict[str, dict[str, float]]:
    """Produce per-category variance dict."""
    all_keys = set(first_bd) | set(last_bd)
    result: dict[str, dict[str, float]] = {}
    for key in sorted(all_keys):
        fv = first_bd.get(key, 0.0)
        lv = last_bd.get(key, 0.0)
        result[key] = _compare_values(fv, lv)
    return result


def _generate_insights(
    variance_by_trade: dict[str, dict[str, float]],
    variance_by_wp: dict[str, dict[str, float]],
    comparison: dict[str, Any],
) -> list[str]:
    """Generate human-readable insights from variances."""
    insights: list[str] = []

    # Top-level trend
    pct = comparison.get("percentage_variance", 0.0)
    abs_var = comparison.get("absolute_variance", 0.0)
    if abs_var != 0.0:
        direction = "increased" if abs_var > 0 else "decreased"
        insights.append(
            f"Total estimate {direction} by {abs(pct):.1f}% "
            f"(${abs_var:+,.2f}) between the first and last estimate."
        )

    # Trades with >10% variance
    for trade, var in variance_by_trade.items():
        tpct = var.get("percentage_variance", 0.0)
        if abs(tpct) > 10.0:
            direction = "increased" if tpct > 0 else "decreased"
            insights.append(
                f"Trade '{trade}' {direction} by {abs(tpct):.1f}% "
                f"(${var.get('absolute_variance', 0):+,.2f}). Review scope or rates."
            )

    # WPs with >10% variance
    for wp, var in variance_by_wp.items():
        wpct = var.get("percentage_variance", 0.0)
        if abs(wpct) > 10.0:
            direction = "increased" if wpct > 0 else "decreased"
            insights.append(
                f"Work package '{wp}' {direction} by {abs(wpct):.1f}% "
                f"(${var.get('absolute_variance', 0):+,.2f}). "
                f"Check for scope changes or measurement errors."
            )

    if not insights:
        insights.append("No significant variances (>10%) detected between estimates.")

    return insights
