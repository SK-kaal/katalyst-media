import type {
  Campaign,
  CampaignStatus,
  Client,
  PostMetricSnapshot,
  TikTokPost,
} from "@/lib/supabase/database.types";

export type CampaignMetrics = {
  posts: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagement: number;
  engagementRate: number;
};

/** Live campaigns older than this are marked stale (6 hours). */
export const LIVE_STALE_MS = 6 * 60 * 60 * 1000;

type SoundDisplayFields = {
  sound_title?: string | null;
  sound_artist?: string | null;
  sound_title_override?: string | null;
  sound_artist_override?: string | null;
};

export function campaignSoundTitle(campaign: SoundDisplayFields): string | null {
  return (
    campaign.sound_title_override?.trim() ||
    campaign.sound_title?.trim() ||
    null
  );
}

export function campaignSoundArtist(campaign: SoundDisplayFields): string | null {
  return (
    campaign.sound_artist_override?.trim() ||
    campaign.sound_artist?.trim() ||
    null
  );
}

export function campaignHeadline(
  campaign: Pick<
    Campaign,
    | "sound_title"
    | "sound_artist"
    | "sound_title_override"
    | "sound_artist_override"
    | "display_title"
  >,
  client?: Pick<Client, "name"> | null,
): string {
  if (campaign.display_title?.trim()) return campaign.display_title.trim();
  const title = campaignSoundTitle(campaign) || "Untitled campaign";
  const soundArtist = campaignSoundArtist(campaign) || "";
  // TikTok sometimes returns the track title as the "artist" — prefer client name.
  const artist =
    (soundArtist &&
    soundArtist.toLowerCase() !== title.toLowerCase()
      ? soundArtist
      : "") ||
    client?.name?.trim() ||
    "";
  return artist && artist.toLowerCase() !== title.toLowerCase()
    ? `${artist} — ${title}`
    : title;
}

export function isPostFailed(
  post: Pick<TikTokPost, "last_sync_status" | "last_sync_error">,
): boolean {
  return post.last_sync_status === "failed" || Boolean(post.last_sync_error);
}

export function campaignSyncLabel(
  campaign: Pick<Campaign, "status" | "last_synced_at">,
  failedCount = 0,
): { label: string; tone: "ok" | "warn" | "bad" | "muted"; stale: boolean } {
  if (failedCount > 0) {
    return {
      label: `${failedCount} post${failedCount === 1 ? "" : "s"} failed`,
      tone: "bad",
      stale: true,
    };
  }
  if (!campaign.last_synced_at) {
    return { label: "Not refreshed yet", tone: "muted", stale: false };
  }
  const age = Date.now() - new Date(campaign.last_synced_at).getTime();
  const relative = formatRelativeUpdated(campaign.last_synced_at);
  const stale =
    campaign.status === "active" && age > LIVE_STALE_MS;
  if (stale) {
    return { label: `Data may be outdated · ${relative}`, tone: "warn", stale: true };
  }
  return { label: `Refreshed ${relative}`, tone: "ok", stale: false };
}

export function campaignArtwork(
  campaign: Pick<Campaign, "artwork_url" | "sound_artwork_url">,
): string | null {
  return campaign.artwork_url || campaign.sound_artwork_url || null;
}

export function calculateMetrics(
  posts: Pick<TikTokPost, "views" | "likes" | "comments" | "shares">[],
): CampaignMetrics {
  const totals = posts.reduce(
    (acc, post) => {
      acc.views += Number(post.views) || 0;
      acc.likes += Number(post.likes) || 0;
      acc.comments += Number(post.comments) || 0;
      acc.shares += Number(post.shares) || 0;
      return acc;
    },
    { views: 0, likes: 0, comments: 0, shares: 0 },
  );

  const engagement = totals.likes + totals.comments + totals.shares;
  const engagementRate =
    totals.views > 0 ? (engagement / totals.views) * 100 : 0;

  return {
    posts: posts.length,
    views: totals.views,
    likes: totals.likes,
    comments: totals.comments,
    shares: totals.shares,
    engagement,
    engagementRate,
  };
}

