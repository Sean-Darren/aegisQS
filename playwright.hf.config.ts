import { defineConfig, devices } from "@playwright/test";

const port = process.env.PLAYWRIGHT_PORT || "3300";
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "hf-revision.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run dev -- --webpack --hostname 127.0.0.1 --port ${port}`,
    url: `${baseURL}/en`,
    reuseExistingServer: false,
    env: {
      NEXT_PUBLIC_API_MOCKING: "enabled",
      // Leave HF local fallback enabled so the Python bridge runs.
      AEGISQS_NEXT_DIST_DIR:
        process.env.AEGISQS_NEXT_DIST_DIR || ".next-playwright-hf",
    },
    timeout: 120000,
  },
});
