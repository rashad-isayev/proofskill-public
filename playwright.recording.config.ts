import { defineConfig, devices } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Synthetic video and test-only retention; this does not change product configuration.
export default defineConfig({
  testDir: "./tests/recording-browser",
  outputDir: "test-results/recording",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    {
      command: "node --import tsx scripts/mock-hiring-provider.ts",
      url: "http://127.0.0.1:4105/health",
      reuseExistingServer: false,
    },
    {
      command: "npm run dev -- --webpack --port 3100",
      cwd: process.env.PROOFSKILL_TEST_APP_DIRECTORY || process.cwd(),
      url: "http://127.0.0.1:3100",
      env: {
        BETTER_AUTH_URL: "http://127.0.0.1:3100",
        OPENAI_API_KEY: "fixture-only",
        OPENAI_MODEL: "fixture-only",
        OPENAI_BASE_URL: "http://127.0.0.1:4105",
        RECORDING_ENABLED: "true",
        RECORDING_RETENTION_DAYS: "1",
        RECORDING_LOCAL_DIRECTORY: mkdtempSync(
          join(tmpdir(), "proofskill-recording-test-"),
        ),
      },
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
});
