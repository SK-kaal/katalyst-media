import { expect, test, type Page } from "@playwright/test";
import {
  QA_PREFIX,
  cleanupQaClients,
  createPortalDbClient,
  existingTikTokPostUrl,
} from "./portal-test-helpers";

const ACCESS_CODE = (() => {
  const value = process.env.ADMIN_ACCESS_CODE;
  if (!value) throw new Error("Set ADMIN_ACCESS_CODE before running E2E tests");
  return value;
})();

const SOUND_URL =
  "https://www.tiktok.com/music/bank-on-it-7483905998420527894";
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

async function login(page: Page, next = "/admin") {
  await page.goto(next);
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.locator("#access-code").fill(ACCESS_CODE);
  await page.locator("#access-code").press("Enter");
  const escaped = next.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  await expect(page).toHaveURL(new RegExp(`${escaped}/?$`), {
    timeout: 30_000,
  });
}

function idFromUrl(url: string, segment: "clients" | "campaigns") {
  const match = url.match(new RegExp(`/admin/${segment}/([^/?]+)`));
  if (!match) throw new Error(`Could not read ${segment} id from ${url}`);
  return match[1];
}

test.describe.serial("Disposable real-world portal lifecycle", () => {
  test.setTimeout(360_000);

  test.beforeAll(async () => {
    await cleanupQaClients();
  });

  test.afterAll(async () => {
    await cleanupQaClients();
  });

  test("create, persist, report, move, end, reopen, archive and delete", async ({
    page,
  }) => {
    const suffix = Date.now().toString(36);
    const primaryName = `${QA_PREFIX} Primary ${suffix}`;
    const targetName = `${QA_PREFIX} Move Target ${suffix}`;
    const internalNote = `PRIVATE-${suffix}-MUST-NOT-LEAK`;
    const db = await createPortalDbClient();
    const consoleErrors: string[] = [];
    const firstPartyFailures: string[] = [];

    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("response", (response) => {
      if (
        response.url().startsWith(new URL(page.url() || "http://127.0.0.1").origin) &&
        response.status() >= 400
      ) {
        firstPartyFailures.push(`${response.status()} ${response.url()}`);
      }
    });

    await login(page);

    // Client validation, image rejection, crop/save and persistence.
    await page.goto("/admin/clients?new=1#add-client");
    const clientForm = page.locator("#client-name").locator("xpath=ancestor::form");
    await clientForm.getByRole("button", { name: /create client/i }).click();
    await expect(page.locator("#client-name:invalid")).toHaveCount(1);

    const fileInput = clientForm.locator('input[type="file"]');
    await fileInput.evaluate((input) => {
      const transfer = new DataTransfer();
      transfer.items.add(
        new File([new Uint8Array(5 * 1024 * 1024 + 1)], "too-large.png", {
          type: "image/png",
        }),
      );
      (input as HTMLInputElement).files = transfer.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await expect(clientForm.getByRole("alert")).toContainText(/5mb/i);

    await fileInput.setInputFiles({
      name: "avatar.png",
      mimeType: "image/png",
      buffer: PNG_1X1,
    });
    const cropDialog = page.getByRole("dialog", {
      name: /adjust profile photo/i,
    });
    await expect(cropDialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(cropDialog).toHaveCount(0);
    await fileInput.setInputFiles({
      name: "avatar.png",
      mimeType: "image/png",
      buffer: PNG_1X1,
    });
    await expect(cropDialog).toBeVisible();
    await cropDialog.getByLabel("Zoom").fill("1.5");
    await expect(cropDialog.getByRole("button", { name: /use photo/i })).toBeEnabled();
    await cropDialog.getByRole("button", { name: /use photo/i }).click();
    await expect(cropDialog).toHaveCount(0);

    await clientForm.locator("#client-name").fill(primaryName);
    await clientForm.locator("#client-handle").fill(`qa_${suffix}`);
    await clientForm.locator("#client-tiktok-url").fill(
      `https://www.tiktok.com/@qa_${suffix}`,
    );
    await clientForm.locator("#client-email").fill(`qa-${suffix}@example.com`);
    await clientForm.locator("#client-type").selectOption("artist");
    await clientForm.locator("#client-notes").fill(internalNote);
    await clientForm.getByRole("button", { name: /create client/i }).click();
    await expect(page).toHaveURL(/\/admin\/clients\/[^/?]+$/, {
      timeout: 30_000,
    });
    const primaryClientId = idFromUrl(page.url(), "clients");

    const { data: primary } = await db
      .from("clients")
      .select("*")
      .eq("id", primaryClientId)
      .single();
    expect(primary?.name).toBe(primaryName);
    expect(primary?.internal_notes).toBe(internalNote);
    expect(primary?.profile_image_url).toContain("/portal-assets/");

    // Create a second disposable client used to exercise campaign moving.
    await page.goto("/admin/clients?new=1#add-client");
    await page.locator("#client-name").fill(targetName);
    await page.getByRole("button", { name: /create client/i }).click();
    await expect(page).toHaveURL(/\/admin\/clients\/[^/?]+$/, {
      timeout: 30_000,
    });
    const targetClientId = idFromUrl(page.url(), "clients");

    // Campaign validation and URL-first creation.
    await page.goto(`/admin/clients/${primaryClientId}`);
    await page.getByRole("link", { name: /new campaign/i }).click();
    const campaignForm = page.getByRole("button", {
      name: /create campaign/i,
    }).locator("xpath=ancestor::form");
    await campaignForm.getByRole("button", { name: /create campaign/i }).click();
    await expect(campaignForm.locator("#tiktok_sound_url:invalid")).toHaveCount(1);

    await campaignForm.locator("#tiktok_sound_url").fill(
      "https://www.tiktok.com/@creator/video/1234567890123456789",
    );
    await campaignForm.getByRole("button", { name: /check sound/i }).click();
    await expect(campaignForm.getByRole("alert")).toContainText(/post url/i);

    await campaignForm.locator("#tiktok_sound_url").fill(SOUND_URL);
    await campaignForm.locator("#budget").fill("-1");
    await campaignForm.locator("#target_posts").fill("2.5");
    await campaignForm.getByRole("button", { name: /create campaign/i }).click();
    await expect(campaignForm.locator("#budget:invalid")).toHaveCount(1);

    await campaignForm.locator("#budget").fill("2500.50");
    await campaignForm.locator("#target_posts").fill("3");
    await campaignForm.getByRole("button", { name: /create campaign/i }).click();
    await expect(page).toHaveURL(/\/admin\/campaigns\/[^/?]+\?tab=content/, {
      timeout: 45_000,
    });
    const campaignId = idFromUrl(page.url(), "campaigns");
    await expect(page.getByText("£2,500.50")).toBeVisible();
    const contentTab = page.getByRole("tab", { name: "Content" });
    await expect(contentTab).toHaveAttribute(
      "aria-controls",
      "campaign-panel-content",
    );
    await expect(page.getByRole("tabpanel")).toHaveAttribute(
      "aria-labelledby",
      "campaign-tab-content",
    );
    await contentTab.focus();
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByRole("tab", { name: "Overview" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByRole("tabpanel")).toHaveAttribute(
      "aria-labelledby",
      "campaign-tab-overview",
    );

    const { data: createdCampaign } = await db
      .from("campaigns")
      .select("status, budget, target_posts, share_token, client_id")
      .eq("id", campaignId)
      .single();
    expect(createdCampaign?.status).toBe("active");
    expect(Number(createdCampaign?.budget)).toBe(2500.5);
    expect(createdCampaign?.target_posts).toBe(3);
    expect(createdCampaign?.share_token).toHaveLength(48);
    expect(createdCampaign?.client_id).toBe(primaryClientId);
    const permanentToken = createdCampaign!.share_token;

    // Permanent client report exists immediately and excludes internal data.
    await page.getByRole("tab", { name: /sharing/i }).click();
    const reportUrl = (await page.locator(".break-all").innerText()).trim();
    expect(reportUrl.endsWith(`/report/${permanentToken}`)).toBe(true);
    await page.getByRole("button", { name: /copy client link/i }).first().click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(reportUrl);

    const reportPage = await page.context().newPage();
    const reportResponse = await reportPage.goto(`/report/${permanentToken}`);
    expect(reportResponse?.headers()["cache-control"]).toMatch(
      /no-store|private|max-age=0/i,
    );
    await expect(reportPage.getByText(/shared report · view only/i)).toBeVisible();
    await expect(reportPage.locator("body")).not.toContainText(internalNote);
    await expect(reportPage.locator("body")).not.toContainText(`qa-${suffix}@example.com`);
    const idProbe = await page.context().newPage();
    await idProbe.goto(`/report/${campaignId}`);
    await expect(idProbe.getByText(/no longer available/i)).toBeVisible();
    await idProbe.close();

    // One importer handles one or many URLs, duplicates and invalid entries.
    const seedPostUrl = await existingTikTokPostUrl();
    expect(seedPostUrl, "A known TikTok post is required for the provider test").toBeTruthy();
    await page.getByRole("tab", { name: /content/i }).click();
    const importer = page.getByLabel("TikTok post URLs");
    await importer.fill(
      `${seedPostUrl}\n${seedPostUrl}?is_from_webapp=1\nnot-a-tiktok-url`,
    );
    await page.getByRole("button", { name: /^add posts$/i }).click();
    await expect(page.getByText(/import complete/i).first()).toContainText(
      /1 added.*1 paste duplicates.*1 failed/i,
      { timeout: 45_000 },
    );

    await importer.fill(`${seedPostUrl}&lang=en`);
    await page.getByRole("button", { name: /^add posts$/i }).click();
    await expect(page.getByText(/already tracked/i).first()).toBeVisible({
      timeout: 30_000,
    });

    const { data: importedPosts } = await db
      .from("tiktok_posts")
      .select("id")
      .eq("campaign_id", campaignId);
    expect(importedPosts).toHaveLength(1);

    await page.getByRole("tab", { name: /overview/i }).click();
    await page.getByRole("button", { name: /^refresh data$/i }).click();
    await expect(
      page.locator('p[role="status"]').filter({ hasText: /posts refreshed/i }),
    ).toBeVisible({ timeout: 60_000 });

    // Controlled values prove metric maths and report freshness.
    await page.getByRole("tab", { name: /content/i }).click();
    const row = page.locator("tbody tr").first();
    await row.getByRole("button", { name: /edit|enter manually/i }).click();
    const correctionForm = page
      .getByRole("heading", { name: /edit \/ correct data/i })
      .locator("xpath=ancestor::form");
    await correctionForm.locator('[name="views"]').fill("100");
    await correctionForm.locator('[name="likes"]').fill("10");
    await correctionForm.locator('[name="comments"]').fill("5");
    await correctionForm.locator('[name="shares"]').fill("2");
    await correctionForm.getByRole("button", { name: /save corrections/i }).click();
    await expect(page.getByText(/post updated/i).first()).toBeVisible();

    await page.getByRole("tab", { name: /overview/i }).click();
    await expect(page.getByText("17.00%")).toBeVisible();
    await reportPage.reload();
    await expect(
      reportPage.locator(".report-metric-card").filter({ hasText: "Campaign Views" }),
    ).toContainText("100");
    await expect(reportPage.getByText("17.00%")).toBeVisible();

    // Manual fallback remains usable when a provider cannot return a post.
    await page.getByRole("tab", { name: /content/i }).click();
    await page.getByRole("button", { name: /enter details manually/i }).click();
    const manualForm = page.locator("#manual-post-form");
    const manualPosts = [
      ["9000000000000000300", "@qa_top_300", "300"],
      ["9000000000000000200", "@qa_top_200", "200"],
      ["9000000000000000050", "@qa_low_50", "50"],
      ["9000000000000000040", "@qa_low_40", "40"],
      ["9000000000000000030", "@qa_low_30", "30"],
      ["9000000000000000020", "@qa_low_20", "20"],
      ["9000000000000000019", "@qa_low_19", "19"],
      ["9000000000000000018", "@qa_low_18", "18"],
      ["9000000000000000017", "@qa_low_17", "17"],
      ["9000000000000000016", "@qa_low_16", "16"],
    ] as const;
    const saveManualPost = manualForm.getByRole("button", {
      name: /save manual post/i,
    });
    for (const [index, [id, handle, views]] of manualPosts.entries()) {
      await expect(saveManualPost).toBeEnabled();
      await manualForm
        .locator('[name="post_url"]')
        .fill(`https://www.tiktok.com/@qa/video/${id}`);
      await manualForm.locator('[name="creator_handle"]').fill(handle);
      await manualForm.locator('[name="views"]').fill(views);
      await manualForm.locator('[name="likes"]').fill("1");
      await manualForm.locator('[name="comments"]').fill("0");
      await manualForm.locator('[name="shares"]').fill("0");
      await saveManualPost.click();
      await expect
        .poll(
          async () => {
            const { count } = await db
              .from("tiktok_posts")
              .select("id", { count: "exact", head: true })
              .eq("campaign_id", campaignId);
            return count;
          },
          { timeout: 30_000 },
        )
        .toBe(index + 2);
      await expect(saveManualPost).toBeEnabled();
    }
    await reportPage.reload();
    const topCards = reportPage.locator(".report-top-grid .report-vcard");
    await expect(topCards).toHaveCount(3);
    await expect(topCards.nth(0)).toContainText("@qa_top_300");
    await expect(topCards.nth(1)).toContainText("@qa_top_200");
    await expect(topCards.nth(2)).toContainText("100");
    await expect(
      reportPage.locator(".report-content-grid .report-vcard"),
    ).toHaveCount(10);
    await reportPage.getByRole("button", { name: /next page/i }).click();
    await expect(
      reportPage.locator(".report-content-grid .report-vcard"),
    ).toHaveCount(1);
    await reportPage.getByRole("button", { name: /previous page/i }).click();
    await reportPage.getByLabel("Sort content").selectOption("likes");
    await expect(
      reportPage.locator(".report-content-grid .report-vcard").first(),
    ).toContainText("10");
    await reportPage.getByRole("button", { name: /list view/i }).click();
    await expect(
      reportPage.locator(".report-content-list .report-vcard"),
    ).toHaveCount(10);
    await reportPage.getByRole("button", { name: /grid view/i }).click();
    const csvDownload = reportPage.waitForEvent("download");
    await reportPage.getByRole("button", { name: /export to csv/i }).click();
    expect((await csvDownload).suggestedFilename()).toMatch(/\.csv$/);
    await page.getByLabel("Search posts").fill("@qa_low_20");
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await page.getByLabel("Select @qa_low_20").check();
    await page.getByRole("button", { name: /remove selected/i }).click();
    const removeDialog = page.getByRole("dialog", {
      name: /remove 1 selected post/i,
    });
    await removeDialog
      .getByRole("button", { name: /remove selected/i })
      .click();
    await expect
      .poll(
        async () => {
          const { count } = await db
            .from("tiktok_posts")
            .select("id", { count: "exact", head: true })
            .eq("campaign_id", campaignId);
          return count;
        },
        { timeout: 30_000 },
      )
      .toBe(10);
    await page.getByRole("button", { name: "Clear Search" }).click();
    await reportPage.reload();
    await expect(
      reportPage.locator(".report-content-grid .report-vcard"),
    ).toHaveCount(10);
    await expect(
      reportPage.getByRole("button", { name: /next page/i }),
    ).toBeDisabled();

    // One save operation updates title, budget and target; report remains live.
    await page.getByRole("tab", { name: /overview/i }).click();
    const settings = page
      .getByRole("heading", { name: /campaign settings/i })
      .locator("xpath=ancestor::form");
    await settings.locator('[name="display_title"]').fill(`QA Campaign ${suffix}`);
    await settings.locator('[name="budget"]').fill("3000.75");
    await settings.locator('[name="target_posts"]').fill("4");
    await settings.getByRole("button", { name: /save changes/i }).click();
    await expect
      .poll(async () => {
        const { data } = await db
          .from("campaigns")
          .select("display_title")
          .eq("id", campaignId)
          .single();
        return data?.display_title;
      })
      .toBe(`QA Campaign ${suffix}`);
    const { data: editedCampaign } = await db
      .from("campaigns")
      .select("display_title, budget, target_posts, share_token")
      .eq("id", campaignId)
      .single();
    expect(editedCampaign?.display_title).toBe(`QA Campaign ${suffix}`);
    expect(Number(editedCampaign?.budget)).toBe(3000.75);
    expect(editedCampaign?.target_posts).toBe(4);
    expect(editedCampaign?.share_token).toBe(permanentToken);
    await reportPage.reload();
    await expect(reportPage.getByRole("heading", { name: `QA Campaign ${suffix}` })).toBeVisible();
    await expect(reportPage.getByText("£3,000.75")).toBeVisible();

    // Hidden campaign menu, Escape, moving and token stability.
    await page.getByRole("button", { name: /campaign actions/i }).click();
    await expect(page.getByRole("menu")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await page.getByRole("button", { name: /campaign actions/i }).click();
    await page.getByRole("menuitem", { name: /move campaign/i }).click();
    const moveDialog = page.getByRole("dialog", { name: /move campaign/i });
    await moveDialog.locator("select").selectOption(targetClientId);
    await moveDialog.getByRole("button", { name: /confirm move/i }).click();
    await expect(moveDialog).toHaveCount(0);

    let { data: movedCampaign } = await db
      .from("campaigns")
      .select("client_id, share_token")
      .eq("id", campaignId)
      .single();
    expect(movedCampaign?.client_id).toBe(targetClientId);
    expect(movedCampaign?.share_token).toBe(permanentToken);

    await page.getByRole("button", { name: /campaign actions/i }).click();
    await page.getByRole("menuitem", { name: /move campaign/i }).click();
    await page.getByRole("dialog", { name: /move campaign/i }).locator("select").selectOption(primaryClientId);
    await page.getByRole("dialog", { name: /move campaign/i }).getByRole("button", { name: /confirm move/i }).click();
    await expect(
      page.getByRole("dialog", { name: /move campaign/i }),
    ).toHaveCount(0);
    await expect
      .poll(async () => {
        const { data } = await db
          .from("campaigns")
          .select("client_id")
          .eq("id", campaignId)
          .single();
        return data?.client_id;
      })
      .toBe(primaryClientId);
    ({ data: movedCampaign } = await db
      .from("campaigns")
      .select("client_id, share_token")
      .eq("id", campaignId)
      .single());
    expect(movedCampaign?.client_id).toBe(primaryClientId);
    expect(movedCampaign?.share_token).toBe(permanentToken);

    // End blocks the exact URL; reopen restores the exact same URL.
    await page.getByRole("button", { name: /^end campaign$/i }).click();
    await page.getByRole("dialog", { name: /end campaign/i }).getByRole("button", { name: /^cancel$/i }).click();
    await page.getByRole("button", { name: /^end campaign$/i }).click();
    await page.getByRole("dialog", { name: /end campaign/i }).getByRole("button", { name: /^end campaign$/i }).click();
    await expect(page.getByRole("button", { name: /^reopen campaign$/i })).toBeVisible();

    let { data: lifecycle } = await db
      .from("campaigns")
      .select("status, share_token")
      .eq("id", campaignId)
      .single();
    expect(lifecycle?.status).toBe("ended");
    expect(lifecycle?.share_token).toBe(permanentToken);
    await reportPage.reload();
    await expect(reportPage.getByText(/no longer available/i)).toBeVisible();
    const endedPreview = await page.context().newPage();
    await endedPreview.goto(`/admin/campaigns/${campaignId}/preview`);
    await expect(endedPreview.getByText("Final results")).toBeVisible();
    await expect(endedPreview.getByText("Live results")).toHaveCount(0);
    await endedPreview.close();

    await page.getByRole("button", { name: /^reopen campaign$/i }).click();
    await page.getByRole("dialog", { name: /reopen campaign/i }).getByRole("button", { name: /^reopen campaign$/i }).click();
    await expect(page.getByRole("button", { name: /^end campaign$/i })).toBeVisible();
    ({ data: lifecycle } = await db
      .from("campaigns")
      .select("status, share_token")
      .eq("id", campaignId)
      .single());
    expect(lifecycle?.status).toBe("active");
    expect(lifecycle?.share_token).toBe(permanentToken);
    await reportPage.reload();
    await expect(reportPage.getByText(/shared report · view only/i)).toBeVisible();

    // Archiving is separate from report access and can be restored.
    await page.goto(`/admin/clients/${primaryClientId}`);
    await page.getByRole("button", { name: /^archive$/i }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: /archive client/i })).toHaveCount(0);
    await page.getByRole("button", { name: /^archive$/i }).click();
    await page.getByRole("dialog", { name: /archive client/i }).getByRole("button", { name: /archive client/i }).click();
    await expect(page.getByRole("button", { name: /^restore$/i })).toBeVisible();
    await reportPage.reload();
    await expect(reportPage.getByText(/shared report · view only/i)).toBeVisible();
    await page.getByRole("button", { name: /^restore$/i }).click();
    await expect(page.getByRole("button", { name: /^archive$/i })).toBeVisible();

    // Genuine mobile interaction and overflow pass.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/admin/campaigns/${campaignId}?tab=content`);
    await page.getByRole("button", { name: /open menu/i }).click();
    await expect(page.getByRole("navigation", { name: /admin/i }).last()).toBeVisible();
    await page.keyboard.press("Escape");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await reportPage.setViewportSize({ width: 390, height: 844 });
    await reportPage.reload();
    expect(
      await reportPage.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    for (const width of [768, 820, 1024, 1100]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/admin/campaigns/${campaignId}?tab=content`);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await reportPage.setViewportSize({ width, height: 900 });
      await reportPage.reload();
      expect(
        await reportPage.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }

    // Trash/restore/permanent delete and client deletion use only QA records.
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`/admin/campaigns/${campaignId}`);
    await page.getByRole("button", { name: /campaign actions/i }).click();
    await page.getByRole("menuitem", { name: /trash campaign/i }).click();
    await page.getByRole("dialog", { name: /move campaign to trash/i }).getByRole("button", { name: /move to trash/i }).click();
    await expect(page).toHaveURL(/view=trash/);
    await page.getByRole("button", { name: /campaign actions/i }).click();
    await page.getByRole("menuitem", { name: /restore campaign/i }).click();
    await expect
      .poll(async () => {
        const { data } = await db
          .from("campaigns")
          .select("trashed_at")
          .eq("id", campaignId)
          .single();
        return data?.trashed_at;
      })
      .toBeNull();
    await page.goto(`/admin/campaigns/${campaignId}`);
    await page.getByRole("button", { name: /campaign actions/i }).click();
    await page.getByRole("menuitem", { name: /trash campaign/i }).click();
    await page.getByRole("dialog", { name: /move campaign to trash/i }).getByRole("button", { name: /move to trash/i }).click();
    await expect(page).toHaveURL(/view=trash/);
    await page.getByRole("button", { name: /campaign actions/i }).click();
    await page.getByRole("menuitem", { name: /delete permanently/i }).click();
    await page.getByRole("dialog", { name: /delete campaign permanently/i }).getByRole("button", { name: /delete permanently/i }).click();
    await expect(page).toHaveURL(/view=trash/);
    await expect
      .poll(async () => {
        const { data } = await db
          .from("campaigns")
          .select("id")
          .eq("id", campaignId)
          .maybeSingle();
        return data;
      })
      .toBeNull();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/admin/clients/${primaryClientId}`);
    await page.getByRole("button", { name: /reposition/i }).click();
    const mobileCropDialog = page.getByRole("dialog", {
      name: /adjust profile photo/i,
    });
    await expect(mobileCropDialog).toBeVisible();
    expect((await mobileCropDialog.boundingBox())?.width ?? 391).toBeLessThanOrEqual(
      390,
    );
    await page.keyboard.press("Escape");
    await expect(mobileCropDialog).toHaveCount(0);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.getByRole("button", { name: /^remove$/i }).click();
    await page.getByRole("button", { name: /save changes/i }).click();
    await expect
      .poll(async () => {
        const { data } = await db
          .from("clients")
          .select("profile_image_url")
          .eq("id", primaryClientId)
          .single();
        return data?.profile_image_url;
      })
      .toBeNull();
    const savedAvatarName = primary?.profile_image_url
      ? new URL(primary.profile_image_url).pathname.split("/").at(-1)
      : null;
    if (savedAvatarName) {
      await expect
        .poll(async () => {
          const { data } = await db.storage
            .from("portal-assets")
            .list(`clients/${primaryClientId}`);
          return (data ?? []).some((file) => file.name === savedAvatarName);
        })
        .toBe(false);
    }

    for (const clientId of [targetClientId, primaryClientId]) {
      await page.goto(`/admin/clients/${clientId}`);
      await page.getByRole("button", { name: /^delete$/i }).click();
      await page.getByRole("dialog", { name: /permanently delete client/i }).getByRole("button", { name: /delete permanently/i }).click();
      await expect(page).toHaveURL(/\/admin\/clients/);
    }

    await page.getByRole("button", { name: /log out/i }).first().click();
    await expect(page).toHaveURL(/\/admin\/login/);
    await page.goBack();
    await expect(page).toHaveURL(/\/admin\/login/);

    expect(consoleErrors).toEqual([]);
    expect(firstPartyFailures).toEqual([]);
    await reportPage.close();
  });
});
