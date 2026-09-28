import { expect, test } from "vitest";
import {
  formatCurrency,
  formatCompactCurrency,
  formatUnitRate,
  formatSigma,
  formatPercent,
  formatDate,
} from "@/lib/format";
import { riskBandFor } from "@/lib/config";
test("HKD amounts and unit rates retain the currency and unit", () => {
  expect(formatCurrency(1250)).toBe("HK$1,250.00");
  expect(formatCompactCurrency(142800000)).toBe("HK$142.8M");
  expect(formatCurrency(0)).toBe("HK$0.00");
  expect(formatUnitRate(1250, "m²")).toBe("HK$1,250.00 / m²");
});
test.each([
  [-2.4, "−2.4σ"],
  [0.4, "+0.4σ"],
  [0, "+0.0σ"],
  [-0, "+0.0σ"],
  [-0.01, "+0.0σ"],
  [-2.46, "−2.5σ"],
])("sigma %s formats as %s", (value, expected) =>
  expect(formatSigma(value)).toBe(expected),
);
test("percent accepts fractions and always shows one decimal", () => {
  expect(formatPercent(0.15)).toBe("15.0%");
  expect(formatPercent(0.005)).toBe("0.5%");
  expect(formatPercent(0)).toBe("0.0%");
});
test("dates use the requested locale and Hong Kong calendar day", () => {
  const instant = "2026-09-27T18:00:00Z";
  expect(formatDate(instant, "en")).toBe(
    new Intl.DateTimeFormat("en-HK", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "Asia/Hong_Kong",
    }).format(new Date(instant)),
  );
  expect(formatDate(instant, "zh-HK")).toContain("28");
  expect(formatDate("2026-09-28", "zh-HK")).not.toBe(
    formatDate("2026-09-28", "en"),
  );
});
test("missing or invalid values are not silently formatted as zero", () => {
  expect(() => formatCurrency(NaN)).toThrow();
  expect(() => formatSigma(Infinity)).toThrow();
  expect(() => formatDate("invalid")).toThrow();
  expect(() => formatUnitRate(10, "")).toThrow();
});
test.each([
  [0, "critical"],
  [39.9, "critical"],
  [40, "high"],
  [60, "moderate"],
  [80, "low"],
  [100, "low"],
])("risk band boundary %s", (score, band) =>
  expect(riskBandFor(Number(score))).toBe(band),
);
