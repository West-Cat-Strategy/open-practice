import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import { expect, expectPageHealthy, test } from "./helpers/e2e-fixtures";

type A11yViolationSummary = {
  id: string;
  impact: string | null | undefined;
  targets: string[];
};

async function expectNoSeriousOrCriticalA11yViolations(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const failures = results.violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map(
      (violation): A11yViolationSummary => ({
        id: violation.id,
        impact: violation.impact,
        targets: violation.nodes.flatMap((node) => node.target).slice(0, 6),
      }),
    );

  expect(failures, `${label} should have no serious or critical axe violations`).toEqual([]);
}

test.describe("rendered accessibility QA @a11y", () => {
  test("checks core staff dashboard surfaces", async ({ app, page }) => {
    const staffPages = [
      { label: "dashboard overview", path: "/" },
      { label: "billing workspace", path: "/?section=billing" },
      { label: "documents workspace", path: "/?section=documents" },
      { label: "intake workspace", path: "/?section=intake" },
    ];

    for (const staffPage of staffPages) {
      await page.goto(app.url(staffPage.path));
      await expectPageHealthy(page);
      await expectNoSeriousOrCriticalA11yViolations(page, staffPage.label);
    }
  });

  test("checks public token review pages", async ({ app, page }) => {
    const share = await app.createShareLink();
    await page.goto(app.publicTokenUrl("share-links", share.token));
    await expectPageHealthy(page);
    await expect(page.getByText("Email verification is required")).toBeVisible();
    await expectNoSeriousOrCriticalA11yViolations(page, "share email verification");

    const intakeToken = await app.createIntakeFormLink();
    await page.goto(app.publicTokenUrl("intake-forms", intakeToken));
    await expectPageHealthy(page);
    await expect(page.getByRole("heading", { name: "Residential tenancy intake" })).toBeVisible();
    await expectNoSeriousOrCriticalA11yViolations(page, "public intake form");
  });
});
