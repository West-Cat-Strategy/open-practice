import { expect, type Page, type TestInfo } from "@playwright/test";

const screenshotProjects = new Set(["host-chromium", "host-mobile-chromium", "docker-chromium"]);

const layoutSelectors = [
  ".dashboard-topbar",
  ".dashboard-metrics",
  ".operational-focus-panel",
  ".dashboard-matter-context",
  ".matter-detail-panel",
  ".matter-action-strip",
  ".context-rail",
  ".context-rail-placeholder",
  ".panel-header",
  ".detail-grid",
  ".activity-card",
  ".party-row",
  ".metric-card",
  ".operational-focus-item",
  ".search-field",
  ".primary-button",
  ".secondary-button",
  ".compact-button",
  ".action-strip-button",
  ".public-form-panel",
  ".public-token-description",
  ".public-form-action",
  ".public-form-action > div",
  ".public-upload-document",
  ".public-upload-receipt",
  ".public-attention-item",
  ".public-submit-button",
  ".public-upload-button",
  ".file-button",
  ".share-check-row",
].join(",");

function screenshotName(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function attachUiScreenshot(
  page: Page,
  testInfo: TestInfo,
  name: string,
  options: { fullPage?: boolean } = {},
): Promise<void> {
  if (!screenshotProjects.has(testInfo.project.name)) return;

  await testInfo.attach(`ui-${screenshotName(name)}-${testInfo.project.name}`, {
    body: await page.screenshot({ fullPage: options.fullPage ?? false }),
    contentType: "image/png",
  });
}

export async function expectNoUnexpectedHorizontalOverflow(
  page: Page,
  label: string,
): Promise<void> {
  const result = await page.evaluate((selector) => {
    const documentElement = document.documentElement;
    const body = document.body;
    const viewportWidth = documentElement.clientWidth;
    const documentScrollWidth = Math.max(documentElement.scrollWidth, body.scrollWidth);
    const offenders = Array.from(document.querySelectorAll<HTMLElement>(selector))
      .filter((element) => {
        const style = window.getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden") return false;
        if (element.classList.contains("context-rail-placeholder")) return false;

        const rect = element.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) return false;

        const allowsHorizontalScroll = ["auto", "scroll"].includes(style.overflowX);
        const hasElementOverflow =
          element.scrollWidth > Math.ceil(element.clientWidth) + 6 && !allowsHorizontalScroll;
        const clipsVisibleContent = style.overflowX === "hidden" && hasElementOverflow;
        const escapesViewport = rect.left < -6 || rect.right > viewportWidth + 6;
        return clipsVisibleContent || escapesViewport;
      })
      .slice(0, 8)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const className =
          typeof element.className === "string"
            ? element.className
            : String(element.getAttribute("class") ?? "");
        return {
          tag: element.tagName.toLowerCase(),
          className,
          text: (element.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 80),
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          viewportWidth,
        };
      });

    return {
      viewportWidth,
      documentScrollWidth,
      offenders,
    };
  }, layoutSelectors);

  expect(
    result.documentScrollWidth,
    `${label} should not create app-wide horizontal overflow`,
  ).toBeLessThanOrEqual(result.viewportWidth + 6);
  expect(result.offenders, `${label} should not have clipped or viewport-escaping UI`).toEqual([]);
}

export async function expectNavigationLabelsReadable(page: Page, label: string): Promise<void> {
  const result = await page.evaluate(() => {
    const navigationText = Array.from(
      document.querySelectorAll<HTMLElement>(".nav-item strong, .nav-disabled-reason"),
    );

    return navigationText
      .filter((element) => {
        const style = window.getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden") return false;

        const rect = element.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) return false;

        const clipsInlineText =
          element.scrollWidth > Math.ceil(element.clientWidth) + 6 &&
          !["auto", "scroll"].includes(style.overflowX);
        const clipsBlockText =
          element.scrollHeight > Math.ceil(element.clientHeight) + 6 &&
          style.overflowY === "hidden";
        return clipsInlineText || clipsBlockText;
      })
      .slice(0, 8)
      .map((element) => ({
        className:
          typeof element.className === "string"
            ? element.className
            : String(element.getAttribute("class") ?? ""),
        text: (element.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 80),
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
      }));
  });

  expect(result, `${label} navigation labels should not clip`).toEqual([]);
}

export async function expectDashboardSectionHealthy(page: Page, label: string): Promise<void> {
  await expect(page.locator("#dashboard-title"), `${label} dashboard title`).toBeVisible();
  await expect(page.locator("#matter-workspace"), `${label} matter workspace`).toBeVisible();
  await expect(page.locator("#matter-detail-title"), `${label} section heading`).toBeVisible();
  await expectNavigationLabelsReadable(page, label);
  await expectNoUnexpectedHorizontalOverflow(page, label);
}
