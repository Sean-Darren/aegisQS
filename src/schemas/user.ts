import { z } from "zod";
export const roleSchema = z.enum([
  "senior_qs",
  "junior_qs",
  "owner_viewer",
  "admin",
]);
export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.email(),
  role: roleSchema,
  locale: z.enum(["en", "zh-HK"]),
});
export type User = z.infer<typeof userSchema>;
