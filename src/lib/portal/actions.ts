"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  calculateMetrics,
  createShareToken,
  deriveAutoStatus,
  deriveCampaignDates,
  normalizeHandle,
} from "@/lib/portal/metrics";
import { createAdminClient } from "@/lib/admin-auth/client";
import type { CampaignStatus, ClientType } from "@/lib/supabase/database.types";
import { tiktokProvider } from "@/lib/tiktok/provider";
import { extractUrlsFromPaste, parseTikTokPostUrl } from "@/lib/tiktok/urls";

async function requireUser() {
  return createAdminClient();
}

function revalidateCampaign(campaignId: string, shareToken?: string | null) {
  revalidatePath("/admin");
  revalidatePath(`/admin/campaigns/${campaignId}`);
  revalidatePath("/admin/clients");
  if (shareToken) revalidatePath(`/report/${shareToken}`);
}

async function syncCampaignDerivedState(
  supabase: Awaited<ReturnType<typeof createAdminClient>>,
  campaignId: string,
) {
  const [{ data: posts }, { data: campaign }] = await Promise.all([
    supabase
      .from("tiktok_posts")
      .select("id, posted_at, created_at, views, likes, comments, shares")
      .eq("campaign_id", campaignId),
    supabase.from("campaigns").select("status").eq("id", campaignId).single(),
  ]);

  const list = posts ?? [];
  const dates = deriveCampaignDates(list);
  const current = (campaign?.status ?? "draft") as CampaignStatus;
  const status = deriveAutoStatus(current, list.length);

  await supabase
    .from("campaigns")
    .update({
      status,
      start_date: dates.started ? dates.started.slice(0, 10) : null,
      end_date: dates.latest ? dates.latest.slice(0, 10) : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId);

  return list;
}

async function insertSnapshot(
  supabase: Awaited<ReturnType<typeof createAdminClient>>,
  postId: string,
  metrics: { views: number; likes: number; comments: number; shares: number },
) {
  await supabase.from("post_metric_snapshots").insert({
    post_id: postId,
    views: metrics.views,
    likes: metrics.likes,
    comments: metrics.comments,
    shares: metrics.shares,
  });
}

export async function previewTikTokSound(url: string) {
  await requireUser();
  return tiktokProvider.getSound(url);
}

export async function previewTikTokPost(url: string) {
  await requireUser();
  return tiktokProvider.getPost(url);
}

export async function createClientRecord(formData: FormData) {
  const supabase = await requireUser();
  const tempId = String(formData.get("temp_client_id") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const handle = normalizeHandle(String(formData.get("handle") || ""));
  const profileImageUrl =
    String(formData.get("profile_image_url") || "").trim() || null;
  const tiktokProfileUrl =
    String(formData.get("tiktok_profile_url") || "").trim() || null;
  const email = String(formData.get("email") || "").trim() || null;
  const clientType = (String(formData.get("client_type") || "artist").trim() ||
    "artist") as ClientType;
  const internalNotes =
    String(formData.get("internal_notes") || "").trim() || null;

  if (!name) throw new Error("Name is required");
  if (!profileImageUrl) throw new Error("Profile picture is required");

  const payload = {
    ...(tempId ? { id: tempId } : {}),
    name,
    handle: handle || null,
    profile_image_url: profileImageUrl,
    tiktok_profile_url:
      tiktokProfileUrl ||
      (handle ? `https://www.tiktok.com/${handle}` : null),
    email,
    client_type: ["artist", "manager", "label"].includes(clientType)
      ? clientType
      : "artist",
    internal_notes: internalNotes,
  };

  const { data, error } = await supabase
    .from("clients")
    .insert(payload)
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/admin/clients");
  revalidatePath("/admin");
  redirect(`/admin/clients/${data.id}`);
}

export async function updateClientRecord(clientId: string, formData: FormData) {
  const supabase = await requireUser();
  const name = String(formData.get("name") || "").trim();
  const handle = normalizeHandle(String(formData.get("handle") || ""));
  const profileImageUrl =
    String(formData.get("profile_image_url") || "").trim() || null;
  const tiktokProfileUrl =
    String(formData.get("tiktok_profile_url") || "").trim() || null;
  const email = String(formData.get("email") || "").trim() || null;
  const clientType = (String(formData.get("client_type") || "artist").trim() ||
    "artist") as ClientType;
  const internalNotes =
    String(formData.get("internal_notes") || "").trim() || null;

  if (!name) throw new Error("Name is required");
  if (!profileImageUrl) throw new Error("Profile picture is required");

  const { error } = await supabase
    .from("clients")
    .update({
      name,
      handle: handle || null,
      profile_image_url: profileImageUrl,
      tiktok_profile_url: tiktokProfileUrl,
      email,
      client_type: ["artist", "manager", "label"].includes(clientType)
        ? clientType
        : "artist",
      internal_notes: internalNotes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", clientId);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${clientId}`);
}

export async function createCampaignFromSound(formData: FormData) {
  const supabase = await requireUser();
  const clientId = String(formData.get("client_id") || "").trim();
  const soundUrl = String(formData.get("tiktok_sound_url") || "").trim();
  const budget = Number(formData.get("budget") || 0);
  const artworkOverride =
    String(formData.get("artwork_url") || "").trim() || null;
  const usageOverrideRaw = String(formData.get("sound_usage_count") || "").trim();
  const usageOverride = usageOverrideRaw ? Number(usageOverrideRaw) : null;

  if (!clientId) throw new Error("Select a client");
  if (!soundUrl) throw new Error("TikTok sound URL is required");
  if (!Number.isFinite(budget) || budget < 0) {
    throw new Error("Budget is required");
  }

  const fetched = await tiktokProvider.getSound(soundUrl);
  if (!fetched.ok) throw new Error(fetched.error);

  const sound = fetched.data;
  const title = sound.title;
  const artist = sound.artist || "TikTok Sound";
  const display = `${artist} - ${title}`;

  const { data, error } = await supabase
    .from("campaigns")
    .insert({
      client_id: clientId,
      campaign_name: display,
      release_title: title,
      artwork_url: artworkOverride,
      status: "draft",
      budget,
      amount_spent: 0,
      tiktok_sound_url: sound.soundUrl,
      tiktok_sound_id: sound.soundId,
      sound_title: title,
      sound_artist: sound.artist,
      sound_artwork_url: sound.artworkUrl,
      sound_usage_count:
        usageOverride != null && Number.isFinite(usageOverride)
          ? Math.round(usageOverride)
          : sound.usageCount,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/admin");
  redirect(`/admin/campaigns/${data.id}`);
}

export async function updateCampaignBudget(
  campaignId: string,
  formData: FormData,
) {
  const supabase = await requireUser();
  const budget = Number(formData.get("budget") || 0);
  const artworkUrl = String(formData.get("artwork_url") || "").trim() || null;
  const usageRaw = String(formData.get("sound_usage_count") || "").trim();
  const soundUsage =
    usageRaw === "" ? null : Math.max(0, Math.round(Number(usageRaw) || 0));

  const { error } = await supabase
    .from("campaigns")
    .update({
      budget,
      artwork_url: artworkUrl,
      sound_usage_count: soundUsage,
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId);

  if (error) throw new Error(error.message);
  revalidatePath(`/admin/campaigns/${campaignId}`);
  revalidatePath("/admin");
}

export async function refreshCampaignSound(campaignId: string) {
  const supabase = await requireUser();
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("tiktok_sound_url, share_token")
    .eq("id", campaignId)
    .single();
  if (!campaign?.tiktok_sound_url) {
    throw new Error("This campaign has no TikTok sound URL.");
  }

  const fetched = await tiktokProvider.getSound(campaign.tiktok_sound_url);
  if (!fetched.ok) throw new Error(fetched.error);

  const sound = fetched.data;
  const { error } = await supabase
    .from("campaigns")
    .update({
      tiktok_sound_url: sound.soundUrl,
      tiktok_sound_id: sound.soundId,
      sound_title: sound.title,
      sound_artist: sound.artist,
      sound_artwork_url: sound.artworkUrl,
      sound_usage_count: sound.usageCount,
      release_title: sound.title,
      campaign_name: `${sound.artist || "TikTok Sound"} - ${sound.title}`,
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId);

  if (error) throw new Error(error.message);
  revalidateCampaign(campaignId, campaign.share_token);
  return sound;
}

export type AddPostResult =
  | {
      status: "added";
      postId: string;
      url: string;
      views: number;
      likes: number;
      comments: number;
      shares: number;
      creatorHandle: string;
      thumbnailUrl: string | null;
      postedAt: string | null;
      metricsComplete: boolean;
    }
  | { status: "duplicate"; url: string; postId: string }
  | { status: "invalid"; url: string; error: string }
  | { status: "failed"; url: string; error: string };

async function addFetchedPost(
  supabase: Awaited<ReturnType<typeof createAdminClient>>,
  campaignId: string,
  url: string,
): Promise<AddPostResult> {
  const parsed = parseTikTokPostUrl(url);
  if (parsed.kind === "invalid") {
    return { status: "invalid", url, error: parsed.reason };
  }
  if (parsed.kind === "wrong_type") {
    return {
      status: "invalid",
      url,
      error: "That looks like a TikTok sound URL. Paste a post URL instead.",
    };
  }
  if (parsed.kind !== "post") {
    return { status: "invalid", url, error: "Invalid TikTok post URL." };
  }

  const { data: existing } = await supabase
    .from("tiktok_posts")
    .select("id, tiktok_post_id")
    .eq("campaign_id", campaignId)
    .eq("tiktok_post_id", parsed.postId)
    .maybeSingle();

  if (existing) {
    return { status: "duplicate", url, postId: parsed.postId };
  }

  const fetched = await tiktokProvider.getPost(url);
  if (!fetched.ok) {
    return { status: "failed", url, error: fetched.error };
  }

  const post = fetched.data;
  const now = new Date().toISOString();
  const { data: inserted, error } = await supabase
    .from("tiktok_posts")
    .insert({
      campaign_id: campaignId,
      post_url: post.postUrl,
      tiktok_post_id: post.postId,
      creator_handle: post.creatorHandle,
      creator_display_name: post.creatorDisplayName,
      title: post.title,
      thumbnail_url: post.thumbnailUrl,
      posted_at: post.postedAt,
      views: post.views,
      likes: post.likes,
      comments: post.comments,
      shares: post.shares,
      last_synced_at: now,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { status: "duplicate", url, postId: post.postId };
    }
    return { status: "failed", url, error: error.message };
  }

  await insertSnapshot(supabase, inserted.id, post);

  // Backfill sound artwork / usage hints from first post music metadata
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("sound_artwork_url, artwork_url, tiktok_sound_id, sound_usage_count")
    .eq("id", campaignId)
    .single();

  const updates: {
    last_synced_at: string;
    sound_artwork_url?: string;
  } = {
    last_synced_at: now,
  };
  if (!campaign?.sound_artwork_url && post.musicArtworkUrl) {
    updates.sound_artwork_url = post.musicArtworkUrl;
  }
  if (
    campaign?.tiktok_sound_id &&
    post.musicId &&
    campaign.tiktok_sound_id === post.musicId &&
    !campaign.sound_usage_count
  ) {
    // usage still unknown — leave null
  }

  await supabase.from("campaigns").update(updates).eq("id", campaignId);

  return {
    status: "added",
    postId: post.postId,
    url: post.postUrl,
    views: post.views,
    likes: post.likes,
    comments: post.comments,
    shares: post.shares,
    creatorHandle: post.creatorHandle,
    thumbnailUrl: post.thumbnailUrl,
    postedAt: post.postedAt,
    metricsComplete: post.metricsComplete,
  };
}

export async function addTikTokPostByUrl(campaignId: string, url: string) {
  const supabase = await requireUser();
  const result = await addFetchedPost(supabase, campaignId, url);
  if (result.status === "added") {
    await syncCampaignDerivedState(supabase, campaignId);
    const { data: campaign } = await supabase
      .from("campaigns")
      .select("share_token")
      .eq("id", campaignId)
      .single();
    revalidateCampaign(campaignId, campaign?.share_token);
  }
  return result;
}

export async function importTikTokPostsByUrls(
  campaignId: string,
  paste: string,
) {
  const supabase = await requireUser();
  const urls = extractUrlsFromPaste(paste);
  if (urls.length === 0) {
    throw new Error("No valid TikTok post URLs found.");
  }

  const results: AddPostResult[] = [];
  for (const url of urls) {
    results.push(await addFetchedPost(supabase, campaignId, url));
  }

  await syncCampaignDerivedState(supabase, campaignId);
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("share_token")
    .eq("id", campaignId)
    .single();
  revalidateCampaign(campaignId, campaign?.share_token);
  return results;
}

export async function createTikTokPostManual(
  campaignId: string,
  formData: FormData,
) {
  const supabase = await requireUser();
  const postUrl = String(formData.get("post_url") || "").trim();
  const parsed = parseTikTokPostUrl(postUrl);
  const tiktokPostId =
    parsed.kind === "post"
      ? parsed.postId
      : String(formData.get("tiktok_post_id") || "").trim() || null;

  if (tiktokPostId) {
    const { data: existing } = await supabase
      .from("tiktok_posts")
      .select("id")
      .eq("campaign_id", campaignId)
      .eq("tiktok_post_id", tiktokPostId)
      .maybeSingle();
    if (existing) throw new Error("This TikTok post is already in the campaign.");
  }

  const payload = {
    campaign_id: campaignId,
    post_url: postUrl,
    tiktok_post_id: tiktokPostId,
    creator_handle: normalizeHandle(String(formData.get("creator_handle") || "")),
    creator_display_name:
      String(formData.get("creator_display_name") || "").trim() || null,
    title: String(formData.get("title") || "").trim() || null,
    posted_at: String(formData.get("posted_at") || "").trim() || null,
    views: Math.max(0, Math.round(Number(formData.get("views") || 0))),
    likes: Math.max(0, Math.round(Number(formData.get("likes") || 0))),
    comments: Math.max(0, Math.round(Number(formData.get("comments") || 0))),
    shares: Math.max(0, Math.round(Number(formData.get("shares") || 0))),
    thumbnail_url: String(formData.get("thumbnail_url") || "").trim() || null,
    last_synced_at: new Date().toISOString(),
  };

  if (!payload.post_url || !payload.creator_handle) {
    throw new Error("Post URL and creator are required");
  }

  const { data, error } = await supabase
    .from("tiktok_posts")
    .insert(payload)
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await insertSnapshot(supabase, data.id, payload);
  await syncCampaignDerivedState(supabase, campaignId);
  revalidatePath(`/admin/campaigns/${campaignId}`);
}

export async function updateTikTokPostManual(
  postId: string,
  campaignId: string,
  formData: FormData,
) {
  const supabase = await requireUser();
  const payload = {
    post_url: String(formData.get("post_url") || "").trim(),
    creator_handle: normalizeHandle(String(formData.get("creator_handle") || "")),
    creator_display_name:
      String(formData.get("creator_display_name") || "").trim() || null,
    title: String(formData.get("title") || "").trim() || null,
    posted_at: String(formData.get("posted_at") || "").trim() || null,
    views: Math.max(0, Math.round(Number(formData.get("views") || 0))),
    likes: Math.max(0, Math.round(Number(formData.get("likes") || 0))),
    comments: Math.max(0, Math.round(Number(formData.get("comments") || 0))),
    shares: Math.max(0, Math.round(Number(formData.get("shares") || 0))),
    thumbnail_url: String(formData.get("thumbnail_url") || "").trim() || null,
    last_synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("tiktok_posts")
    .update(payload)
    .eq("id", postId);
  if (error) throw new Error(error.message);

  await insertSnapshot(supabase, postId, payload);
  await syncCampaignDerivedState(supabase, campaignId);
  revalidatePath(`/admin/campaigns/${campaignId}`);
}

export async function deleteTikTokPost(postId: string, campaignId: string) {
  const supabase = await requireUser();
  const { error } = await supabase.from("tiktok_posts").delete().eq("id", postId);
  if (error) throw new Error(error.message);
  await syncCampaignDerivedState(supabase, campaignId);
  revalidatePath(`/admin/campaigns/${campaignId}`);
  revalidatePath("/admin");
}

export async function refreshTikTokPost(postId: string, campaignId: string) {
  const supabase = await requireUser();
  const { data: post } = await supabase
    .from("tiktok_posts")
    .select("*")
    .eq("id", postId)
    .eq("campaign_id", campaignId)
    .single();
  if (!post) throw new Error("Post not found");

  const fetched = await tiktokProvider.refreshPost(post.post_url);
  if (!fetched.ok) throw new Error(fetched.error);
  if (!fetched.data.metricsComplete) {
    throw new Error(
      "TikTok returned the post but not engagement metrics. Try again shortly or edit manually.",
    );
  }

  const data = fetched.data;
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("tiktok_posts")
    .update({
      post_url: data.postUrl,
      tiktok_post_id: data.postId,
      creator_handle: data.creatorHandle,
      creator_display_name: data.creatorDisplayName,
      title: data.title,
      thumbnail_url: data.thumbnailUrl,
      posted_at: data.postedAt,
      views: data.views,
      likes: data.likes,
      comments: data.comments,
      shares: data.shares,
      last_synced_at: now,
      updated_at: now,
    })
    .eq("id", postId);
  if (error) throw new Error(error.message);

  await insertSnapshot(supabase, postId, data);
  await supabase
    .from("campaigns")
    .update({ last_synced_at: now, updated_at: now })
    .eq("id", campaignId);

  revalidatePath(`/admin/campaigns/${campaignId}`);
  return data;
}

export async function refreshCampaignPosts(campaignId: string) {
  const supabase = await requireUser();
  const { data: posts } = await supabase
    .from("tiktok_posts")
    .select("*")
    .eq("campaign_id", campaignId);

  const list = posts ?? [];
  const before = calculateMetrics(list);
  let updated = 0;
  let failed = 0;
  const failedPostIds: string[] = [];

  for (const post of list) {
    try {
      const fetched = await tiktokProvider.refreshPost(post.post_url);
      if (!fetched.ok || !fetched.data.metricsComplete) {
        failed += 1;
        failedPostIds.push(post.id);
        continue;
      }
      const data = fetched.data;
      const now = new Date().toISOString();
      await supabase
        .from("tiktok_posts")
        .update({
          post_url: data.postUrl,
          tiktok_post_id: data.postId,
          creator_handle: data.creatorHandle,
          creator_display_name: data.creatorDisplayName,
          title: data.title,
          thumbnail_url: data.thumbnailUrl,
          posted_at: data.postedAt,
          views: data.views,
          likes: data.likes,
          comments: data.comments,
          shares: data.shares,
          last_synced_at: now,
          updated_at: now,
        })
        .eq("id", post.id);
      await insertSnapshot(supabase, post.id, data);
      updated += 1;
    } catch {
      failed += 1;
      failedPostIds.push(post.id);
    }
  }

  const { data: afterPosts } = await supabase
    .from("tiktok_posts")
    .select("views, likes, comments, shares")
    .eq("campaign_id", campaignId);
  const after = calculateMetrics(afterPosts ?? []);
  const now = new Date().toISOString();
  await supabase
    .from("campaigns")
    .update({ last_synced_at: now, updated_at: now })
    .eq("id", campaignId);

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("share_token")
    .eq("id", campaignId)
    .single();
  revalidateCampaign(campaignId, campaign?.share_token);

  return {
    total: list.length,
    updated,
    failed,
    failedPostIds,
    before,
    after,
  };
}

export async function refreshFailedCampaignPosts(
  campaignId: string,
  postIds: string[],
) {
  const supabase = await requireUser();
  if (postIds.length === 0) {
    return refreshCampaignPosts(campaignId);
  }

  const { data: posts } = await supabase
    .from("tiktok_posts")
    .select("*")
    .eq("campaign_id", campaignId)
    .in("id", postIds);

  const list = posts ?? [];
  const beforeAll = await supabase
    .from("tiktok_posts")
    .select("views, likes, comments, shares")
    .eq("campaign_id", campaignId);
  const before = calculateMetrics(beforeAll.data ?? []);

  let updated = 0;
  let failed = 0;
  const failedPostIds: string[] = [];

  for (const post of list) {
    try {
      const fetched = await tiktokProvider.refreshPost(post.post_url);
      if (!fetched.ok || !fetched.data.metricsComplete) {
        failed += 1;
        failedPostIds.push(post.id);
        continue;
      }
      const data = fetched.data;
      const now = new Date().toISOString();
      await supabase
        .from("tiktok_posts")
        .update({
          post_url: data.postUrl,
          tiktok_post_id: data.postId,
          creator_handle: data.creatorHandle,
          creator_display_name: data.creatorDisplayName,
          title: data.title,
          thumbnail_url: data.thumbnailUrl,
          posted_at: data.postedAt,
          views: data.views,
          likes: data.likes,
          comments: data.comments,
          shares: data.shares,
          last_synced_at: now,
          updated_at: now,
        })
        .eq("id", post.id);
      await insertSnapshot(supabase, post.id, data);
      updated += 1;
    } catch {
      failed += 1;
      failedPostIds.push(post.id);
    }
  }

  const { data: afterPosts } = await supabase
    .from("tiktok_posts")
    .select("views, likes, comments, shares")
    .eq("campaign_id", campaignId);
  const after = calculateMetrics(afterPosts ?? []);
  const now = new Date().toISOString();
  await supabase
    .from("campaigns")
    .update({ last_synced_at: now, updated_at: now })
    .eq("id", campaignId);

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("share_token")
    .eq("id", campaignId)
    .single();
  revalidateCampaign(campaignId, campaign?.share_token);

  return {
    total: list.length,
    updated,
    failed,
    failedPostIds,
    before,
    after,
  };
}

export async function publishCampaignReport(campaignId: string) {
  const supabase = await requireUser();
  const { data: existing } = await supabase
    .from("campaigns")
    .select("share_token")
    .eq("id", campaignId)
    .single();

  const token = existing?.share_token || createShareToken();
  const { error } = await supabase
    .from("campaigns")
    .update({
      share_token: token,
      share_enabled: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/campaigns/${campaignId}`);
  revalidatePath(`/report/${token}`);
  return token;
}

export async function updatePublishedReport(campaignId: string) {
  const supabase = await requireUser();
  const { error } = await supabase
    .from("campaigns")
    .update({ updated_at: new Date().toISOString(), share_enabled: true })
    .eq("id", campaignId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/campaigns/${campaignId}`);
}

export async function disableCampaignShare(campaignId: string) {
  const supabase = await requireUser();
  const { error } = await supabase
    .from("campaigns")
    .update({ share_enabled: false })
    .eq("id", campaignId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/campaigns/${campaignId}`);
}

export async function regenerateCampaignShare(campaignId: string) {
  const supabase = await requireUser();
  const token = createShareToken();
  const { error } = await supabase
    .from("campaigns")
    .update({
      share_token: token,
      share_enabled: true,
    })
    .eq("id", campaignId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/campaigns/${campaignId}`);
  return token;
}

export async function setCampaignStatus(
  campaignId: string,
  status: CampaignStatus,
) {
  const supabase = await requireUser();
  if (!["draft", "live", "paused", "closed"].includes(status)) {
    throw new Error("Invalid status");
  }

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("status, share_token")
    .eq("id", campaignId)
    .single();
  if (!campaign) throw new Error("Campaign not found");

  // Closing/pausing never deletes data or disables share links.
  const { error } = await supabase
    .from("campaigns")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId);
  if (error) throw new Error(error.message);

  // If resuming a campaign that still has posts, ensure live; if empty, draft.
  if (status === "live") {
    await syncCampaignDerivedState(supabase, campaignId);
  }

  revalidateCampaign(campaignId, campaign.share_token);
  revalidatePath("/admin/clients");
}

const PORTAL_BUCKET = "portal-assets";

export async function uploadPortalAssetAction(
  path: string,
  formData: FormData,
): Promise<string> {
  const supabase = await requireUser();
  const file = formData.get("file");
  if (!file || typeof file === "string") {
    throw new Error("Missing file");
  }
  const contentType =
    "type" in file && typeof file.type === "string" && file.type
      ? file.type
      : "image/jpeg";

  const { error } = await supabase.storage.from(PORTAL_BUCKET).upload(path, file, {
    contentType,
    upsert: true,
    cacheControl: "3600",
  });
  if (error) throw new Error(error.message || "Upload failed.");

  const { data } = supabase.storage.from(PORTAL_BUCKET).getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}

export async function removePortalAssetAction(url: string | null | undefined) {
  if (!url) return;
  const supabase = await requireUser();
  try {
    const parsed = new URL(url);
    const marker = `/object/public/${PORTAL_BUCKET}/`;
    const idx = parsed.pathname.indexOf(marker);
    if (idx < 0) return;
    const path = decodeURIComponent(parsed.pathname.slice(idx + marker.length));
    if (!path) return;
    await supabase.storage.from(PORTAL_BUCKET).remove([path]);
  } catch {
    // Non-fatal
  }
}

