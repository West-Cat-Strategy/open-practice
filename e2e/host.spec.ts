import { expect, expectPageHealthy, test } from "./helpers/e2e-fixtures";

test.describe("host Playwright suite", () => {
  test("renders the dashboard shell and seeded matter data", async ({ app, page }) => {
    await page.goto(app.url("/"));

    await expectPageHealthy(page);
    await expect(
      page.getByRole("heading", { name: "West Coast Legal Services Collective" }),
    ).toBeVisible();
    await expect(page.getByText("Avery Chen")).toBeVisible();
    await expect(page.locator("body")).toContainText("Server-enforced controls");
    await expect(page.getByRole("heading", { name: "Morgan tenancy dispute" })).toBeVisible();
  });

  test("deep-links through core dashboard sections", async ({ app, page }) => {
    const sections = [
      { label: "Matters", path: "/" },
      { label: "Calendar", path: "/?section=calendar" },
      { label: "Queues", path: "/?section=queues" },
      { label: "Billing", path: "/?section=billing" },
      { label: "Funds", path: "/?section=funds" },
      { label: "Intake", path: "/?section=intake" },
    ];

    for (const section of sections) {
      await page.goto(app.url(section.path));
      await expectPageHealthy(page);
      await expect(
        page.getByLabel("Primary").getByRole("button", { name: section.label, exact: true }),
      ).toHaveAttribute("aria-current", "page");
    }
  });

  test("verifies a secure share before showing documents", async ({ app, page }) => {
    const token = await app.createShareLink();

    await page.goto(app.url(`/share-links/${token}`));
    await expectPageHealthy(page);
    await expect(page.getByText("Email verification is required")).toBeVisible();
    await page.getByRole("button", { name: /Verify email/i }).click();

    await expect(page.getByRole("heading", { name: "Shared documents" })).toBeVisible();
    await expect(page.getByText("Synthetic shareable disclosure.pdf")).toBeVisible();
    await expect(page.locator("body")).not.toContainText(token);
    await expect(page.locator("body")).not.toContainText(/tokenHash|matter-001/i);
  });

  test("saves an intake draft and shows incomplete public-form requirements", async ({
    app,
    page,
  }) => {
    const token = await app.createIntakeFormLink();

    await page.goto(app.url(`/intake-forms/${token}`));
    await expectPageHealthy(page);
    await expect(page.getByRole("heading", { name: "Residential tenancy intake" })).toBeVisible();
    await page.getByLabel("Preferred client name").fill("Ada Morgan");
    await page.getByLabel("Short matter title").fill("Synthetic repair request");
    await page.getByLabel("Issue type").selectOption("repair");
    await page.getByLabel("Repair details").fill("Synthetic repair timeline for browser proof.");
    await page.getByRole("button", { name: /Save draft/i }).click();

    await expect(page.getByText(/Draft saved/)).toBeVisible();
    await page.getByRole("button", { name: /Submit intake/i }).click();
    await expect(page.getByText(/Submit blocked: complete/)).toBeVisible();
    await expect(page.getByText(/evidence-upload/)).toBeVisible();
    await expect(page.getByText(/client-attestation/)).toBeVisible();
  });

  test("checks in to a hosted guest-session lobby and reflects staff admission", async ({
    app,
    page,
  }) => {
    const guest = await app.createGuestSession();

    await page.goto(app.url(`/guest-sessions/${guest.token}`));
    await expectPageHealthy(page);
    await expect(page.getByRole("status").filter({ hasText: "The lobby is open." })).toBeVisible();
    await page.getByRole("button", { name: /Check in/i }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "You are waiting in the lobby." }),
    ).toBeVisible();

    await app.admitGuest(guest.sessionId, guest.guestId);
    await page.reload();
    await expect(
      page.getByRole("status").filter({ hasText: "You have been admitted." }),
    ).toBeVisible();
    await expect(page.getByText("admitted", { exact: true }).first()).toBeVisible();
    await expect(page.locator("body")).not.toContainText(guest.token);
  });
});
