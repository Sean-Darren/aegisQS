import { z } from "zod";
import { projectStageSchema, isoDateTimeSchema } from "./enums";
export const projectSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  stage: projectStageSchema,
  createdAt: isoDateTimeSchema,
  tendererCount: z.number().int().nonnegative(),
  latestJobId: z.string().optional(),
});
export const tendererSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  name: z.string(),
  devbRegistered: z.boolean(),
  companyRegistryMatched: z.boolean(),
  activeLitigationCount: z.number().int().nonnegative(),
  adversePressFlags: z.number().int().nonnegative(),
});
export const bidSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  tendererId: z.string(),
  totalValueHKD: z.number().nonnegative(),
  provisionalSumHKD: z.number().nonnegative(),
});
export const projectKpisSchema = z.object({
  avgRateVarianceZ: z.number(),
  highRiskBidCount: z.number().int().nonnegative(),
  totalBidCount: z.number().int().nonnegative(),
  recommendedTendererId: z.string().optional(),
  benchmarkDataAsOf: z.string().min(1),
});
export type Project = z.infer<typeof projectSchema>;
export type Tenderer = z.infer<typeof tendererSchema>;
export type Bid = z.infer<typeof bidSchema>;
export type ProjectKpis = z.infer<typeof projectKpisSchema>;
