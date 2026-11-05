import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  workers: 1,
  use: { baseURL: "http://localhost:3200" },
  webServer: {
    command: "../node_modules/.bin/next start --port 3200",
    url: "http://localhost:3200",
    reuseExistingServer: false,
    env: { ADDIN_API_MOCKING: "enabled" },
    timeout: 120000,
  },
});
