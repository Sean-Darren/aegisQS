import { expect, test } from "vitest";
import { z } from "zod";
import * as s from "@/schemas";
import { createFixtures, scenario } from "@/mocks/fixtures/data";
import { users } from "@/mocks/fixtures/users";
import { readFileSync } from "node:fs";
import { samplePdfBase64 } from "@/mocks/fixtures/pdf";
const data = createFixtures();
const cases: [string, z.ZodType, unknown[]][] = [
  ["User", s.userSchema, users],
  ["Project", s.projectSchema, data.projects],
  ["Tenderer", s.tendererSchema, data.tenderers],
  ["Bid", s.bidSchema, data.bids],
  ["ProjectDocument", s.projectDocumentSchema, data.documents],
  ["AnalysisJob", s.analysisJobSchema, data.jobs],
  [
    "SignalContribution",
    s.signalContributionSchema,
    data.scores.flatMap((score) => score.signals),
  ],
  ["ComplianceScore", s.complianceScoreSchema, data.scores],
  ["Evidence", s.evidenceSchema, data.flags.flatMap((flag) => flag.evidence)],
  [
    "FlagDecision",
    s.flagDecisionSchema,
    data.flags.flatMap((flag) =>
      [flag.proposal, flag.decision].filter(Boolean),
    ),
  ],
  ["Flag", s.flagSchema, data.flags],
  ["RateGridRow", s.rateGridRowSchema, data.rows],
  [
    "RateGridPage",
    s.rateGridPageSchema,
    [{ rows: data.rows.slice(0, 100), nextCursor: "100", totalRows: 3000 }],
  ],
  ["PriceDistribution", s.priceDistributionSchema, [data.priceDistribution]],
  ["ProjectKpis", s.projectKpisSchema, [data.kpis]],
  ["ScopeGap", s.scopeGapSchema, data.scopeGaps],
  ["Report", s.reportSchema, data.reports],
  ["AuditEvent", s.auditEventSchema, data.auditEvents],
  [
    "WsEvent",
    s.wsEventSchema,
    [
      { type: "job.progress", jobId: "J-001", ...data.jobs[0].progress[0] },
      { type: "job.completed", jobId: "J-001", status: "succeeded" },
      { type: "flag.created", flag: data.flags[0] },
    ],
  ],
  ["Role", s.roleSchema, users.map((user) => user.role)],
  ["ProjectStage", s.projectStageSchema, s.projectStageSchema.options],
  ["Severity", s.severitySchema, data.flags.map((flag) => flag.severity)],
  ["RiskBand", s.riskBandSchema, data.scores.map((score) => score.band)],
  [
    "AuditorKind",
    s.auditorKindSchema,
    data.jobs[0].progress.map((progress) => progress.auditor),
  ],
  [
    "SignalKey",
    s.signalKeySchema,
    data.scores[0].signals.map((signal) => signal.signal),
  ],
  ["DocumentType", s.documentTypeSchema, s.documentTypeSchema.options],
];
test.each(cases)("%s parses every fixture", (_name, schema, fixtures) => {
  expect(fixtures.length).toBeGreaterThan(0);
  for (const fixture of fixtures)
    expect(schema.safeParse(fixture).success).toBe(true);
});
test("fixtures reproduce the exact scenario with consistent foreign keys", () => {
  expect(createFixtures()).toEqual(data);
  expect(data.projects[0]).toMatchObject({
    id: "P-001",
    name: "Central Market Rehab Phase 2",
    stage: "tender",
    tendererCount: 12,
  });
  expect(data.tenderers).toHaveLength(12);
  expect(data.tenderers[0]).toMatchObject({
    name: "BuildCorp HK Ltd.",
    activeLitigationCount: 0,
  });
  expect(data.scores[0]).toMatchObject({ score: 94.2, band: "low" });
  expect(data.bids[0].totalValueHKD).toBe(142800000);
  expect(scenario.buildCorpVoRisk).toBe("moderate");
  expect(data.tenderers[1]).toMatchObject({
    name: "Apex Foundations",
    activeLitigationCount: 3,
    adversePressFlags: 2,
  });
  expect(data.scores[1]).toMatchObject({ score: 41.8, band: "high" });
  expect(data.bids[1].totalValueHKD).toBe(118400000);
  expect(data.priceDistribution.points[1].sigma).toBe(-2.4);
  expect(
    data.priceDistribution.points.filter((point) => !point.withinTolerance),
  ).toHaveLength(3);
  expect(data.kpis.avgRateVarianceZ).toBe(0.42);
  expect(data.rows).toHaveLength(3000);
  expect(new Set(data.rows.map((row) => row.trade)).size).toBe(8);
  expect(
    data.rows.filter((row) =>
      Object.values(row.rates).some((rate) => rate.flagId),
    ),
  ).toHaveLength(150);
  expect(data.rows.some((row) => !row.benchmarkSufficient)).toBe(true);
  expect(
    data.scores.some((score) =>
      score.signals.some((signal) => !signal.dataSufficient),
    ),
  ).toBe(true);
  for (const row of data.rows) {
    expect(Object.keys(row.rates)).toHaveLength(12);
    for (const [tendererId, rate] of Object.entries(row.rates))
      if (rate.flagId) {
        const flag = data.flags.find((flag) => flag.id === rate.flagId)!;
        expect(flag).toMatchObject({ boqItemRef: row.boqItemRef, tendererId });
        expect(rate.rate).toBe(flag.evidence[0].calculation?.inputs.rate);
      }
  }
  for (const flag of data.flags)
    for (const evidence of flag.evidence)
      expect(data.documents.some((doc) => doc.id === evidence.documentId)).toBe(
        true,
      );
  for (const point of data.priceDistribution.points)
    expect(
      (point.totalValueHKD - data.priceDistribution.benchmarkMeanHKD) /
        data.priceDistribution.benchmarkSigmaHKD,
    ).toBeCloseTo(point.sigma);
});
test("PDF served by mocks is identical to the actual sample; 150 flags have page citations", () => {
  const bytes = readFileSync("public/mock-docs/sample-priced-boq.pdf");
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  expect(Buffer.from(samplePdfBase64, "base64")).toEqual(bytes);
  expect(
    data.flags.filter((flag) => flag.evidence.some((e) => e.bbox && e.page)),
  ).toHaveLength(150);
});
test("invalid evidence, proportions, scores, timestamps and dispositions are rejected", () => {
  expect(
    s.flagSchema.safeParse({ ...data.flags[0], evidence: [] }).success,
  ).toBe(false);
  expect(
    s.flagSchema.safeParse({ ...data.flags[0], confidence: 1.1 }).success,
  ).toBe(false);
  expect(
    s.evidenceSchema.safeParse({
      ...data.flags[0].evidence[0],
      bbox: { x: 0.9, y: 0, w: 0.2, h: 0.1 },
    }).success,
  ).toBe(false);
  expect(
    s.complianceScoreSchema.safeParse({ ...data.scores[0], score: 101 })
      .success,
  ).toBe(false);
  expect(
    s.complianceScoreSchema.safeParse({ ...data.scores[0], signals: [] })
      .success,
  ).toBe(false);
  expect(
    s.projectSchema.safeParse({ ...data.projects[0], createdAt: "yesterday" })
      .success,
  ).toBe(false);
  expect(
    s.dispositionInputSchema.safeParse({
      action: "accept",
      reason: "          ",
    }).success,
  ).toBe(false);
  expect(
    s.reportSchema.safeParse({ ...data.reports[0], status: "signed" }).success,
  ).toBe(false);
});
