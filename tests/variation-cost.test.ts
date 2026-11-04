import { expect, test } from "vitest";
import { costAmount, indicativeCost } from "@/features/variations/model";
test("signed quantities allow omissions to reduce the total", () => {
  expect(costAmount(4.2, 7000)).toBe(29400);
  expect(costAmount(-2, 7000)).toBe(-14000);
  expect(indicativeCost([{ amount: 29400 }, { amount: -14000 }]).total).toBe(
    15400,
  );
  expect(() => costAmount(1, -1)).toThrow();
});
test("configured range applies to the live BOQ total", () => {
  expect(
    indicativeCost([{ amount: 29400 }, { amount: 72000 }, { amount: 85000 }]),
  ).toEqual({
    total: 186400,
    low: 171488,
    high: 203176,
    basis: "Contract BOQ rates; quantities entered by QS",
  });
  expect(indicativeCost([{ amount: -100 }])).toMatchObject({
    total: -100,
    low: -109,
    high: -92,
  });
});
