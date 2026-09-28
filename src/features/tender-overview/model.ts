import type {
  AuditEvent,
  Bid,
  ComplianceScore,
  Flag,
  PriceDistribution,
  ProjectDocument,
  Tenderer,
  SignalKey,
} from "@/schemas";

export type RankedTenderer = {
  tenderer: Tenderer;
  bid: Bid;
  score: ComplianceScore;
  rank: number;
  auditEvents: AuditEvent[];
  evidenceFlag?: Flag;
};

const severityRank = { critical: 0, high: 1, medium: 2, low: 3 } as const;

export function highestSeverityFlag(flags: Flag[], tendererId: string) {
  return flags
    .filter(
      (flag) => flag.tendererId === tendererId && flag.evidence.length > 0,
    )
    .sort(
      (a, b) =>
        severityRank[a.severity] - severityRank[b.severity] ||
        b.confidence - a.confidence,
    )[0];
}

export function rankTenderers(
  tenderers: Tenderer[],
  bids: Bid[],
  scores: ComplianceScore[],
  flags: Flag[],
  documents: ProjectDocument[],
  auditEvents: AuditEvent[],
): RankedTenderer[] {
  const bidByTenderer = new Map(bids.map((bid) => [bid.tendererId, bid]));
  const scoreByTenderer = new Map(
    scores.map((score) => [score.tendererId, score]),
  );
  const documentOwner = new Map(
    documents
      .filter((doc) => doc.tendererId)
      .map((doc) => [doc.id, doc.tendererId]),
  );
  return tenderers
    .flatMap((tenderer) => {
      const bid = bidByTenderer.get(tenderer.id);
      const score = scoreByTenderer.get(tenderer.id);
      if (!bid || !score || score.bidId !== bid.id) return [];
      return [
        {
          tenderer,
          bid,
          score,
          rank: 0,
          auditEvents: auditEvents.filter(
            (event) =>
              event.entityType === "document" &&
              documentOwner.get(event.entityId) === tenderer.id,
          ),
          evidenceFlag: highestSeverityFlag(flags, tenderer.id),
        },
      ];
    })
    .sort(
      (a, b) =>
        b.score.score - a.score.score ||
        a.tenderer.name.localeCompare(b.tenderer.name),
    )
    .map((item, index) => ({ ...item, rank: index + 1 }));
}

export function benchmarkCurve(distribution: PriceDistribution) {
  const { benchmarkMeanHKD: mean, benchmarkSigmaHKD: sigma } = distribution;
  return Array.from({ length: 81 }, (_, index) => {
    const z = -4 + index / 10;
    return [mean + z * sigma, Math.exp(-(z * z) / 2)];
  });
}

export function scoreContributionTotal(score: ComplianceScore) {
  return score.signals.reduce((total, signal) => total + signal.contribution, 0);
}

export function sortedSignalKeys(scores: ComplianceScore[]): SignalKey[] {
  const impact = (signal: SignalKey) =>
    Math.max(
      ...scores.map(
        (score) =>
          score.signals.find((entry) => entry.signal === signal)?.contribution ??
          0,
      ),
    );
  return scores[0].signals
    .map((entry) => entry.signal)
    .sort((a, b) => impact(b) - impact(a));
}
