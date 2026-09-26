import { userSchema } from "@/schemas/user";
export const mockUser = userSchema.parse({
  id: "user-senior",
  name: "Sample Senior QS",
  email: "senior@example.test",
  role: "senior_qs",
  locale: "en",
});
