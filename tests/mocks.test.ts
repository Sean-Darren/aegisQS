import { expect, test } from "vitest";
import { userSchema } from "@/schemas/user";
import { mockUser } from "@/mocks/fixtures/users";
test("Node MSW intercepts the current-user endpoint with a valid contract", async () => {
  const response = await fetch("http://localhost/api/v1/me");
  expect(response.ok).toBe(true);
  expect(userSchema.parse(await response.json())).toEqual(mockUser);
});
