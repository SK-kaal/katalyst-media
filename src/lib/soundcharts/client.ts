import {
  clearSoundchartsAccessToken,
  SOUNDCHARTS_API_BASE_URL,
  soundchartsAuthHeaders,
} from "@/lib/soundcharts/credentials";

const SOUNDCHARTS_EARLIEST_TIKTOK_DATE = "2016-01-01";
const REQUEST_TIMEOUT_MS = 20_000;

type SoundchartsError = {
  key?: string;
  code?: number;
  message?: string;
};

type SoundchartsEnvelope = {
  errors?: SoundchartsError[];
};

type SongByPlatformResponse = SoundchartsEnvelope & {
  type?: string;
  object?: {
    uuid?: string;
    name?: string;
    creditName?: string;
  };
};

export type SoundchartsAudiencePoint = {
  providerDataDate: string;
  creationCount: number;
  identifier: string;
};

type SongAudienceResponse = SoundchartsEnvelope & {
  items?: Array<{
    date?: string;
    plots?: Array<{
      identifier?: string;
      value?: number;
    }>;
  }>;
};

function errorDetail(payload: SoundchartsEnvelope, status: number): string {
  const messages = payload.errors
    ?.map((error) => error.message)
    .filter((message): message is string => Boolean(message));
  return messages?.length ? messages.join("; ") : `HTTP ${status}`;
}

async function requestSoundchartsJson<T extends SoundchartsEnvelope>(
  path: string,
  retryAuth = true,
): Promise<T> {
  const response = await fetch(`${SOUNDCHARTS_API_BASE_URL}${path}`, {
    headers: {
      ...(await soundchartsAuthHeaders()),
      Accept: "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (response.status === 401 && retryAuth) {
    clearSoundchartsAccessToken();
    return requestSoundchartsJson<T>(path, false);
  }

  const payload = (await response.json().catch(() => ({}))) as T;
  if (!response.ok) {
    throw new Error(
      `Soundcharts request failed (${path}): ${errorDetail(payload, response.status)}`,
    );
  }
  return payload;
}

export async function resolveSoundchartsSong(
  tiktokSoundId: string,
): Promise<{ uuid: string; name: string | null; creditName: string | null }> {
  const payload = await requestSoundchartsJson<SongByPlatformResponse>(
    `/api/v2.25/song/by-platform/tiktok/${encodeURIComponent(tiktokSoundId)}`,
  );
  const uuid = payload.object?.uuid?.trim();
  if (!uuid) {
    throw new Error(
      `Soundcharts did not return a song UUID for TikTok sound ${tiktokSoundId}`,
    );
  }
  return {
    uuid,
    name: payload.object?.name?.trim() || null,
    creditName: payload.object?.creditName?.trim() || null,
  };
}

export function parseTikTokAudiencePoints(
  payload: SongAudienceResponse,
  tiktokSoundId: string,
): SoundchartsAudiencePoint[] {
  const points: SoundchartsAudiencePoint[] = [];

  for (const item of payload.items ?? []) {
    const timestamp = item.date ? new Date(item.date).getTime() : Number.NaN;
    if (!Number.isFinite(timestamp)) continue;
    const providerDataDate = new Date(timestamp).toISOString().slice(0, 10);

    for (const plot of item.plots ?? []) {
      if (plot.identifier !== tiktokSoundId) continue;
      const value = Number(plot.value);
      if (!Number.isFinite(value) || value < 0) continue;
      points.push({
        providerDataDate,
        creationCount: Math.round(value),
        identifier: plot.identifier,
      });
    }
  }

  return points.sort((left, right) =>
    left.providerDataDate.localeCompare(right.providerDataDate),
  );
}

async function fetchTikTokAudience(
  songUuid: string,
  tiktokSoundId: string,
  options: {
    startDate: string;
    endDate: string;
    sort: "asc" | "desc";
  },
): Promise<SoundchartsAudiencePoint[]> {
  const query = new URLSearchParams({
    identifier: tiktokSoundId,
    startDate: options.startDate,
    endDate: options.endDate,
    sort: options.sort,
    limit: "100",
  });
  const payload = await requestSoundchartsJson<SongAudienceResponse>(
    `/api/v2/song/${encodeURIComponent(songUuid)}/audience/tiktok?${query}`,
  );
  return parseTikTokAudiencePoints(payload, tiktokSoundId);
}

export async function getLatestTikTokAudiencePoint(
  songUuid: string,
  tiktokSoundId: string,
  endDate: string,
): Promise<SoundchartsAudiencePoint | null> {
  const points = await fetchTikTokAudience(songUuid, tiktokSoundId, {
    startDate: SOUNDCHARTS_EARLIEST_TIKTOK_DATE,
    endDate,
    sort: "desc",
  });
  return points.at(-1) ?? null;
}

export async function getCampaignStartTikTokAudiencePoint(
  songUuid: string,
  tiktokSoundId: string,
  campaignStartDate: string,
  today: string,
): Promise<SoundchartsAudiencePoint | null> {
  const onOrBeforeStart = await fetchTikTokAudience(songUuid, tiktokSoundId, {
    startDate: SOUNDCHARTS_EARLIEST_TIKTOK_DATE,
    endDate: campaignStartDate,
    sort: "desc",
  });
  const baseline = onOrBeforeStart.at(-1);
  if (baseline) return baseline;

  const afterStart = await fetchTikTokAudience(songUuid, tiktokSoundId, {
    startDate: campaignStartDate,
    endDate: today,
    sort: "asc",
  });
  return afterStart[0] ?? null;
}
