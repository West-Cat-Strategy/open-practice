import { expect, expectPageHealthy, test } from "./helpers/e2e-fixtures";

test.describe("first-run setup @first-run", () => {
  test("creates an operational starter workspace without a setup key", async ({ app, page }) => {
    await expect
      .poll(async () =>
        app.apiJson<{ blocked: boolean; required: boolean }>("/api/setup/status", {
          headers: {},
        }),
      )
      .toMatchObject({ required: true, blocked: false });

    await page.goto(app.url("/"));
    await expectPageHealthy(page);
    await expect(page.getByText("First run setup")).toBeVisible();
    await expect(page.getByLabel(/System setup key/i)).toHaveCount(0);
    await expect(page.getByLabel(/General Canada practice/i)).toBeChecked();
    await expect(page.getByLabel(/BC notarial/i)).toBeChecked();

    await page.getByLabel("Workspace name").fill("North Shore Starter Law");
    await page.getByLabel("Matter title").fill("Opening consult");
    await page.getByLabel("Practice area").fill("Notarial services");
    await page.getByLabel("Jurisdiction").selectOption("BC");
    await page.getByLabel("Client type").selectOption("organization");
    await page.getByLabel("Client name").fill("Example Cooperative");
    await page.getByLabel("Client email").fill("contact@example.test");
    await page.getByRole("button", { name: /Next Step/i }).click();

    await page.getByLabel("Owner name").fill("Avery Owner");
    await page.getByLabel("Owner email").fill("avery@example.test");
    await page.getByLabel("Backup password").fill("correct horse battery staple");
    await page.getByLabel("Confirm password").fill("correct horse battery staple");
    await page.getByRole("button", { name: /Next Step/i }).click();

    await page.getByLabel(/trust\/funds workflows are operational records/i).check();
    await page.getByRole("button", { name: /Next Step/i }).click();
    await expect(page.getByText("Opening consult")).toBeVisible();
    await page.getByRole("button", { name: /Complete Setup/i }).click();

    await expect(page.getByRole("heading", { name: "North Shore Starter Law" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("heading", { name: "Opening consult" })).toBeVisible();
    await expectPageHealthy(page);

    await page.goto(app.url("/?section=drafting"));
    await expect(page.getByText("Matter Summary Note")).toBeVisible();
    await expect(page.getByText("Notarial Appointment Checklist")).toBeVisible();
    await expect(
      app.apiJson<{ blocked: boolean; required: boolean }>("/api/setup/status", { headers: {} }),
    ).resolves.toMatchObject({ required: false, blocked: false });
  });
});
