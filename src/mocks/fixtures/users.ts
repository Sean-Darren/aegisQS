import { roleSchema, userSchema } from "@/schemas";
export const users = roleSchema.options.map((role, index) =>
  userSchema.parse({
    id: `user-${index}`,
    name: ["Senior QS", "QS", "Viewer", "Administrator"][index],
    email: `${role}@example.test`,
    role,
    locale: "en",
  }),
);
export const mockUser = users[0];
