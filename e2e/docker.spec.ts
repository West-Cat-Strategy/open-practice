import { expect, expectPageHealthy, test } from "./helpers/e2e-fixtures";

test.describe("Docker-backed Playwright suite @docker", () => {
  test("serves the dashboard from disposable PostgreSQL-backed runtime", async ({ app, page }) => {
    const health = await app.apiJson<{ persistence: string }>("/health", {
      headers: {},
    });
    expect(health.persistence).toBe("postgres");

    await page.goto(app.url("/"));
    await expectPageHealthy(page);
    await expect(
      page.getByRole("heading", { name: "West Coast Legal Services Collective" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Morgan tenancy dispute" })).toBeVisible();
  });

  test("uploads a synthetic document through an external upload link and MinIO", async ({
    app,
    page,
  }) => {
    const token = await app.createExternalUploadLink();

    await page.goto(app.publicTokenUrl("external-uploads", token));
    await expectPageHealthy(page);
    await expect(page.getByText(/Upload link ready/)).toBeVisible();
    await page.getByLabel("Classification").selectOption("privileged");
    await page.getByLabel("Legal hold").check();
    await page.locator('input[type="file"]').setInputFiles({
      name: "synthetic-evidence.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Synthetic Open Practice browser upload proof.\n"),
    });

    await expect(page.getByText("synthetic-evidence.txt")).toBeVisible();
    await expect(page.getByText("received")).toBeVisible();
    await expect(page.getByText(/verified.*pending_review/i)).toBeVisible();
    await expect(page.locator("body")).not.toContainText(token);
    await expect(page.locator("body")).not.toContainText(/tokenHash|open_practice_secret/i);
  });

  test("reuses public-token flows against the Docker-backed API", async ({ app, page }) => {
    const share = await app.createShareLink();
    await page.goto(app.publicTokenUrl("share-links", share.token));
    await expectPageHealthy(page);
    await page.getByLabel("Email verification code").fill(share.verificationCode);
    await page.getByRole("button", { name: /Verify email/i }).click();
    await expect(page.getByText("Synthetic shareable disclosure.pdf")).toBeVisible();

    const guest = await app.createGuestSession();
    await page.goto(app.publicTokenUrl("guest-sessions", guest.token));
    await expect(page.getByRole("status").filter({ hasText: "The lobby is open." })).toBeVisible();
    await page.getByRole("button", { name: /Check in/i }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "You are waiting in the lobby." }),
    ).toBeVisible();
  });
});
