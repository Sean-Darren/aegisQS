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
});
