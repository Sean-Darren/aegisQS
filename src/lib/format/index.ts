export type FormatLocale = "en" | "zh-HK";
function finite(value: number) {
  if (!Number.isFinite(value))
    throw new RangeError("A finite number is required");
  return value;
}
const fullCurrency = new Intl.NumberFormat("en-HK", {
  style: "currency",
  currency: "HKD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const compactCurrency = new Intl.NumberFormat("en-HK", {
  style: "currency",
  currency: "HKD",
  notation: "compact",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
export function formatCurrency(value: number) {
  return fullCurrency.format(finite(value));
}
export function formatCompactCurrency(value: number) {
  return compactCurrency.format(finite(value));
}
export function formatUnitRate(value: number, unit: string) {
  if (!unit.trim()) throw new RangeError("A unit is required");
  return `${formatCurrency(value)} / ${unit}`;
}
export function formatSigma(value: number) {
  const rounded = Math.round(Math.abs(finite(value)) * 10) / 10;
  return `${value < 0 && rounded !== 0 ? "−" : "+"}${rounded.toFixed(1)}σ`;
}
/** Percent input is a fraction: 0.15 renders as 15.0%. */
export function formatPercent(value: number, locale: FormatLocale = "en") {
  return new Intl.NumberFormat(locale === "en" ? "en-HK" : locale, {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(finite(value));
}
export function formatDate(
  value: string | Date,
  locale: FormatLocale = "en",
  options: Intl.DateTimeFormatOptions = {},
) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime()))
    throw new RangeError("A valid date is required");
  return new Intl.DateTimeFormat(locale === "en" ? "en-HK" : locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...options,
    timeZone: "Asia/Hong_Kong",
  }).format(date);
}
