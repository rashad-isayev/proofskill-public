import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/b2b",
  testMatch: "*.spec.ts",
  fullyParallel: true,
  workers: 2,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: devices["Desktop Chrome"] },
    { name: "mobile", use: devices["Pixel 7"] },
  ],
  webServer: [
    {
      command: "npm run start -- --port 3100",
      env: { BETTER_AUTH_URL: "http://127.0.0.1:3100" },
      url: "http://127.0.0.1:3100",
      reuseExistingServer: false,
      timeout: 120000,
    },
    {
      command: "node --import tsx tests/b2b/harness/server.mts",
      url: "http://127.0.0.1:3200",
      reuseExistingServer: false,
      timeout: 60000,
    },
  ],
});
