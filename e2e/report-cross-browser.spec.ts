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

      // The load-in sequence transforms the cards, so geometry and hover
      // assertions must wait for GSAP to clear its inline transforms.
      const settleIntro = async () => {
        await expect
          .poll(
            () =>
              page
                .locator(".report-overview-card")
                .last()
                .evaluate((element) => getComputedStyle(element).transform),
            { timeout: 6000 },
          )
          .toBe("none");
      };

      try {
        for (const width of [1920, 1440, 1024, 820, 768, 430, 390]) {
          await page.setViewportSize({ width, height: 900 });
          await page.goto(reportUrl!, { waitUntil: "networkidle" });
          await settleIntro();

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
          expect(
            await page.locator(".report-results__featured").evaluate((card) => {
              const header = card.querySelector(
                ".report-results__featured-head",
              )?.getBoundingClientRect();
              const plot = card.querySelector(
                ".report-metric-plot",
              )?.getBoundingClientRect();
              return Boolean(header && plot && plot.top >= header.bottom - 1);
            }),
          ).toBe(true);
          expect(
            await page.locator(".report-metric-card").evaluateAll((cards) =>
              cards.every((card) => {
                const content = card
                  .querySelector(".report-metric-card__content")
                  ?.getBoundingClientRect();
                const plot = card
                  .querySelector(".report-metric-plot")
                  ?.getBoundingClientRect();
                if (!content || !plot) return false;
                return (
                  plot.left >= content.right - 1 ||
                  plot.top >= content.bottom - 1
                );
              }),
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
        await settleIntro();
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
        expect(
          Math.abs(
            Math.round(overviewBoxes[0].y) - Math.round(overviewBoxes[1].y),
          ),
        ).toBeLessThanOrEqual(3);
        expect(overviewBoxes[0].width).toBeGreaterThan(overviewBoxes[1].width);
        await expect(page.locator(".report-metric-card__icon")).toHaveCount(0);
        await expect(
          page.locator(".report-metric-card .report-metric-plot"),
        ).toHaveCount(4);

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

        const firstMiniPoint = page
          .locator(".report-metric-card .report-metric-plot")
          .first()
          .locator('circle[role="button"]')
          .last();
        if ((await firstMiniPoint.count()) > 0) {
          await firstMiniPoint.tap();
          await expect(
            page
              .locator(".report-metric-card")
              .first()
              .locator(".report-metric-plot__tooltip"),
          ).toBeVisible();
        }

        const waveformDuration = await page
          .locator(".report-summary__waveform-flow")
          .first()
          .evaluate((element) => getComputedStyle(element).animationDuration);
        expect(Number.parseFloat(waveformDuration)).toBeGreaterThanOrEqual(20);
        const budgetGlowDuration = await page
          .locator(".report-delivery-card")
          .evaluate(
            (element) =>
              getComputedStyle(element, "::before").animationDuration,
          );
        expect(Number.parseFloat(budgetGlowDuration)).toBeGreaterThanOrEqual(8);
        // The live dots glow in and out; they must not carry a ring pulse.
        for (const selector of [
          ".report-status__dot",
          ".report-results__live-dot",
        ]) {
          const dot = await page.locator(selector).evaluate((element) => ({
            name: getComputedStyle(element).animationName,
            duration: getComputedStyle(element).animationDuration,
            ring: getComputedStyle(element, "::after").animationName,
            ringContent: getComputedStyle(element, "::after").content,
          }));
          expect(dot.name).toBe("report-status-breathe");
          expect(Number.parseFloat(dot.duration)).toBeGreaterThanOrEqual(4);
          expect(dot.ring).toBe("none");
          expect(dot.ringContent).not.toBe('""');
        }

        // Ambient motion must keep running without scroll, hover or clicks.
        await expect(page.locator(".report-atmosphere")).toHaveCount(1);
        await expect(
          page.locator(".report-summary__waveform-flow"),
        ).toHaveCount(1);
        await expect(page.locator(".report-summary__waveform-path")).toHaveCount(
          9,
        );
        await expect(page.locator(".report-chart-pulse")).not.toHaveCount(0);
        const bandTransformBefore = await page
          .locator(".report-summary__waveform-flow")
          .first()
          .evaluate((element) => getComputedStyle(element).transform);
        await expect
          .poll(
            () =>
              page
                .locator(".report-summary__waveform-flow")
                .first()
                .evaluate((element) => getComputedStyle(element).transform),
            { timeout: 5000 },
          )
          .not.toBe(bandTransformBefore);
        // Alive but restrained: motion must run unprompted without the page
        // turning into a light show.
        const idleAnimations = await page.evaluate(
          () =>
            document.getAnimations().filter((animation) => {
              const name = (animation as CSSAnimation).animationName;
              return (
                animation.playState === "running" &&
                typeof name === "string" &&
                name.startsWith("report-")
              );
            }).length,
        );
        expect(idleAnimations).toBeGreaterThanOrEqual(8);
        expect(idleAnimations).toBeLessThanOrEqual(32);
        await expect(
          page.locator(".report-metric-card .report-metric-plot__pulse"),
        ).toHaveCount(0);
        expect(
          await page
            .locator(".report-metric-card .report-metric-plot__line")
            .evaluateAll((lines) =>
              lines.every(
                (line) => getComputedStyle(line).animationName === "none",
              ),
            ),
        ).toBe(true);

        await page.setViewportSize({ width: 390, height: 900 });
        await page.goto(reportUrl!, { waitUntil: "networkidle" });
        await settleIntro();
        if ((await soundLink.count()) > 0) {
          expect((await soundLink.boundingBox())?.width).toBeGreaterThanOrEqual(44);
          expect((await soundLink.boundingBox())?.height).toBeGreaterThanOrEqual(44);
        }
        const campaignTitle = page.locator(".report-summary__title");
        const originalCampaignTitle = await campaignTitle.textContent();
        await campaignTitle.evaluate((element) => {
          element.textContent =
            "A deliberately long campaign title that must wrap without crowding the sound link";
        });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        ).toBe(true);
        await campaignTitle.evaluate((element, originalTitle) => {
          element.textContent = originalTitle;
        }, originalCampaignTitle);

        const dataRequestCount = await page.evaluate(
          () =>
            performance
              .getEntriesByType("resource")
              .filter((entry) => {
                const url = new URL(entry.name);
                return (
                  url.pathname.startsWith("/api/") ||
                  url.pathname.includes("/rest/v1/") ||
                  url.pathname.includes("/rpc/")
                );
              }).length,
        );
        const firstDaily = page.getByRole("button", { name: "Daily" }).first();
        const firstIndicator = page.locator(".report-toggle__indicator").first();
        const indicatorBefore = await firstIndicator.evaluate(
          (element) => getComputedStyle(element).transform,
        );
        await firstDaily.focus();
        await firstDaily.click();
        await expect(firstDaily).toHaveAttribute("aria-pressed", "true");
        await expect
          .poll(() =>
            firstIndicator.evaluate(
              (element) => getComputedStyle(element).transform,
            ),
          )
          .not.toBe(indicatorBefore);
        await page.getByRole("button", { name: "Cumulative" }).first().click();
        await firstDaily.click();
        expect(
          await page.evaluate(
            () =>
              performance
                .getEntriesByType("resource")
                .filter((entry) => {
                  const url = new URL(entry.name);
                  return (
                    url.pathname.startsWith("/api/") ||
                    url.pathname.includes("/rest/v1/") ||
                    url.pathname.includes("/rpc/")
                  );
                }).length,
          ),
        ).toBe(dataRequestCount);

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
        await settleIntro();
        expect(
          await page
            .locator(".report-delivery-card")
            .evaluate(
              (element) =>
                getComputedStyle(element, "::before").animationName,
            ),
        ).toBe("none");
        await expect(page.locator(".report-results__live-dot")).toHaveCSS(
          "animation-name",
          "none",
        );
        await expect(
          page.locator(".report-summary__waveform-flow").first(),
        ).toHaveCSS("animation-name", "none");
        await expect(page.locator(".report-atmosphere__glow").first()).toHaveCSS(
          "animation-name",
          "none",
        );
        await expect
          .poll(
            () =>
              page.evaluate(
                () =>
                  document.getAnimations().filter((animation) => {
                    const name = (animation as CSSAnimation).animationName;
                    return (
                      animation.playState === "running" &&
                      typeof name === "string" &&
                      name.startsWith("report-")
                    );
                  }).length,
              ),
            { timeout: 5000 },
          )
          .toBe(0);
        expect(
          await page
            .locator(
              ".report-summary, .report-delivery-card, .report-results, .report-metric-card, .report-chart-card",
            )
            .evaluateAll((elements) =>
              elements.every((element) => {
                const style = getComputedStyle(element);
                return style.opacity === "1" && style.transform === "none";
              }),
            ),
        ).toBe(true);

        expect(errors).toEqual([]);
      } finally {
        await browser.close();
      }
    });
  }
});
