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
import {
  getCampaignStartTikTokAudiencePoint,
  getLatestTikTokAudiencePoint,
  resolveSoundchartsSong,
  type SoundchartsAudiencePoint,
} from "@/lib/soundcharts/client";
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

async function upsertSoundchartsSnapshot(
  supabase: PortalClient,
  campaignId: string,
  soundId: string,
  point: SoundchartsAudiencePoint,
  checkedAt: string,
) {
  const key = {
    campaign_id: campaignId,
    sound_id: soundId,
    provider_data_date: point.providerDataDate,
  };
  const { data: existing, error: existingError } = await supabase
    .from("sound_metric_snapshots")
    .select("id")
    .eq("campaign_id", key.campaign_id)
    .eq("sound_id", key.sound_id)
    .eq("provider_data_date", key.provider_data_date)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);

  if (existing) {
    const { error } = await supabase
      .from("sound_metric_snapshots")
      .update({
        creation_count: point.creationCount,
        checked_at: checkedAt,
      })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    return { inserted: false };
  }

  const { error } = await supabase.from("sound_metric_snapshots").insert({
    ...key,
    creation_count: point.creationCount,
    checked_at: checkedAt,
  });
  if (!error) return { inserted: true };
  if (error.code !== "23505") throw new Error(error.message);

  // A concurrent refresh inserted this provider day after our initial read.
  // Update that row instead of adding a second progress point.
  const { error: updateError } = await supabase
    .from("sound_metric_snapshots")
    .update({
      creation_count: point.creationCount,
      checked_at: checkedAt,
    })
    .eq("campaign_id", key.campaign_id)
    .eq("sound_id", key.sound_id)
    .eq("provider_data_date", key.provider_data_date);
  if (updateError) throw new Error(updateError.message);
  return { inserted: false };
}

export type SoundchartsRefreshResult = {
  skipped: boolean;
  songUuid: string | null;
  creationCount: number | null;
  providerDataDate: string | null;
  checkedAt: string | null;
  inserted: boolean;
  baselineInserted: boolean;
};

/**
 * Resolve/cache the Soundcharts song and persist provider-dated TikTok video
 * totals. A stale provider date is retained as stale; the Katalyst check time
 * never substitutes for the date of the actual Soundcharts datapoint.
 */
export async function refreshCampaignSoundchartsWithClient(
  supabase: PortalClient,
  campaignId: string,
): Promise<SoundchartsRefreshResult> {
  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select(
      "created_at, tiktok_sound_id, soundcharts_song_uuid, sound_usage_count",
    )
    .eq("id", campaignId)
    .single();
  if (campaignError) throw new Error(campaignError.message);
  if (!campaign?.tiktok_sound_id) {
    return {
      skipped: true,
      songUuid: null,
      creationCount: campaign?.sound_usage_count ?? null,
      providerDataDate: null,
      checkedAt: null,
      inserted: false,
      baselineInserted: false,
    };
  }

  const soundId = campaign.tiktok_sound_id;
  let songUuid = campaign.soundcharts_song_uuid;
  if (!songUuid) {
    const resolved = await resolveSoundchartsSong(soundId);
    songUuid = resolved.uuid;
    const { error } = await supabase
      .from("campaigns")
      .update({ soundcharts_song_uuid: songUuid })
      .eq("id", campaignId)
      .eq("tiktok_sound_id", soundId);
    if (error) throw new Error(error.message);
  }

  const today = new Date().toISOString().slice(0, 10);
  const campaignStartDate = new Date(campaign.created_at)
    .toISOString()
    .slice(0, 10);
  const latest = await getLatestTikTokAudiencePoint(
    songUuid,
    soundId,
    today,
  );
  if (!latest) {
    return {
      skipped: false,
      songUuid,
      creationCount: campaign.sound_usage_count,
      providerDataDate: null,
      checkedAt: new Date().toISOString(),
      inserted: false,
      baselineInserted: false,
    };
  }

  const checkedAt = new Date().toISOString();
  const { count: existingProviderPoints, error: historyError } = await supabase
    .from("sound_metric_snapshots")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("sound_id", soundId)
    .not("provider_data_date", "is", null);
  if (historyError) throw new Error(historyError.message);

  let baselineInserted = false;
  if ((existingProviderPoints ?? 0) === 0) {
    const baseline = await getCampaignStartTikTokAudiencePoint(
      songUuid,
      soundId,
      campaignStartDate,
      today,
    );
    if (
      baseline &&
      baseline.providerDataDate !== latest.providerDataDate
    ) {
      const baselineWrite = await upsertSoundchartsSnapshot(
        supabase,
        campaignId,
        soundId,
        baseline,
        checkedAt,
      );
      baselineInserted = baselineWrite.inserted;
    }
  }

  const latestWrite = await upsertSoundchartsSnapshot(
    supabase,
    campaignId,
    soundId,
    latest,
    checkedAt,
  );
  const { error: updateError } = await supabase
    .from("campaigns")
    .update({
      sound_usage_count: latest.creationCount,
      updated_at: checkedAt,
    })
    .eq("id", campaignId)
    .eq("tiktok_sound_id", soundId);
  if (updateError) throw new Error(updateError.message);

  return {
    skipped: false,
    songUuid,
    creationCount: latest.creationCount,
    providerDataDate: latest.providerDataDate,
    checkedAt,
    inserted: latestWrite.inserted,
    baselineInserted,
  };
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
  // TikTok's HTML is still useful for display metadata, but Soundcharts is
  // now the authoritative source for reportable creation counts.
  const nextUsage = campaign.sound_usage_count;

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

  return {
    sound,
    usageCount: nextUsage,
    usageRetrieved: false,
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
    songUuid?: string | null;
    providerDataDate?: string | null;
    checkedAt?: string | null;
    snapshotInserted?: boolean;
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
    .select("sound_usage_count, tiktok_sound_url, tiktok_sound_id")
    .eq("id", campaignId)
    .single();
  if (campaignError) throw new Error(campaignError.message);

  const soundResult: CampaignRefreshResult["sound"] = {
    ok: false,
    before: beforeCampaign?.sound_usage_count ?? null,
    after: beforeCampaign?.sound_usage_count ?? null,
    usageRetrieved: false,
  };

  const soundErrors: string[] = [];
  if (beforeCampaign?.tiktok_sound_url) {
    try {
      await refreshCampaignSoundWithClient(supabase, campaignId);
    } catch (error) {
      soundErrors.push(
        error instanceof Error ? error.message : "Sound refresh failed",
      );
    }
  }

  if (beforeCampaign?.tiktok_sound_id) {
    try {
      const tracked = await refreshCampaignSoundchartsWithClient(
        supabase,
        campaignId,
      );
      soundResult.after = tracked.creationCount;
      soundResult.usageRetrieved = tracked.creationCount != null;
      soundResult.songUuid = tracked.songUuid;
      soundResult.providerDataDate = tracked.providerDataDate;
      soundResult.checkedAt = tracked.checkedAt;
      soundResult.snapshotInserted =
        tracked.inserted || tracked.baselineInserted;
    } catch (error) {
      soundErrors.push(
        error instanceof Error
          ? error.message
          : "Soundcharts refresh failed",
      );
    }
  } else {
    soundResult.skipped = true;
  }

  soundResult.ok = soundErrors.length === 0;
  if (soundErrors.length > 0) soundResult.error = soundErrors.join("; ");

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
