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

export function campaignHeadline(
  campaign: Pick<
    Campaign,
    "sound_title" | "sound_artist" | "release_title" | "campaign_name"
  >,
  client?: Pick<Client, "name"> | null,
): string {
  const title =
    campaign.sound_title?.trim() ||
    campaign.release_title?.trim() ||
    "Untitled campaign";
  const artist =
    campaign.sound_artist?.trim() ||
    client?.name?.trim() ||
    campaign.campaign_name?.trim() ||
    "";
  return artist ? `${artist} — ${title}` : title;
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
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
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

export function formatDateRange(
  start: string | null | undefined,
  end: string | null | undefined,
): string | null {
  if (!start && !end) return null;
  if (start && end) return `${formatShortDate(start)} – ${formatShortDate(end)}`;
  if (start) return `From ${formatShortDate(start)}`;
  return `Until ${formatShortDate(end!)}`;
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

export function statusLabel(status: CampaignStatus): string {
  switch (status) {
    case "live":
      return "Live";
    case "paused":
      return "Paused";
    case "closed":
      return "Closed";
    case "draft":
      return "Draft";
  }
}

export function isActiveCampaignStatus(status: CampaignStatus): boolean {
  return status === "live" || status === "paused";
}

export function isPastCampaignStatus(status: CampaignStatus): boolean {
  return status === "closed";
}

export function createShareToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function parseDailyPaste(raw: string): { date: string; views: number }[] {
  const rows: { date: string; views: number }[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(/[,\t]/).map((p) => p.trim());
    if (parts.length < 2) continue;
    const date = parts[0];
    const views = Number(parts[1].replace(/,/g, ""));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(views) || views < 0) {
      continue;
    }
    rows.push({ date, views: Math.round(views) });
  }
  return rows;
}

export function buildCumulative(
  daily: { date: string; views: number }[],
): { date: string; views: number; cumulative: number }[] {
  const sorted = [...daily].sort((a, b) => a.date.localeCompare(b.date));
  let running = 0;
  return sorted.map((row) => {
    running += Number(row.views) || 0;
    return { date: row.date, views: Number(row.views) || 0, cumulative: running };
  });
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

export function deriveCampaignDates(
  posts: Pick<TikTokPost, "posted_at" | "created_at">[],
): { started: string | null; latest: string | null } {
  const stamps = posts
    .map((p) => p.posted_at || p.created_at)
    .filter(Boolean)
    .map((v) => new Date(v as string).getTime())
    .filter((n) => Number.isFinite(n));
  if (stamps.length === 0) return { started: null, latest: null };
  return {
    started: new Date(Math.min(...stamps)).toISOString(),
    latest: new Date(Math.max(...stamps)).toISOString(),
  };
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
      views: index === 0 ? row.total : delta,
      cumulative: row.total,
    };
  });
}

/** Only auto-promote draft ↔ live. Never override paused/closed. */
export function deriveAutoStatus(
  current: CampaignStatus,
  postCount: number,
): CampaignStatus {
  if (current === "paused" || current === "closed") return current;
  if (postCount > 0) return "live";
  return "draft";
}
