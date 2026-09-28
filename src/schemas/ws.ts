import { z } from "zod";
import { auditorKindSchema } from "./enums";
import { jobStatusSchema } from "./job";
import { flagSchema } from "./flag";
export const wsEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("job.progress"),
    jobId: z.string(),
    tendererId: z.string(),
    auditor: auditorKindSchema,
    status: z.string(),
    pct: z.number().min(0).max(100),
  }),
  z.object({
    type: z.literal("job.completed"),
    jobId: z.string(),
    status: jobStatusSchema,
  }),
  z.object({ type: z.literal("flag.created"), flag: flagSchema }),
]);
export type WsEvent = z.infer<typeof wsEventSchema>;
