// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DecisionForm } from "@/components/ui/DecisionForm";
import { SummaryCard } from "@/components/ui/SummaryCard";
import { moveGridCell } from "@/components/grid/navigation";
import { can } from "@/lib/auth/permissions";
import {
  filterAuditEvents,
  initialAuditFilters,
  auditEventsCsv,
} from "@/features/audit/model";
import { auditEventSchema } from "@/schemas";
afterEach(cleanup);
test("grid keyboard movement clamps at every edge", () => {
  expect(moveGridCell({ row: 0, column: 0 }, "ArrowUp", 10, 4)).toEqual({
    row: 0,
    column: 0,
  });
  expect(moveGridCell({ row: 9, column: 3 }, "ArrowRight", 10, 4)).toEqual({
    row: 9,
    column: 3,
  });
  expect(moveGridCell({ row: 2, column: 1 }, "ArrowDown", 10, 4)).toEqual({
    row: 3,
    column: 1,
  });
});
test("project roles gate decisions and uploads", () => {
  expect(can({ role: "senior_qs" }, "variation.decide")).toBe(true);
  expect(can({ role: "qs" }, "variation.decide")).toBe(false);
  expect(can({ role: "viewer" }, "document.upload")).toBe(false);
  expect(can({ role: "viewer" }, "project.view")).toBe(true);
  expect(can({ role: "admin" }, "variation.decide")).toBe(false);
});
test("decision requires a reason and submits the chosen action", () => {
  const submit = vi.fn();
  render(
    <DecisionForm
      actions={[
        { value: "confirm", label: "Confirm" },
        { value: "reject", label: "Reject" },
      ]}
      actionLabel="Action"
      reasonLabel="Reason"
      submitLabel="Save"
      errorMessage="Explain the decision"
      onSubmit={submit}
    />,
  );
  fireEvent.submit(
    screen.getByRole("button", { name: "Save" }).closest("form")!,
  );
  expect(submit).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toHaveTextContent("Explain the decision");
  fireEvent.change(screen.getByLabelText("Action"), {
    target: { value: "reject" },
  });
  fireEvent.change(screen.getByLabelText("Reason"), {
    target: { value: "Requires a revised drawing" },
  });
  fireEvent.submit(
    screen.getByRole("button", { name: "Save" }).closest("form")!,
  );
  expect(submit).toHaveBeenCalledWith({
    action: "reject",
    reason: "Requires a revised drawing",
  });
});
test("summary numbers use tabular figures", () => {
  render(<SummaryCard label="Documents" value="40" />);
  expect(screen.getByText("40")).toHaveClass("tabular-nums");
});
test("audit filters and CSV retain immutable records", () => {
  const event = auditEventSchema.parse({
    id: "A-1",
    at: "2026-11-04T00:00:00Z",
    actorId: "user-0",
    actorRole: "senior_qs",
    action: "document.version_uploaded",
    entityType: "document",
    entityId: "D-1",
    summary: "Version uploaded",
  });
  expect(
    filterAuditEvents([event], {
      ...initialAuditFilters,
      entityType: "document",
    }),
  ).toEqual([event]);
  expect(
    filterAuditEvents([event], { ...initialAuditFilters, actor: "other" }),
  ).toEqual([]);
  expect(auditEventsCsv([event], [])).toContain('"D-1"');
});
