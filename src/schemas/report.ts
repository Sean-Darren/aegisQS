import { z } from "zod";
import { isoDateTimeSchema } from "./enums";
export const reportSchema = z
  .object({
    id: z.string(),
    projectId: z.string(),
    version: z.number().int().positive(),
    status: z.enum(["draft", "signed"]),
    signedBy: z.string().optional(),
    signedAt: isoDateTimeSchema.optional(),
    recommendedTendererId: z.string().optional(),
    overrideReason: z.string().optional(),
    modelVersion: z.string(),
    toolSchemaVersion: z.string(),
    benchmarkDataAsOf: z.string().min(1),
    pdfUrl: z.string().optional(),
  })
  .refine((r) => r.status !== "signed" || !!(r.signedBy && r.signedAt), {
    message: "Signed reports require a signatory and timestamp",
  });
export const signReportInputSchema = z.object({
  recommendedTendererId: z.string().min(1),
  overrideReason: z.string().trim().min(10).optional(),
});
export type Report = z.infer<typeof reportSchema>;
export type SignReportInput = z.infer<typeof signReportInputSchema>;
