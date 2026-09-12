import { expect, test } from "@playwright/test";
import { readUsageCountFromHtml } from "../src/lib/tiktok/provider";

function hydrationHtml(scope: Record<string, unknown>) {
  return `<html><body><script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">${JSON.stringify(
    { __DEFAULT_SCOPE__: scope },
  )}</script></body></html>`;
}

/**
 * These numbers end up on a client's report as "TikTok Creations", so the
 * parser must never mistake a creator's own upload count for a sound's.
 */
test.describe("TikTok sound creation count", () => {
  test("reads the count from the sound's own stats", () => {
    expect(
      readUsageCountFromHtml(
        hydrationHtml({
          "webapp.music-detail": { musicInfo: { stats: { videoCount: 4821 } } },
        }),
      ),
    ).toBe(4821);

    expect(
      readUsageCountFromHtml(
        hydrationHtml({
          "webapp.music-detail": { musicInfo: { music: { videoCount: "917" } } },
        }),
      ),
    ).toBe(917);

    expect(
      readUsageCountFromHtml(
        '<script>{"originalItemStats":{"videoCount":2750}}</script>',
      ),
    ).toBe(2750);
  });

  test("never reports a creator's upload count as sound creations", () => {
    // Shape taken from a live post page: authorStats.videoCount is the
    // creator's own total, and appears before anything sound-related.
    const postPage = hydrationHtml({
      "webapp.video-detail": {
        itemInfo: {
          itemStruct: {
            id: "7555935272920288568",
            author: { uniqueId: "de_cosmetologist" },
            authorStats: { videoCount: 91, followerCount: 12000 },
            stats: { playCount: 10_000_000 },
            music: { id: "7483905998420527894", title: "bank on it" },
          },
        },
      },
    });
    expect(readUsageCountFromHtml(postPage)).toBeNull();

    const profilePage = hydrationHtml({
      "webapp.user-detail": {
        userInfo: { stats: { videoCount: 381, followerCount: 5000 } },
      },
    });
    expect(readUsageCountFromHtml(profilePage)).toBeNull();
  });

  test("returns null when TikTok withholds the figure", () => {
    // The live sound page currently ships only these scopes.
    expect(
      readUsageCountFromHtml(
        hydrationHtml({
          "webapp.app-context": { region: "GB" },
          "webapp.i18n-translation": {},
          "seo.abtest": { pageId: "music" },
        }),
      ),
    ).toBeNull();
    expect(readUsageCountFromHtml("<html><body>no data</body></html>")).toBeNull();
    expect(readUsageCountFromHtml("")).toBeNull();
    expect(
      readUsageCountFromHtml(
        hydrationHtml({
          "webapp.music-detail": { musicInfo: { stats: { videoCount: 0 } } },
        }),
      ),
    ).toBeNull();
  });
});
