import { z } from "zod";
import { roleSchema, isoDateTimeSchema } from "./enums";
export const auditEventSchema = z.object({
  id: z.string(),
  at: isoDateTimeSchema,
  actorId: z.string(),
  actorRole: roleSchema,
  action: z.string(),
  entityType: z.enum([
    "project",
    "document",
    "job",
    "flag",
    "report",
    "config",
    "user",
  ]),
  entityId: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
});
export type AuditEvent = z.infer<typeof auditEventSchema>;
