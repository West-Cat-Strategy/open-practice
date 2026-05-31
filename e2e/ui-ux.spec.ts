import type { Page, TestInfo } from "@playwright/test";

import { routeCatalog, type OpenPracticeRouteId } from "../apps/web/routes/routeCatalog";
import { expect, expectPageHealthy, test } from "./helpers/e2e-fixtures";
import {
  attachUiScreenshot,
  expectDashboardSectionHealthy,
  expectNavigationLabelsReadable,
  expectNoUnexpectedHorizontalOverflow,
} from "./helpers/ui-ux-assertions";

const hostDisabledSections = new Set<OpenPracticeRouteId>(["externalUploads"]);
const deepReviewSections = new Set<OpenPracticeRouteId>([
  "admin",
  "billing",
  "documents",
  "externalUploads",
  "calendar",
  "intake",
]);

const sectionSentinels: Record<OpenPracticeRouteId, RegExp[]> = {
  matters: [/Activity and files/i, /Documents, time, and expenses/i],
  contacts: [/Contact dossiers/i],
  funds: [/Trust controls workbench/i],
  billing: [/Create draft invoice/i],
  documents: [/Document processing workbench/i],
  shares: [/Create share link/i],
  externalUploads: [/Uploaded document review/i],
  drafting: [/Templates/i, /Matter drafts/i],
  calendar: [/Deadline radar/i],
  signatures: [/Retainer agreement|No signature requests are linked/i],
  intake: [/Intake pipeline/i],
  audit: [/Audit taxonomy projection/i],
  reports: [/Saved report definitions/i],
  admin: [
    /Access and support controls/i,
    /Portability and migration/i,
    /Backup and restore evidence/i,
    /Regional, privacy, and training posture/i,
  ],
  queues: [/Connector outbox/i],
};

const dashboardSections = routeCatalog
  .filter((entry) => entry.showInSidebar && entry.sectionKey)
  .map((entry) => ({
    id: entry.id,
    label: entry.shortLabel,
    path: entry.path,
    sectionKey: entry.sectionKey!,
    title: entry.title,
  }));

