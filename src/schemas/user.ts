import { z } from "zod";
import { roleSchema } from "./enums";
export { roleSchema } from "./enums";
export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.email(),
  role: roleSchema,
  locale: z.enum(["en", "zh-HK"]),
});
export type User = z.infer<typeof userSchema>;
