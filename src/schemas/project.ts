import { z } from "zod";
import { isoDateSchema } from "./enums";
export const projectSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  createdAt: isoDateSchema,
  memberIds: z.array(z.string()),
});
export type Project = z.infer<typeof projectSchema>;
