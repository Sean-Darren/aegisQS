import type { RiskBand } from "@/schemas";
export const thresholds = { sigma: 2, provisionalSumPercent: 15 } as const;
export const riskBands: ReadonlyArray<{ band: RiskBand; minimum: number }> = [
  { band: "low", minimum: 80 },
  { band: "moderate", minimum: 60 },
  { band: "high", minimum: 40 },
  { band: "critical", minimum: 0 },
];
export function riskBandFor(score: number): RiskBand {
  if (!Number.isFinite(score) || score < 0 || score > 100)
    throw new RangeError("Score must be between 0 and 100");
  return riskBands.find((range) => score >= range.minimum)!.band;
}
