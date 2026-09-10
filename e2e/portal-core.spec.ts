import { test, expect, type Page } from "@playwright/test";

const ACCESS_CODE = (() => {
  const value = process.env.ADMIN_ACCESS_CODE;
  if (!value) throw new Error("Set ADMIN_ACCESS_CODE before running e2e tests");
  return value;
})();

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

    for (const label of ["All", "Active", "Ended"]) {
      const control = page
        .getByRole("link", { name: new RegExp(`^${label}`, "i") })
        .first();
      await expect(control).toBeVisible();
      await control.click();
      await expect(page).toHaveURL(/\/admin/);
    }

    for (const label of ["Newest", "Oldest", "Last updated"]) {
      const control = page.getByRole("link", { name: label, exact: true });
      await expect(control).toBeVisible();
      await control.click();
      await expect(page).toHaveURL(
        label === "Last updated" ? /\/admin\/?$/ : /sort=/,
      );
    }

    await page.getByLabel("Search campaigns").fill("no-such-campaign-9c78f7");
    await page.getByLabel("Search campaigns").press("Enter");
    await expect(page.getByText("No campaigns found")).toBeVisible();
    await page.getByRole("link", { name: "Clear Search" }).click();
    await expect(page.getByLabel("Search campaigns")).toHaveValue("");
  });

  test("invalid records show a clean portal not-found state", async ({ page }) => {
    await page.goto("/admin/clients/00000000-0000-4000-8000-000000000000");
    await expect(
      page.getByRole("heading", { name: /portal record does not exist/i }),
    ).toBeVisible();
    await page.goto("/admin/campaigns/00000000-0000-4000-8000-000000000000");
    await expect(
      page.getByRole("heading", { name: /portal record does not exist/i }),
    ).toBeVisible();
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

    // Row is a clickable client link (aria-label Open {name}).
    await page.goto("/admin/clients");
    const firstClient = page.getByRole("link", { name: /^Open /i }).first();
    await expect(firstClient).toBeVisible();
    await firstClient.click();
    await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 20_000 });
  });

  test("client search has useful no-results and clear states", async ({ page }) => {
    await login(page);
    await page.goto("/admin/clients");
    await page.getByLabel("Search clients").fill("no-such-client-9c78f7");
    await page.getByLabel("Search clients").press("Enter");
    await expect(page.getByText("No clients found")).toBeVisible();
    await page.getByRole("link", { name: "Clear Search" }).click();
    await expect(page.getByLabel("Search clients")).toHaveValue("");
  });
});

test("critical admin pages do not overflow at tablet breakpoints", async ({
  page,
}) => {
  await login(page);
  for (const width of [768, 820, 1024, 1100]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/admin", "/admin/clients"]) {
      await page.goto(path);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }
  }
});
