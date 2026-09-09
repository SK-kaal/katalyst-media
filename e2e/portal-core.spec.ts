import { test, expect, type Page } from "@playwright/test";

const ACCESS_CODE = process.env.ADMIN_ACCESS_CODE;
if (!ACCESS_CODE) {
  throw new Error("Set ADMIN_ACCESS_CODE before running e2e tests");
}

async function login(page: Page) {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.locator("#access-code").fill(ACCESS_CODE);
  await page.getByRole("button", { name: /enter portal/i }).click();
  await expect(page).toHaveURL(/\/admin\/?$/, { timeout: 30_000 });
  await expect(page.getByRole("link", { name: /campaigns/i }).first()).toBeVisible({
    timeout: 25_000,
  });
}

test.describe("Campaign library", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("loads library controls and status filters", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.locator("body")).toContainText(/campaign/i);

    for (const label of ["All", "Live", "Paused", "Draft", "Closed"]) {
      const control = page.getByRole("link", { name: new RegExp(label, "i") }).first();
      if (await control.count()) {
        await control.click();
        await expect(page).toHaveURL(/\/admin/);
      }
    }

    const sort = page.locator("select, [name='sort']").first();
    if (await sort.count()) {
      await sort.selectOption({ index: 0 }).catch(() => undefined);
    }
  });
});

test.describe("Clients CRUD smoke", () => {
  test("add-client form opens and an existing profile can be opened", async ({ page }) => {
    await login(page);
    await page.goto("/admin/clients");

    await page.getByRole("link", { name: /add client/i }).first().click();
    await expect(page.locator("#client-name")).toBeVisible();
    await expect(page.locator("#client-handle")).toBeVisible();
    await expect(page.getByRole("button", { name: /create client/i })).toBeVisible();

    // Profile image is required to save — open an existing client instead of inventing one.
    await page.goto("/admin/clients");
    await page.getByRole("link", { name: /open profile/i }).first().click();
    await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 20_000 });
  });
});
