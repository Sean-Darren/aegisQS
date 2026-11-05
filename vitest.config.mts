import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    setupFiles: ["./tests/setup.ts"],
    env: {
      NEXT_PUBLIC_API_MOCKING: "enabled",
      AEGISQS_HF_LOCAL_FALLBACK: "disabled",
    },
  },
});
