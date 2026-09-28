import { z } from "zod";
import { signalKeySchema, riskBandSchema, isoDateTimeSchema } from "./enums";
export const signalContributionSchema = z.object({
  signal: signalKeySchema,
  weight: z.number().min(0).max(1),
  rawValue: z.number(),
  contribution: z.number(),
  dataSufficient: z.boolean(),
});
export const complianceScoreSchema = z
  .object({
    bidId: z.string(),
    tendererId: z.string(),
    projectId: z.string(),
    score: z.number().min(0).max(100),
    band: riskBandSchema,
    signals: z.array(signalContributionSchema),
    scoringMode: z.enum(["static", "ml"]),
    configVersion: z.string(),
    computedAt: isoDateTimeSchema,
  })
  .refine(
    (score) =>
      score.scoringMode !== "static" ||
      Math.abs(
        score.signals.reduce((sum, signal) => sum + signal.weight, 0) - 1,
      ) < 1e-8,
    { message: "Static signal weights must sum to one", path: ["signals"] },
  );
export type SignalContribution = z.infer<typeof signalContributionSchema>;
export type ComplianceScore = z.infer<typeof complianceScoreSchema>;
