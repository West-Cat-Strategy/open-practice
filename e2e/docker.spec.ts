import { expect, expectPageHealthy, test } from "./helpers/e2e-fixtures";

test.describe("Docker-backed Playwright suite @docker", () => {
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
});
