import { test, expect } from "@playwright/test";

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
