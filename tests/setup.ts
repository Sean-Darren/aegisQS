import { afterAll, afterEach, beforeAll } from "vitest";
import "@testing-library/jest-dom/vitest";
import { resetMockState } from "@/mocks/store";
import { server } from "@/mocks/server";
if (process.env.NEXT_PUBLIC_API_MOCKING === "enabled") {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => {
    server.resetHandlers();
    resetMockState();
  });
  afterAll(() => server.close());
}
