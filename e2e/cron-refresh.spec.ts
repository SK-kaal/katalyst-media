import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { getUkCampaignRefreshWindow } from "../src/lib/portal/cron-schedule";

const CRON_PATH = "/api/cron/refresh-campaigns";

const CRON_SECRET = (() => {
  const value = process.env.CRON_SECRET;
  if (!value) throw new Error("Set CRON_SECRET before running e2e tests");
  return value;
})();

/**
 * The scheduled refresh writes real campaign data, so these tests only cover
 * the auth contract. The happy path is verified against production, which is
 * the only place Vercel actually runs the cron.
 */
test.describe("Scheduled campaign refresh", () => {
  test("documents the fixed UTC schedule in GMT and BST", () => {
    for (const [iso, localHour, exactPreferredHour] of [
      ["2026-01-15T06:00:00.000Z", 6, true],
      ["2026-01-15T18:00:00.000Z", 18, true],
      ["2026-07-15T06:00:00.000Z", 7, false],
      ["2026-07-15T18:00:00.000Z", 19, false],
    ] as const) {
      expect(getUkCampaignRefreshWindow(new Date(iso))).toMatchObject({
        localHour,
        shouldRun: exactPreferredHour,
        timeZone: "Europe/London",
      });
    }

    expect(
      getUkCampaignRefreshWindow(new Date("2026-07-15T05:00:00.000Z")),
    ).toMatchObject({
      localHour: 6,
      shouldRun: true,
      timeZone: "Europe/London",
    });
    expect(
      getUkCampaignRefreshWindow(new Date("2026-07-15T17:00:00.000Z")),
    ).toMatchObject({
      localHour: 18,
        shouldRun: true,
        timeZone: "Europe/London",
      });
  });

  test("deploys two Hobby-compatible daily UTC schedules", async () => {
    const config = JSON.parse(
      await readFile("vercel.json", "utf8"),
    ) as {
      crons?: Array<{ path: string; schedule: string }>;
    };
    expect(config.crons).toEqual([
      {
        path: CRON_PATH,
        schedule: "0 6 * * *",
      },
      {
        path: CRON_PATH,
        schedule: "0 18 * * *",
      },
    ]);
  });

  test("rejects requests with no, malformed or wrong credentials", async ({
    request,
  }) => {
    for (const headers of [
      undefined,
      { authorization: "" },
      { authorization: "Bearer" },
      { authorization: "Bearer " },
      { authorization: CRON_SECRET },
      { authorization: `Basic ${CRON_SECRET}` },
      { authorization: `Bearer ${CRON_SECRET}x` },
      { authorization: "Bearer definitely-not-the-secret" },
    ]) {
      const response = await request.get(CRON_PATH, { headers });
      expect(
        response.status(),
        `expected 401 for headers ${JSON.stringify(headers)}`,
      ).toBe(401);
      expect(await response.json()).toEqual({
        ok: false,
        error: "Unauthorized",
      });
    }
  });

  test("guards itself rather than relying on the admin middleware", async ({
    request,
  }) => {
    // A redirect to the access-code screen would mean the route sits behind
    // /admin protection, which Vercel's cron requests can never satisfy.
    const response = await request.get(CRON_PATH, {
      maxRedirects: 0,
    });
    expect(response.status()).toBe(401);
    expect(response.headers()["content-type"]).toContain("application/json");
    expect(response.headers()["location"]).toBeUndefined();
  });

  test("only answers GET", async ({ request }) => {
    const response = await request.post(CRON_PATH, {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    expect(response.status()).toBe(405);
  });
});
