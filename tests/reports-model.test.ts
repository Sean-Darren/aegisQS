import { expect, test } from "vitest";
import { createFixtures } from "@/mocks/fixtures/data";
import {
  citedFlags,
  reportRecommendation,
  signOffBlockers,
  validOverride,
} from "@/features/reports/model";

test("sign-off blocks only undecided cited critical and high flags", () => {
  const { flags } = createFixtures();
  const blockers = signOffBlockers(flags);
  expect(blockers.length).toBeGreaterThan(0);
  expect(
    blockers.every((flag) => flag.evidence.length > 0 && !flag.decision),
  ).toBe(true);
  expect(
    blockers.every((flag) => ["critical", "high"].includes(flag.severity)),
  ).toBe(true);
  expect(
    signOffBlockers(flags.map((flag) => ({ ...flag, evidence: [] }))),
  ).toHaveLength(0);
});

test("recommendation defaults to the KPI and an override requires a reason", () => {
  const { reports, kpis } = createFixtures();
  expect(reportRecommendation(undefined, kpis)).toBe("T-001");
  expect(
    reportRecommendation(
      { ...reports[0], recommendedTendererId: "T-002" },
      kpis,
    ),
  ).toBe("T-002");
  expect(validOverride("T-001", "T-001", "")).toBe(true);
  expect(validOverride("T-002", "T-001", "short")).toBe(false);
  expect(validOverride("T-002", "T-001", "Reviewed the evidence.")).toBe(true);
});

test("cited flags are severity ordered and omit missing evidence", () => {
  const { flags } = createFixtures();
  const ordered = citedFlags([
    { ...flags[0], evidence: [] },
    ...flags.slice(1),
  ]);
  expect(ordered.some((flag) => flag.id === flags[0].id)).toBe(false);
  expect(ordered[0].severity).toBe("critical");
});
