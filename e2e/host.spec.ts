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

  test("verifies a secure share before showing documents", async ({ app, page }) => {
    const share = await app.createShareLink();

    await page.goto(app.publicTokenUrl("share-links", share.token));
    await expectPageHealthy(page);
    await expect(page.getByText("Email verification is required")).toBeVisible();
    await page.getByLabel("Email verification code").fill(share.verificationCode);
    await page.getByRole("button", { name: /Verify email/i }).click();

    await expect(page.getByRole("heading", { name: "Shared documents" })).toBeVisible();
    await expect(page.getByText("Synthetic shareable disclosure.pdf")).toBeVisible();
    await expect(page.locator("body")).not.toContainText(share.token);
    await expect(page.locator("body")).not.toContainText(/tokenHash|matter-001/i);
  });

  test("saves an intake draft and shows incomplete public-form requirements", async ({
    app,
    page,
  }) => {
    const token = await app.createIntakeFormLink();

    await page.goto(app.publicTokenUrl("intake-forms", token));
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

    await page.goto(app.publicTokenUrl("guest-sessions", guest.token));
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

  test("renders the client portal workspace without leaking private fields @client-portal", async ({
    app,
    page,
  }, testInfo) => {
    expect(process.env.DEV_AUTH_USER_ID).toBe("user-client-external");
    testInfo.setTimeout(90_000);

    await app.ensureClientPortalAccount();
    await page.goto(app.url("/"));
    await expectPageHealthy(page);

    await expect(page.getByRole("heading", { name: "Ada Morgan" })).toBeVisible();
    await expect(page.getByLabel("Matter action workspace")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Morgan tenancy dispute" })).toBeVisible();
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
    await expect(page.getByLabel("Billing")).toBeVisible();
    await expect(page.getByText(/redacted/i).first()).toBeVisible();

    const viewedRow = page
      .locator(".client-portal-file")
      .filter({ hasText: "Client portal E2E view acknowledgement" });
    await viewedRow.getByRole("button", { name: "Mark viewed" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Signature marked viewed." }),
    ).toBeVisible();
    await expect(viewedRow.locator("span").filter({ hasText: "Viewed" })).toBeVisible();
    await expect(viewedRow.getByRole("button", { name: "Mark viewed" })).toHaveCount(0);
    await expect(viewedRow.getByRole("button", { name: "Confirm signed" })).toBeVisible();
    await expect(viewedRow.getByRole("button", { name: "Decline signing" })).toBeVisible();

    const declinedRow = page
      .locator(".client-portal-file")
      .filter({ hasText: "Client portal E2E decline option" });
    await declinedRow.getByRole("button", { name: "Decline signing" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Signature decline recorded." }),
    ).toBeVisible();
    await expect(declinedRow.locator("em").filter({ hasText: "Declined" })).toBeVisible();
    await expect(declinedRow.getByRole("button", { name: "Decline signing" })).toHaveCount(0);
    await expect(declinedRow.getByRole("button", { name: "Confirm signed" })).toHaveCount(0);

    const signatureRow = page
      .locator(".client-portal-file")
      .filter({ hasText: "Client portal E2E signature" });
    await signatureRow.getByRole("button", { name: "Confirm signed" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Signature completion recorded." }),
    ).toBeVisible();
    await expect(signatureRow.locator("em").filter({ hasText: "Completed" })).toBeVisible();
    await expect(signatureRow.getByRole("button", { name: "Confirm signed" })).toHaveCount(0);

    await expect(page.locator("body")).not.toContainText(/tokenHash|storageKey|checkoutUrl/i);
    await expect(page.locator("body")).not.toContainText(/externalSessionId|private-checkout/i);
    await expect(page.locator("body")).not.toContainText(/signingUrl|providerEvidence/i);
  });

  test("grants and revokes staff portal document visibility @host-chromium-only", async ({
    app,
    page,
  }, testInfo) => {
    expect(process.env.DEV_AUTH_USER_ID ?? "user-admin").toBe("user-admin");
    testInfo.setTimeout(90_000);

    await app.ensureClientPortalAccount();
    await page.goto(app.url("/?section=documents"));
    await expectPageHealthy(page);

    await expect(
      page.getByRole("heading", { name: "Document processing workbench" }),
    ).toBeVisible();
    await expect(
      page.getByRole("status").filter({ hasText: "Portal visibility for Ada Morgan" }),
    ).toBeVisible();

    const grantableDocumentRow = page
      .locator(".upload-review-row")
      .filter({ hasText: "Client portal E2E staff grant.pdf" });
    await grantableDocumentRow.scrollIntoViewIfNeeded();
    await expect(grantableDocumentRow.getByRole("button", { name: "Grant portal" })).toBeVisible();

    await grantableDocumentRow.getByRole("button", { name: "Grant portal" }).click();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "Portal file visibility granted for Ada Morgan." }),
    ).toBeVisible();
    await expect(grantableDocumentRow.getByRole("button", { name: "Revoke portal" })).toBeVisible();

    await grantableDocumentRow.getByRole("button", { name: "Revoke portal" }).click();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "Portal file visibility revoked for Ada Morgan." }),
    ).toBeVisible();
    await expect(grantableDocumentRow.getByRole("button", { name: "Grant portal" })).toBeVisible();
  });
});
