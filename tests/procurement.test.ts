import { expect, test } from "vitest";
import { calculateAdvice } from "@/mocks/procurement";
import {
  materials,
  forecasts,
  procurement,
  fixtureTime,
} from "@/mocks/fixtures/data";
const input = {
  id: "test",
  projectId: "P-001",
  material: materials[0],
  forecast: forecasts[0],
  quantity: 4.2,
  neededBy: "2027-06-01T00:00:00Z",
  leadTimeWeeks: 8,
  createdBy: "user-1",
  createdAt: fixtureTime,
};
test("rebar advice selects the cheapest eligible p50 and its adjacent tied window", () => {
  const advice = calculateAdvice(input);
  expect(advice.recommendation).toBe("buy_in_window");
  expect(advice.window).toEqual({ from: "2027-02", to: "2027-03" });
  expect(advice.latestOrderDate).toBe("2027-04-06T00:00:00.000Z");
  const month = forecasts[0].forecast.find((p) => p.period === "2027-02")!;
  expect(advice.expectedCostInWindow).toBe(27300);
  expect(advice.expectedSaving).toBe(1470);
  expect(advice.range.low).toBeCloseTo(month.p10 * 4.2, 2);
  expect(advice.range.high).toBeCloseTo(month.p90 * 4.2, 2);
});
test("concrete has no clear advantage and copper is buy-now", () => {
  expect(procurement.map((p) => p.recommendation)).toEqual([
    "buy_in_window",
    "no_clear_advantage",
    "buy_now",
  ]);
});
test("cheap prices after the order deadline cannot influence the advice", () => {
  const forecast = structuredClone(input.forecast);
  forecast.forecast.find((p) => p.period === "2027-08")!.p50 = 1;
  const advice = calculateAdvice({ ...input, forecast });
  expect(advice.window?.from).toBe("2027-02");
  expect(() => calculateAdvice({ ...input, neededBy: "2026-11-01" })).toThrow(
    RangeError,
  );
  expect(() => calculateAdvice({ ...input, quantity: 0 })).toThrow(RangeError);
});
