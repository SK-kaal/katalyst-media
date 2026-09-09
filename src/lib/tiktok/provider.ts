/**
 * TikTok data provider for the campaign portal.
 *
 * Uses official oEmbed where possible, plus public page hydration JSON
 * for post metrics (same source family as the site's existing embed resolver).
 * Do not invent metrics — partial/null fields mean unavailable.
 */

import {
  parseTikTokPostUrl,
  parseTikTokSoundUrl,
  type ParsedTikTokPostUrl,
  type ParsedTikTokSoundUrl,
} from "@/lib/tiktok/urls";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

export type TikTokSoundData = {
  soundId: string;
  soundUrl: string;
  title: string;
  artist: string | null;
  artworkUrl: string | null;
  usageCount: number | null;
};

export type TikTokPostData = {
  postId: string;
  postUrl: string;
  creatorHandle: string;
  creatorDisplayName: string | null;
  title: string | null;
  thumbnailUrl: string | null;
  postedAt: string | null;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  musicId: string | null;
  musicTitle: string | null;
  musicArtist: string | null;
  musicArtworkUrl: string | null;
  metricsComplete: boolean;
};

export type ProviderErrorCode =
  | "invalid_url"
  | "wrong_type"
  | "fetch_failed"
  | "not_found";

export type ProviderResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: ProviderErrorCode };

export interface TikTokDataProvider {
  getSound(url: string): Promise<ProviderResult<TikTokSoundData>>;
  getPost(url: string): Promise<ProviderResult<TikTokPostData>>;
  refreshPost(url: string): Promise<ProviderResult<TikTokPostData>>;
}

function extractScriptJson(html: string, id: string): unknown | null {
  const marker = `id="${id}"`;
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) return null;
  const jsonStart = html.indexOf(">", markerIndex) + 1;
  const jsonEnd = html.indexOf("</script>", jsonStart);
  if (jsonStart <= 0 || jsonEnd <= jsonStart) return null;
  try {
    return JSON.parse(html.slice(jsonStart, jsonEnd));
  } catch {
    return null;
  }
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "text/html,application/xhtml+xml,application/json",
        "User-Agent": USER_AGENT,
        Referer: "https://www.tiktok.com/",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(18_000),
      cache: "no-store",
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

type OEmbedVideo = {
  title?: string;
  author_name?: string;
  author_unique_id?: string;
  thumbnail_url?: string;
  embed_product_id?: string;
  html?: string;
};

type OEmbedMusic = {
  title?: string;
  author_name?: string;
  embed_product_id?: string;
};

