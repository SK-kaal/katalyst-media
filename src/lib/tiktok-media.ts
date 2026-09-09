const VIDEO_ID_PATTERN = /^\d{10,25}$/;
const EMBED_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
const RESOLVE_TTL_MS = 8 * 60 * 1000;

export const TIKTOK_MEDIA_USER_AGENT = EMBED_USER_AGENT;

export function isTikTokVideoId(id: string) {
  return VIDEO_ID_PATTERN.test(id);
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/\\u002F/g, "/")
    .replace(/\\\//g, "/");
}

function isTikTokVideoUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    if (!host.includes("tiktokcdn") && !host.includes("tiktok.com")) {
      return false;
    }
    return (
      url.pathname.includes("/video/") ||
      url.searchParams.get("mime_type") === "video_mp4"
    );
  } catch {
    return false;
  }
}

function urlsFromUnknown(value: unknown, found: string[]) {
  if (typeof value === "string") {
    const decoded = decodeHtmlEntities(value.trim());
    if (isTikTokVideoUrl(decoded)) found.push(decoded);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) urlsFromUnknown(item, found);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const item of Object.values(value)) urlsFromUnknown(item, found);
}

export function extractTikTokVideoUrl(html: string, id: string) {
  const marker = 'id="__FRONTITY_CONNECT_STATE__"';
  const markerIndex = html.indexOf(marker);
  if (markerIndex >= 0) {
    const jsonStart = html.indexOf(">", markerIndex) + 1;
    const jsonEnd = html.indexOf("</script>", jsonStart);
    if (jsonStart > 0 && jsonEnd > jsonStart) {
      try {
        const state = JSON.parse(html.slice(jsonStart, jsonEnd)) as {
          source?: { data?: Record<string, { videoData?: unknown }> };
        };
        const videoData =
          state.source?.data?.[`/embed/v2/${id}`]?.videoData ??
          Object.values(state.source?.data ?? {}).find(
            (entry) => entry?.videoData,
          )?.videoData;
        const found: string[] = [];
        urlsFromUnknown(videoData, found);
        if (found[0]) return found[0];
      } catch {
        // Fall through to regex extraction.
      }
    }
  }

  const match = html.match(
    /https:\/\/v\d+\.tiktokcdn[^\s"'<>]+mime_type=video_mp4[^\s"'<>]*/i,
  );
  if (!match) return null;
  const decoded = decodeHtmlEntities(match[0]);
  return isTikTokVideoUrl(decoded) ? decoded : null;
}

const resolveCache = new Map<string, { url: string; at: number }>();

function embedUrlsFor(id: string) {
  return [
    `https://www.tiktok.com/embed/v2/${id}`,
    `https://www.tiktok.com/embed/${id}`,
  ];
}

export async function resolveTikTokVideoUrl(id: string, force = false) {
  if (!force) {
    const cached = resolveCache.get(id);
    if (cached && Date.now() - cached.at < RESOLVE_TTL_MS) {
      return cached.url;
    }
  }

  for (const embedUrl of embedUrlsFor(id)) {
    try {
      const response = await fetch(embedUrl, {
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent": EMBED_USER_AGENT,
          Referer: "https://www.tiktok.com/",
        },
        signal: AbortSignal.timeout(10_000),
        next: { revalidate: 180 },
      });
      if (!response.ok) continue;
      const videoUrl = extractTikTokVideoUrl(await response.text(), id);
      if (!videoUrl) continue;
      resolveCache.set(id, { url: videoUrl, at: Date.now() });
      return videoUrl;
    } catch {
      continue;
    }
  }

  return null;
}
