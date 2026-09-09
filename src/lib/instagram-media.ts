const SHORTCODE_PATTERN = /^[A-Za-z0-9_-]+$/;
const EMBED_USER_AGENT =
  "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";
const RESOLVE_TTL_MS = 12 * 60 * 1000;

export const INSTAGRAM_MEDIA_USER_AGENT = EMBED_USER_AGENT;

export function isInstagramShortcode(id: string) {
  return SHORTCODE_PATTERN.test(id);
}

export function decodeInstagramEscapedUrl(value: string) {
  let current = value.trim().replace(/^"+|"+$/g, "");
  for (let pass = 0; pass < 12; pass += 1) {
    const next = current
      .replace(/\\\\/g, "\\")
      .replace(/\\\//g, "/")
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) =>
        String.fromCharCode(Number.parseInt(hex, 16)),
      )
    if (next === current) break;
    current = next;
  }
  current = current.replace(/\\+$/g, "");
  if (!current.startsWith("https://")) return null;
  if (!current.includes(".mp4")) return null;
  return current;
}

export function extractInstagramVideoUrl(html: string) {
  const markers = ["video_url", "playback_url"] as const;
  for (const marker of markers) {
    const index = html.indexOf(marker);
    if (index < 0) continue;
    const slice = html.slice(index, index + 8000);
    const match = slice.match(/https:[\\/]+[^\s"'<>]+?\.mp4[^\s"'<>]*/);
    if (!match) continue;
    const decoded = decodeInstagramEscapedUrl(match[0]);
    if (decoded) return decoded;
  }
  return null;
}

const resolveCache = new Map<string, { url: string; at: number }>();

function embedUrlsFor(id: string) {
  return [
    `https://www.instagram.com/reel/${id}/embed/`,
    `https://www.instagram.com/p/${id}/embed/`,
  ];
}

export async function resolveInstagramVideoUrl(id: string, force = false) {
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
        },
        signal: AbortSignal.timeout(10_000),
        next: { revalidate: 300 },
      });
      if (!response.ok) continue;
      const videoUrl = extractInstagramVideoUrl(await response.text());
      if (!videoUrl) continue;
      resolveCache.set(id, { url: videoUrl, at: Date.now() });
      return videoUrl;
    } catch {
      continue;
    }
  }

  return null;
}
