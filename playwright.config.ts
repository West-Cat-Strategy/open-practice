import { defineConfig, devices } from "@playwright/test";

const hostExcluded = /@docker|@first-run/;
const dockerOnly = /@docker/;
const firstRunOnly = /@first-run/;

export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  outputDir: "test-results/e2e",
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL: process.env.E2E_WEB_BASE_URL ?? "http://localhost:33110",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "host-chromium",
      grepInvert: hostExcluded,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "host-mobile-chromium",
      grepInvert: hostExcluded,
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "host-firefox",
      grepInvert: hostExcluded,
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "host-webkit",
      grepInvert: hostExcluded,
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "docker-chromium",
      grep: dockerOnly,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "first-run-chromium",
      grep: firstRunOnly,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
