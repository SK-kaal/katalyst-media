/** TikTok URL parsing / normalisation for the campaign portal. */

const VIDEO_ID_RE = /^(\d{10,25})$/;
const VIDEO_PATH_RE = /\/video\/(\d{10,25})/i;
const PHOTO_PATH_RE = /\/photo\/(\d{10,25})/i;
const MUSIC_PATH_RE = /\/music\/([^/?#]+)/i;
const SOUND_PATH_RE = /\/sound\/([^/?#]+)/i;

export type ParsedTikTokPostUrl = {
  kind: "post";
  postId: string;
  canonicalUrl: string;
  handle: string | null;
};

export type ParsedTikTokSoundUrl = {
  kind: "sound";
  soundId: string;
  slug: string | null;
  titleHint: string | null;
  canonicalUrl: string;
};

export type ParsedTikTokUrl =
  | ParsedTikTokPostUrl
  | ParsedTikTokSoundUrl
  | { kind: "invalid"; reason: string }
  | { kind: "wrong_type"; expected: "post" | "sound"; got: "post" | "sound" };

function cleanUrl(raw: string): URL | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    return new URL(withProtocol);
  } catch {
    return null;
  }
}

function isTikTokHost(hostname: string) {
  const host = hostname.toLowerCase();
  return (
    host === "tiktok.com" ||
    host === "www.tiktok.com" ||
    host === "m.tiktok.com" ||
    host === "vm.tiktok.com" ||
    host === "vt.tiktok.com" ||
    host.endsWith(".tiktok.com")
  );
}

function titleFromMusicSlug(slug: string): { titleHint: string | null; soundId: string | null } {
  // e.g. bank-on-it-7483905998420527894
  const match = slug.match(/^(.*)-(\d{10,25})$/);
  if (!match) {
    if (VIDEO_ID_RE.test(slug)) return { titleHint: null, soundId: slug };
    return { titleHint: slug.replace(/-/g, " "), soundId: null };
  }
  return {
    titleHint: match[1].replace(/-/g, " ").trim() || null,
    soundId: match[2],
  };
}

export function parseTikTokPostUrl(raw: string): ParsedTikTokUrl {
  const url = cleanUrl(raw);
  if (!url || !isTikTokHost(url.hostname)) {
    return { kind: "invalid", reason: "This doesn't appear to be a valid TikTok post." };
  }

  const music = url.pathname.match(MUSIC_PATH_RE) || url.pathname.match(SOUND_PATH_RE);
  if (music) {
    return { kind: "wrong_type", expected: "post", got: "sound" };
  }

  const videoMatch =
    url.pathname.match(VIDEO_PATH_RE) || url.pathname.match(PHOTO_PATH_RE);
  if (!videoMatch) {
    return { kind: "invalid", reason: "This doesn't appear to be a valid TikTok post." };
  }

  const postId = videoMatch[1];
  const handleMatch = url.pathname.match(/@([^/]+)/);
  const handle = handleMatch ? handleMatch[1] : null;
  const canonicalUrl = handle
    ? `https://www.tiktok.com/@${handle}/video/${postId}`
    : `https://www.tiktok.com/video/${postId}`;

  return { kind: "post", postId, canonicalUrl, handle };
}

export function parseTikTokSoundUrl(raw: string): ParsedTikTokUrl {
  const url = cleanUrl(raw);
  if (!url || !isTikTokHost(url.hostname)) {
    return { kind: "invalid", reason: "This doesn't appear to be a valid TikTok sound URL." };
  }

  const videoMatch =
    url.pathname.match(VIDEO_PATH_RE) || url.pathname.match(PHOTO_PATH_RE);
  if (videoMatch) {
    return { kind: "wrong_type", expected: "sound", got: "post" };
  }

  const musicMatch =
    url.pathname.match(MUSIC_PATH_RE) || url.pathname.match(SOUND_PATH_RE);
  if (!musicMatch) {
    return { kind: "invalid", reason: "This doesn't appear to be a valid TikTok sound URL." };
  }

  const slug = decodeURIComponent(musicMatch[1]);
  const { titleHint, soundId } = titleFromMusicSlug(slug);
  if (!soundId) {
    return { kind: "invalid", reason: "Could not find a TikTok sound ID in that URL." };
  }

  return {
    kind: "sound",
    soundId,
    slug,
    titleHint,
    canonicalUrl: `https://www.tiktok.com/music/${slug}`,
  };
}

export function extractUrlsFromPaste(raw: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Allow space-separated URLs on one line
    const parts = trimmed.split(/\s+/);
    for (const part of parts) {
      const parsed = parseTikTokPostUrl(part);
      if (parsed.kind !== "post") continue;
      if (seen.has(parsed.postId)) continue;
      seen.add(parsed.postId);
      found.push(part.trim());
    }
  }
  return found;
}

export function isTikTokVideoId(id: string) {
  return VIDEO_ID_RE.test(id);
}
