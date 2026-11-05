from __future__ import annotations

from typing import Any


class CashFlowProjector:
    """Project cash flow over a project duration using an S-curve distribution."""

    @staticmethod
    def project_cash_flow(
        estimate: dict[str, Any],
        project_duration_months: int,
        payment_schedule: str = "monthly",
    ) -> dict[str, Any]:
        """Return a month-by-month cash-flow projection.

        Uses the normalised S-curve formula:

        .. math::

            w_i = \\frac{t}{d} \\left(1 - \\frac{t}{d}\\right) \\cdot 4

        where *t* is the month midpoint (e.g. 1.5 for month 1) and *d* is
        the total duration.  Weights are normalised so that the sum of
        planned values equals *total_estimate*.

        Parameters
        ----------
        estimate:
            Estimate dict from :class:`EstimateGenerator` (must have
            ``"total_estimate"``).
        project_duration_months:
            Number of calendar months for the project.
        payment_schedule:
            ``"monthly"`` (default).  Other values accepted but treated
            identically for now.

        Returns
        -------
        dict
            ``{"projection": [...], "total_projected": float,
            "monthly_average": float, "peak_month": int,
            "peak_value": float}``
        """
        total = float(estimate.get("total_estimate") or 0.0)
        duration = max(1, project_duration_months)

        # Compute raw weights using month midpoints
        raw_weights: list[float] = []
        for month in range(1, duration + 1):
            t = month - 0.5  # midpoint of the month
            frac = t / duration
            w = frac * (1.0 - frac) * 4.0
            raw_weights.append(w)

        # Normalise so sum of weights = 1.0
        weight_sum = sum(raw_weights)
        if weight_sum == 0.0:
            norm_weights = [1.0 / duration] * duration
        else:
            norm_weights = [w / weight_sum for w in raw_weights]

        # Build projection
        projection: list[dict[str, Any]] = []
        cumulative = 0.0
        peak_month = 1
        peak_value = 0.0

        for month in range(1, duration + 1):
            planned = round(total * norm_weights[month - 1], 2)
            cumulative += planned
            cumulative = round(cumulative, 2)

            projection.append(
                {
                    "month": month,
                    "planned_value": planned,
                    "cumulative_value": cumulative,
                }
            )

            if planned > peak_value:
                peak_value = planned
                peak_month = month

        total_projected = round(sum(p["planned_value"] for p in projection), 2)
        monthly_average = round(total_projected / duration, 2)

        return {
            "projection": projection,
            "total_projected": total_projected,
            "monthly_average": monthly_average,
            "peak_month": peak_month,
            "peak_value": peak_value,
        }
