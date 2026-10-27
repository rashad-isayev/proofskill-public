import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/hiring-browser",
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
      command: "npm run dev -- --port 3100",
      url: "http://127.0.0.1:3100",
      env: {
        BETTER_AUTH_URL: "http://127.0.0.1:3100",
        OPENAI_API_KEY: "fixture-only",
        OPENAI_MODEL: "fixture-only",
        OPENAI_BASE_URL: "http://127.0.0.1:4105",
      },
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
});
