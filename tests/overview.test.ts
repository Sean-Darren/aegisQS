import { test, expect, vi } from "vitest";
vi.mock("@/lib/api", async () => {
  const api = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...api,
    resources: api.createResources(
      api.createApiClient("http://localhost/api/v1"),
    ),
  };
});
vi.mock("@/features/audit", () => import("@/features/audit/model"));
import { loadOverview, summarizeOverview } from "@/features/overview/load";
import { resources } from "@/lib/api";
test("overview derives current BOQ checks, ranges, conflicts and unreviewed changes from contracts", async () => {
  const data = await loadOverview("P-001");
  const summary = summarizeOverview(data, "2026-11");
  expect(data.documents).toHaveLength(40);
  expect(summary.confirmedPriced).toBe(
    data.variations.filter((v) => v.status === "confirmed" && v.indicativeCost)
      .length,
  );
  expect(summary.conflicts.some((d) => d.docNumber === "CON-004")).toBe(true);
  expect(summary.unreviewed.length).toBeGreaterThan(0);
  expect(summary.low).toBe(
    summary.potential.reduce((n, v) => n + (v.indicativeCost?.low ?? 0), 0),
  );
  const current = data.checks
    .filter((w) => w.workbook.kind === "boq")
    .flatMap((w) => w.checks)
    .filter((c) => c.status === "open");
  expect(summary.errors).toBe(
    current.filter((c) => c.severity === "error").length,
  );
  const raised = await resources.createProcurement("P-001", {
    materialId: "rebar",
    quantity: 4.2,
    neededBy: "2027-06-01T00:00:00Z",
    leadTimeWeeks: 8,
  });
  const updated = await loadOverview("P-001");
  expect(
    updated.events.some(
      (e) =>
        e.entityId === raised.id &&
        e.action === "procurement.created" &&
        e.summary.length > 10,
    ),
  ).toBe(true);
});
