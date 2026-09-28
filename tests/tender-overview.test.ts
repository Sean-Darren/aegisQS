import { expect, test } from "vitest";
import { createFixtures } from "@/mocks/fixtures/data";
import {
  benchmarkCurve,
  highestSeverityFlag,
  rankTenderers,
} from "@/features/tender-overview/model";

test("ranks parsed bids by Compliance Score and retains cited evidence", () => {
  const fixtures = createFixtures();
  const ranked = rankTenderers(
    fixtures.tenderers,
    fixtures.bids,
    fixtures.scores,
    fixtures.flags,
    fixtures.documents,
    fixtures.auditEvents,
  );
  expect(ranked).toHaveLength(12);
  expect(ranked[0].tenderer.name).toBe("BuildCorp HK Ltd.");
  expect(ranked[0].score.score).toBe(94.2);
  expect(
    ranked.find((entry) => entry.tenderer.name === "Apex Foundations")?.score
      .score,
  ).toBe(41.8);
  expect(ranked.every((entry, index) => entry.rank === index + 1)).toBe(true);
  expect(ranked[0].auditEvents.length).toBeGreaterThan(0);
  expect(ranked[0].evidenceFlag?.evidence.length).toBeGreaterThan(0);
});

test("chart series derives from the benchmark contract", () => {
  const { priceDistribution } = createFixtures();
  const curve = benchmarkCurve(priceDistribution);
  expect(curve).toHaveLength(81);
  expect(curve[40]).toEqual([priceDistribution.benchmarkMeanHKD, 1]);
  expect(
    priceDistribution.points.filter((point) => !point.withinTolerance),
  ).toHaveLength(3);
});

test("highest-severity flag ignores entries without evidence", () => {
  const fixture = createFixtures();
  const tendererId = fixture.tenderers[0].id;
  const critical = fixture.flags.find(
    (flag) => flag.tendererId === tendererId && flag.severity === "critical",
  )!;
  const noEvidence = { ...critical, id: "unusable", evidence: [] };
  expect(
    highestSeverityFlag([noEvidence, ...fixture.flags], tendererId)?.id,
  ).not.toBe("unusable");
});
