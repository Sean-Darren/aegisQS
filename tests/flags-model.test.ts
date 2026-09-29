import { expect, test } from "vitest";
import { createFixtures } from "@/mocks/fixtures/data";
import {
  canBulkProposeDismiss,
  filterInboxFlags,
  flagInboxStats,
  initialInboxFilters,
} from "@/features/flags/model";
import { flagResponseSchema, flagSchema } from "@/schemas";

const fixture = createFixtures();

test("severity counts and sign-off blockers update after a final decision", () => {
  const open = fixture.flags.find(
    (flag) => flag.severity === "critical" && !flag.decision,
  )!;
  const before = flagInboxStats(fixture.flags);
  const after = flagInboxStats(
    fixture.flags.map((flag) =>
      flag.id === open.id
        ? {
            ...flag,
            status: "accepted" as const,
            decision: {
              action: "accept" as const,
              reason: "Reviewed the cited document.",
              by: "user-senior",
              at: "2026-09-29T00:00:00.000Z",
            },
          }
        : flag,
    ),
  );
  expect(after.severity).toEqual(before.severity);
  expect(after.blocking).toBe(before.blocking - 1);
  expect(after.decided).toBe(before.decided + 1);
});

test("presets and assignee filter select matching flags", () => {
  const criticalHigh = filterInboxFlags(
    fixture.flags,
    { ...initialInboxFilters, preset: "criticalHigh" },
    "user-senior",
  );
  expect(criticalHigh.length).toBeGreaterThan(0);
  expect(
    criticalHigh.every((flag) => ["critical", "high"].includes(flag.severity)),
  ).toBe(true);
  const mine = filterInboxFlags(
    fixture.flags,
    { ...initialInboxFilters, preset: "needsDecision", assignee: "mine" },
    "user-senior",
  );
  expect(
    mine.every((flag) => flag.assigneeId === "user-senior" && !flag.decision),
  ).toBe(true);
});

test("bulk dismiss excludes final decisions and missing evidence", () => {
  const low = fixture.flags.find((flag) => flag.severity === "low")!;
  expect(
    canBulkProposeDismiss({ ...low, status: "open", decision: undefined }),
  ).toBe(true);
  expect(canBulkProposeDismiss({ ...low, evidence: [] })).toBe(false);
  expect(
    canBulkProposeDismiss({ ...low, decision: fixture.flags[2].decision }),
  ).toBe(false);
});

test("the strict flag contract rejects missing evidence while the API boundary can render its error state", () => {
  const missing = { ...fixture.flags[0], evidence: [] };
  expect(flagSchema.safeParse(missing).success).toBe(false);
  expect(flagResponseSchema.safeParse(missing).success).toBe(true);
  expect(flagInboxStats([missing]).blocking).toBe(0);
});
