import { expect, test } from "vitest";
import { can } from "@/lib/auth/permissions";
test("senior QS can finalize and sign, junior QS can only propose", () => {
  expect(can({ role: "senior_qs" }, "flag.finalize")).toBe(true);
  expect(can({ role: "senior_qs" }, "report.sign")).toBe(true);
  expect(can({ role: "junior_qs" }, "flag.propose")).toBe(true);
  expect(can({ role: "junior_qs" }, "flag.finalize")).toBe(false);
  expect(can({ role: "junior_qs" }, "report.sign")).toBe(false);
});
test("owner and admin roles cannot sign; anonymous access is denied", () => {
  expect(can({ role: "owner_viewer" }, "report.sign")).toBe(false);
  expect(can({ role: "admin" }, "report.sign")).toBe(false);
  expect(can(null, "project.view")).toBe(false);
  expect(can({ role: "owner_viewer" }, "project.view")).toBe(false);
  expect(can({ role: "owner_viewer" }, "report.viewSigned")).toBe(true);
  expect(
    can({ role: "owner_viewer" }, "report.viewSigned", { status: "draft" }),
  ).toBe(false);
  expect(
    can({ role: "owner_viewer" }, "report.viewSigned", { status: "signed" }),
  ).toBe(true);
  expect(can({ role: "admin" }, "admin.manage")).toBe(true);
  expect(can({ role: "admin" }, "flag.finalize")).toBe(false);
});
