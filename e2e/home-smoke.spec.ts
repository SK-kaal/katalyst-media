import { expect, test } from "@playwright/test";

test("home page hydrates and exposes its main sections", async ({ page }) => {
  const pageErrors: string[] = [];
  const hydrationErrors: string[] = [];

  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (
      /hydration|hydrated|server rendered html/i.test(
        message.text(),
      )
    ) {
      const location = message.location();
      hydrationErrors.push(
        `${message.text()} (${location.url}:${location.lineNumber}:${location.columnNumber})`,
      );
    }
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page.locator("#hero-heading")).toBeVisible();
  await expect(page.locator("#overview")).toBeAttached();
  await expect(page.locator("#process")).toBeAttached();
  await expect(page.locator("#contact")).toBeAttached();
  await expect(
    page.locator('[aria-label="Creator campaign preview reel"]'),
  ).toBeVisible();
  await page.waitForTimeout(3_000);

  expect(pageErrors).toEqual([]);
  expect(hydrationErrors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
