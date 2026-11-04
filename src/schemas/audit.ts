import { z } from "zod";
import { roleSchema, isoDateSchema } from "./enums";
export const auditEventSchema = z.object({
  id: z.string(),
  at: isoDateSchema,
  actorId: z.string(),
  actorRole: roleSchema,
  action: z.string(),
  entityType: z.enum([
    "project",
    "document",
    "document_version",
    "comparison",
    "change",
    "variation",
    "workbook",
    "workbook_version",
    "check",
    "procurement",
    "user",
  ]),
  entityId: z.string(),
  summary: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
});
export type AuditEvent = z.infer<typeof auditEventSchema>;
