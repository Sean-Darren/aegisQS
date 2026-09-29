import { expect, test } from "vitest";
import { createFixtures } from "@/mocks/fixtures/data";
import { gridCsv, heatLevel, moveGridCell } from "@/features/rate-grid/model";

test("z-score shading follows inclusive thresholds and insufficient data suppresses heat", () => {
  const [row, insufficient] = createFixtures().rows;
  expect(heatLevel(row, 0.9)).toBe("neutral");
  expect(heatLevel(row, -1)).toBe("caution");
  expect(heatLevel(row, 1.99)).toBe("caution");
  expect(heatLevel(row, -2)).toBe("risk");
  expect(heatLevel(insufficient, 3)).toBe("insufficient");
});

test("arrow navigation stays within the visible grid", () => {
  expect(moveGridCell({ row: 0, column: 0 }, "ArrowLeft", 10, 30)).toEqual({
    row: 0,
    column: 0,
  });
  expect(moveGridCell({ row: 0, column: 0 }, "ArrowRight", 10, 30)).toEqual({
    row: 0,
    column: 1,
  });
  expect(moveGridCell({ row: 9, column: 29 }, "ArrowDown", 10, 30)).toEqual({
    row: 9,
    column: 29,
  });
});

test("CSV exports the selected tenderer columns and filtered rows", () => {
  const fixture = createFixtures();
  const csv = gridCsv(fixture.rows.slice(0, 2), fixture.tenderers.slice(0, 1), {
    itemRef: "Item ref",
    description: "Description",
    trade: "Trade",
    unit: "Unit",
    quantity: "Quantity",
    benchmark: "Benchmark rate",
    rate: "Rate",
    sigma: "z-score",
    insufficient: "Insufficient benchmark data",
  });
  expect(csv).toContain('"BuildCorp HK Ltd. — Rate"');
  expect(csv).not.toContain("Apex Foundations");
  expect(csv).toContain("Insufficient benchmark data");
  expect(csv.split("\r\n")).toHaveLength(3);
});

test("the stress fixture generates 5,000 deterministic BOQ rows", () => {
  const first = createFixtures({ rateGridRowCount: 5000 });
  const second = createFixtures({ rateGridRowCount: 5000 });
  expect(first.rows).toHaveLength(5000);
  expect(first.rows[4999]).toEqual(second.rows[4999]);
  expect(first.tenderers).toHaveLength(12);
});
