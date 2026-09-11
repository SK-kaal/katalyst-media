import {
  chromium,
  expect,
  firefox,
  test,
  webkit,
  type BrowserType,
} from "@playwright/test";
import { readFile } from "node:fs/promises";

const reportUrl = process.env.REPORT_TEST_URL;
const browsers: [string, BrowserType][] = [
  ["Chromium", chromium],
  ["Firefox", firefox],
  ["WebKit", webkit],
];

test.describe("client report cross-browser quality", () => {
  test.skip(!reportUrl, "Set REPORT_TEST_URL to a valid active client report");

  for (const [browserName, browserType] of browsers) {
    test(`${browserName} report smoke`, async () => {
      const browser = await browserType.launch({ headless: true });
      const context = await browser.newContext({
        deviceScaleFactor: 2,
        hasTouch: true,
        permissions: [],
        timezoneId: "America/Los_Angeles",
      });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      try {
        for (const width of [1920, 1440, 1024, 820, 768, 430, 390]) {
          await page.setViewportSize({ width, height: 900 });
          await page.goto(reportUrl!, { waitUntil: "networkidle" });

          await expect(
            page.getByRole("heading", { name: "Katalyst Campaign Results" }),
          ).toBeVisible();
          await expect(page.getByText("Top Performing Posts")).toBeVisible();
          await expect(page.getByText("All Content")).toBeVisible();
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= window.innerWidth,
            ),
          ).toBe(true);
          expect(
            await page.locator(".report-metric-card").evaluateAll((cards) =>
              cards.every((card) => card.scrollWidth <= card.clientWidth),
            ),
          ).toBe(true);

          const topCards = page.locator(".report-top-grid .report-vcard");
          if ((await topCards.count()) > 1) {
            const positions = await topCards.evaluateAll((cards) =>
              cards.map((card) => {
                const rect = card.getBoundingClientRect();
                return { x: rect.x, y: rect.y, width: rect.width };
              }),
            );
            expect(new Set(positions.map((position) => Math.round(position.y))).size).toBe(1);
            expect(positions[1].x).toBeGreaterThan(
              positions[0].x + positions[0].width,
            );
          }
        }

        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto(reportUrl!, { waitUntil: "networkidle" });
        expect(
          await page.locator(".report-overview").evaluate(
            (element) => getComputedStyle(element).display,
          ),
        ).toBe("grid");
        const overviewCards = page.locator(".report-overview-card");
        const overviewBoxes = await overviewCards.evaluateAll((cards) =>
          cards.map((card) => {
            const rect = card.getBoundingClientRect();
            return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
          }),
        );
        expect(overviewBoxes).toHaveLength(2);
        expect(Math.round(overviewBoxes[0].y)).toBe(Math.round(overviewBoxes[1].y));
        expect(overviewBoxes[0].width).toBeGreaterThan(overviewBoxes[1].width);
        await expect(page.locator(".report-metric-card__icon")).toHaveCount(0);

        const soundLink = page.getByRole("link", { name: "View sound" });
        if ((await soundLink.count()) > 0) {
          await expect(soundLink).toHaveAttribute("href", /^https:\/\/www\.tiktok\.com\//);
          await expect(soundLink).toHaveAttribute("target", "_blank");
          await expect(soundLink).toHaveAttribute("rel", /noopener/);
          expect(Math.round((await soundLink.boundingBox())?.width ?? 0)).toBe(38);
          await soundLink.hover();
          await expect(page.locator(".report-summary__sound-tooltip")).toHaveCSS(
            "opacity",
            "1",
          );
          await soundLink.focus();
          expect(
            await soundLink.evaluate(
              (element) => getComputedStyle(element).outlineStyle !== "none",
            ),
          ).toBe(true);
        }

        const decorationDuration = await page
          .locator(".report-overview-card")
          .first()
          .evaluate(
            (element) =>
              getComputedStyle(element, "::before").animationDuration,
          );
        expect(Number.parseFloat(decorationDuration)).toBeGreaterThanOrEqual(18);
        expect(
          await page.locator(".report-results__live-dot").evaluate(
            (element) =>
              getComputedStyle(element, "::after").animationDuration,
          ),
        ).toBe("2s");

        await page.setViewportSize({ width: 390, height: 900 });
        await page.goto(reportUrl!, { waitUntil: "networkidle" });
        if ((await soundLink.count()) > 0) {
          expect((await soundLink.boundingBox())?.width).toBeGreaterThanOrEqual(44);
          expect((await soundLink.boundingBox())?.height).toBeGreaterThanOrEqual(44);
        }
        await page.locator(".report-summary__title").evaluate((element) => {
          element.textContent =
            "A deliberately long campaign title that must wrap without crowding the sound link";
        });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        ).toBe(true);

        const resourceCount = await page.evaluate(
          () => performance.getEntriesByType("resource").length,
        );
        const firstDaily = page.getByRole("button", { name: "Daily" }).first();
        await firstDaily.focus();
        await page.keyboard.press("Enter");
        await expect(firstDaily).toHaveAttribute("aria-pressed", "true");
        await page.getByRole("button", { name: "Cumulative" }).first().click();
        await firstDaily.click();
        expect(
          await page.evaluate(
            () => performance.getEntriesByType("resource").length,
          ),
        ).toBe(resourceCount);

        const viewsChart = page.locator(".report-chart-card").last();
        await viewsChart.getByRole("button", { name: "Cumulative" }).click();
        const cumulativePoints = viewsChart.locator('circle[role="button"]');
        if ((await cumulativePoints.count()) > 0) {
          await cumulativePoints.last().focus();
          await expect(viewsChart.locator(".report-chart-tooltip")).toContainText(
            /Total views/,
          );
        }
        await viewsChart.getByRole("button", { name: "Daily" }).click();
        const dailyPoints = viewsChart.locator('circle[role="button"]');
        if ((await dailyPoints.count()) > 0) {
          await dailyPoints.last().tap();
          await expect(viewsChart.locator(".report-chart-tooltip")).toContainText(
            /New views/,
          );
        }

        for (const sort of [
          "views",
          "likes",
          "comments",
          "shares",
          "newest",
        ]) {
          await page.getByLabel("Sort content").selectOption(sort);
        }
        await page.getByRole("button", { name: "List view" }).click();
        await expect(page.locator(".report-content-list")).toBeVisible();
        await page.getByRole("button", { name: "Grid view" }).click();
        await expect(page.locator(".report-content-grid")).toBeVisible();

        if (browserName === "Chromium") {
          const downloadPromise = page.waitForEvent("download");
          await page.getByRole("button", { name: "Export to CSV" }).click();
          const download = await downloadPromise;
          const csv = await readFile(await download.path(), "utf8");
          expect(csv.split(/\r?\n/, 1)[0]).toBe(
            "creator_handle,posted_at,views,likes,comments,shares,post_url",
          );
          expect(csv).toContain('"https://www.tiktok.com/');
          expect(csv).not.toMatch(/internal|email|share_token|provider/i);
        }

        const externalLinks = page.locator(
          ".report-vcard[href], .report-summary__sound-icon[href]",
        );
        for (let index = 0; index < (await externalLinks.count()); index += 1) {
          await expect(externalLinks.nth(index)).toHaveAttribute("target", "_blank");
          await expect(externalLinks.nth(index)).toHaveAttribute(
            "rel",
            /noopener/,
          );
        }

        const loadedImages = page.locator(".report-vcard__media img");
        for (let index = 0; index < (await loadedImages.count()); index += 1) {
          const quality = await loadedImages.nth(index).evaluate((image) => {
            const element = image as HTMLImageElement;
            const rect = element.getBoundingClientRect();
            return {
              complete: element.complete,
              naturalWidth: element.naturalWidth,
              renderedWidth: rect.width,
            };
          });
          expect(quality.complete).toBe(true);
          expect(quality.naturalWidth).toBeGreaterThanOrEqual(
            quality.renderedWidth * 2,
          );
        }

        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.reload({ waitUntil: "networkidle" });
        expect(
          await page
            .locator(".report-overview-card")
            .first()
            .evaluate(
              (element) =>
                getComputedStyle(element, "::before").animationName,
            ),
        ).toBe("none");
        expect(
          await page.locator(".report-results__live-dot").evaluate(
            (element) => getComputedStyle(element, "::after").animationName,
          ),
        ).toBe("none");

        expect(errors).toEqual([]);
      } finally {
        await browser.close();
      }
    });
  }
});
