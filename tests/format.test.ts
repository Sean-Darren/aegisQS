import { test, expect } from "vitest";
import {
  formatCurrency,
  formatCompactCurrency,
  formatUnitRate,
  formatPercent,
  formatDate,
} from "@/lib/format";
test("currency and rates retain their basis", () => {
  expect(formatCurrency(186400)).toContain("186,400.00");
  expect(formatCompactCurrency(186400)).toContain("186.4");
  expect(formatUnitRate(6850, "tonne")).toContain(" / tonne");
  expect(() => formatCurrency(NaN)).toThrow();
});
test("percent and dates are locale aware", () => {
  expect(formatPercent(0.042)).toBe("4.2%");
  expect(formatDate("2026-11-04T00:00:00Z")).toContain("2026");
  expect(() => formatDate("invalid")).toThrow();
});

import {
  formatRange,
  formatSignedPercent,
  formatPeriod,
  formatFileSize,
  formatRevisionLabel,
} from "@/lib/format";
test("compact amounts, ranges and unit rates follow QS notation", () => {
  expect(formatCompactCurrency(186400)).toBe("HK$186.4k");
  expect(formatCompactCurrency(1200000)).toBe("HK$1.2M");
  expect(formatRange(171000, 203000)).toBe("HK$171k – HK$203k");
  expect(formatRange(-5, 10, String)).toBe("-5 – 10");
  expect(formatUnitRate(6850, "tonne")).toBe("HK$6,850 / tonne");
  expect(() => formatRange(20, 10)).toThrow(RangeError);
});
test("signed percent uses one decimal and true minus", () => {
  expect(formatSignedPercent(0.042)).toBe("+4.2%");
  expect(formatSignedPercent(-0.018)).toBe("−1.8%");
  expect(formatSignedPercent(0)).toBe("+0.0%");
  expect(formatSignedPercent(-0.00001)).toBe("+0.0%");
  expect(() => formatSignedPercent(Infinity)).toThrow(RangeError);
});
test("periods validate months and localize both locales", () => {
  expect(formatPeriod("2027-02")).toBe("Feb 2027");
  expect(formatPeriod("2027-02", "zh-HK")).toBe("2027年2月");
  expect(() => formatPeriod("2027-13")).toThrow(RangeError);
  expect(() => formatPeriod("2027-2")).toThrow(RangeError);
});
test("file sizes use decimal units; revisions preserve issuer labels", () => {
  expect(formatFileSize(2400000)).toBe("2.4 MB");
  expect(formatFileSize(0)).toBe("0 B");
  expect(formatFileSize(0.5)).not.toContain("undefined");
  expect(formatFileSize(1000)).toBe("1 kB");
  expect(() => formatFileSize(-1)).toThrow(RangeError);
  expect(formatRevisionLabel(" C ")).toBe("Rev C");
  expect(formatRevisionLabel("P1")).toBe("Rev P1");
  expect(() => formatRevisionLabel(" ")).toThrow(RangeError);
});
