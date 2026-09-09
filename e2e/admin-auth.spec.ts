import { test, expect, type Page } from "@playwright/test";

const ACCESS_CODE = process.env.ADMIN_ACCESS_CODE;
if (!ACCESS_CODE) {
  throw new Error("Set ADMIN_ACCESS_CODE before running e2e tests");
}

async function fillAccessCode(page: Page, code: string) {
  await page.locator("#access-code").fill(code);
}

async function login(page: Page, code = ACCESS_CODE) {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(page.getByRole("heading", { name: /enter access code/i })).toBeVisible();
  await fillAccessCode(page, code);
  await page.getByRole("button", { name: /enter portal/i }).click();
  await expect(page).toHaveURL(/\/admin\/?$/, { timeout: 30_000 });
  await expect(page.getByRole("link", { name: /campaigns/i }).first()).toBeVisible({
    timeout: 25_000,
  });
}

test.describe("Admin access-code authentication", () => {
  test("shows access-code screen when logged out", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.getByRole("heading", { name: /enter access code/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /enter portal/i })).toBeVisible();
    await expect(page.getByText(/authorised users only/i)).toBeVisible();
  });

  test("rejects blank and incorrect codes", async ({ page }) => {
    await page.goto("/admin");
    await page.getByRole("button", { name: /enter portal/i }).click();
    await expect(page.getByRole("alert")).toContainText(/incorrect access code/i);

    await fillAccessCode(page, "definitely-wrong-code");
    await page.getByRole("button", { name: /enter portal/i }).click();
    await expect(page.getByRole("alert")).toContainText(/incorrect access code/i);
    await expect(page.getByRole("alert")).toContainText(/try again/i);
  });

  test("accepts correct code, keeps session on refresh, logout locks routes", async ({
    page,
  }) => {
    await login(page);

    await page.reload();
    await expect(page.getByRole("link", { name: /campaigns/i }).first()).toBeVisible();

    await page.goto("/admin/clients");
    await expect(page.getByRole("heading", { name: /clients/i })).toBeVisible();

    await page.getByRole("button", { name: /log out/i }).first().click();
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.getByRole("heading", { name: /enter access code/i })).toBeVisible();

    await page.goto("/admin/clients");
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.getByRole("heading", { name: /enter access code/i })).toBeVisible();

    await page.goto("/admin/campaigns/new");
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.getByRole("heading", { name: /enter access code/i })).toBeVisible();
  });

  test("Enter key submits the access code form", async ({ page }) => {
    await page.goto("/admin/login");
    await fillAccessCode(page, ACCESS_CODE);
    await page.locator("#access-code").press("Enter");
    await expect(page).toHaveURL(/\/admin\/?$/, { timeout: 30_000 });
    await expect(page.getByRole("link", { name: /campaigns/i }).first()).toBeVisible({
      timeout: 25_000,
    });
  });
});

test.describe("Protected admin surfaces", () => {
  test("campaign library loads after login", async ({ page }) => {
    await login(page);
    await expect(page.getByText(/campaign library|campaigns/i).first()).toBeVisible();
    const search = page.getByPlaceholder(/search/i).first();
    if (await search.count()) {
      await search.fill("zzzz-no-match-xyz");
      await page.keyboard.press("Enter");
    }
  });

  test("clients page search and create form validation", async ({ page }) => {
    await login(page);
    await page.goto("/admin/clients");
    await expect(page.getByRole("heading", { name: /clients/i })).toBeVisible();

    const newClient = page.getByRole("link", { name: /add client/i }).first();
    if (await newClient.count()) {
      await newClient.click();
      const save = page.getByRole("button", { name: /save client|create client/i }).first();
      if (await save.count()) {
        await save.click();
        await expect(page.locator("form").first()).toBeVisible();
      }
    }
  });
});

test.describe("Report share security", () => {
  test("invalid report token is not an admin page", async ({ page }) => {
    await page.goto("/report/this-token-does-not-exist-xyz");
    const body = await page.locator("body").innerText();
    expect(body.toLowerCase()).not.toContain("log out");
    expect(body.toLowerCase()).not.toContain("internal notes");
  });
});
