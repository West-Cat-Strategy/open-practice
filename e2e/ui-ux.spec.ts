import type { Page, TestInfo } from "@playwright/test";

import { routeCatalog, type OpenPracticeRouteId } from "../apps/web/routes/routeCatalog";
import { expect, expectPageHealthy, test } from "./helpers/e2e-fixtures";
import {
  attachUiScreenshot,
  expectDashboardSectionHealthy,
  expectNavigationLabelsReadable,
  expectNoUnexpectedHorizontalOverflow,
  expectNoVisibleUiCollisions,
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
const matterlessDeepLinkSections = [
  "contacts",
  "calendar",
  "audit",
  "reports",
  "admin",
  "queues",
] as const satisfies readonly OpenPracticeRouteId[];

const matterlessSectionHeadings: Record<(typeof matterlessDeepLinkSections)[number], RegExp> = {
  contacts: /^Contacts$/,
  calendar: /^Calendar$/,
  audit: /^Audit activity$/,
  reports: /^Reports$/,
  admin: /^Admin Readiness$/,
  queues: /^Queues$/,
};

const sectionSentinels: Record<OpenPracticeRouteId, RegExp[]> = {
  matters: [/Activity and files/i, /Documents, time, and expenses/i],
  contacts: [/Contact dossiers/i],
  communications: [/Client communications/i, /Email delivery history/i],
  funds: [/Trust controls workbench/i],
  billing: [/Create draft invoice/i],
  documents: [/Document processing workbench/i],
  research: [/Research workspace/i],
  shares: [/Create share link/i],
  externalUploads: [/Uploaded document review/i],
  drafting: [/Templates/i, /Matter drafts/i],
  calendar: [/Deadline radar/i],
  signatures: [/Retainer agreement|No signature requests are linked/i],
  intake: [/Intake pipeline/i],
  audit: [/Audit taxonomy projection/i],
  reports: [/Saved report definitions/i],
  tasks: [/Create task/i, /Suggested follow-ups/i],
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

const staffPageScreenshotSections = [
  "matters",
  "contacts",
  "communications",
  "billing",
  "funds",
  "calendar",
  "intake",
  "queues",
] as const satisfies readonly OpenPracticeRouteId[];

function labelPattern(label: string): RegExp {
  return new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\b|$)`);
}

function primaryNavigationItem(page: Page, label: string) {
  const primaryNavigation = page.getByLabel("Primary");
  return primaryNavigation
    .getByRole("link", { name: labelPattern(label) })
    .or(primaryNavigation.getByRole("button", { name: labelPattern(label) }))
    .first();
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

async function expectUnavailableDashboardSection(
  page: Page,
  title: string | RegExp,
  label: string,
): Promise<void> {
  const workspace = page.locator("#matter-workspace");
  await expect(workspace.getByRole("heading", { name: title }), `${label} heading`).toBeVisible();
  await expect(workspace.getByRole("status"), `${label} status`).toBeVisible();
  await expect(
    page.getByLabel("Primary").locator('[aria-current="page"]'),
    `${label} active sidebar state`,
  ).toHaveCount(0);
  await expect(workspace, `${label} should not render fallback matter content`).not.toContainText(
    "Morgan tenancy dispute",
  );
  await expectDashboardSectionHealthy(page, label);
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

    const sidebarButton = primaryNavigationItem(page, section.label);
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
      await expectUnavailableDashboardSection(
        page,
        `${section.title} unavailable`,
        `${section.title} disabled route`,
      );
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

async function expectMatterlessDeepLink(
  page: Page,
  sectionId: (typeof matterlessDeepLinkSections)[number],
): Promise<void> {
  const workspace = page.locator("#matter-workspace");
  await expect(
    workspace.getByRole("heading", { name: matterlessSectionHeadings[sectionId] }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Create the first matter" })).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("Morgan tenancy dispute");
  await expectSectionSentinels(page, sectionId);
}

test.describe("UI/UX screenshot QA", () => {
  test("shows unavailable dashboard sections for unknown and disabled deep links", async ({
    app,
    page,
  }, testInfo) => {
    await page.goto(app.url("/?section=not-a-section"));
    await expectPageHealthy(page);
    await expectUnavailableDashboardSection(page, "Dashboard section unavailable", "unknown route");
    await expect(page.locator("#matter-workspace")).not.toContainText("not-a-section");
    await attachUiScreenshot(page, testInfo, "dashboard-unknown-section-unavailable");

    await page
      .getByLabel("Primary")
      .getByRole("button", { name: labelPattern("Matters") })
      .click();
    await expect(
      page.locator("#matter-detail-title"),
      "matters after unavailable route",
    ).toContainText("Morgan tenancy dispute");
    await page.goBack();
    await expectUnavailableDashboardSection(
      page,
      "Dashboard section unavailable",
      "unknown route after history back",
    );

    await page.goto(app.url("/?section=externalUploads"));
    await expectPageHealthy(page);
    await expectUnavailableDashboardSection(
      page,
      "External Uploads unavailable",
      "disabled external uploads route",
    );
    await expect(page.locator("#matter-workspace").getByRole("status")).toContainText(
      "External uploads require S3 storage, token signing, and upload access.",
    );
    await attachUiScreenshot(page, testInfo, "dashboard-externalUploads-unavailable");
  });

  test("sweeps every host dashboard section for layout health and active navigation @host-chromium-only", async ({
    app,
    page,
  }, testInfo) => {
    testInfo.setTimeout(240_000);
    await sweepDashboardSections({ app, disabledSections: hostDisabledSections, page, testInfo });
  });

  test("sweeps every Docker dashboard section for provider-backed layout health @docker", async ({
    app,
    page,
  }, testInfo) => {
    testInfo.setTimeout(240_000);
    const health = await app.apiJson<{ persistence: string }>("/health", { headers: {} });
    expect(health.persistence).toBe("postgres");
    await sweepDashboardSections({ app, disabledSections: new Set(), page, testInfo });
  });

  test("captures selected staff page screenshots at desktop and mobile widths @host-chromium-only", async ({
    app,
    page,
  }, testInfo) => {
    testInfo.setTimeout(240_000);

    for (const width of [1280, 520]) {
      await page.setViewportSize({ width, height: 900 });
      const sizeName = width === 520 ? "mobile" : "desktop";

      for (const sectionId of staffPageScreenshotSections) {
        const section = routeCatalog.find((entry) => entry.id === sectionId)!;
        await page.goto(app.url(section.path));
        await expectPageHealthy(page);
        await expectSectionSentinels(page, sectionId);
        await expectDashboardSectionHealthy(page, `${section.title} ${sizeName}`);
        await attachUiScreenshot(page, testInfo, `staff-${sectionId}-${sizeName}`, {
          fullPage: true,
        });
      }
    }
  });

  test("surfaces unavailable dashboard deep links without echoing raw query values", async ({
    app,
    page,
  }) => {
    await page.goto(app.url("/?section=not-a-section"));
    await expectPageHealthy(page);

    await expectUnavailableDashboardSection(page, "Dashboard section unavailable", "unknown route");
    await expect(page.locator("#matter-workspace")).not.toContainText("not-a-section");
    await expect(page.getByRole("button", { name: labelPattern("Open Matters") })).toBeVisible();
  });

  test("renders matterless deep links without falling back to First Matter @matterless", async ({
    app,
    page,
  }, testInfo) => {
    expect(process.env.DEV_AUTH_FIRM_ID).toBe("firm-matterless-e2e");
    expect(process.env.DEV_AUTH_USER_ID).toBe("user-matterless-admin");

    for (const sectionId of matterlessDeepLinkSections) {
      const section = routeCatalog.find((entry) => entry.id === sectionId)!;
      await page.goto(app.url(`/?section=${sectionId}`));
      await expectPageHealthy(page);

      const sidebarButton = page
        .getByLabel("Primary")
        .getByRole("button", { name: labelPattern(section.shortLabel) })
        .first();
      await expect(sidebarButton, `${sectionId} matterless sidebar entry`).toBeVisible();
      await expect(sidebarButton, `${sectionId} matterless active state`).toHaveAttribute(
        "aria-current",
        "page",
      );

      await expectMatterlessDeepLink(page, sectionId);
      await expectNavigationLabelsReadable(page, `${sectionId} matterless deep link`);
      await expectNoUnexpectedHorizontalOverflow(page, `${sectionId} matterless deep link`);
      await attachUiScreenshot(page, testInfo, `dashboard-matterless-${sectionId}`);
    }
  });

  test("keeps the first-matter starter workspace readable at review breakpoints @matterless", async ({
    app,
    page,
  }, testInfo) => {
    expect(process.env.DEV_AUTH_FIRM_ID).toBe("firm-matterless-e2e");
    expect(process.env.DEV_AUTH_USER_ID).toBe("user-matterless-admin");

    for (const width of [1100, 760, 720, 520]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(app.url("/?section=matters"));
      await expectPageHealthy(page);

      await expect(page.getByRole("heading", { name: "Create the first matter" })).toBeVisible();
      await expect(page.getByText("Starter intake")).toBeVisible();
      await expect(page.getByRole("button", { name: /Create matter/i })).toBeVisible();
      await expect(page.locator(".first-matter-panel")).toBeVisible();
      await expectNavigationLabelsReadable(page, `first matter ${width}px`);
      await expectNoUnexpectedHorizontalOverflow(page, `first matter ${width}px`);
      await expectNoVisibleUiCollisions(page, `first matter ${width}px`);
      await attachUiScreenshot(page, testInfo, `dashboard-first-matter-${width}px`, {
        fullPage: true,
      });
    }
  });

  test("keeps the client portal workspace readable at desktop and mobile widths @client-portal", async ({
    app,
    page,
  }, testInfo) => {
    expect(process.env.DEV_AUTH_USER_ID).toBe("user-client-external");
    await app.ensureClientPortalAccount();

    for (const width of [1100, 720, 520]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(app.url("/"));
      await expectPageHealthy(page);

      await expect(page.getByRole("heading", { name: "Ada Morgan" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Matter details" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Shared files" })).toBeVisible();
      await expect(
        page.getByLabel("Shared files").getByText("Client portal E2E disclosure.pdf"),
      ).toBeVisible();
      await expect(page.getByRole("heading", { name: "Signatures" })).toBeVisible();
      await expect(
        page.getByLabel("Signatures").getByText("Client portal E2E signature"),
      ).toBeVisible();
      await expect(
        page.getByLabel("Signatures").getByText("Client portal E2E view acknowledgement"),
      ).toBeVisible();
      await expect(
        page.getByLabel("Signatures").getByText("Client portal E2E decline option"),
      ).toBeVisible();
      await expect(page.getByRole("heading", { name: "Billing" })).toBeVisible();
      await expectNoUnexpectedHorizontalOverflow(page, `client portal ${width}px`);
      await expectNoVisibleUiCollisions(page, `client portal ${width}px`);
      await attachUiScreenshot(page, testInfo, `client-portal-${width}px`, { fullPage: true });
    }
  });

  test("keeps dashboard rail and sidebar controls stable", async ({ app, page }, testInfo) => {
    await page.goto(app.url("/"));
    await expectPageHealthy(page);
    await attachUiScreenshot(page, testInfo, "dashboard-review-rail-expanded");

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

  test("keeps dense dashboard panels readable at review breakpoints @host-chromium-only", async ({
    app,
    page,
  }, testInfo) => {
    testInfo.setTimeout(180_000);
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
    const share = await app.createShareLink();
    await page.goto(app.publicTokenUrl("share-links", share.token));
    await expectPageHealthy(page);
    await expect(page.getByText("Email verification is required")).toBeVisible();
    await expectNoUnexpectedHorizontalOverflow(page, "share verification gate");
    await attachUiScreenshot(page, testInfo, "public-share-verification-gate");

    await page.getByLabel("Email verification code").fill(share.verificationCode);
    await page.getByRole("button", { name: /Verify email/i }).click();
    await expect(page.getByRole("heading", { name: "Shared documents" })).toBeVisible();
    await expect(page.locator("body")).not.toContainText(share.token);
    await expectNoUnexpectedHorizontalOverflow(page, "verified share documents");
    await attachUiScreenshot(page, testInfo, "public-share-verified");

    const intakeToken = await app.createIntakeFormLink();
    await page.goto(app.publicTokenUrl("intake-forms", intakeToken));
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
    await page.goto(app.publicTokenUrl("guest-sessions", guest.token));
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
    await page.goto(app.publicTokenUrl("external-uploads", token));
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