function labelPattern(label: string): RegExp {
  return new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\b|$)`);
}

async function expectSectionSentinels(page: Page, sectionId: OpenPracticeRouteId): Promise<void> {
  const workspace = page.locator("#matter-workspace");
  for (const sentinel of sectionSentinels[sectionId]) {
    await expect(
      workspace.getByText(sentinel).first(),
      `${sectionId} sentinel ${sentinel}`,
    ).toBeVisible();
  }
}

async function sweepDashboardSections({
  app,
  disabledSections,
  page,
  testInfo,
}: {
  app: { url(path: string): string };
  disabledSections: Set<OpenPracticeRouteId>;
  page: Page;
  testInfo: TestInfo;
}): Promise<void> {
  for (const section of dashboardSections) {
    await page.goto(app.url(section.path));
    await expectPageHealthy(page);

    const sidebarButton = page
      .getByLabel("Primary")
      .getByRole("button", { name: labelPattern(section.label) })
      .first();
    await expect(sidebarButton, `${section.title} sidebar entry`).toBeVisible();

    const expectedDisabled = disabledSections.has(section.id);
    const isDisabled =
      (await sidebarButton.getAttribute("aria-disabled")) === "true" ||
      (await sidebarButton.isDisabled());
    expect(isDisabled, `${section.title} enabled/disabled route state`).toBe(expectedDisabled);

    if (expectedDisabled) {
      await expect(sidebarButton, `${section.title} disabled sidebar entry`).not.toHaveAttribute(
        "aria-current",
        "page",
      );
      await expect(
        page.locator("#matter-detail-title"),
        `${section.title} disabled route fallback`,
      ).toContainText("Morgan tenancy dispute");
      await expectDashboardSectionHealthy(page, `${section.title} disabled fallback`);
      await attachUiScreenshot(page, testInfo, `dashboard-${section.id}-disabled`);
      continue;
    }

    await expect(sidebarButton, `${section.title} active sidebar entry`).toHaveAttribute(
      "aria-current",
      "page",
    );
    await sidebarButton.focus();
    await expect(sidebarButton, `${section.title} focused sidebar entry`).toBeFocused();

    const expectedHeading =
      section.sectionKey === "matters" ? "Morgan tenancy dispute" : section.title;
    await expect(
      page.locator("#matter-detail-title"),
      `${section.title} detail heading`,
    ).toContainText(expectedHeading);
    await expectSectionSentinels(page, section.id);
    await expectDashboardSectionHealthy(page, section.title);
    await attachUiScreenshot(page, testInfo, `dashboard-${section.id}`);

    if (deepReviewSections.has(section.id)) {
      await page.getByText(sectionSentinels[section.id].at(-1)!).first().scrollIntoViewIfNeeded();
      await expectNoUnexpectedHorizontalOverflow(page, `${section.title} deep review panel`);
      await attachUiScreenshot(page, testInfo, `dashboard-${section.id}-deep-review`);
    }
  }
}

test.describe("UI/UX screenshot QA", () => {
  test("sweeps every host dashboard section for layout health and active navigation", async ({
    app,
    page,
  }, testInfo) => {
    await sweepDashboardSections({ app, disabledSections: hostDisabledSections, page, testInfo });
  });

  test("sweeps every Docker dashboard section for provider-backed layout health @docker", async ({
    app,
    page,
  }, testInfo) => {
    await sweepDashboardSections({ app, disabledSections: new Set(), page, testInfo });
  });

  test("keeps dashboard rail and sidebar controls stable", async ({ app, page }, testInfo) => {
    await page.goto(app.url("/"));
    await expectPageHealthy(page);

    const reviewToggle = page.getByRole("button", { name: "Toggle review tools" });
    await expect(reviewToggle).toHaveAttribute("aria-controls", "dashboard-review-rail");
    await expect(reviewToggle).toHaveAttribute("aria-expanded", "true");
    await reviewToggle.click();
    await expect(reviewToggle).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("#dashboard-review-rail")).toHaveAttribute(
      "data-review-rail-state",
      "collapsed",
    );
    await expectNoUnexpectedHorizontalOverflow(page, "collapsed review rail");
    await attachUiScreenshot(page, testInfo, "dashboard-review-rail-collapsed");

    await reviewToggle.click();
    await expect(reviewToggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#dashboard-review-rail")).not.toHaveAttribute(
      "data-review-rail-state",
      "collapsed",
    );

    const workspaceGroup = page.getByRole("button", { name: "Collapse Workspace navigation" });
    await expect(workspaceGroup).toHaveAttribute("aria-expanded", "true");
    await workspaceGroup.click();
    await expect(page.getByRole("button", { name: "Expand Workspace navigation" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await expectNoUnexpectedHorizontalOverflow(page, "collapsed workspace navigation");

    await page.getByRole("button", { name: "Expand Workspace navigation" }).click();
    await expect(
      page.getByRole("button", { name: "Collapse Workspace navigation" }),
    ).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByLabel("Primary").getByRole("button", { name: "Matters" })).toBeVisible();
    await expectNavigationLabelsReadable(page, "restored workspace navigation");
    await attachUiScreenshot(page, testInfo, "dashboard-sidebar-restored");
  });

  test("keeps dense dashboard panels readable at review breakpoints", async ({
    app,
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "host-chromium", "covered once with explicit viewports");

    for (const width of [1100, 720, 520]) {
      await page.setViewportSize({ width, height: 900 });
      for (const section of ["billing", "documents", "calendar", "intake", "admin"] as const) {
        await page.goto(app.url(`/?section=${section}`));
        await expectPageHealthy(page);
        await expectSectionSentinels(page, section);
        await expectDashboardSectionHealthy(page, `${section} ${width}px`);
        await page.getByText(sectionSentinels[section].at(-1)!).first().scrollIntoViewIfNeeded();
        await expectNoUnexpectedHorizontalOverflow(page, `${section} ${width}px deep panel`);
        await attachUiScreenshot(page, testInfo, `dashboard-${section}-${width}px`);
      }
    }
  });

  test("keeps current public-token flows readable after primary interactions", async ({
    app,
    page,
  }, testInfo) => {
    const shareToken = await app.createShareLink();
    await page.goto(app.url(`/share-links/${shareToken}`));
    await expectPageHealthy(page);
    await expect(page.getByText("Email verification is required")).toBeVisible();
    await expectNoUnexpectedHorizontalOverflow(page, "share verification gate");
    await attachUiScreenshot(page, testInfo, "public-share-verification-gate");

    await page.getByRole("button", { name: /Verify email/i }).click();
    await expect(page.getByRole("heading", { name: "Shared documents" })).toBeVisible();
    await expect(page.locator("body")).not.toContainText(shareToken);
    await expectNoUnexpectedHorizontalOverflow(page, "verified share documents");
    await attachUiScreenshot(page, testInfo, "public-share-verified");

    const intakeToken = await app.createIntakeFormLink();
    await page.goto(app.url(`/intake-forms/${intakeToken}`));
    await expectPageHealthy(page);
    await page.getByLabel("Preferred client name").fill("Ada Morgan");
    await page.getByLabel("Short matter title").fill("Synthetic repair request");
    await page.getByLabel("Issue type").selectOption("repair");
    await page.getByLabel("Repair details").fill("Synthetic repair timeline for UI proof.");
    await page.getByRole("button", { name: /Save draft/i }).click();
    await expect(page.getByText(/Draft saved/)).toBeVisible();
    await page.getByRole("button", { name: /Submit intake/i }).click();
    await expect(page.getByText(/Submit blocked: complete/)).toBeVisible();
    await expectNoUnexpectedHorizontalOverflow(page, "incomplete intake requirements");
    await attachUiScreenshot(page, testInfo, "public-intake-incomplete");

    const guest = await app.createGuestSession();
    await page.goto(app.url(`/guest-sessions/${guest.token}`));
    await expectPageHealthy(page);
    await expect(page.getByRole("status").filter({ hasText: "The lobby is open." })).toBeVisible();
    await page.getByRole("button", { name: /Check in/i }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "You are waiting in the lobby." }),
    ).toBeVisible();
    await expect(page.locator("body")).not.toContainText(guest.token);
    await expectNoUnexpectedHorizontalOverflow(page, "guest-session waiting state");
    await attachUiScreenshot(page, testInfo, "public-guest-session-waiting");
  });

  test("keeps Docker-backed external upload receipt layout stable @docker", async ({
    app,
    page,
  }, testInfo) => {
    const health = await app.apiJson<{ persistence: string }>("/health", { headers: {} });
    expect(health.persistence).toBe("postgres");

    const token = await app.createExternalUploadLink();
    await page.goto(app.url(`/external-uploads/${token}`));
    await expectPageHealthy(page);
    await expect(page.getByText(/Upload link ready/)).toBeVisible();
    await expectNoUnexpectedHorizontalOverflow(page, "external upload ready state");
    await attachUiScreenshot(page, testInfo, "docker-external-upload-ready");

    await page.getByLabel("Classification").selectOption("privileged");
    await page.getByLabel("Legal hold").check();
    await page.locator('input[type="file"]').setInputFiles({
      name: "synthetic-ui-proof.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Synthetic Open Practice UI/UX upload proof.\n"),
    });

    await expect(page.getByText("synthetic-ui-proof.txt")).toBeVisible();
    await expect(page.getByText("received")).toBeVisible();
    await expect(page.getByText(/verified.*pending_review/i)).toBeVisible();
    await expect(page.locator("body")).not.toContainText(token);
    await expect(page.locator("body")).not.toContainText(/tokenHash|open_practice_secret/i);
    await expectNoUnexpectedHorizontalOverflow(page, "external upload receipt");
    await attachUiScreenshot(page, testInfo, "docker-external-upload-receipt");
  });
});
