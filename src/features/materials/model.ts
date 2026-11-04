import { forecastThresholds } from "@/lib/config/forecast";
import type { PriceForecast } from "@/schemas";
export function lowForecastConfidence(backtestMapePct: number) {
  return backtestMapePct > forecastThresholds.lowConfidenceBacktestMapePct;
}
export function forecastAt(
  forecast: PriceForecast,
  latestPeriod: string,
  months: number,
) {
  const [year, month] = latestPeriod.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + months, 1));
  const period = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  return forecast.forecast.find((p) => p.period === period);
}
