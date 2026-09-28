import { z } from "zod";
export const scopeGapSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  finding: z.object({
    ref: z.string(),
    text: z.string(),
    documentId: z.string(),
    page: z.number().int().positive(),
  }),
  mappedBoqItemRef: z.string().optional(),
  status: z.enum(["mapped", "vague", "missing", "oversized_ps"]),
  flagId: z.string().optional(),
});
export type ScopeGap = z.infer<typeof scopeGapSchema>;
