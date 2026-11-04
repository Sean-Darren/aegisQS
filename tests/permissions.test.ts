import { expect, test } from "vitest";
import { can, type Permission } from "@/lib/auth/permissions";
const edit: Permission[] = [
  "document.upload",
  "comparison.run",
  "change.review",
  "variation.raise",
  "variation.editCost",
  "workbook.upload",
  "workbook.editMapping",
  "workbook.resolveCheck",
  "procurement.plan",
];
test("QS can prepare work; only senior QS can decide variations and current versions", () => {
  for (const permission of edit) {
    expect(can({ role: "qs" }, permission)).toBe(true);
    expect(can({ role: "senior_qs" }, permission)).toBe(true);
    expect(can({ role: "viewer" }, permission)).toBe(false);
  }
  for (const permission of [
    "document.setCurrent",
    "variation.decide",
  ] as const) {
    expect(can({ role: "senior_qs" }, permission)).toBe(true);
    expect(can({ role: "qs" }, permission)).toBe(false);
    expect(can({ role: "viewer" }, permission)).toBe(false);
    expect(can({ role: "admin" }, permission)).toBe(false);
  }
});
test("all four roles can view projects; only admin manages the organization", () => {
  for (const role of ["senior_qs", "qs", "viewer", "admin"] as const) {
    expect(can({ role }, "project.view")).toBe(true);
    expect(can({ role }, "admin.manage")).toBe(role === "admin");
  }
  expect(can(undefined, "project.view")).toBe(false);
  expect(can(null, "variation.decide")).toBe(false);
});
