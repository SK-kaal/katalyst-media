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

export type ParsedTikTokShortUrl = {
  kind: "short";
  canonicalUrl: string;
};

export type ParsedTikTokUrl =
  | ParsedTikTokPostUrl
  | ParsedTikTokSoundUrl
  | ParsedTikTokShortUrl
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

function isTikTokShortHost(hostname: string) {
  const host = hostname.toLowerCase();
  return host === "vm.tiktok.com" || host === "vt.tiktok.com";
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
  if (isTikTokShortHost(url.hostname)) {
    return {
      kind: "short",
      canonicalUrl: `${url.origin}${url.pathname}`,
    };
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
  if (isTikTokShortHost(url.hostname)) {
    return {
      kind: "short",
      canonicalUrl: `${url.origin}${url.pathname}`,
    };
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
  return analyzePasteUrls(raw).uniqueUrls;
}

/** Trim, split, normalise, and pre-dedupe a bulk paste before any TikTok fetches. */
export function analyzePasteUrls(raw: string): {
  uniqueUrls: string[];
  uniqueCount: number;
  pasteDuplicateCount: number;
  invalidLineCount: number;
  invalidUrls: { value: string; reason: string }[];
  totalNonEmptyLines: number;
} {
  const uniqueUrls: string[] = [];
  const seen = new Set<string>();
  const invalidUrls: { value: string; reason: string }[] = [];
  let pasteDuplicateCount = 0;
  let invalidLineCount = 0;
  let totalNonEmptyLines = 0;

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(/\s+/).filter(Boolean);
    for (const part of parts) {
      totalNonEmptyLines += 1;
      const parsed = parseTikTokPostUrl(part);
      if (parsed.kind === "invalid" || parsed.kind === "wrong_type") {
        invalidLineCount += 1;
        invalidUrls.push({
          value: part,
          reason:
            parsed.kind === "invalid"
              ? parsed.reason
              : "That looks like a TikTok sound URL. Paste a post URL instead.",
        });
        continue;
      }
      const key =
        parsed.kind === "post" ? parsed.postId : parsed.canonicalUrl.toLowerCase();
      if (seen.has(key)) {
        pasteDuplicateCount += 1;
        continue;
      }
      seen.add(key);
      uniqueUrls.push(parsed.canonicalUrl);
    }
  }

  return {
    uniqueUrls,
    uniqueCount: uniqueUrls.length,
    pasteDuplicateCount,
    invalidLineCount,
    invalidUrls,
    totalNonEmptyLines,
  };
}

export function isTikTokVideoId(id: string) {
  return VIDEO_ID_RE.test(id);
}
