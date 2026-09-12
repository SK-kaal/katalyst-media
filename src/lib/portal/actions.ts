"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  calculateMetrics,
  createShareToken,
  normalizeHandle,
} from "@/lib/portal/metrics";
import { createAdminClient } from "@/lib/admin-auth/client";
import {
  insertCampaignSnapshot,
  insertSnapshot,
  insertSoundSnapshot,
  refreshCampaignDataWithClient,
  refreshCampaignPostsWithClient,
  refreshCampaignSoundWithClient,
  refreshTikTokPostWithClient,
} from "@/lib/portal/refresh";
import type { ClientType } from "@/lib/supabase/database.types";
import { tiktokProvider } from "@/lib/tiktok/provider";
import { analyzePasteUrls, parseTikTokPostUrl } from "@/lib/tiktok/urls";

async function requireUser() {
  return createAdminClient();
}

function nonNegativeInteger(formData: FormData, key: string) {
  const raw = String(formData.get(key) || "0").trim();
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0 || value > Number.MAX_SAFE_INTEGER) {
    throw new Error(`${key[0]!.toUpperCase()}${key.slice(1)} must be a whole number`);
  }
  return value;
}

function optionalDateTime(formData: FormData, key: string) {
  const raw = String(formData.get(key) || "").trim();
  if (!raw) return null;
  const value = new Date(raw);
  if (!Number.isFinite(value.getTime())) throw new Error("Enter a valid post date");
  return value.toISOString();
}

function optionalHttpUrl(formData: FormData, key: string) {
  const raw = String(formData.get(key) || "").trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error();
    }
    return parsed.toString();
  } catch {
    throw new Error("Enter a valid image URL");
  }
}

function revalidateCampaign(campaignId: string, shareToken?: string | null) {
  revalidatePath("/admin");
  revalidatePath(`/admin/campaigns/${campaignId}`);
  revalidatePath("/admin/clients");
  if (shareToken) revalidatePath(`/report/${shareToken}`);
}

async function touchCampaign(
  supabase: Awaited<ReturnType<typeof createAdminClient>>,
  campaignId: string,
) {
  const { error } = await supabase
    .from("campaigns")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", campaignId);
  if (error) throw new Error(error.message);
}

