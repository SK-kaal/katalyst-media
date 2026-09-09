import { NextResponse } from "next/server";
import {
  TIKTOK_MEDIA_USER_AGENT,
  isTikTokVideoId,
  resolveTikTokVideoUrl,
} from "@/lib/tiktok-media";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_CHUNK_BYTES = 1.5 * 1024 * 1024;

type RouteContext = {
  params: Promise<{ id: string }>;
};

function boundedRange(rangeHeader: string | null) {
  if (!rangeHeader) {
    return `bytes=0-${MAX_CHUNK_BYTES - 1}`;
  }

  const match = /^bytes=(\d+)-(\d+)?$/i.exec(rangeHeader.trim());
  if (!match) {
    return `bytes=0-${MAX_CHUNK_BYTES - 1}`;
  }

  const start = Number(match[1]);
  const requestedEnd = match[2]
    ? Number(match[2])
    : start + MAX_CHUNK_BYTES - 1;
  if (!Number.isFinite(start) || start < 0) {
    return `bytes=0-${MAX_CHUNK_BYTES - 1}`;
  }

  const end = Math.min(requestedEnd, start + MAX_CHUNK_BYTES - 1);
  return `bytes=${start}-${end}`;
}

function fetchTikTokMedia(sourceUrl: string, range: string) {
  return fetch(sourceUrl, {
    headers: {
      Accept: "video/mp4,video/*,*/*",
      Referer: "https://www.tiktok.com/",
      Origin: "https://www.tiktok.com",
      "User-Agent": TIKTOK_MEDIA_USER_AGENT,
      Range: range,
    },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
}

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!isTikTokVideoId(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    let sourceUrl = await resolveTikTokVideoUrl(id);
    if (!sourceUrl) {
      return NextResponse.json({ error: "Unavailable" }, { status: 404 });
    }

    const range = boundedRange(request.headers.get("range"));
    let upstream = await fetchTikTokMedia(sourceUrl, range);

    if (upstream.status === 403 || upstream.status === 410) {
      sourceUrl = await resolveTikTokVideoUrl(id, true);
      if (sourceUrl) {
        upstream = await fetchTikTokMedia(sourceUrl, range);
      }
    }

    if (!upstream.ok && upstream.status !== 206) {
      return NextResponse.json({ error: "Unavailable" }, { status: 502 });
    }

    const headers = new Headers();
    headers.set(
      "Content-Type",
      upstream.headers.get("Content-Type") ?? "video/mp4",
    );
    headers.set("Accept-Ranges", "bytes");
    headers.set("Cache-Control", "private, max-age=90");
    const contentLength = upstream.headers.get("Content-Length");
    if (contentLength) headers.set("Content-Length", contentLength);
    const contentRange = upstream.headers.get("Content-Range");
    if (contentRange) headers.set("Content-Range", contentRange);

    return new NextResponse(upstream.body, {
      status:
        upstream.status === 200 && contentRange ? 206 : upstream.status,
      headers,
    });
  } catch {
    return NextResponse.json({ error: "Unavailable" }, { status: 502 });
  }
}
