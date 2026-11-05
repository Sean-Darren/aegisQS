import { expect, test } from "vitest";
import { diffWorkbooks } from "@/mocks/workbook-engine";
import { boqItems, variations } from "@/mocks/fixtures/data";
import {
  amountDelta,
  linkedVariations,
  rateUnit,
} from "@/features/workbooks/diff-model";
import { formatSignedCurrency } from "@/lib/format";
import type { BoqItem } from "@/schemas";
const item = (ref: string, row: number, amount = 20): BoqItem => ({
  id: ref,
  workbookVersionId: "v",
  sheet: "BOQ",
  row,
  itemRef: ref,
  description: ref,
  unit: "m",
  quantity: 2,
  rate: amount / 2,
  amount,
});
test("item refs identify moves, additions, removals and changed fields", () => {
  const result = diffWorkbooks(
    "a",
    "b",
    [item("same", 2), item("change", 3), item("remove", 4)],
    [item("add", 2), item("same", 100), item("change", 9, 30)],
  );
  expect(result.summary).toEqual({
    added: 1,
    removed: 1,
    changed: 1,
    totalDelta: 10,
  });
  expect(result.rows.find((r) => r.itemRef === "same")).toBeUndefined();
  expect(
    result.rows.find((r) => r.itemRef === "change")?.fields,
  ).toContainEqual({ field: "rate", before: 10, after: 15 });
  expect(result.rows.map(amountDelta).reduce((a, b) => a + b, 0)).toBe(10);
});
test("same reference on different sheets stays distinct and duplicates are not collapsed", () => {
  const a = item("X", 2),
    b = { ...item("X", 3), description: "second" };
  const result = diffWorkbooks(
    "a",
    "b",
    [a, b, { ...a, sheet: "Other" }],
    [
      { ...a, row: 5 },
      { ...b, row: 6 },
    ],
  );
  expect(result.summary).toEqual({
    added: 0,
    removed: 1,
    changed: 0,
    totalDelta: -20,
  });
});
test("seeded pair has exactly three VE additions and two rate changes, with matching totals", () => {
  const base = boqItems.filter((i) => i.workbookVersionId === "WV-1"),
    target = boqItems.filter((i) => i.workbookVersionId === "WV-2");
  const result = diffWorkbooks("WV-1", "WV-2", base, target);
  expect(result.summary.added).toBe(3);
  expect(result.summary.totalDelta).toBe(123014.55);
  expect(result.summary.removed).toBe(0);
  expect(
    result.rows.filter(
      (r) => r.fields.some((f) => f.field === "rate") && r.kind === "changed",
    ),
  ).toHaveLength(2);
  const added = result.rows.filter((r) => r.kind === "added");
  expect(added.reduce((s, r) => s + amountDelta(r), 0)).toBe(186400);
  for (const row of added)
    expect(linkedVariations(row, variations).map((v) => v.ref)).toContain(
      "VE-007",
    );
  expect(result.summary.totalDelta).toBe(
    result.rows.reduce((s, r) => s + Math.round(amountDelta(r) * 100), 0) / 100,
  );
});
test("signed currency uses a true minus and normalises rounded zero", () => {
  expect(formatSignedCurrency(-100)).toBe("−HK$100.00");
  expect(formatSignedCurrency(-0.001)).toBe("+HK$0.00");
});

test("MSW diff endpoint returns the same validated fixture comparison", async () => {
  const { createApiClient, createResources } = await import("@/lib/api");
  const api = createResources(createApiClient("http://localhost/api/v1"));
  const diff = await api.diff("WB-001", "WV-1", "WV-2");
  expect(diff.summary).toMatchObject({
    added: 3,
    removed: 0,
    totalDelta: 123014.55,
  });
  expect(
    diff.rows.filter(
      (r) => r.kind === "changed" && r.fields.some((f) => f.field === "rate"),
    ),
  ).toHaveLength(2);
});

test("rate labels retain before/after units and expose missing units", () => {
  const row = {
    kind: "changed" as const,
    sheet: "BOQ",
    row: 1,
    itemRef: "X",
    description: "X",
    fields: [{ field: "unit" as const, before: "m²", after: "m³" }],
  };
  expect(rateUnit(row, "before", "m³")).toBe("m²");
  expect(rateUnit(row, "after", "m³")).toBe("m³");
  expect(rateUnit({ ...row, fields: [] }, "after", "")).toBeUndefined();
});