async function campaignContext(
  supabase: Awaited<ReturnType<typeof createAdminClient>>,
  campaignId: string,
) {
  const { data, error } = await supabase
    .from("campaigns")
    .select("share_token, client_id, trashed_at")
    .eq("id", campaignId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Campaign not found");
  return data;
}

export async function previewTikTokSound(url: string) {
  await requireUser();
  return tiktokProvider.getSound(url);
}

export async function createClientRecord(formData: FormData) {
  const supabase = await requireUser();
  const tempId = String(formData.get("temp_client_id") || "").trim();
  const clientId = tempId || crypto.randomUUID();
  const name = String(formData.get("name") || "").trim();
  const handle = normalizeHandle(String(formData.get("handle") || ""));
  const tiktokProfileUrl =
    String(formData.get("tiktok_profile_url") || "").trim() || null;
  const email = String(formData.get("email") || "").trim() || null;
  const clientType = (String(formData.get("client_type") || "artist").trim() ||
    "artist") as ClientType;
  const internalNotes =
    String(formData.get("internal_notes") || "").trim() || null;

  if (!name) throw new Error("Name is required");
  if (name.length > 120) throw new Error("Name must be 120 characters or fewer");
  if (handle && !/^@[A-Za-z0-9._]{1,30}$/.test(handle)) {
    throw new Error("Enter a valid TikTok handle");
  }
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    throw new Error("Enter a valid email address");
  }
  if (tiktokProfileUrl) {
    try {
      const parsed = new URL(tiktokProfileUrl);
      if (
        parsed.protocol !== "https:" ||
        !(
          parsed.hostname === "tiktok.com" ||
          parsed.hostname.endsWith(".tiktok.com")
        )
      ) {
        throw new Error();
      }
    } catch {
      throw new Error("Enter a valid TikTok profile URL");
    }
  }
  if (internalNotes && internalNotes.length > 5000) {
    throw new Error("Internal notes must be 5,000 characters or fewer");
  }
  if (!CLIENT_ID_PATTERN.test(clientId)) {
    throw new Error("Invalid client identifier");
  }

  const avatarFile = portalImageFile(formData);
  const uploadedAvatar = await uploadClientAvatar(supabase, clientId, avatarFile);

  const payload = {
    id: clientId,
    name,
    handle: handle || null,
    profile_image_url: uploadedAvatar?.url ?? null,
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

  if (error) {
    if (uploadedAvatar) {
      await supabase.storage.from(PORTAL_BUCKET).remove([uploadedAvatar.path]);
    }
    throw new Error(error.message);
  }
  revalidatePath("/admin/clients");
  revalidatePath("/admin");
  redirect(`/admin/clients/${data.id}`);
}

export async function updateClientRecord(clientId: string, formData: FormData) {
  const supabase = await requireUser();
  const name = String(formData.get("name") || "").trim();
  const handle = normalizeHandle(String(formData.get("handle") || ""));
  const tiktokProfileUrl =
    String(formData.get("tiktok_profile_url") || "").trim() || null;
  const email = String(formData.get("email") || "").trim() || null;
  const clientType = (String(formData.get("client_type") || "artist").trim() ||
    "artist") as ClientType;
  const internalNotes =
    String(formData.get("internal_notes") || "").trim() || null;
  const removeProfileImage =
    String(formData.get("remove_profile_image") || "") === "1";

  if (!name) throw new Error("Name is required");
  if (name.length > 120) throw new Error("Name must be 120 characters or fewer");
  if (handle && !/^@[A-Za-z0-9._]{1,30}$/.test(handle)) {
    throw new Error("Enter a valid TikTok handle");
  }
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    throw new Error("Enter a valid email address");
  }
  if (tiktokProfileUrl) {
    try {
      const parsed = new URL(tiktokProfileUrl);
      if (
        parsed.protocol !== "https:" ||
        !(
          parsed.hostname === "tiktok.com" ||
          parsed.hostname.endsWith(".tiktok.com")
        )
      ) {
        throw new Error();
      }
    } catch {
      throw new Error("Enter a valid TikTok profile URL");
    }
  }
  if (internalNotes && internalNotes.length > 5000) {
    throw new Error("Internal notes must be 5,000 characters or fewer");
  }
  if (!CLIENT_ID_PATTERN.test(clientId)) throw new Error("Invalid client identifier");

  const { data: existing, error: existingError } = await supabase
    .from("clients")
    .select("profile_image_url")
    .eq("id", clientId)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (!existing) throw new Error("Client not found");

  const avatarFile = portalImageFile(formData);
  if (removeProfileImage && avatarFile) {
    throw new Error(
      "Choose either a replacement photo or remove the current photo",
    );
  }
  const uploadedAvatar = await uploadClientAvatar(supabase, clientId, avatarFile);
  const nextProfileImageUrl = removeProfileImage
    ? null
    : uploadedAvatar?.url ?? existing.profile_image_url;

  const { error } = await supabase
    .from("clients")
    .update({
      name,
      handle: handle || null,
      profile_image_url: nextProfileImageUrl,
      tiktok_profile_url: tiktokProfileUrl,
      email,
      client_type: ["artist", "manager", "label"].includes(clientType)
        ? clientType
        : "artist",
      internal_notes: internalNotes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", clientId);

  if (error) {
    if (uploadedAvatar) {
      await supabase.storage.from(PORTAL_BUCKET).remove([uploadedAvatar.path]);
    }
    throw new Error(error.message);
  }
  if (
    existing.profile_image_url &&
    (removeProfileImage || uploadedAvatar)
  ) {
    await removePortalAssetWithClient(supabase, existing.profile_image_url);
  }
  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${clientId}`);
  return { profileImageUrl: nextProfileImageUrl };
}

export async function createCampaignFromSound(formData: FormData) {
  const supabase = await requireUser();
  const clientId = String(formData.get("client_id") || "").trim();
  const soundUrl = String(formData.get("tiktok_sound_url") || "").trim();
  const budgetRaw = String(formData.get("budget") || "").trim();
  const targetRaw = String(formData.get("target_posts") || "").trim();
  const budget = Number(budgetRaw);
  const targetPosts = Number(targetRaw);

  if (!clientId) throw new Error("Select a client");
  if (!soundUrl) throw new Error("TikTok sound URL is required");
  if (!budgetRaw || !Number.isFinite(budget) || budget < 0 || budget > 100_000_000) {
    throw new Error("Enter a valid budget");
  }
  if (
    !targetRaw ||
    !Number.isInteger(targetPosts) ||
    targetPosts < 1 ||
    targetPosts > 10_000
  ) {
    throw new Error("Target posts must be a whole number between 1 and 10,000");
  }

  const { data: client } = await supabase
    .from("clients")
    .select("name")
    .eq("id", clientId)
    .is("archived_at", null)
    .single();
  if (!client) throw new Error("Client not found");

  const fetched = await tiktokProvider.getSound(soundUrl);
  if (!fetched.ok) throw new Error(fetched.error);

  const sound = fetched.data;
  const title = sound.title;
  const shareToken = createShareToken();

  const { data, error } = await supabase
    .from("campaigns")
    .insert({
      client_id: clientId,
      display_title: null,
      artwork_url: null,
      status: "active",
      budget,
      target_posts: targetPosts,
      tiktok_sound_url: sound.soundUrl,
      tiktok_sound_id: sound.soundId,
      sound_title: title,
      sound_artist: sound.artist,
      sound_artwork_url: sound.artworkUrl,
      sound_usage_count: sound.usageCount,
      share_token: shareToken,
      ended_at: null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await insertSoundSnapshot(
    supabase,
    data.id,
    sound.soundId,
    sound.usageCount,
  );
  await insertCampaignSnapshot(supabase, data.id);

  revalidatePath("/admin");
  revalidatePath(`/admin/clients/${clientId}`);
  // Land on Content so the next step is always "add TikTok posts".
  redirect(`/admin/campaigns/${data.id}?tab=content`);
}

export async function updateCampaignBudget(
  campaignId: string,
  formData: FormData,
) {
  const supabase = await requireUser();
  const budgetRaw = String(formData.get("budget") || "").trim();
  const budget = Number(budgetRaw);
  const targetRaw = String(formData.get("target_posts") || "").trim();
  const targetPosts = Number(targetRaw);
  const displayTitle =
    String(formData.get("display_title") || "").trim() || null;

  if (!budgetRaw || !Number.isFinite(budget) || budget < 0 || budget > 100_000_000) {
    throw new Error("Enter a valid budget");
  }
  if (
    !targetRaw ||
    !Number.isInteger(targetPosts) ||
    targetPosts < 1 ||
    targetPosts > 10_000
  ) {
    throw new Error("Target posts must be a whole number between 1 and 10,000");
  }
  if (displayTitle && displayTitle.length > 160) {
    throw new Error("Display title must be 160 characters or fewer");
  }

  const campaign = await campaignContext(supabase, campaignId);
  const { error } = await supabase
    .from("campaigns")
    .update({
      budget,
      target_posts: targetPosts,
      display_title: displayTitle,
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId);

  if (error) throw new Error(error.message);
  revalidateCampaign(campaignId, campaign.share_token);
  revalidatePath(`/admin/clients/${campaign.client_id}`);
}

/** Attach or replace the TikTok sound URL for a campaign (fetches metadata). */
export async function attachCampaignSound(campaignId: string, soundUrl: string) {
  const supabase = await requireUser();
  const url = soundUrl.trim();
  if (!url) throw new Error("TikTok sound URL is required");

  // Validate and fetch first. A failed replacement must not touch the current sound.
  const fetched = await tiktokProvider.getSound(url);
  if (!fetched.ok) throw new Error(fetched.error);
  const sound = fetched.data;

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select(
      "share_token, client_id, tiktok_sound_id, sound_title, sound_artist, sound_artwork_url, sound_usage_count, sound_title_override, sound_artist_override, artwork_url",
    )
    .eq("id", campaignId)
    .single();
  if (campaignError) throw new Error(campaignError.message);
  if (!campaign) throw new Error("Campaign not found");

  const sameSound = campaign.tiktok_sound_id === sound.soundId;

  const { error } = await supabase
    .from("campaigns")
    .update({
      tiktok_sound_url: sound.soundUrl,
      tiktok_sound_id: sound.soundId,
      sound_title: sound.title ?? (sameSound ? campaign.sound_title : null),
      sound_artist: sound.artist ?? (sameSound ? campaign.sound_artist : null),
      sound_artwork_url:
        sound.artworkUrl ?? (sameSound ? campaign.sound_artwork_url : null),
      sound_usage_count:
        sound.usageCount ?? (sameSound ? campaign.sound_usage_count : null),
      sound_title_override: sameSound
        ? campaign.sound_title_override
        : null,
      sound_artist_override: sameSound
        ? campaign.sound_artist_override
        : null,
      artwork_url: sameSound ? campaign.artwork_url : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId);
  if (error) throw new Error(error.message);

  if (!sameSound && campaign.artwork_url) {
    await removePortalAssetWithClient(supabase, campaign.artwork_url);
  }

  if (sound.usageCount != null) {
    await insertSoundSnapshot(
      supabase,
      campaignId,
      sound.soundId,
      sound.usageCount,
    );
  }

  revalidateCampaign(campaignId, campaign.share_token);
  revalidatePath(`/admin/clients/${campaign.client_id}`);
  return {
    sameSound,
    usageRetrieved: sound.usageCount != null,
    usageCount: sound.usageCount,
    sound,
  };
}

export async function refreshCampaignSound(campaignId: string) {
  const supabase = await requireUser();
  const result = await refreshCampaignSoundWithClient(supabase, campaignId);
  const campaign = await campaignContext(supabase, campaignId);
  revalidateCampaign(campaignId, campaign.share_token);
  revalidatePath(`/admin/clients/${campaign.client_id}`);
  return result;
}

export async function updateCampaignSoundDetails(
  campaignId: string,
  formData: FormData,
) {
  const supabase = await requireUser();
  const useTikTokMetadata =
    String(formData.get("use_tiktok_metadata") || "") === "1";
  const titleOverride = useTikTokMetadata
    ? null
    : String(formData.get("sound_title") || "").trim() || null;
  const artistOverride = useTikTokMetadata
    ? null
    : String(formData.get("sound_artist") || "").trim() || null;
  const removeArtwork =
    String(formData.get("remove_artwork") || "") === "1";

  if (titleOverride && titleOverride.length > 160) {
    throw new Error("Sound title must be 160 characters or fewer");
  }
  if (artistOverride && artistOverride.length > 120) {
    throw new Error("Artist name must be 120 characters or fewer");
  }

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select(
      "share_token, client_id, tiktok_sound_id, sound_title, sound_artist, sound_artwork_url, artwork_url",
    )
    .eq("id", campaignId)
    .single();
  if (campaignError) throw new Error(campaignError.message);
  if (!campaign?.tiktok_sound_id) throw new Error("This campaign has no TikTok sound.");

  const artworkFile = portalImageFile(formData, "sound_artwork_file");
  if (removeArtwork && artworkFile) {
    throw new Error("Choose either replacement artwork or remove the current artwork");
  }
  const uploadedArtwork = await uploadCampaignArtwork(
    supabase,
    campaignId,
    artworkFile,
  );
  const nextTitleOverride =
    titleOverride &&
    titleOverride !==
      (campaign.sound_title?.trim() || "")
      ? titleOverride
      : null;
  const nextArtistOverride =
    artistOverride &&
    artistOverride !==
      (campaign.sound_artist?.trim() || "")
      ? artistOverride
      : null;
  const nextArtworkUrl = removeArtwork
    ? null
    : uploadedArtwork?.url ?? campaign.artwork_url;

  const { error } = await supabase
    .from("campaigns")
    .update({
      sound_title_override: nextTitleOverride,
      sound_artist_override: nextArtistOverride,
      artwork_url: nextArtworkUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId);

  if (error) {
    if (uploadedArtwork) {
      await supabase.storage.from(PORTAL_BUCKET).remove([uploadedArtwork.path]);
    }
    throw new Error(error.message);
  }

  if (campaign.artwork_url && (removeArtwork || uploadedArtwork)) {
    await removePortalAssetWithClient(supabase, campaign.artwork_url);
  }

  revalidateCampaign(campaignId, campaign.share_token);
  revalidatePath(`/admin/clients/${campaign.client_id}`);
  return {
    title: nextTitleOverride ?? campaign.sound_title,
    artist: nextArtistOverride ?? campaign.sound_artist,
    artworkUrl: nextArtworkUrl ?? campaign.sound_artwork_url,
  };
}

export async function removeCampaignSound(campaignId: string) {
  const supabase = await requireUser();
  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("share_token, client_id, artwork_url")
    .eq("id", campaignId)
    .single();
  if (campaignError) throw new Error(campaignError.message);
  if (!campaign) throw new Error("Campaign not found");

  const { error } = await supabase
    .from("campaigns")
    .update({
      tiktok_sound_url: null,
      tiktok_sound_id: null,
      sound_title: null,
      sound_artist: null,
      sound_title_override: null,
      sound_artist_override: null,
      sound_artwork_url: null,
      sound_usage_count: null,
      artwork_url: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId);
  if (error) throw new Error(error.message);

  if (campaign.artwork_url) {
    await removePortalAssetWithClient(supabase, campaign.artwork_url);
  }
  revalidateCampaign(campaignId, campaign.share_token);
  revalidatePath(`/admin/clients/${campaign.client_id}`);
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
  if (parsed.kind !== "post" && parsed.kind !== "short") {
    return { status: "invalid", url, error: "Invalid TikTok post URL." };
  }

  if (parsed.kind === "post") {
    const { data: existing, error: existingError } = await supabase
      .from("tiktok_posts")
      .select("id")
      .eq("campaign_id", campaignId)
      .eq("tiktok_post_id", parsed.postId)
      .maybeSingle();
    if (existingError) {
      return { status: "failed", url, error: existingError.message };
    }
    if (existing) {
      return { status: "duplicate", url, postId: parsed.postId };
    }
  }

  const fetched = await tiktokProvider.getPost(url);
  if (!fetched.ok) {
    return { status: "failed", url, error: fetched.error };
  }

  const post = fetched.data;
  const { data: resolvedExisting, error: resolvedExistingError } = await supabase
    .from("tiktok_posts")
    .select("id")
    .eq("campaign_id", campaignId)
    .eq("tiktok_post_id", post.postId)
    .maybeSingle();
  if (resolvedExistingError) {
    return { status: "failed", url, error: resolvedExistingError.message };
  }
  if (resolvedExisting) {
    return { status: "duplicate", url, postId: post.postId };
  }

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
      last_sync_status: post.metricsComplete ? "ok" : "failed",
      last_sync_error: post.metricsComplete
        ? null
        : "TikTok returned the post but not engagement metrics.",
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

  // Backfill sound artwork / TikTok Creations from post music metadata when available
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("sound_artwork_url, artwork_url, tiktok_sound_id, sound_usage_count")
    .eq("id", campaignId)
    .single();

  const updates: {
    last_synced_at: string;
    sound_artwork_url?: string;
    sound_usage_count?: number;
  } = {
    last_synced_at: now,
  };
  if (
    !campaign?.sound_artwork_url &&
    post.musicArtworkUrl &&
    post.musicId &&
    campaign?.tiktok_sound_id === post.musicId
  ) {
    updates.sound_artwork_url = post.musicArtworkUrl;
  }
  if (
    post.musicVideoCount != null &&
    post.musicVideoCount > 0 &&
    post.musicId &&
    (!campaign?.tiktok_sound_id || campaign.tiktok_sound_id === post.musicId)
  ) {
    updates.sound_usage_count = post.musicVideoCount;
    await insertSoundSnapshot(
      supabase,
      campaignId,
      post.musicId || campaign?.tiktok_sound_id,
      post.musicVideoCount,
    );
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

export async function importTikTokPostsByUrls(
  campaignId: string,
  paste: string,
) {
  const supabase = await requireUser();
  const analysis = analyzePasteUrls(paste);
  if (analysis.totalNonEmptyLines === 0) {
    throw new Error("Paste at least one TikTok post URL.");
  }

  const results: AddPostResult[] = analysis.invalidUrls.map(({ value, reason }) => ({
    status: "invalid",
    url: value,
    error: reason,
  }));
  const concurrency = 4;
  for (let index = 0; index < analysis.uniqueUrls.length; index += concurrency) {
    const batch = analysis.uniqueUrls.slice(index, index + concurrency);
    results.push(
      ...(await Promise.all(
        batch.map((url) => addFetchedPost(supabase, campaignId, url)),
      )),
    );
  }

  await touchCampaign(supabase, campaignId);
  await insertCampaignSnapshot(supabase, campaignId);
  const campaign = await campaignContext(supabase, campaignId);
  revalidateCampaign(campaignId, campaign.share_token);
  revalidatePath(`/admin/clients/${campaign.client_id}`);

  const added = results.filter((r) => r.status === "added").length;
  const alreadyTracked = results.filter((r) => r.status === "duplicate").length;
  const failed = results.filter(
    (r) => r.status === "failed" || r.status === "invalid",
  ).length;

  return {
    results,
    analysis,
    summary: {
      added,
      alreadyTracked,
      pasteDuplicates: analysis.pasteDuplicateCount,
      failed,
      processed: results.length,
    },
  };
}

export async function createTikTokPostManual(
  campaignId: string,
  formData: FormData,
) {
  const supabase = await requireUser();
  const postUrl = String(formData.get("post_url") || "").trim();
  const parsed = parseTikTokPostUrl(postUrl);
  if (parsed.kind !== "post") {
    throw new Error("Enter a full TikTok post URL for manual entry");
  }
  const tiktokPostId = parsed.postId;

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
    post_url: parsed.canonicalUrl,
    tiktok_post_id: tiktokPostId,
    creator_handle: normalizeHandle(String(formData.get("creator_handle") || "")),
    creator_display_name:
      String(formData.get("creator_display_name") || "").trim() || null,
    title: String(formData.get("title") || "").trim() || null,
    posted_at: optionalDateTime(formData, "posted_at"),
    views: nonNegativeInteger(formData, "views"),
    likes: nonNegativeInteger(formData, "likes"),
    comments: nonNegativeInteger(formData, "comments"),
    shares: nonNegativeInteger(formData, "shares"),
    thumbnail_url: optionalHttpUrl(formData, "thumbnail_url"),
    last_synced_at: new Date().toISOString(),
    last_sync_status: "ok",
    last_sync_error: null,
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
  await touchCampaign(supabase, campaignId);
  await insertCampaignSnapshot(supabase, campaignId);
  const campaign = await campaignContext(supabase, campaignId);
  revalidateCampaign(campaignId, campaign.share_token);
  revalidatePath(`/admin/clients/${campaign.client_id}`);
}

export async function updateTikTokPostManual(
  postId: string,
  campaignId: string,
  formData: FormData,
) {
  const supabase = await requireUser();
  const postUrl = String(formData.get("post_url") || "").trim();
  const parsed = parseTikTokPostUrl(postUrl);
  if (parsed.kind !== "post") {
    throw new Error("Enter a full TikTok post URL");
  }
  const payload = {
    post_url: parsed.canonicalUrl,
    tiktok_post_id: parsed.postId,
    creator_handle: normalizeHandle(String(formData.get("creator_handle") || "")),
    creator_display_name:
      String(formData.get("creator_display_name") || "").trim() || null,
    title: String(formData.get("title") || "").trim() || null,
    posted_at: optionalDateTime(formData, "posted_at"),
    views: nonNegativeInteger(formData, "views"),
    likes: nonNegativeInteger(formData, "likes"),
    comments: nonNegativeInteger(formData, "comments"),
    shares: nonNegativeInteger(formData, "shares"),
    thumbnail_url: optionalHttpUrl(formData, "thumbnail_url"),
    last_synced_at: new Date().toISOString(),
    last_sync_status: "ok",
    last_sync_error: null,
    updated_at: new Date().toISOString(),
  };
  if (!payload.creator_handle) throw new Error("Creator is required");

  const { error } = await supabase
    .from("tiktok_posts")
    .update(payload)
    .eq("id", postId)
    .eq("campaign_id", campaignId);
  if (error) throw new Error(error.message);

  await insertSnapshot(supabase, postId, payload);
  await touchCampaign(supabase, campaignId);
  await insertCampaignSnapshot(supabase, campaignId);
  const campaign = await campaignContext(supabase, campaignId);
  revalidateCampaign(campaignId, campaign.share_token);
  revalidatePath(`/admin/clients/${campaign.client_id}`);
}

export async function deleteTikTokPost(postId: string, campaignId: string) {
  const supabase = await requireUser();
  const { error } = await supabase
    .from("tiktok_posts")
    .delete()
    .eq("id", postId)
    .eq("campaign_id", campaignId);
  if (error) throw new Error(error.message);
  await touchCampaign(supabase, campaignId);
  await insertCampaignSnapshot(supabase, campaignId);
  const campaign = await campaignContext(supabase, campaignId);
  revalidateCampaign(campaignId, campaign.share_token);
  revalidatePath(`/admin/clients/${campaign.client_id}`);
}

export async function refreshTikTokPost(postId: string, campaignId: string) {
  const supabase = await requireUser();
  const data = await refreshTikTokPostWithClient(supabase, postId, campaignId);
  await insertCampaignSnapshot(supabase, campaignId);
  const campaign = await campaignContext(supabase, campaignId);
  revalidateCampaign(campaignId, campaign.share_token);
  revalidatePath(`/admin/clients/${campaign.client_id}`);
  return data;
}

export async function refreshCampaignPosts(campaignId: string) {
  const supabase = await requireUser();
  const result = await refreshCampaignPostsWithClient(supabase, campaignId);
  const campaign = await campaignContext(supabase, campaignId);
  revalidateCampaign(campaignId, campaign.share_token);
  revalidatePath(`/admin/clients/${campaign.client_id}`);
  return result;
}

/** Refresh sound + posts independently. Partial failure is allowed. */
export async function refreshCampaignData(campaignId: string) {
  const supabase = await requireUser();
  const result = await refreshCampaignDataWithClient(supabase, campaignId);
  const campaign = await campaignContext(supabase, campaignId);
  revalidateCampaign(campaignId, campaign.share_token);
  revalidatePath(`/admin/clients/${campaign.client_id}`);
  return result;
}

export async function refreshFailedCampaignPosts(
  campaignId: string,
  postIds: string[],
) {
  if (postIds.length === 0) {
    return refreshCampaignPosts(campaignId);
  }
  return refreshSelectedCampaignPosts(campaignId, postIds);
}

export async function refreshSelectedCampaignPosts(
  campaignId: string,
  postIds: string[],
) {
  const supabase = await requireUser();
  const ids = [...new Set(postIds.filter(Boolean))];
  if (ids.length === 0) {
    return {
      total: 0,
      updated: 0,
      failed: 0,
      failedPostIds: [] as string[],
      before: calculateMetrics([]),
      after: calculateMetrics([]),
    };
  }

  const { data: allPosts, error: beforeError } = await supabase
    .from("tiktok_posts")
    .select("views, likes, comments, shares")
    .eq("campaign_id", campaignId);
  if (beforeError) throw new Error(beforeError.message);
  const before = calculateMetrics(allPosts ?? []);

  let updated = 0;
  let failed = 0;
  const failedPostIds: string[] = [];

  for (const id of ids) {
    try {
      await refreshTikTokPostWithClient(supabase, id, campaignId);
      updated += 1;
    } catch {
      failed += 1;
      failedPostIds.push(id);
    }
  }

  const { data: afterPosts, error: afterError } = await supabase
    .from("tiktok_posts")
    .select("views, likes, comments, shares")
    .eq("campaign_id", campaignId);
  if (afterError) throw new Error(afterError.message);
  const after = calculateMetrics(afterPosts ?? []);
  await insertCampaignSnapshot(supabase, campaignId);
  const now = new Date().toISOString();
  await supabase
    .from("campaigns")
    .update({ last_synced_at: now, updated_at: now })
    .eq("id", campaignId);

  const campaign = await campaignContext(supabase, campaignId);
  revalidateCampaign(campaignId, campaign.share_token);
  revalidatePath(`/admin/clients/${campaign.client_id}`);

  return {
    total: ids.length,
    updated,
    failed,
    failedPostIds,
    before,
    after,
  };
}

export async function deleteSelectedTikTokPosts(
  campaignId: string,
  postIds: string[],
) {
  const supabase = await requireUser();
  const ids = [...new Set(postIds.filter(Boolean))];
  if (ids.length === 0) return { deleted: 0 };

  const { data: deletedRows, error } = await supabase
    .from("tiktok_posts")
    .delete()
    .eq("campaign_id", campaignId)
    .in("id", ids)
    .select("id");
  if (error) throw new Error(error.message);

  await touchCampaign(supabase, campaignId);
  await insertCampaignSnapshot(supabase, campaignId);
  const campaign = await campaignContext(supabase, campaignId);
  revalidateCampaign(campaignId, campaign.share_token);
  revalidatePath(`/admin/clients/${campaign.client_id}`);
  return { deleted: deletedRows?.length ?? 0 };
}

export async function endCampaign(campaignId: string) {
  const supabase = await requireUser();
  const campaign = await campaignContext(supabase, campaignId);

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("campaigns")
    .update({
      status: "ended",
      ended_at: now,
      updated_at: now,
    })
    .eq("id", campaignId)
    .eq("status", "active");
  if (error) throw new Error(error.message);

  revalidateCampaign(campaignId, campaign.share_token);
  revalidatePath("/admin/clients");
}

export async function reopenCampaign(campaignId: string) {
  const supabase = await requireUser();
  const campaign = await campaignContext(supabase, campaignId);
  if (campaign.trashed_at) {
    throw new Error("Restore this campaign from Trash before reopening it");
  }
  const { error } = await supabase
    .from("campaigns")
    .update({
      status: "active",
      ended_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId)
    .eq("status", "ended");
  if (error) throw new Error(error.message);

  revalidateCampaign(campaignId, campaign.share_token);
  revalidatePath("/admin/clients");
  return campaign.share_token;
}

export async function archiveClient(clientId: string) {
  const supabase = await requireUser();
  const { error } = await supabase
    .from("clients")
    .update({
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", clientId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/admin");
}

export async function restoreClient(clientId: string) {
  const supabase = await requireUser();
  const { error } = await supabase
    .from("clients")
    .update({ archived_at: null, updated_at: new Date().toISOString() })
    .eq("id", clientId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/admin");
}

export async function permanentlyDeleteClient(clientId: string) {
  const supabase = await requireUser();
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("profile_image_url")
    .eq("id", clientId)
    .maybeSingle();
  if (clientError) throw new Error(clientError.message);
  if (!client) throw new Error("Client not found");
  const { count } = await supabase
    .from("campaigns")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId);
  if ((count ?? 0) > 0) {
    throw new Error(
      "This client has existing campaigns and cannot be permanently deleted. Archive the client instead.",
    );
  }
  const { error } = await supabase.from("clients").delete().eq("id", clientId);
  if (error) throw new Error(error.message);
  if (client.profile_image_url) {
    await removePortalAssetWithClient(supabase, client.profile_image_url);
  }
  revalidatePath("/admin/clients");
  revalidatePath("/admin");
  redirect("/admin/clients");
}

export async function trashCampaign(campaignId: string) {
  const supabase = await requireUser();
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("share_token, client_id, status")
    .eq("id", campaignId)
    .single();
  if (!campaign) throw new Error("Campaign not found");

  const { error } = await supabase
    .from("campaigns")
    .update({
      status: "ended",
      ended_at:
        campaign.status === "active" ? new Date().toISOString() : undefined,
      trashed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId);
  if (error) throw new Error(error.message);
  revalidateCampaign(campaignId, campaign.share_token);
  revalidatePath(`/admin/clients/${campaign.client_id}`);
  redirect("/admin?view=trash");
}

export async function restoreCampaign(campaignId: string) {
  const supabase = await requireUser();
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("share_token, client_id")
    .eq("id", campaignId)
    .single();
  if (!campaign) throw new Error("Campaign not found");

  const { error } = await supabase
    .from("campaigns")
    .update({
      trashed_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId);
  if (error) throw new Error(error.message);
  revalidateCampaign(campaignId, campaign.share_token);
  revalidatePath(`/admin/clients/${campaign.client_id}`);
}

export async function permanentlyDeleteCampaign(campaignId: string) {
  const supabase = await requireUser();
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("client_id, share_token, trashed_at")
    .eq("id", campaignId)
    .single();
  if (!campaign) throw new Error("Campaign not found");
  if (!campaign.trashed_at) {
    throw new Error("Move the campaign to Trash before permanently deleting it.");
  }

  const { error } = await supabase.from("campaigns").delete().eq("id", campaignId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
  revalidatePath(`/admin/clients/${campaign.client_id}`);
  if (campaign.share_token) revalidatePath(`/report/${campaign.share_token}`);
  redirect("/admin?view=trash");
}

export async function moveCampaign(campaignId: string, newClientId: string) {
  const supabase = await requireUser();
  if (!newClientId) throw new Error("Select a client");

  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("id", newClientId)
    .is("archived_at", null)
    .single();
  if (!client) throw new Error("Client not found");

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("client_id, share_token")
    .eq("id", campaignId)
    .single();
  if (!campaign) throw new Error("Campaign not found");

  const { error } = await supabase
    .from("campaigns")
    .update({
      client_id: newClientId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId);
  if (error) throw new Error(error.message);

  revalidateCampaign(campaignId, campaign.share_token);
  revalidatePath(`/admin/clients/${campaign.client_id}`);
  revalidatePath(`/admin/clients/${newClientId}`);
}

const PORTAL_BUCKET = "portal-assets";
const PORTAL_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const PORTAL_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const CLIENT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CLIENT_AVATAR_PATH =
  /^clients\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/avatar(?:-[0-9a-f-]{36})?\.jpg$/i;
const CAMPAIGN_ARTWORK_PATH =
  /^campaigns\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/sound-artwork-[0-9a-f-]{36}\.jpg$/i;

function assertPortalAssetPath(path: string) {
  if (!CLIENT_AVATAR_PATH.test(path) && !CAMPAIGN_ARTWORK_PATH.test(path)) {
    throw new Error("Invalid upload destination");
  }
}

function portalImageFile(
  formData: FormData,
  key = "profile_image_file",
): File | null {
  const file = formData.get(key);
  if (!file || typeof file === "string" || file.size === 0) return null;
  if (!PORTAL_IMAGE_TYPES.has(file.type)) {
    throw new Error("Use a JPG, PNG or WEBP image.");
  }
  if (file.size > PORTAL_IMAGE_MAX_BYTES) {
    throw new Error("Image must be under 5MB.");
  }
  return file;
}

async function uploadClientAvatar(
  supabase: Awaited<ReturnType<typeof createAdminClient>>,
  clientId: string,
  file: File | null,
) {
  if (!file) return null;
  const path = `clients/${clientId}/avatar-${crypto.randomUUID()}.jpg`;
  assertPortalAssetPath(path);
  const { error } = await supabase.storage.from(PORTAL_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
    cacheControl: "3600",
  });
  if (error) throw new Error(error.message || "Upload failed.");
  const { data } = supabase.storage.from(PORTAL_BUCKET).getPublicUrl(path);
  return { path, url: data.publicUrl };
}

async function uploadCampaignArtwork(
  supabase: Awaited<ReturnType<typeof createAdminClient>>,
  campaignId: string,
  file: File | null,
) {
  if (!file) return null;
  const path = `campaigns/${campaignId}/sound-artwork-${crypto.randomUUID()}.jpg`;
  assertPortalAssetPath(path);
  const { error } = await supabase.storage.from(PORTAL_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
    cacheControl: "3600",
  });
  if (error) throw new Error(error.message || "Upload failed.");
  const { data } = supabase.storage.from(PORTAL_BUCKET).getPublicUrl(path);
  return { path, url: data.publicUrl };
}

async function removePortalAssetWithClient(
  supabase: Awaited<ReturnType<typeof createAdminClient>>,
  url: string,
) {
  const parsed = new URL(url);
  const marker = `/object/public/${PORTAL_BUCKET}/`;
  const idx = parsed.pathname.indexOf(marker);
  if (idx < 0) return;
  const path = decodeURIComponent(parsed.pathname.slice(idx + marker.length));
  assertPortalAssetPath(path);
  const { error } = await supabase.storage.from(PORTAL_BUCKET).remove([path]);
  if (error) {
    console.error("Could not remove old portal asset", error.message);
  }
}

