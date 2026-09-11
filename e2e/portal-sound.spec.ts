import { randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import {
  QA_PREFIX,
  cleanupQaClients,
  createPortalDbClient,
} from "./portal-test-helpers";
import type { Database } from "../src/lib/supabase/database.types";

const ACCESS_CODE = (() => {
  const value = process.env.ADMIN_ACCESS_CODE;
  if (!value) throw new Error("Set ADMIN_ACCESS_CODE before running E2E tests");
  return value;
})();

const SOUND_A =
  "https://www.tiktok.com/music/Last-Letter-demo-7556360217967512342";
const SOUND_A_ID = "7556360217967512342";
const SOUND_B =
  "https://www.tiktok.com/music/bank-on-it-7483905998420527894";
const SOUND_B_ID = "7483905998420527894";
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

async function login(page: Page, next: string) {
  await page.goto(next);
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.locator("#access-code").fill(ACCESS_CODE);
  await page.locator("#access-code").press("Enter");
  await expect(page).toHaveURL(new RegExp(next.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

async function openSoundMenu(page: Page) {
  await page.getByRole("button", { name: "Manage TikTok sound" }).click();
  await expect(page.getByRole("menu")).toBeVisible();
}

async function checkAndConfirmSound(page: Page, url: string) {
  const dialog = page.getByRole("dialog", {
    name: /add tiktok sound|change tiktok sound/i,
  });
  await dialog.getByLabel("New TikTok sound URL").fill(url);
  await dialog.getByRole("button", { name: "Check Sound" }).click();
  await expect(dialog.getByText(/sound title unavailable|last letter|bank on it/i)).toBeVisible({
    timeout: 30_000,
  });
  await dialog
    .getByRole("button", { name: /add sound|confirm change/i })
    .click();
  await expect(dialog).toHaveCount(0, { timeout: 30_000 });
}

test.describe.serial("TikTok sound management", () => {
  test.setTimeout(300_000);

  test.beforeAll(async () => {
    await cleanupQaClients();
  });

  test.afterAll(async () => {
    await cleanupQaClients();
  });

  test("automatic data, manual fallback, safe change/remove and permanent link", async ({
    page,
  }) => {
    const db = await createPortalDbClient();
    const suffix = Date.now().toString(36);
    const { data: client, error: clientError } = await db
      .from("clients")
      .insert({ name: `${QA_PREFIX} Sound ${suffix}`, client_type: "artist" })
      .select("id")
      .single();
    expect(clientError).toBeNull();

    const permanentToken = randomBytes(24).toString("hex");
    const { data: campaign, error: campaignError } = await db
      .from("campaigns")
      .insert({
        client_id: client!.id,
        display_title: `QA Sound Workflow ${suffix}`,
        budget: 2500,
        target_posts: 3,
        status: "active",
        share_token: permanentToken,
      })
      .select("id")
      .single();
    expect(campaignError).toBeNull();

    const { error: postError } = await db.from("tiktok_posts").insert({
      campaign_id: campaign!.id,
      post_url: "https://www.tiktok.com/@qa/video/9000000000000000999",
      tiktok_post_id: "9000000000000000999",
      creator_handle: "@qa_sound",
      views: 321,
      likes: 20,
      comments: 4,
      shares: 2,
    });
    expect(postError).toBeNull();

    const adminUrl = `/admin/campaigns/${campaign!.id}`;
    const reportUrl = `/report/${permanentToken}`;
    await login(page, adminUrl);

    // No sound is an intentional state and does not render broken creations UI.
    await expect(page.getByText("No TikTok sound added.")).toBeVisible();
    await expect(page.getByText("TikTok Creations")).toHaveCount(0);

    // Case A: URL parsing + automatic title/artist import succeeds even when
    // artwork or creation count is unavailable.
    await page.getByRole("button", { name: "Add TikTok Sound" }).click();
    await checkAndConfirmSound(page, SOUND_A);
    await expect
      .poll(async () => {
        const { data } = await db
          .from("campaigns")
          .select("tiktok_sound_id, sound_title, sound_artist")
          .eq("id", campaign!.id)
          .single();
        return data;
      })
      .toMatchObject({
        tiktok_sound_id: SOUND_A_ID,
        sound_title: "Last Letter demo",
        sound_artist: "Gigi Moss",
      });

    await db.from("sound_metric_snapshots").insert({
      campaign_id: campaign!.id,
      sound_id: SOUND_A_ID,
      creation_count: 111,
    });

    // Case B: manual artwork uses the crop/upload flow and persists to Storage.
    await openSoundMenu(page);
    await page.getByRole("menuitem", { name: "Edit Sound" }).click();
    const editDialog = page.getByRole("dialog", { name: "Edit Sound" });
    await editDialog.locator('input[type="file"]').setInputFiles({
      name: "sound.png",
      mimeType: "image/png",
      buffer: PNG_1X1,
    });
    const cropDialog = page.getByRole("dialog", {
      name: "Adjust sound artwork",
    });
    await expect(cropDialog).toBeVisible();
    await cropDialog.getByRole("button", { name: "Use Photo" }).click();
    await editDialog.getByRole("button", { name: "Save Sound" }).click();
    await expect(editDialog).toHaveCount(0, { timeout: 30_000 });

    const { data: afterArtwork } = await db
      .from("campaigns")
      .select("artwork_url, share_token")
      .eq("id", campaign!.id)
      .single();
    expect(afterArtwork?.artwork_url).toContain(
      `/portal-assets/campaigns/${campaign!.id}/sound-artwork-`,
    );
    expect(afterArtwork?.share_token).toBe(permanentToken);

    const reportPage = await page.context().newPage();
    await reportPage.goto(reportUrl);
    await expect(reportPage.locator(".report-summary__art img")).toBeVisible();
    for (const width of [1920, 1440, 1024, 768, 390]) {
      await reportPage.setViewportSize({ width, height: 900 });
      await reportPage.reload();
      const image = reportPage.locator(".report-summary__art img");
      await expect(image).toBeVisible();
      expect(
        await reportPage.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      expect(await image.evaluate((node) => getComputedStyle(node).objectFit)).toBe(
        "cover",
      );
    }
    await reportPage.setViewportSize({ width: 1280, height: 720 });

    // Manual display corrections survive a provider retry.
    await openSoundMenu(page);
    await page.getByRole("menuitem", { name: "Edit Sound" }).click();
    await editDialog.getByLabel("Sound Title").fill("Manual Sound Title");
    await editDialog.getByLabel("Artist Name").fill("Manual Artist");
    await editDialog.getByRole("button", { name: "Save Sound" }).click();
    await expect(editDialog).toHaveCount(0, { timeout: 30_000 });
    const retry = page.getByRole("button", { name: "Retry Sound" });
    if (await retry.isVisible()) {
      await retry.click();
      await expect(retry).toBeEnabled({ timeout: 30_000 });
    }
    const { data: afterRetry } = await db
      .from("campaigns")
      .select("sound_title_override, sound_artist_override")
      .eq("id", campaign!.id)
      .single();
    expect(afterRetry).toMatchObject({
      sound_title_override: "Manual Sound Title",
      sound_artist_override: "Manual Artist",
    });

    // Ended admin preview resolves the same manual display overrides as the
    // public RPC, then the disposable campaign is restored for the flow.
    await db
      .from("campaigns")
      .update({
        status: "ended",
        ended_at: new Date().toISOString(),
        display_title: null,
      })
      .eq("id", campaign!.id);
    const endedPreview = await page.context().newPage();
    await endedPreview.goto(`/admin/campaigns/${campaign!.id}/preview`);
    await expect(
      endedPreview.getByRole("heading", { name: "Manual Sound Title" }),
    ).toBeVisible();
    await expect(endedPreview.getByText("Manual Artist")).toBeVisible();
    await endedPreview.close();
    await db
      .from("campaigns")
      .update({
        status: "active",
        ended_at: null,
        display_title: `QA Sound Workflow ${suffix}`,
      })
      .eq("id", campaign!.id);

    // Case H: another URL for the same ID refreshes without deleting history.
    await openSoundMenu(page);
    await page.getByRole("menuitem", { name: "Change Sound" }).click();
    await checkAndConfirmSound(page, `${SOUND_A}?lang=en`);
    const { count: sameSoundHistory } = await db
      .from("sound_metric_snapshots")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaign!.id)
      .eq("sound_id", SOUND_A_ID);
    expect(sameSoundHistory).toBeGreaterThanOrEqual(1);

    // Case E: invalid replacement never mutates the attached sound.
    await openSoundMenu(page);
    await page.getByRole("menuitem", { name: "Change Sound" }).click();
    const changeDialog = page.getByRole("dialog", { name: "Change TikTok Sound" });
    await changeDialog
      .getByLabel("New TikTok sound URL")
      .fill("https://www.tiktok.com/@creator/video/1234567890123456789");
    await changeDialog.getByRole("button", { name: "Check Sound" }).click();
    await expect(changeDialog.getByRole("alert")).toContainText(/post url/i);
    const { data: afterFailedChange } = await db
      .from("campaigns")
      .select("tiktok_sound_id")
      .eq("id", campaign!.id)
      .single();
    expect(afterFailedChange?.tiktok_sound_id).toBe(SOUND_A_ID);
    await changeDialog.getByRole("button", { name: "Cancel" }).click();

    // Case D: a different sound clears old display/art overrides while preserving
    // posts, campaign metrics, budget and the permanent report token.
    await openSoundMenu(page);
    await page.getByRole("menuitem", { name: "Change Sound" }).click();
    await checkAndConfirmSound(page, SOUND_B);
    const { data: changed } = await db
      .from("campaigns")
      .select(
        "tiktok_sound_id, sound_title_override, sound_artist_override, artwork_url, budget, share_token",
      )
      .eq("id", campaign!.id)
      .single();
    expect(changed).toMatchObject({
      tiktok_sound_id: SOUND_B_ID,
      sound_title_override: null,
      sound_artist_override: null,
      artwork_url: null,
      share_token: permanentToken,
    });
    expect(Number(changed?.budget)).toBe(2500);
    const { count: postCountAfterChange } = await db
      .from("tiktok_posts")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaign!.id);
    expect(postCountAfterChange).toBe(1);

    await db.from("sound_metric_snapshots").insert({
      campaign_id: campaign!.id,
      sound_id: SOUND_B_ID,
      creation_count: 222,
    });
    await db
      .from("campaigns")
      .update({ sound_usage_count: 222 })
      .eq("id", campaign!.id);
    const publicDb = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    );
    const { data: shared } = await publicDb.rpc("fetch_shared_report", {
      p_token: permanentToken,
    });
    const sharedReport = shared as {
      client?: Record<string, unknown>;
      posts?: { id: string; post_url: string }[];
      sound_snapshots?: { creation_count: number }[];
    };
    expect(
      sharedReport.sound_snapshots,
    ).toMatchObject([{ creation_count: 222 }]);
    expect(Object.keys(sharedReport.client ?? {})).toEqual(["name"]);
    expect(sharedReport.posts?.[0]?.id).toBe(sharedReport.posts?.[0]?.post_url);
    expect(JSON.stringify(sharedReport)).not.toMatch(
      /internal_notes|share_token|client_id|campaign_id|last_sync_error|"email"/i,
    );
    await reportPage.reload();
    await expect(
      reportPage.locator(".report-chart-card").filter({ hasText: "TikTok Creations" }),
    ).toContainText("222");

    // Case F: remove only sound-specific active data.
    await openSoundMenu(page);
    await page.getByRole("menuitem", { name: "Remove Sound" }).click();
    const removeDialog = page.getByRole("dialog", {
      name: "Remove TikTok Sound?",
    });
    await removeDialog.getByRole("button", { name: "Remove Sound" }).click();
    await expect(page.getByText("No TikTok sound added.")).toBeVisible({
      timeout: 30_000,
    });
    const { data: removed } = await db
      .from("campaigns")
      .select(
        "tiktok_sound_id, tiktok_sound_url, sound_title, sound_artist, artwork_url, sound_usage_count, budget, share_token",
      )
      .eq("id", campaign!.id)
      .single();
    expect(removed).toMatchObject({
      tiktok_sound_id: null,
      tiktok_sound_url: null,
      sound_title: null,
      sound_artist: null,
      artwork_url: null,
      sound_usage_count: null,
      share_token: permanentToken,
    });
    expect(Number(removed?.budget)).toBe(2500);
    await reportPage.reload();
    await expect(reportPage.getByText(/shared report · view only/i)).toBeVisible();
    await expect(reportPage.getByText("TikTok Creations")).toHaveCount(0);
    await expect(
      reportPage.locator(".report-results__featured"),
    ).toContainText("321");

    // Case G: sound can be added again without rotating the report URL.
    await page.getByRole("button", { name: "Add TikTok Sound" }).click();
    await checkAndConfirmSound(page, SOUND_A);
    const { data: addedAgain } = await db
      .from("campaigns")
      .select("tiktok_sound_id, share_token")
      .eq("id", campaign!.id)
      .single();
    expect(addedAgain).toMatchObject({
      tiktok_sound_id: SOUND_A_ID,
      share_token: permanentToken,
    });
    await reportPage.reload();
    await expect(reportPage.getByRole("link", { name: "View Sound" })).toBeVisible();

    // The intentional empty-artwork placeholder is also balanced and large
    // enough across the requested breakpoints.
    for (const width of [1920, 1440, 1024, 768, 390]) {
      await reportPage.setViewportSize({ width, height: 900 });
      await reportPage.reload();
      const artwork = reportPage.locator(".report-summary__art");
      await expect(artwork).toBeVisible();
      expect(
        await reportPage.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      const artBox = await artwork.boundingBox();
      expect(artBox!.width).toBeGreaterThanOrEqual(width >= 900 ? 130 : 110);
    }

    await reportPage.close();
  });
});
