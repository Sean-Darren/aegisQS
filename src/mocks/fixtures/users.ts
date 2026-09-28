import { userSchema, roleSchema } from "@/schemas";
export const users = roleSchema.options.map((role, index) =>
  userSchema.parse({
    id: ["user-senior", "user-junior", "user-owner", "user-admin"][index],
    name: [
      "Sample Senior QS",
      "Sample Junior QS",
      "Sample Owner",
      "Sample Administrator",
    ][index],
    email: `${role}@example.test`,
    role,
    locale: "en",
  }),
);
export const mockUser = users[0];
