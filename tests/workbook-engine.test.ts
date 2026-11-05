import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { parseWorkbook, diffWorkbooks } from "@/mocks/workbook-engine";
const bytes = (version: number) =>
  Uint8Array.from(
    readFileSync(`public/mock-files/workbooks/boq-v${version}.xlsx`),
  ).buffer;
test("real workbook formulas expose the seeded v2 problems", async () => {
  const base = await parseWorkbook(bytes(1), "base"),
    updated = await parseWorkbook(bytes(2), "next");
  expect(base.items).toHaveLength(600);
  expect(base.checks).toHaveLength(0);
  expect(updated.items).toHaveLength(603);
  for (const rule of [
    "formula_error",
    "amount_mismatch",
    "sum_mismatch",
    "duplicate_item_ref",
  ]) {
    expect(updated.checks.filter((c) => c.rule === rule)).toHaveLength(1);
  }
  const mismatch = updated.checks.find((c) => c.rule === "amount_mismatch")!;
  expect(Number(mismatch.actual) - Number(mismatch.expected)).toBe(500);
  expect(
    updated.sheets.BOQ.find((r) => r.row === 40)?.cells.find(
      (c) => c.column === "F",
    )?.formula,
  ).toBe("D40*E40+500");
  expect(
    diffWorkbooks("base", "next", base.items, updated.items).summary.added,
  ).toBe(3);
});
