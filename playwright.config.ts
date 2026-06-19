import { defineConfig, devices } from "@playwright/test";

const hostExcluded = /@docker|@first-run|@matterless|@client-portal|@a11y/;
const nonChromiumHostExcluded =
  /@docker|@first-run|@matterless|@client-portal|@host-chromium-only|@a11y/;
const dockerOnly = /@docker/;
const firstRunOnly = /@first-run/;
const matterlessOnly = /@matterless/;
const clientPortalOnly = /@client-portal/;
const a11yOnly = /@a11y/;

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
      grepInvert: nonChromiumHostExcluded,
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "host-firefox",
      grepInvert: nonChromiumHostExcluded,
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "host-webkit",
      grepInvert: nonChromiumHostExcluded,
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
    {
      name: "matterless-chromium",
      grep: matterlessOnly,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "client-portal-chromium",
      grep: clientPortalOnly,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "a11y-chromium",
      grep: a11yOnly,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
