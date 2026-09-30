import { z } from "zod";
import * as s from "@/schemas";
import { riskBandFor, thresholds } from "@/lib/config";
import citations from "./pdf-evidence.json";
export const FIXTURE_TIME = "2026-09-28T00:00:00.000Z";
export const provenance = {
  modelVersion: "mock-auditors-1.0",
  toolSchemaVersion: "1.0",
  benchmarkDataAsOf: "2026-06-30",
};
export const projectId = "P-001";
export const trades = [
  "preliminaries",
  "concrete repair",
  "waterproofing",
  "external walls",
  "windows",
  "drainage",
  "fire services",
  "E&M",
] as const;
// Scenario-only information: the §6 Bid/ComplianceScore contracts have no VO-risk field.
export const scenario = {
  buildCorpVoRisk: "moderate",
  allNamesFictional: true,
} as const;
function seededRandom(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
export function createFixtures({
  rateGridRowCount = 3000,
}: { rateGridRowCount?: 3000 | 5000 } = {}) {
  const random = seededRandom(20260928);
  const names = [
    "BuildCorp HK Ltd.",
    "Apex Foundations",
    "Harbour Renewal Ltd.",
    "Summit Repair Works",
    "Cedar Building Services",
    "Beacon Rehabilitation",
    "Stonebridge Projects",
    "Larch Construction",
    "Bayview Maintenance",
    "Crown Facade Works",
    "Elm Engineering",
    "Seaward Contractors",
  ];
  const tenderers = z.array(s.tendererSchema).parse(
    names.map((name, i) => ({
      id: `T-${String(i + 1).padStart(3, "0")}`,
      projectId,
      name,
      devbRegistered: true,
      companyRegistryMatched: true,
      activeLitigationCount: i === 1 ? 3 : 0,
      adversePressFlags: i === 1 ? 2 : 0,
    })),
  );
  const sigmas = [
    0.04, -2.4, 2.2, -2.1, 0.5, 0.8, -0.5, 1.2, -1.1, 0.3, 1.5, -0.8,
  ];
  const scores = [94.2, 41.8, 55, 38, 86, 79, 82, 72, 88, 67, 91, 84];
  const bids = z.array(s.bidSchema).parse(
    tenderers.map((t, i) => ({
      id: `B-${i + 1}`,
      projectId,
      tendererId: t.id,
      totalValueHKD: Math.round(142400000 + sigmas[i] * 10000000),
      provisionalSumHKD: Math.round(
        (142400000 + sigmas[i] * 10000000) * (i === 1 ? 0.22 : 0.08),
      ),
    })),
  );
  const complianceScores = z.array(s.complianceScoreSchema).parse(
    tenderers.map((t, i) => ({
      bidId: bids[i].id,
      tendererId: t.id,
      projectId,
      score: scores[i],
      band: riskBandFor(scores[i]),
      signals: s.signalKeySchema.options.map((signal, j) => ({
        signal,
        weight: j === 6 ? 0.1 : 0.15,
        rawValue:
          signal === "provisional_sum_concentration"
            ? bids[i].provisionalSumHKD / bids[i].totalValueHKD
            : Math.round(random() * 100) / 100,
        contribution: scores[i] * (j === 6 ? 0.1 : 0.15),
        dataSufficient: !(i === 5 && j === 6),
      })),
      scoringMode: "static",
      configVersion: "static-1",
      computedAt: FIXTURE_TIME,
    })),
  );
  const projects = z.array(s.projectSchema).parse([
    {
      id: projectId,
      code: projectId,
      name: "Central Market Rehab Phase 2",
      stage: "tender",
      createdAt: FIXTURE_TIME,
      tendererCount: 12,
      latestJobId: "J-001",
    },
  ]);
  const documents = z.array(s.projectDocumentSchema).parse([
    {
      id: "D-001",
      projectId,
      type: "priced_boq",
      tendererId: tenderers[0].id,
      fileName: "sample-priced-boq.pdf",
      version: 1,
      pageCount: 10,
      parseStatus: "parsed",
      uploadedBy: "user-senior",
      uploadedAt: FIXTURE_TIME,
    },
    ...tenderers.slice(1).map((t, i) => ({
      id: `D-${String(i + 2).padStart(3, "0")}`,
      projectId,
      tendererId: t.id,
      type: "priced_boq",
      fileName: `${t.id}-sample-priced-boq.pdf`,
      version: 1,
      pageCount: 10,
      parseStatus: "parsed",
      uploadedBy: "user-senior",
      uploadedAt: FIXTURE_TIME,
    })),
    {
      id: "D-013",
      projectId,
      type: "inspection_report",
      fileName: "sample-inspection-report.pdf",
      version: 1,
      pageCount: 1,
      parseStatus: "parsed",
      uploadedBy: "user-senior",
      uploadedAt: FIXTURE_TIME,
    },
  ]);
  const flags = z.array(s.flagSchema).parse(
    citations.map((citation, i) => {
      const status = s.flagStatusSchema.options[i % 5];
      const action =
        status === "dismissed"
          ? "dismiss"
          : status === "escalated"
            ? "escalate"
            : "accept";
      const decision = {
        action,
        by: "user-senior",
        at: FIXTURE_TIME,
        reason: "Reviewed the cited rate against the benchmark.",
      };
      const tendererId = tenderers[i % 12].id;
      const row = i * 20;
      const benchmark = 100 + (row % 100) * 12;
      const rate = Math.round(benchmark * 0.7 * 100) / 100;
      return {
        id: `F-${String(i + 1).padStart(3, "0")}`,
        projectId,
        tendererId,
        auditor: s.auditorKindSchema.options[i % 4],
        signal: s.signalKeySchema.options[i % 7],
        severity: s.severitySchema.options[i % 4],
        confidence: 0.8 + (i % 10) / 100,
        title: `Unit rate requires review: ${citation.boqItemRef}`,
        description:
          "The recorded rate is outside the configured benchmark tolerance. Review the cited document before deciding.",
        boqItemRef: citation.boqItemRef,
        zScore: -3,
        threshold: { kind: "sigma", value: thresholds.sigma },
        evidence: [
          {
            id: `E-${i + 1}`,
            documentId: documents[i % 12].id,
            ...citation,
            calculation: {
              expression: "(rate - benchmark) / sigma",
              inputs: { rate, benchmark, sigma: benchmark * 0.1 },
              result: -3,
            },
          },
        ],
        status,
        ...(status === "proposed"
          ? { proposal: { ...decision, by: "user-junior" } }
          : {}),
        ...(["accepted", "dismissed", "escalated"].includes(status)
          ? { decision }
          : {}),
        assigneeId: "user-senior",
        createdAt: FIXTURE_TIME,
      };
    }),
  );
  const rows = z.array(s.rateGridRowSchema).parse(
    Array.from({ length: rateGridRowCount }, (_, i) => {
      const flagged = i % 20 === 0;
      const flag = flagged ? flags[i / 20] : undefined;
      const sufficient = flagged || i % 37 !== 1;
      const benchmark = 100 + (i % 100) * 12;
      return {
        boqItemRef: `BQ-${String(i + 1).padStart(4, "0")}`,
        description: `${trades[i % 8]} work item ${i + 1}`,
        trade: trades[i % 8],
        unit: "m²",
        quantity: 10 + Math.floor(random() * 500),
        benchmarkSufficient: sufficient,
        ...(sufficient ? { benchmarkRate: benchmark } : {}),
        rates: Object.fromEntries(
          tenderers.map((t, j) => {
            const missing = (i + j) % 173 === 1;
            const isFlag = flag?.tendererId === t.id;
            const sigma = isFlag
              ? -3
              : Math.round((random() * 3 - 1.5) * 10) / 10;
            return [
              t.id,
              {
                rate:
                  missing && !isFlag
                    ? null
                    : Math.round(benchmark * (1 + sigma * 0.1) * 100) / 100,
                ...((sufficient && !missing) || isFlag
                  ? { zScore: sigma }
                  : {}),
                ...(isFlag ? { flagId: flag.id } : {}),
              },
            ];
          }),
        ),
      };
    }),
  );
  const priceDistribution = s.priceDistributionSchema.parse({
    benchmarkMeanHKD: 142400000,
    benchmarkSigmaHKD: 10000000,
    points: bids.map((bid, i) => ({
      tendererId: bid.tendererId,
      totalValueHKD: bid.totalValueHKD,
      sigma: sigmas[i],
      withinTolerance: Math.abs(sigmas[i]) <= thresholds.sigma,
    })),
    thresholdSigma: thresholds.sigma,
  });
  const kpis = s.projectKpisSchema.parse({
    avgRateVarianceZ: 0.42,
    highRiskBidCount: complianceScores.filter((score) =>
      ["high", "critical"].includes(score.band),
    ).length,
    totalBidCount: 12,
    recommendedTendererId: tenderers[0].id,
    benchmarkDataAsOf: provenance.benchmarkDataAsOf,
  });
  const scopeGaps = z.array(s.scopeGapSchema).parse(
    ["mapped", "vague", "missing", "oversized_ps"].map((status, i) => ({
      id: `SG-${i + 1}`,
      projectId,
      finding: {
        ref: `F-0${i + 1}`,
        text: [
          "External wall repair extent is confirmed.",
          "Waterproofing detail remains vague.",
          "Drainage replacement scope is missing.",
          "Provisional sum allowance needs itemisation.",
        ][i],
        documentId: "D-013",
        page: 1,
      },
      ...(status !== "missing"
        ? { mappedBoqItemRef: flags[i].boqItemRef }
        : {}),
      status,
      ...(status !== "mapped" ? { flagId: flags[i].id } : {}),
    })),
  );
  const jobs = z.array(s.analysisJobSchema).parse([
    {
      id: "J-001",
      projectId,
      status: "succeeded",
      startedAt: FIXTURE_TIME,
      finishedAt: FIXTURE_TIME,
      progress: tenderers.flatMap((t) =>
        s.auditorKindSchema.options.map((auditor) => ({
          tendererId: t.id,
          auditor,
          status: "succeeded",
          pct: 100,
        })),
      ),
      modelVersion: provenance.modelVersion,
      toolSchemaVersion: provenance.toolSchemaVersion,
    },
  ]);
  const reports = z.array(s.reportSchema).parse([
    {
      id: "R-001",
      projectId,
      version: 1,
      status: "draft",
      recommendedTendererId: tenderers[0].id,
      ...provenance,
    },
  ]);
  const auditEvents = z.array(s.auditEventSchema).parse(
    Array.from({ length: 125 }, (_, i) => ({
      id: `A-${String(i + 1).padStart(3, "0")}`,
      at: new Date(Date.parse(FIXTURE_TIME) + i * 1000).toISOString(),
      actorId: "user-senior",
      actorRole: "senior_qs",
      action: "document.reviewed",
      entityType: "document",
      entityId: documents[i % 12].id,
      details: { sequence: i + 1 },
    })),
  );
  return {
    projects,
    tenderers,
    bids,
    scores: complianceScores,
    documents,
    flags,
    rows,
    priceDistribution,
    kpis,
    scopeGaps,
    jobs,
    reports,
    auditEvents,
  };
}