/** Compact display: 1.2M / 138.4K / 868 */
export function formatCompactNumber(value: number): string {
  const n = Math.max(0, Number(value) || 0);
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `${m >= 10 ? m.toFixed(0) : m.toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (n >= 10_000) {
    return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  }
  return new Intl.NumberFormat("en-GB").format(Math.round(n));
}

/** Full locale number: 868,329 */
export function formatFullNumber(value: number): string {
  return new Intl.NumberFormat("en-GB").format(Math.round(Math.max(0, value)));
}

export function formatEngagementRate(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0%";
  return `${value.toFixed(2)}%`;
}

export function formatGbp(value: number): string {
  const amount = Number(value) || 0;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatGbpExact(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

export function formatShortDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function formatRelativeUpdated(value: string): string {
  const then = new Date(value).getTime();
  const now = Date.now();
  const diffMs = Math.max(0, now - then);
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days} day${days === 1 ? "" : "s"} ago`;
  return formatShortDate(value);
}

export function isActiveCampaignStatus(status: CampaignStatus): boolean {
  return status === "active";
}

export function isPastCampaignStatus(status: CampaignStatus): boolean {
  return status === "ended";
}

export function createShareToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function formatPostsVsTarget(
  tracked: number,
  target: number | null | undefined,
): string {
  if (target == null || !Number.isFinite(Number(target))) {
    return String(tracked);
  }
  return `${tracked} / ${Math.round(Number(target))}`;
}

/** ~7 day window for weekly comparisons (±36h tolerance). */
export const WEEKLY_DELTA_MS = 7 * 24 * 60 * 60 * 1000;
export const WEEKLY_DELTA_TOLERANCE_MS = 36 * 60 * 60 * 1000;

export type WeeklyDelta = {
  current: number;
  previous: number;
  delta: number;
} | null;

/**
 * Compare latest value against nearest snapshot ~7 days earlier.
 * Returns null when history is insufficient — never invents a comparison.
 */
export function weeklyDeltaFromSnapshots(
  snapshots: { captured_at: string; value: number }[],
  currentValue?: number | null,
): WeeklyDelta {
  if (snapshots.length === 0 && (currentValue == null || !Number.isFinite(currentValue))) {
    return null;
  }

  const points = [...snapshots]
    .map((s) => ({
      at: new Date(s.captured_at).getTime(),
      value: Number(s.value) || 0,
    }))
    .filter((p) => Number.isFinite(p.at))
    .sort((a, b) => a.at - b.at);

  if (currentValue != null && Number.isFinite(currentValue)) {
    points.push({ at: Date.now(), value: Number(currentValue) });
  }

  if (points.length < 2) return null;

  const latest = points[points.length - 1];
  const targetAt = latest.at - WEEKLY_DELTA_MS;
  let best: (typeof points)[number] | null = null;
  let bestDist = Number.POSITIVE_INFINITY;

  for (const point of points.slice(0, -1)) {
    const dist = Math.abs(point.at - targetAt);
    if (dist <= WEEKLY_DELTA_TOLERANCE_MS && dist < bestDist) {
      best = point;
      bestDist = dist;
    }
  }

  // Fallback: oldest snapshot at least ~5 days older than latest
  if (!best) {
    const minAge = 5 * 24 * 60 * 60 * 1000;
    for (let i = points.length - 2; i >= 0; i -= 1) {
      if (latest.at - points[i].at >= minAge) {
        best = points[i];
        break;
      }
    }
  }

  if (!best) return null;

  return {
    current: latest.value,
    previous: best.value,
    delta: latest.value - best.value,
  };
}

export function formatWeeklyDelta(delta: number | null | undefined): string | null {
  if (delta == null || !Number.isFinite(delta)) return null;
  const abs = Math.abs(Math.round(delta));
  if (abs === 0) return "No change since last week";
  const arrow = delta > 0 ? "↑" : "↓";
  return `${arrow} ${formatFullNumber(abs)} since last week`;
}

