import { expect, test } from "@playwright/test";
import {
  getCampaignStartTikTokAudiencePoint,
  getLatestTikTokAudiencePoint,
  parseTikTokAudiencePoints,
  resolveSoundchartsSong,
} from "../src/lib/soundcharts/client";
import {
  clearSoundchartsAccessToken,
} from "../src/lib/soundcharts/credentials";
import { summarizeSoundTracking } from "../src/lib/portal/metrics";

test("uses only the exact TikTok identifier and valid counts", () => {
  const points = parseTikTokAudiencePoints(
    {
      items: [
        {
          date: "2026-08-13T00:00:00.000Z",
          plots: [
            { identifier: "other-sound", value: 999999 },
            { identifier: "7483905998420527894", value: 102300 },
          ],
        },
        {
          date: "2026-08-14T00:00:00.000Z",
          plots: [
            { identifier: "7483905998420527894-extra", value: 120000 },
            { identifier: "7483905998420527894", value: -1 },
          ],
        },
      ],
    },
    "7483905998420527894",
  );

  expect(points).toEqual([
    {
      providerDataDate: "2026-08-13",
      creationCount: 102300,
      identifier: "7483905998420527894",
    },
  ]);
});

test("charts provider dates without synthesizing a point at check time", () => {
  const summary = summarizeSoundTracking(
    [
      {
        captured_at: "2026-09-17T18:00:00.000Z",
        provider_data_date: "2026-08-13",
        checked_at: "2026-09-17T18:00:00.000Z",
        creation_count: 102300,
      },
    ],
    102300,
  );

  expect(summary.providerDataDate).toBe("2026-08-13");
  expect(summary.checkedAt).toBe("2026-09-17T18:00:00.000Z");
  expect(summary.growthFromCampaignStart).toBe(0);
  expect(summary.series).toHaveLength(1);
  expect(summary.series[0]?.date).toBe("2026-08-13");
});

test("selects the nearest pre-start baseline, then the earliest post-start fallback", async () => {
  const originalFetch = global.fetch;
  const originalClientId = process.env.SOUNDCHARTS_CLIENT_ID;
  const originalClientSecret = process.env.SOUNDCHARTS_CLIENT_SECRET;
  process.env.SOUNDCHARTS_CLIENT_ID = "test-client";
  process.env.SOUNDCHARTS_CLIENT_SECRET = "test-secret";
  clearSoundchartsAccessToken();

  global.fetch = (async (input) => {
    const url = String(input);
    if (url.includes("/oauth/token")) {
      return Response.json({ access_token: "baseline-token", expires_in: 900 });
    }

    const request = new URL(url);
    const identifier = request.searchParams.get("identifier");
    const startDate = request.searchParams.get("startDate");
    if (identifier === "sound-before") {
      return Response.json({
        items: [
          {
            date: "2026-08-01T00:00:00.000Z",
            plots: [{ identifier, value: 90 }],
          },
          {
            date: "2026-09-09T00:00:00.000Z",
            plots: [{ identifier, value: 100 }],
          },
        ],
      });
    }
    if (identifier === "sound-after" && startDate === "2016-01-01") {
      return Response.json({ items: [] });
    }
    if (identifier === "sound-after") {
      return Response.json({
        items: [
          {
            date: "2026-09-12T00:00:00.000Z",
            plots: [{ identifier, value: 120 }],
          },
          {
            date: "2026-09-11T00:00:00.000Z",
            plots: [{ identifier, value: 110 }],
          },
        ],
      });
    }
    return Response.json({ items: [] });
  }) as typeof fetch;

  try {
    const before = await getCampaignStartTikTokAudiencePoint(
      "11111111-1111-4111-8111-111111111111",
      "sound-before",
      "2026-09-10",
      "2026-09-17",
    );
    const after = await getCampaignStartTikTokAudiencePoint(
      "22222222-2222-4222-8222-222222222222",
      "sound-after",
      "2026-09-10",
      "2026-09-17",
    );
    const emptyLatest = await getLatestTikTokAudiencePoint(
      "33333333-3333-4333-8333-333333333333",
      "sound-empty",
      "2026-09-17",
    );

    expect(before).toMatchObject({
      providerDataDate: "2026-09-09",
      creationCount: 100,
    });
    expect(after).toMatchObject({
      providerDataDate: "2026-09-11",
      creationCount: 110,
    });
    expect(emptyLatest).toBeNull();
  } finally {
    global.fetch = originalFetch;
    if (originalClientId == null) {
      delete process.env.SOUNDCHARTS_CLIENT_ID;
    } else {
      process.env.SOUNDCHARTS_CLIENT_ID = originalClientId;
    }
    if (originalClientSecret == null) {
      delete process.env.SOUNDCHARTS_CLIENT_SECRET;
    } else {
      process.env.SOUNDCHARTS_CLIENT_SECRET = originalClientSecret;
    }
    clearSoundchartsAccessToken();
  }
});

test("refreshes the OAuth token once after a Soundcharts 401", async () => {
  const originalFetch = global.fetch;
  const originalClientId = process.env.SOUNDCHARTS_CLIENT_ID;
  const originalClientSecret = process.env.SOUNDCHARTS_CLIENT_SECRET;
  process.env.SOUNDCHARTS_CLIENT_ID = "test-client";
  process.env.SOUNDCHARTS_CLIENT_SECRET = "test-secret";
  clearSoundchartsAccessToken();

  const requests: Array<{ url: string; authorization: string | null }> = [];
  let tokenRequests = 0;
  global.fetch = (async (input, init) => {
    const url = String(input);
    const authorization = new Headers(init?.headers).get("Authorization");
    requests.push({ url, authorization });

    if (url.includes("/oauth/token")) {
      tokenRequests += 1;
      return Response.json({
        access_token: `token-${tokenRequests}`,
        expires_in: 900,
      });
    }
    if (authorization === "Bearer token-1") {
      return Response.json(
        { errors: [{ message: "expired" }] },
        { status: 401 },
      );
    }
    return Response.json({
      object: {
        uuid: "9fe6ddf6-d96f-4677-8914-9685da8446a6",
        name: "Bank On It",
      },
    });
  }) as typeof fetch;

  try {
    const song = await resolveSoundchartsSong("7483905998420527894");
    expect(song.uuid).toBe("9fe6ddf6-d96f-4677-8914-9685da8446a6");
    expect(tokenRequests).toBe(2);
    expect(
      requests.filter((request) =>
        request.url.includes("/by-platform/tiktok/"),
      ),
    ).toMatchObject([
      { authorization: "Bearer token-1" },
      { authorization: "Bearer token-2" },
    ]);
  } finally {
    global.fetch = originalFetch;
    if (originalClientId == null) {
      delete process.env.SOUNDCHARTS_CLIENT_ID;
    } else {
      process.env.SOUNDCHARTS_CLIENT_ID = originalClientId;
    }
    if (originalClientSecret == null) {
      delete process.env.SOUNDCHARTS_CLIENT_SECRET;
    } else {
      process.env.SOUNDCHARTS_CLIENT_SECRET = originalClientSecret;
    }
    clearSoundchartsAccessToken();
  }
});
