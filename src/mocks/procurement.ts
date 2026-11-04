import {
  procurementAdviceSchema,
  type Material,
  type PriceForecast,
  type ProcurementAdvice,
} from "@/schemas";
const round = (n: number) => Math.round(n * 100) / 100;
export function calculateAdvice(input: {
  id: string;
  projectId: string;
  material: Material;
  forecast: PriceForecast;
  quantity: number;
  neededBy: string;
  leadTimeWeeks: number;
  createdBy: string;
  createdAt: string;
}): ProcurementAdvice {
  const { material, forecast, quantity, neededBy, leadTimeWeeks, createdAt } =
    input;
  if (
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    !Number.isFinite(leadTimeWeeks) ||
    leadTimeWeeks < 0
  )
    throw new RangeError(
      "Quantity must be positive and lead time nonnegative.",
    );
  const deadline = new Date(neededBy);
  if (!Number.isFinite(deadline.getTime()))
    throw new RangeError("A valid need-by date is required.");
  deadline.setTime(deadline.getTime() - leadTimeWeeks * 7 * 86400000);
  if (deadline.getTime() < Date.parse(createdAt))
    throw new RangeError(
      "The latest order date is in the past. Review the need-by date or lead time.",
    );
  const today = createdAt.slice(0, 7);
  const candidates = forecast.forecast.filter(
    (p) =>
      p.period >= today &&
      `${p.period}-01` <= deadline.toISOString().slice(0, 10),
  );
  const cheapest = candidates.reduce<
    PriceForecast["forecast"][number] | undefined
  >((best, p) => (!best || p.p50 < best.p50 ? p : best), undefined);
  const now = quantity * material.latestPrice;
  const advantageous = cheapest && cheapest.p50 < material.latestPrice;
  const laterRising =
    candidates.length > 0 &&
    candidates.every((p) => p.p50 > material.latestPrice);
  const recommendation = advantageous
    ? "buy_in_window"
    : laterRising
      ? "buy_now"
      : "no_clear_advantage";
  // A window spans adjacent equally cheapest months; it never includes a dearer month.
  const tied = cheapest
    ? candidates.filter((p) => Math.abs(p.p50 - cheapest.p50) < 0.005)
    : [];
  let from = cheapest?.period,
    to = cheapest?.period;
  if (cheapest) {
    let index = candidates.indexOf(cheapest);
    while (
      index + 1 < candidates.length &&
      Math.abs(candidates[index + 1].p50 - cheapest.p50) < 0.005
    ) {
      index++;
      to = candidates[index].period;
    }
    from = tied[0]?.period ?? from;
  }
  const chosen = advantageous ? cheapest : undefined;
  return procurementAdviceSchema.parse({
    id: input.id,
    projectId: input.projectId,
    materialId: material.id,
    quantity,
    neededBy,
    leadTimeWeeks,
    latestOrderDate: deadline.toISOString(),
    recommendation,
    ...(chosen
      ? {
          window: { from, to },
          expectedCostInWindow: round(chosen.p50 * quantity),
          expectedSaving: round(now - chosen.p50 * quantity),
        }
      : {}),
    costIfBoughtNow: round(now),
    range: {
      low: round((cheapest?.p10 ?? material.latestPrice) * quantity),
      high: round((cheapest?.p90 ?? material.latestPrice) * quantity),
    },
    confidence: cheapest ? "medium" : "low",
    rationale: [
      chosen
        ? `The lowest forecast median before the latest order date is ${chosen.period}; costs use the p10–p90 range.`
        : laterRising
          ? "All eligible forecast medians exceed the latest observed price. Buying now may reduce exposure."
          : "No lower eligible forecast median is available; there is no clear price advantage.",
      `Lead time is ${leadTimeWeeks} weeks. Forecasts are indicative and require QS review.`,
    ],
    createdBy: input.createdBy,
    createdAt,
  });
}