export function formatPostsVsTargetLabel(
  tracked: number,
  target: number | null | undefined,
): { value: string; progress: number } {
  const t = target != null && Number.isFinite(Number(target)) ? Math.round(Number(target)) : null;
  return {
    value: formatPostsVsTarget(tracked, t),
    progress: t && t > 0 ? Math.min(1, tracked / t) : 0,
  };
}

export function normalizeHandle(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export type ReportChartPoint = {
  date: string;
  daily: number;
  cumulative: number;
};

/**
 * Turn cumulative snapshot totals into daily + cumulative series.
 * Never invents values — returns [] when history is insufficient (< 2 days).
 */
export function buildSeriesFromCumulativeSnapshots(
  snapshots: { captured_at: string; value: number }[],
  latestValue?: number | null,
): ReportChartPoint[] {
  const sorted = [...snapshots].sort(
    (a, b) => +new Date(a.captured_at) - +new Date(b.captured_at),
  );

  const byDay = new Map<string, number>();
  for (const snap of sorted) {
    const value = Number(snap.value);
    if (!Number.isFinite(value) || value < 0) continue;
    const day = new Date(snap.captured_at).toISOString().slice(0, 10);
    byDay.set(day, value);
  }

  if (
    latestValue != null &&
    Number.isFinite(Number(latestValue)) &&
    Number(latestValue) >= 0
  ) {
    const today = new Date().toISOString().slice(0, 10);
    const current = Number(latestValue);
    const existing = byDay.get(today);
    byDay.set(today, existing == null ? current : Math.max(existing, current));
  }

  const days = [...byDay.keys()].sort();
  if (days.length < 2) return [];

  return days.map((date, index) => {
    const cumulative = byDay.get(date) ?? 0;
    const prev = index === 0 ? cumulative : (byDay.get(days[index - 1]) ?? 0);
    const daily = index === 0 ? 0 : Math.max(0, cumulative - prev);
    return { date, daily, cumulative };
  });
}

/**
 * Build daily + cumulative campaign views from post metric snapshots.
 * For each calendar day, take each post's latest snapshot on/before that day,
 * sum views, then convert totals into daily deltas for the bar chart.
 */
export function buildChartFromSnapshots(
  posts: Pick<TikTokPost, "id">[],
  snapshots: Pick<
    PostMetricSnapshot,
    "post_id" | "captured_at" | "views"
  >[],
): { date: string; views: number; cumulative: number }[] {
  if (posts.length === 0 || snapshots.length === 0) return [];

  const byPost = new Map<string, { at: number; views: number }[]>();
  for (const snap of snapshots) {
    const list = byPost.get(snap.post_id) ?? [];
    list.push({
      at: new Date(snap.captured_at).getTime(),
      views: Number(snap.views) || 0,
    });
    byPost.set(snap.post_id, list);
  }
  for (const list of byPost.values()) {
    list.sort((a, b) => a.at - b.at);
  }

  const daySet = new Set<string>();
  for (const snap of snapshots) {
    daySet.add(new Date(snap.captured_at).toISOString().slice(0, 10));
  }
  const days = [...daySet].sort();

  const totals: { date: string; total: number }[] = [];
  for (const day of days) {
    const end = new Date(`${day}T23:59:59.999Z`).getTime();
    let total = 0;
    for (const post of posts) {
      const list = byPost.get(post.id) ?? [];
      let latest = 0;
      for (const point of list) {
        if (point.at <= end) latest = point.views;
        else break;
      }
      total += latest;
    }
    totals.push({ date: day, total });
  }

  return totals.map((row, index) => {
    const prev = index === 0 ? 0 : totals[index - 1].total;
    const delta = Math.max(0, row.total - prev);
    return {
      date: row.date,
      views: index === 0 ? 0 : delta,
      cumulative: row.total,
    };
  });
}
