// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import messages from "@/messages/en.json";
import {
  materials,
  forecasts,
  procurement,
  materialNeeds,
} from "@/mocks/fixtures/data";
import { latestOrderDate } from "@/lib/procurement/latest-order-date";
import { AdviceCard } from "@/features/procurement/components/advice-card";
import { buildExposureOptions } from "@/features/procurement/chart-options";
import { exposureRows } from "@/features/procurement/model";
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
afterEach(cleanup);
test("latest order date subtracts lead time across leap days and year boundaries", () => {
  expect(latestOrderDate("2027-06-01", 8)).toBe("2027-04-06T00:00:00.000Z");
  expect(latestOrderDate("2028-03-07", 1)).toBe("2028-02-29T00:00:00.000Z");
  expect(latestOrderDate("2027-01-02", 1)).toBe("2026-12-26T00:00:00.000Z");
  expect(latestOrderDate("2027-01-02", 0)).toBe("2027-01-02T00:00:00.000Z");
  expect(() => latestOrderDate("not-a-date", 2)).toThrow(RangeError);
  expect(() => latestOrderDate("2027-01-02", -1)).toThrow(RangeError);
  expect(() => latestOrderDate("2027-01-02", NaN)).toThrow(RangeError);
});
test("low confidence precedes the recommendation, with range, rationale and provenance", () => {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AdviceCard
        advice={{ ...procurement[0], confidence: "low" }}
        material={materials[0]}
        forecast={forecasts[0]}
      />
    </NextIntlClientProvider>,
  );
  const note = screen.getByText(/^Low confidence$/);
  const recommendation = screen.getByText("Buy in window");
  expect(
    note.compareDocumentPosition(recommendation) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(screen.getByText("· Feb–Mar 2027")).toBeVisible();
  expect(screen.getByText("+HK$1,470.00")).toBeVisible();
  expect(screen.getByText(/Likely range:/)).toBeVisible();
  expect(
    screen.getByText(/Likely saving range vs latest price:/),
  ).toBeVisible();
  expect(screen.getByText(/Backtest error ±4.8%/)).toBeVisible();
  expect(screen.getByText("AI-generated")).toBeVisible();
});
test("exposure aggregates each material and sorts by p90; whiskers preserve supplied bounds", () => {
  const rows = exposureRows(
    [
      ...materialNeeds,
      {
        ...materialNeeds[0],
        quantity: 1,
        exposureHKD: { p10: 100, p50: 200, p90: 300 },
      },
    ],
    materials,
  );
  expect(rows[0].material.id).toBe("concrete");
  expect(rows.find((r) => r.material.id === "rebar")?.p50).toBe(
    materialNeeds[0].exposureHKD.p50 + 200,
  );
  const options = buildExposureOptions(
    rows,
    { rising: "Rising", median: "p50", range: "p10–p90" },
    { bar: "var(--chart-5)", ink: "var(--ink)" },
  );
  expect(options.series[0].data).toEqual(rows.map((r) => r.p50));
  expect(options.series[0].markLine.data).toEqual(
    rows.map((r, i) => [{ coord: [r.p10, i] }, { coord: [r.p90, i] }]),
  );
  expect(options.yAxis.data.some((label) => label.includes("Rising"))).toBe(
    true,
  );
});
