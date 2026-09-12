/**
 * Campaign refresh internals, shared by the admin server actions and the
 * scheduled refresh route.
 *
 * These helpers take an explicit Supabase client so they can run either as an
 * authenticated admin action or as a sessionless scheduled job. They are
 * deliberately kept out of the `"use server"` module: exporting them from there
 * would publish them as unauthenticated server-action endpoints.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateMetrics } from "@/lib/portal/metrics";
import type { Database } from "@/lib/supabase/database.types";
import { tiktokProvider } from "@/lib/tiktok/provider";

export type PortalClient = SupabaseClient<Database>;

export async function insertSnapshot(
  supabase: PortalClient,
  postId: string,
  metrics: { views: number; likes: number; comments: number; shares: number },
) {
  const { data: latest, error: latestError } = await supabase
    .from("post_metric_snapshots")
    .select("views, likes, comments, shares")
    .eq("post_id", postId)
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestError) throw new Error(latestError.message);
  if (
    latest &&
    Number(latest.views) === metrics.views &&
    Number(latest.likes) === metrics.likes &&
    Number(latest.comments) === metrics.comments &&
    Number(latest.shares) === metrics.shares
  ) {
    return;
  }
  const { error } = await supabase.from("post_metric_snapshots").insert({
    post_id: postId,
    views: metrics.views,
    likes: metrics.likes,
    comments: metrics.comments,
    shares: metrics.shares,
  });
  if (error && error.code !== "23505") throw new Error(error.message);
}

export async function insertSoundSnapshot(
  supabase: PortalClient,
  campaignId: string,
  soundId: string | null | undefined,
  creationCount: number | null | undefined,
) {
  if (creationCount == null || !Number.isFinite(creationCount) || creationCount < 0) {
    return;
  }
  const next = Math.round(creationCount);
  const { data: latest, error: latestError } = await supabase
    .from("sound_metric_snapshots")
    .select("sound_id, creation_count")
    .eq("campaign_id", campaignId)
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestError) throw new Error(latestError.message);
  if (
    latest &&
    latest.sound_id === (soundId ?? null) &&
    Number(latest.creation_count) === next
  ) {
    return;
  }
  const { error } = await supabase.from("sound_metric_snapshots").insert({
    campaign_id: campaignId,
    sound_id: soundId ?? null,
    creation_count: next,
  });
  if (error && error.code !== "23505") throw new Error(error.message);
}

export async function insertCampaignSnapshot(
  supabase: PortalClient,
  campaignId: string,
) {
  const { data: posts, error: postsError } = await supabase
    .from("tiktok_posts")
    .select("views, likes, comments, shares")
    .eq("campaign_id", campaignId);
  if (postsError) throw new Error(postsError.message);
  const metrics = calculateMetrics(posts ?? []);
  const { data: latest, error: latestError } = await supabase
    .from("campaign_metric_snapshots")
    .select("tracked_posts, views, likes, comments, shares")
    .eq("campaign_id", campaignId)
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestError) throw new Error(latestError.message);
  if (
    latest &&
    Number(latest.tracked_posts) === metrics.posts &&
    Number(latest.views) === metrics.views &&
    Number(latest.likes) === metrics.likes &&
    Number(latest.comments) === metrics.comments &&
    Number(latest.shares) === metrics.shares
  ) {
    return metrics;
  }
  const { error } = await supabase.from("campaign_metric_snapshots").insert({
    campaign_id: campaignId,
    tracked_posts: metrics.posts,
    views: metrics.views,
    likes: metrics.likes,
    comments: metrics.comments,
    shares: metrics.shares,
    engagement_rate: metrics.engagementRate,
  });
  if (error && error.code !== "23505") throw new Error(error.message);
  return metrics;
}

export async function refreshCampaignSoundWithClient(
  supabase: PortalClient,
  campaignId: string,
) {
  const { data: campaign } = await supabase
    .from("campaigns")
    .select(
      "tiktok_sound_url, tiktok_sound_id, sound_title, sound_artist, sound_artwork_url, sound_usage_count, share_token",
    )
    .eq("id", campaignId)
    .single();
  if (!campaign?.tiktok_sound_url) {
    throw new Error("This campaign has no TikTok sound URL.");
  }

  const fetched = await tiktokProvider.refreshSound(campaign.tiktok_sound_url);
  if (!fetched.ok) throw new Error(fetched.error);

  const sound = fetched.data;
  if (campaign.tiktok_sound_id && sound.soundId !== campaign.tiktok_sound_id) {
    throw new Error(
      "This URL now resolves to a different TikTok sound. Use Change Sound to review it first.",
    );
  }
  const nextUsage =
    sound.usageCount != null ? sound.usageCount : campaign.sound_usage_count;

  const update: {
    tiktok_sound_url: string;
    tiktok_sound_id: string;
    sound_usage_count: number | null;
    updated_at: string;
    sound_title?: string;
    sound_artist?: string;
    sound_artwork_url?: string;
  } = {
    tiktok_sound_url: sound.soundUrl,
    tiktok_sound_id: sound.soundId,
    sound_usage_count: nextUsage,
    updated_at: new Date().toISOString(),
  };
  if (sound.title) update.sound_title = sound.title;
  if (sound.artist) update.sound_artist = sound.artist;
  if (sound.artworkUrl) update.sound_artwork_url = sound.artworkUrl;

  const { error } = await supabase
    .from("campaigns")
    .update(update)
    .eq("id", campaignId);

  if (error) throw new Error(error.message);

  if (sound.usageCount != null) {
    await insertSoundSnapshot(
      supabase,
      campaignId,
      sound.soundId,
      sound.usageCount,
    );
  }

  return {
    sound,
    usageCount: nextUsage,
    usageRetrieved: sound.usageCount != null,
  };
}

export async function refreshTikTokPostWithClient(
  supabase: PortalClient,
  postId: string,
  campaignId: string,
) {
  const { data: post } = await supabase
    .from("tiktok_posts")
    .select("*")
    .eq("id", postId)
    .eq("campaign_id", campaignId)
    .single();
  if (!post) throw new Error("Post not found");

  const fetched = await tiktokProvider.refreshPost(post.post_url);
  if (!fetched.ok) {
    await supabase
      .from("tiktok_posts")
      .update({
        last_sync_status: "failed",
        last_sync_error: fetched.error,
        updated_at: new Date().toISOString(),
      })
      .eq("id", postId);
    throw new Error(fetched.error);
  }
  if (!fetched.data.metricsComplete) {
    await supabase
      .from("tiktok_posts")
      .update({
        last_sync_status: "failed",
        last_sync_error:
          "TikTok returned the post but not engagement metrics. Try again shortly or edit manually.",
        updated_at: new Date().toISOString(),
      })
      .eq("id", postId);
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
      last_sync_status: "ok",
      last_sync_error: null,
      updated_at: now,
    })
    .eq("id", postId);
  if (error) throw new Error(error.message);

  await insertSnapshot(supabase, postId, data);
  await supabase
    .from("campaigns")
    .update({ last_synced_at: now, updated_at: now })
    .eq("id", campaignId);

  return data;
}

export async function refreshCampaignPostsWithClient(
  supabase: PortalClient,
  campaignId: string,
) {
  const { data: posts, error: postsError } = await supabase
    .from("tiktok_posts")
    .select("*")
    .eq("campaign_id", campaignId);
  if (postsError) throw new Error(postsError.message);

  const list = posts ?? [];
  const before = calculateMetrics(list);
  let updated = 0;
  let failed = 0;
  const failedPostIds: string[] = [];

  for (const post of list) {
    try {
      await refreshTikTokPostWithClient(supabase, post.id, campaignId);
      updated += 1;
    } catch {
      failed += 1;
      failedPostIds.push(post.id);
    }
  }

  const after = await insertCampaignSnapshot(supabase, campaignId);
  const now = new Date().toISOString();
  await supabase
    .from("campaigns")
    .update({ last_synced_at: now, updated_at: now })
    .eq("id", campaignId);

  return {
    total: list.length,
    updated,
    failed,
    failedPostIds,
    before,
    after,
  };
}

export type CampaignRefreshResult = {
  sound: {
    ok: boolean;
    error?: string;
    before: number | null;
    after: number | null;
    usageRetrieved: boolean;
    skipped?: boolean;
  };
  posts: Awaited<ReturnType<typeof refreshCampaignPostsWithClient>> & {
    error?: string;
  };
};

/** Refresh sound + posts independently. Partial failure is allowed. */
export async function refreshCampaignDataWithClient(
  supabase: PortalClient,
  campaignId: string,
): Promise<CampaignRefreshResult> {
  const { data: beforeCampaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("sound_usage_count, tiktok_sound_url")
    .eq("id", campaignId)
    .single();
  if (campaignError) throw new Error(campaignError.message);

  const soundResult: CampaignRefreshResult["sound"] = {
    ok: false,
    before: beforeCampaign?.sound_usage_count ?? null,
    after: beforeCampaign?.sound_usage_count ?? null,
    usageRetrieved: false,
  };

  if (!beforeCampaign?.tiktok_sound_url) {
    soundResult.ok = true;
    soundResult.skipped = true;
  } else {
    try {
      const sound = await refreshCampaignSoundWithClient(supabase, campaignId);
      soundResult.ok = true;
      soundResult.after = sound.usageCount ?? null;
      soundResult.usageRetrieved = sound.usageRetrieved;
    } catch (error) {
      soundResult.ok = false;
      soundResult.error =
        error instanceof Error ? error.message : "Sound refresh failed";
    }
  }

  let postsResult: CampaignRefreshResult["posts"];
  try {
    postsResult = await refreshCampaignPostsWithClient(supabase, campaignId);
  } catch (error) {
    postsResult = {
      total: 0,
      updated: 0,
      failed: 0,
      failedPostIds: [],
      before: calculateMetrics([]),
      after: calculateMetrics([]),
      error: error instanceof Error ? error.message : "Post refresh failed",
    };
  }

  return { sound: soundResult, posts: postsResult };
}
