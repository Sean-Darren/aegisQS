export type FormatLocale = "en" | "zh-HK";
export function formatNumber(value: number, locale: FormatLocale = "en") {
  return new Intl.NumberFormat(locale === "en" ? "en-HK" : locale, {
    maximumFractionDigits: 2,
  }).format(value);
}
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
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});
export function formatCurrency(value: number) {
  return fullCurrency.format(finite(value));
}
export function formatCompactCurrency(value: number) {
  return compactCurrency.format(finite(value)).replace(/K$/, "k");
}
export function formatUnitRate(value: number, unit: string) {
  if (!unit.trim()) throw new RangeError("A unit is required");
  return `${new Intl.NumberFormat("en-HK", { style: "currency", currency: "HKD", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(finite(value))} / ${unit}`;
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

/** Percent change input is a fraction, as for formatPercent. */
export function formatSignedPercent(
  value: number,
  locale: FormatLocale = "en",
) {
  const rounded = Number((finite(value) * 100).toFixed(1));
  const magnitude = new Intl.NumberFormat(locale === "en" ? "en-HK" : locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(Math.abs(rounded));
  return `${rounded < 0 ? "−" : "+"}${magnitude}%`;
}
export function formatRange(
  low: number,
  high: number,
  formatter: (value: number) => string = formatCompactCurrency,
) {
  if (finite(low) > finite(high))
    throw new RangeError("Range bounds must be ordered");
  return `${formatter(low)} – ${formatter(high)}`;
}
export function formatPeriod(value: string, locale: FormatLocale = "en") {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value))
    throw new RangeError("A YYYY-MM period is required");
  const [year, month] = value.split("-").map(Number);
  if (locale === "zh-HK") return `${year}年${month}月`;
  return new Intl.DateTimeFormat("en-HK", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}
export function formatFileSize(bytes: number) {
  if (finite(bytes) < 0) throw new RangeError("File size must be nonnegative");
  const units = ["B", "kB", "MB", "GB", "TB"];
  const index =
    bytes === 0
      ? 0
      : Math.min(
          units.length - 1,
          Math.max(0, Math.floor(Math.log10(bytes) / 3)),
        );
  return `${new Intl.NumberFormat("en-HK", { maximumFractionDigits: index === 0 ? 0 : 1 }).format(bytes / 1000 ** index)} ${units[index]}`;
}
export function formatRevisionLabel(label: string) {
  if (!label.trim()) throw new RangeError("A revision label is required");
  return `Rev ${label.trim()}`;
}

export function formatSignedCurrency(value: number) {
  const rounded = Math.round(finite(value) * 100) / 100;
  return `${rounded < 0 ? "−" : "+"}${formatCurrency(Math.abs(rounded))}`;
}
