import { z } from "zod";
import { documentTypeSchema, isoDateTimeSchema } from "./enums";
export const projectDocumentSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  tendererId: z.string().optional(),
  type: documentTypeSchema,
  fileName: z.string(),
  version: z.number().int().positive(),
  pageCount: z.number().int().positive().optional(),
  parseStatus: z.enum(["queued", "parsing", "parsed", "failed"]),
  parseError: z.string().optional(),
  uploadedBy: z.string(),
  uploadedAt: isoDateTimeSchema,
});
export type ProjectDocument = z.infer<typeof projectDocumentSchema>;