async function fetchOEmbed(url: string): Promise<Record<string, unknown> | null> {
  const endpoint = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
  try {
    const response = await fetch(endpoint, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });
    if (!response.ok) return null;
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function cleanMusicTitle(raw: string): string {
  return raw
    .replace(/^♬\s*/u, "")
    .replace(/\s+-\s+[^-]+$/u, (match, offset, full) => {
      // Keep title part before final " - Artist"
      const idx = full.lastIndexOf(" - ");
      if (idx > 0) return "";
      return match;
    })
    .trim();
}

function parseMusicOEmbedTitle(title: string): { soundTitle: string; artist: string | null } {
  const cleaned = title.replace(/^♬\s*/u, "").trim();
  const split = cleaned.lastIndexOf(" - ");
  if (split > 0) {
    return {
      soundTitle: cleaned.slice(0, split).replace(/-/g, " ").trim(),
      artist: cleaned.slice(split + 3).trim() || null,
    };
  }
  return { soundTitle: cleaned.replace(/-/g, " ").trim(), artist: null };
}

function asNumber(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
}

function unixToIso(value: unknown): string | null {
  const n = typeof value === "string" ? Number(value) : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(n * 1000).toISOString();
}

function normalizeHandle(value: string | null | undefined): string {
  const trimmed = (value || "").trim().replace(/^@/, "");
  return trimmed ? `@${trimmed}` : "";
}

function readVideoDetail(html: string) {
  const uni = extractScriptJson(html, "__UNIVERSAL_DATA_FOR_REHYDRATION__") as {
    __DEFAULT_SCOPE__?: Record<string, unknown>;
  } | null;
  const scope = uni?.__DEFAULT_SCOPE__;
  const detail = scope?.["webapp.video-detail"] as
    | {
        itemInfo?: {
          itemStruct?: {
            id?: string;
            desc?: string;
            createTime?: string | number;
            author?: { uniqueId?: string; nickname?: string };
            stats?: {
              playCount?: number | string;
              diggCount?: number | string;
              commentCount?: number | string;
              shareCount?: number | string;
            };
            video?: { cover?: string; originCover?: string; dynamicCover?: string };
            music?: {
              id?: string;
              title?: string;
              authorName?: string;
              coverLarge?: string;
              coverMedium?: string;
              videoCount?: number | string;
            };
          };
        };
        statusCode?: number;
      }
    | undefined;

  return detail?.itemInfo?.itemStruct ?? null;
}

function readUsageCountFromHtml(html: string): number | null {
  // Best-effort only — TikTok often withholds this from SSR.
  const patterns = [
    /"videoCount"\s*:\s*(\d+)/,
    /"video_count"\s*:\s*(\d+)/,
    /"userCount"\s*:\s*(\d+)/,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      const n = Number(match[1]);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return null;
}

async function getSoundFromParsed(
  parsed: ParsedTikTokSoundUrl,
): Promise<ProviderResult<TikTokSoundData>> {
  const oembed = (await fetchOEmbed(parsed.canonicalUrl)) as OEmbedMusic | null;
  let title = parsed.titleHint || "";
  let artist: string | null = null;
  let artworkUrl: string | null = null;
  let usageCount: number | null = null;

  if (oembed?.title) {
    const parsedTitle = parseMusicOEmbedTitle(String(oembed.title));
    title = parsedTitle.soundTitle || title;
    artist = parsedTitle.artist || (oembed.author_name ? String(oembed.author_name) : null);
  } else if (oembed?.author_name) {
    artist = String(oembed.author_name);
  }

  const pageHtml = await fetchText(parsed.canonicalUrl);
  if (pageHtml) {
    usageCount = readUsageCountFromHtml(pageHtml);
  }

  if (!title) {
    title = `Sound ${parsed.soundId}`;
  }

  return {
    ok: true,
    data: {
      soundId: parsed.soundId,
      soundUrl: parsed.canonicalUrl,
      title: cleanMusicTitle(title) || title,
      artist,
      artworkUrl,
      usageCount,
    },
  };
}

async function getPostFromParsed(
  parsed: ParsedTikTokPostUrl,
): Promise<ProviderResult<TikTokPostData>> {
  const pageHtml = await fetchText(parsed.canonicalUrl);
  const item = pageHtml ? readVideoDetail(pageHtml) : null;

  if (item?.id) {
    const handle =
      normalizeHandle(item.author?.uniqueId) ||
      normalizeHandle(parsed.handle) ||
      "@unknown";
    const views = asNumber(item.stats?.playCount);
    const likes = asNumber(item.stats?.diggCount);
    const comments = asNumber(item.stats?.commentCount);
    const shares = asNumber(item.stats?.shareCount);
    const metricsComplete = Boolean(item.stats);

    return {
      ok: true,
      data: {
        postId: String(item.id),
        postUrl: parsed.handle
          ? `https://www.tiktok.com/@${parsed.handle}/video/${item.id}`
          : `https://www.tiktok.com/@${handle.replace(/^@/, "")}/video/${item.id}`,
        creatorHandle: handle,
        creatorDisplayName: item.author?.nickname || null,
        title: item.desc?.trim() || null,
        thumbnailUrl:
          item.video?.cover || item.video?.originCover || item.video?.dynamicCover || null,
        postedAt: unixToIso(item.createTime),
        views,
        likes,
        comments,
        shares,
        musicId: item.music?.id ? String(item.music.id) : null,
        musicTitle: item.music?.title || null,
        musicArtist: item.music?.authorName || null,
        musicArtworkUrl: item.music?.coverLarge || item.music?.coverMedium || null,
        metricsComplete,
      },
    };
  }

  // Fallback: oEmbed gives identity + thumbnail, not engagement metrics.
  const oembed = (await fetchOEmbed(parsed.canonicalUrl)) as OEmbedVideo | null;
  if (!oembed) {
    return {
      ok: false,
      code: "fetch_failed",
      error: "We couldn't retrieve this TikTok post automatically.",
    };
  }

  const handle =
    normalizeHandle(oembed.author_unique_id) ||
    normalizeHandle(parsed.handle) ||
    "@unknown";

  return {
    ok: true,
    data: {
      postId: parsed.postId,
      postUrl: parsed.canonicalUrl,
      creatorHandle: handle,
      creatorDisplayName: oembed.author_name ? String(oembed.author_name) : null,
      title: oembed.title ? String(oembed.title) : null,
      thumbnailUrl: oembed.thumbnail_url ? String(oembed.thumbnail_url) : null,
      postedAt: null,
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      musicId: null,
      musicTitle: null,
      musicArtist: null,
      musicArtworkUrl: null,
      metricsComplete: false,
    },
  };
}

export const tiktokProvider: TikTokDataProvider = {
  async getSound(url) {
    const parsed = parseTikTokSoundUrl(url);
    if (parsed.kind === "invalid") {
      return { ok: false, code: "invalid_url", error: parsed.reason };
    }
    if (parsed.kind === "wrong_type") {
      return {
        ok: false,
        code: "wrong_type",
        error: "That looks like a TikTok post URL. Paste a TikTok sound / music URL instead.",
      };
    }
    if (parsed.kind !== "sound") {
      return { ok: false, code: "invalid_url", error: "Invalid TikTok sound URL." };
    }
    return getSoundFromParsed(parsed);
  },

  async getPost(url) {
    const parsed = parseTikTokPostUrl(url);
    if (parsed.kind === "invalid") {
      return { ok: false, code: "invalid_url", error: parsed.reason };
    }
    if (parsed.kind === "wrong_type") {
      return {
        ok: false,
        code: "wrong_type",
        error: "That looks like a TikTok sound URL. Paste a TikTok post URL instead.",
      };
    }
    if (parsed.kind !== "post") {
      return { ok: false, code: "invalid_url", error: "Invalid TikTok post URL." };
    }
    return getPostFromParsed(parsed);
  },

  async refreshPost(url) {
    return this.getPost(url);
  },
};
