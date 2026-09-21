"use client";

import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  pickRandomCarouselSet,
  type CreatorVideo,
} from "@/content/creator-videos";
import { cn } from "@/lib/utils";
import { useMotionEnabled } from "@/hooks/useMotionEnabled";
import {
  clearMediaWarmQueue,
  warmMediaSource,
} from "./hero-video-preload";
import "./hero-carousel.css";

type HeroCreatorCarouselProps = {
  videos: readonly CreatorVideo[];
};

/** Matches the original four-card reel's approximate resting speed. */
const AUTO_SPEED_PX_PER_MS = 0.024;
const DRAG_CLICK_THRESHOLD = 6;
const GESTURE_AXIS_THRESHOLD = 7;
const MOBILE_MAX_THROW_PX_PER_MS = 1.5;
const DESKTOP_MAX_THROW_PX_PER_MS = 2.4;
/** Time constant (ms) for blending release velocity back toward auto-scroll. */
const SETTLE_MS = 520;
/** How far back (ms) to look when estimating release flick velocity. */
const VELOCITY_SAMPLE_WINDOW_MS = 90;
/**
 * The slot pool has to be wide enough to hold the visible cards plus a runway
 * of pre-loaded ones on either side, because a slot only recycles at the edge
 * of the window. The wider the window, the longer a newly assigned video has
 * to buffer before it can reach the viewport.
 */
const DESKTOP_POOL_SIZE = 17;
const MOBILE_POOL_SIZE = 11;
/** Slots held behind the viewport, so dragging backwards is prepared too. */
const DESKTOP_LEAD_SLOTS = 5;
const MOBILE_LEAD_SLOTS = 4;
/** Floor for desktop: four visible cards plus one incoming pre-play slot. */
const DESKTOP_MIN_PLAY_COUNT = 5;
/** Mobile: the visible card(s) plus one incoming card already playing. */
const MOBILE_PLAY_COUNT = 3;
/** Pre-play lead-in, expressed in card strides. */
const PLAY_LEAD_STRIDES = 0.9;
/**
 * How far out, in card strides, a card is buffered ahead as well as decoded.
 * Kept close to the viewport because this is the expensive tier.
 */
const DESKTOP_WARM_STRIDES = 1.8;
const MOBILE_WARM_STRIDES = 1.2;
/**
 * How far out a card holds a decoded first frame. This is the band that makes
 * dragging feel instant, so it is stretched across the rest of the pool.
 */
const DESKTOP_FRAME_STRIDES = 9;
const MOBILE_FRAME_STRIDES = 6;
/**
 * Equivalents for the reduced-motion scroller, which has no stride to measure
 * against. Doubled for desktop, where cards are wider and more are on screen.
 */
const STATIC_WARM_MARGIN_PX = 260;
const STATIC_FRAME_MARGIN_PX = 1100;
/** Keeps the background warm-up clear of the initial page load. */
const IDLE_WARM_DELAY_MS = 1200;
/** Weighting that retires already-passed cards ahead of approaching ones. */
const EXITING_RANK_PENALTY = 2.2;
const FOCUS_X_RATIO = 0.36;

function wrapOffset(offset: number, width: number) {
  if (width <= 0) return 0;
  let next = offset % width;
  if (next > 0) next -= width;
  if (next <= -width) next += width;
  return next;
}

type VelocitySample = {
  vx: number;
  at: number;
};

type GestureAxis = "pending" | "horizontal" | "vertical" | null;

type VideoPlatform = CreatorVideo["platform"];

function oppositePlatform(platform: VideoPlatform | null): VideoPlatform | null {
  if (platform === "tiktok") return "instagram";
  if (platform === "instagram") return "tiktok";
  return null;
}

function interleavePlayableVideos(
  videos: readonly CreatorVideo[],
  failedVideoIds: ReadonlySet<string>,
) {
  const playable = videos.filter((video) => !failedVideoIds.has(video.id));
  if (playable.length <= 1) return playable;

  const creators = Array.from(new Set(playable.map((video) => video.creator)));
  const queues = new Map<string, Record<VideoPlatform, CreatorVideo[]>>();

  for (const creator of creators) {
    queues.set(creator, { tiktok: [], instagram: [] });
  }
  for (const video of playable) {
    queues.get(video.creator)?.[video.platform].push(video);
  }

  const remainingFor = (creator: string, platform?: VideoPlatform) => {
    const entry = queues.get(creator);
    if (!entry) return 0;
    if (platform) return entry[platform].length;
    return entry.tiktok.length + entry.instagram.length;
  };

  const result: CreatorVideo[] = [];
  let lastCreator: string | null = null;
  let lastPlatform: VideoPlatform | null = null;
  const recentCreators: string[] = [];

  while (result.length < playable.length) {
    const preferPlatform = oppositePlatform(lastPlatform) ?? "tiktok";
    const firstCreator = result[0]?.creator;
    const picksLeft = playable.length - result.length;

    type MixCandidate = {
      creator: string;
      platform: VideoPlatform;
      score: number;
    };

    const candidates: MixCandidate[] = [];

    for (const creator of creators) {
      for (const platform of ["tiktok", "instagram"] as const) {
        if (remainingFor(creator, platform) === 0) continue;
        if (picksLeft === 1 && firstCreator && creator === firstCreator) {
          continue;
        }

        let score = remainingFor(creator) * 3 + remainingFor(creator, platform);
        if (creator === lastCreator) score -= 140;
        const recentIndex = recentCreators.indexOf(creator);
        if (recentIndex >= 0) score -= (3 - recentIndex) * 28;
        if (platform === preferPlatform) score += 55;
        if (lastPlatform && platform === lastPlatform) score -= 48;
        const lastCreatorIndex = lastCreator
          ? creators.indexOf(lastCreator)
          : -1;
        if (lastCreatorIndex >= 0) {
          const rotation =
            (creators.indexOf(creator) - lastCreatorIndex + creators.length) %
            creators.length;
          if (rotation === 1) score += 10;
        }
        candidates.push({ creator, platform, score });
      }
    }

    const pool =
      candidates.length > 0
        ? candidates
        : creators.flatMap((creator) =>
            (["tiktok", "instagram"] as const)
              .filter((platform) => remainingFor(creator, platform) > 0)
              .map((platform) => ({ creator, platform, score: 0 })),
          );

    if (pool.length === 0) break;

    pool.sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if (
        left.platform === preferPlatform &&
        right.platform !== preferPlatform
      ) {
        return -1;
      }
      if (
        right.platform === preferPlatform &&
        left.platform !== preferPlatform
      ) {
        return 1;
      }
      return creators.indexOf(left.creator) - creators.indexOf(right.creator);
    });

    const pick: MixCandidate =
      lastCreator && pool[0].creator === lastCreator
        ? (pool.find((item) => item.creator !== lastCreator) ?? pool[0])
        : pool[0];

    const next = queues.get(pick.creator)?.[pick.platform].shift();
    if (!next) break;
    result.push(next);
    lastCreator = pick.creator;
    lastPlatform = pick.platform;
    recentCreators.unshift(pick.creator);
    if (recentCreators.length > 3) recentCreators.pop();
  }

  return result.length > 0 ? result : playable;
}

function nativeMediaSrc(video: CreatorVideo, nonce: number) {
  const path =
    video.platform === "tiktok"
      ? `/api/tiktok-video/${encodeURIComponent(video.id)}`
      : `/api/instagram-reel/${encodeURIComponent(video.id)}`;
  // The normal request redirects the browser to the social platform's CDN, so
  // Vercel only serves a tiny redirect response. If direct playback is blocked,
  // the existing bounded Vercel proxy remains available as a compatibility
  // fallback on the player's retry path.
  return nonce > 0 ? `${path}?proxy=1&r=${nonce}` : path;
}

/**
 * How much of a video a slot is holding ready:
 * - `play`   visible, or about to be, and playing
 * - `warm`   buffered ahead and decoded to its first frame, paused
 * - `frame`  first frame decoded and nothing more, paused
 * - `idle`   no network activity; keeps whatever it already buffered
 *
 * `frame` is what stops a dragged-to card showing as blank. Holding a decoded
 * opening frame costs a fraction of a full buffer, so it can be applied to the
 * whole width of the pool, while `warm` stays close to the viewport.
 */
type PlayTier = "play" | "warm" | "frame" | "idle";

function preloadFor(tier: PlayTier) {
  if (tier === "play" || tier === "warm") return "auto";
  return tier === "frame" ? "metadata" : "none";
}

/**
 * Playback is gated while the reel is off screen or the tab is hidden, but the
 * buffered frames are deliberately kept: a playing card drops back to warm so
 * it resumes instantly instead of loading again on return.
 */
function resolveTier(tier: PlayTier, playbackAllowed: boolean): PlayTier {
  if (playbackAllowed || tier !== "play") return tier;
  return "warm";
}

function SocialNativePlayer({
  video,
  tier,
  onPlayable,
  onFailure,
}: {
  video: CreatorVideo;
  tier: PlayTier;
  onPlayable: (videoId: string) => void;
  onFailure: (videoId: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const reportedRef = useRef(false);
  const appliedSrcRef = useRef<string | null>(null);
  const warmedRef = useRef(false);
  const shouldPlayRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [retry, setRetry] = useState({ id: video.id, count: 0 });

  const attempt = retry.id === video.id ? retry.count : 0;
  const mediaSrc = nativeMediaSrc(video, attempt);

  const playMuted = useCallback(() => {
    const node = videoRef.current;
    if (!node) return;
    node.muted = true;
    node.defaultMuted = true;
    node.volume = 0;
    node.playsInline = true;
    node.setAttribute("playsinline", "true");
    node.setAttribute("webkit-playsinline", "true");
    const attempt = node.play();
    if (!attempt) return;
    void attempt
      .then(() => setAutoplayBlocked(false))
      .catch(() => setAutoplayBlocked(true));
  }, []);

  /**
   * Safari treats `preload="auto"` as a suggestion and will happily leave a
   * paused element with nothing decoded, which defeats the point of warming it.
   * A muted play stopped on the first frame forces the decode. The element is
   * still transparent at this point, so none of this is visible.
   */
  const warmToFirstFrame = useCallback(() => {
    const node = videoRef.current;
    if (!node || warmedRef.current) return;
    warmedRef.current = true;
    if (node.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return;

    const settle = () => {
      node.removeEventListener("loadeddata", settle);
      if (!shouldPlayRef.current) node.pause();
    };
    node.addEventListener("loadeddata", settle);
    node.muted = true;
    node.playsInline = true;
    const started = node.play();
    if (started) void started.catch(() => {});
  }, []);

  // The source is assigned imperatively rather than through JSX so that a slot
  // recycling onto a new video reuses the same element. Remounting would throw
  // away every buffered byte and restart the request from nothing, which is
  // what made cards appear late when the carousel was dragged.
  useEffect(() => {
    const node = videoRef.current;
    if (!node) return;
    // A dormant slot that has never loaded stays empty until it is promoted.
    if (tier === "idle" && appliedSrcRef.current === null) return;
    if (appliedSrcRef.current === mediaSrc) return;

    appliedSrcRef.current = mediaSrc;
    reportedRef.current = false;
    warmedRef.current = false;
    setReady(false);
    setAutoplayBlocked(false);
    node.preload = preloadFor(tier);
    node.setAttribute("referrerpolicy", "no-referrer");
    node.src = mediaSrc;
    node.load();
  }, [mediaSrc, tier]);

  useEffect(() => {
    // Read by the warm-up's first-frame handler, which must not pause a card
    // that has been promoted to playing while it was waiting for data.
    shouldPlayRef.current = tier === "play";

    const node = videoRef.current;
    if (!node || appliedSrcRef.current === null) return;

    node.preload = preloadFor(tier);

    if (tier === "play") {
      playMuted();
      return;
    }

    node.pause();
    const frame = window.requestAnimationFrame(() => setAutoplayBlocked(false));
    if (tier === "warm" || tier === "frame") warmToFirstFrame();
    return () => window.cancelAnimationFrame(frame);
  }, [mediaSrc, playMuted, tier, warmToFirstFrame]);

  return (
    <div className="hero-creator-reel__native-wrap">
      <video
        ref={videoRef}
        className={cn(
          "hero-creator-reel__native",
          ready && "hero-creator-reel__native--ready",
        )}
        muted
        loop
        playsInline
        disablePictureInPicture
        disableRemotePlayback
        controls={false}
        controlsList="nodownload nofullscreen noremoteplayback"
        // Revealed on the first decoded frame rather than on playback, so a
        // warmed card is already showing its opening frame when it slides in.
        onLoadedData={() => setReady(true)}
        onCanPlay={() => {
          if (tier === "play") playMuted();
        }}
        onPlaying={() => {
          setReady(true);
          setAutoplayBlocked(false);
          if (reportedRef.current) return;
          reportedRef.current = true;
          onPlayable(video.id);
        }}
        onError={(event) => {
          const node = event.currentTarget;
          if (appliedSrcRef.current === null) return;
          // Recycling a slot aborts whatever the element was loading, and that
          // surfaces here as an error. Treating it as a real failure would
          // retire a perfectly good video and rebuild the whole reel, which is
          // what made a single drag reload every card.
          if (node.error?.code === MediaError.MEDIA_ERR_ABORTED) return;
          if (node.getAttribute("src") !== appliedSrcRef.current) return;

          if (attempt >= 2) {
            onFailure(video.id);
            return;
          }
          setReady(false);
          setRetry({ id: video.id, count: attempt + 1 });
        }}
      />
      {autoplayBlocked ? (
        <button
          type="button"
          className="hero-creator-reel__play-hint"
          aria-label={`Play ${video.creator} ${video.platform} video`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            playMuted();
          }}
        >
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <path d="M3.2 1.6v8.8L10.4 6 3.2 1.6Z" fill="currentColor" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

function formatStatCount(value: number) {
  if (value <= 0) return null;
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (value >= 10_000) return `${Math.round(value / 1000)}K`;
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  }
  return String(value);
}

const CardActionStack = memo(function CardActionStack({
  likes,
}: {
  likes: number;
}) {
  const likeCount = formatStatCount(likes);

  return (
    <ul className="hero-creator-reel__actions" aria-hidden="true">
      <li className="hero-creator-reel__action">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12.1 20.2s-6.8-4.2-8.6-8.1C2.3 9.4 3.6 6.4 6.6 5.7c1.8-.4 3.5.4 4.4 1.8.9-1.4 2.6-2.2 4.4-1.8 3 .7 4.3 3.7 3.1 6.4-1.8 3.9-8.4 8.1-8.4 8.1Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
        </svg>
        {likeCount ? (
          <span className="hero-creator-reel__action-count">{likeCount}</span>
        ) : null}
      </li>
      <li className="hero-creator-reel__action">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M19.2 7.2A4.2 4.2 0 0 0 15 3H9A4.2 4.2 0 0 0 4.8 7.2v6.2A4.2 4.2 0 0 0 9 17.6h.6v2.7c0 .5.6.8 1 .4L14 17.6h1A4.2 4.2 0 0 0 19.2 13.4V7.2Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
        </svg>
      </li>
      <li className="hero-creator-reel__action">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M3.9 19.9C4.6 11.6 8.8 7.8 13 7.8V4.1l7.1 5.9-7.1 5.8v-3.4c-3.1 0-5.7 2.5-6.2 7.5Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </li>
    </ul>
  );
});

const PlatformGlyph = memo(function PlatformGlyph({
  platform,
}: {
  platform: CreatorVideo["platform"];
}) {
  if (platform === "instagram") {
    return (
      <svg
        viewBox="0 0 24 24"
        className="hero-creator-reel__platform-icon"
        aria-hidden="true"
      >
        <rect
          x="3.4"
          y="3.4"
          width="17.2"
          height="17.2"
          rx="5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
        />
        <circle
          cx="12"
          cy="12"
          r="4.1"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
        />
        <circle cx="17.15" cy="6.85" r="1.05" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      className="hero-creator-reel__platform-icon"
      aria-hidden="true"
      fill="none"
    >
      <path
        d="M14.2 7.2c.7 2.3 2.3 3.4 4.3 3.6v2.4c-1.8-.1-3.4-.7-4.3-1.8v5.4c0 3-2.4 4.7-5.2 4.7-2.7 0-5.1-1.6-5.1-4.6 0-3 2.4-4.7 5.1-4.7.5 0 1 .1 1.4.2v2.6c-.4-.2-.8-.3-1.3-.3-1.4 0-2.5.9-2.5 2.3s1.1 2.2 2.5 2.2 2.5-.8 2.5-2.3V3.2h2.6v4Z"
        fill="currentColor"
      />
    </svg>
  );
});

function mod(value: number, length: number) {
  return ((value % length) + length) % length;
}

function sameIds(left: readonly string[], right: readonly string[]) {
  if (left.length !== right.length) return false;
  return left.every((id, index) => id === right[index]);
}

function sameTiers(left: readonly PlayTier[], right: readonly PlayTier[]) {
  if (left.length !== right.length) return false;
  return left.every((tier, index) => tier === right[index]);
}

function readCssLength(element: HTMLElement, property: string) {
  const raw = getComputedStyle(element).getPropertyValue(property).trim();
  if (!raw) return 0;
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value)) return 0;
  if (raw.endsWith("rem")) {
    const rootSize = Number.parseFloat(
      getComputedStyle(document.documentElement).fontSize,
    );
    return value * (Number.isFinite(rootSize) ? rootSize : 16);
  }
  return value;
}

function poolSizeFor(isMobile: boolean, videoCount: number) {
  return Math.max(
    1,
    Math.min(isMobile ? MOBILE_POOL_SIZE : DESKTOP_POOL_SIZE, videoCount),
  );
}

/**
 * Memoised so the ~11 recycling commits per second only re-render the slots
 * whose video or flags actually changed, instead of every card and its SVGs.
 */
const SocialVideoCard = memo(function SocialVideoCard({
  video,
  tier,
  playersEnabled,
  onVideoPlayable,
  onVideoFailure,
}: {
  video: CreatorVideo;
  tier: PlayTier;
  playersEnabled: boolean;
  onVideoPlayable: (videoId: string) => void;
  onVideoFailure: (videoId: string) => void;
}) {
  return (
    <article className="hero-creator-reel__card">
      <div className="hero-creator-reel__card-shell">
        <div className="hero-creator-reel__card-media">
          {/* Stays mounted underneath the video for the whole life of the card,
              so a loading, slow or failed source shows artwork rather than an
              empty panel. The video covers it once it has a frame to show. */}
          <div className="hero-creator-reel__placeholder" aria-hidden="true">
            <div className="hero-creator-reel__placeholder-grid" />
            <span className="hero-creator-reel__placeholder-letter">
              {video.creator.charAt(0)}
            </span>
          </div>

          {playersEnabled ? (
            <SocialNativePlayer
              video={video}
              tier={tier}
              onPlayable={onVideoPlayable}
              onFailure={onVideoFailure}
            />
          ) : null}

          <div className="hero-creator-reel__overlay">
            <div className="hero-creator-reel__scrim" aria-hidden="true" />

            <div className="hero-creator-reel__platform-badge" aria-hidden="true">
              <PlatformGlyph platform={video.platform} />
            </div>

            <CardActionStack likes={video.likes} />

            <div className="hero-creator-reel__meta">
              <p className="hero-creator-reel__meta-name">{video.creator}</p>
              <p className="hero-creator-reel__meta-platform">
                {video.platform === "tiktok" ? "TikTok" : "Instagram"}
              </p>
            </div>
          </div>

          <a
            className="hero-creator-reel__post-link"
            href={video.url}
            target="_blank"
            rel="noreferrer"
            aria-label={`View ${video.creator} ${video.platform} post`}
            draggable={false}
            // Only the cards on screen take a tab stop; the buffered ones
            // waiting off to either side stay out of the tab order.
            tabIndex={tier === "play" ? 0 : -1}
          />
        </div>
      </div>
    </article>
  );
});

export function HeroCreatorCarousel({ videos }: HeroCreatorCarouselProps) {
  const motionEnabled = useMotionEnabled();
  const [sessionVideos, setSessionVideos] = useState(videos);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setSessionVideos(pickRandomCarouselSet(videos));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [videos]);
  const rootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const slotElsRef = useRef<(HTMLDivElement | null)[]>([]);
  const slotLogicalRef = useRef<number[]>([]);
  const videosRef = useRef<readonly CreatorVideo[]>([]);
  const offsetRef = useRef(0);
  const setWidthRef = useRef(0);
  const strideRef = useRef(0);
  const cardWidthRef = useRef(0);
  const viewportWidthRef = useRef(0);
  const baseIndexRef = useRef(-1);
  const autoVelocityRef = useRef(0);
  const velocityRef = useRef(0);
  const draggingRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const lastXRef = useRef(0);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const lastTimeRef = useRef(0);
  const gestureAxisRef = useRef<GestureAxis>(null);
  const dragDistanceRef = useRef(0);
  const samplesRef = useRef<VelocitySample[]>([]);
  const pendingPointerDxRef = useRef(0);
  const rafRef = useRef(0);
  const commitOffsetRef = useRef<(nextOffset: number) => void>(() => {});
  const paintSlotsRef = useRef<() => void>(() => {});
  const slotTiersRef = useRef<PlayTier[]>([]);
  const leadSlotsRef = useRef(1);
  const warmExpandedRef = useRef(false);
  const slotIdsRef = useRef<string[]>([]);
  const lastReactSyncRef = useRef(0);
  const [failedVideoIds, setFailedVideoIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [playableVideoIds, setPlayableVideoIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [isMobile, setIsMobile] = useState(false);
  const [carouselActive, setCarouselActive] = useState(true);
  const [tabHidden, setTabHidden] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [staticWarmIds, setStaticWarmIds] = useState<string[]>([]);
  const [staticFrameIds, setStaticFrameIds] = useState<string[]>([]);
  const [staticPlayIds, setStaticPlayIds] = useState<string[]>([]);
  // useReducedMotion is unknown during SSR. Keep the server and first browser
  // render on the same static layout, then enable the virtual reel after
  // hydration when the actual media preference is available.
  const animate = motionEnabled;
  const canonicalVideos = useMemo(
    () => interleavePlayableVideos(sessionVideos, new Set()),
    [sessionVideos],
  );
  const activeVideos = useMemo(
    () => interleavePlayableVideos(sessionVideos, failedVideoIds),
    [failedVideoIds, sessionVideos],
  );
  const usePlaceholderOnly =
    (failedVideoIds.size >= 4 && playableVideoIds.size === 0) ||
    (failedVideoIds.size >= 8 && playableVideoIds.size < 4) ||
    (failedVideoIds.size > 0 && activeVideos.length < 8);
  const displayVideos = usePlaceholderOnly ? canonicalVideos : activeVideos;
  const videoSignature = useMemo(
    () => displayVideos.map((item) => item.id).join("|"),
    [displayVideos],
  );
  const poolSize = poolSizeFor(isMobile, displayVideos.length);
  const [slotVideos, setSlotVideos] = useState<CreatorVideo[]>(() =>
    displayVideos.length === 0
      ? []
      : Array.from(
          { length: poolSizeFor(isMobile, displayVideos.length) },
          (_, index) => displayVideos[mod(index - 1, displayVideos.length)],
        ),
  );
  const [slotTiers, setSlotTiers] = useState<PlayTier[]>(() =>
    Array.from({ length: poolSize }, () => "idle" as PlayTier),
  );
  useEffect(() => {
    videosRef.current = displayVideos;
  }, [displayVideos]);
  const handleVideoPlayable = useCallback((videoId: string) => {
    setPlayableVideoIds((previous) => {
      if (previous.has(videoId)) return previous;
      const next = new Set(previous);
      next.add(videoId);
      return next;
    });
  }, []);
  const handleVideoFailure = useCallback((videoId: string) => {
    setPlayableVideoIds((previous) => {
      if (!previous.has(videoId)) return previous;
      const next = new Set(previous);
      next.delete(videoId);
      return next;
    });
    setFailedVideoIds((previous) => {
      if (previous.has(videoId)) return previous;
      const next = new Set(previous);
      next.add(videoId);
      return next;
    });
  }, []);

  const resetSlotWindow = useCallback(
    (nextPoolSize: number, list: readonly CreatorVideo[]) => {
      if (list.length === 0 || nextPoolSize <= 0) {
        slotLogicalRef.current = [];
        setSlotVideos([]);
        setSlotTiers([]);
        return;
      }

      const lead = Math.min(leadSlotsRef.current, nextPoolSize - 1);
      const stride = strideRef.current;
      const base =
        stride > 0 ? Math.floor(-offsetRef.current / stride) - lead : -lead;
      const logical = Array.from(
        { length: nextPoolSize },
        (_, index) => base + index,
      );
      slotLogicalRef.current = logical;
      baseIndexRef.current = base;
      const nextVideos = logical.map(
        (index) => list[mod(index, list.length)],
      );
      // Real tiers land in the same commit, once the track has been measured.
      const nextTiers = Array.from(
        { length: nextPoolSize },
        () => "idle" as PlayTier,
      );
      slotIdsRef.current = nextVideos.map((video) => video.id);
      slotTiersRef.current = nextTiers;
      setSlotVideos(nextVideos);
      setSlotTiers(nextTiers);
    },
    [],
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      ([entry]) => setCarouselActive(entry.isIntersecting),
      { rootMargin: "180px 0px", threshold: 0 },
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  // Backgrounded tabs stop the movement loop and playback outright, regardless
  // of what the IntersectionObserver still believes about the hero.
  useEffect(() => {
    const sync = () => setTabHidden(document.visibilityState === "hidden");
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  useLayoutEffect(() => {
    if (!animate) return;
    const frame = window.requestAnimationFrame(() => {
      resetSlotWindow(poolSize, displayVideos);
      paintSlotsRef.current();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [animate, displayVideos, poolSize, resetSlotWindow, videoSignature]);

  // Cards outside the slot window get no element, so nothing has asked their
  // route to resolve an upstream URL yet — the slowest part of a cold request.
  // Priming that during idle time means a distant card promoted by a long drag
  // starts streaming immediately instead of waiting on a lookup. Ordered from
  // the current position outwards, and held back until the reel is on screen so
  // it never competes with the initial page load.
  useEffect(() => {
    if (!carouselActive || tabHidden) return;
    if (displayVideos.length === 0) return;

    const start = window.setTimeout(() => {
      // Opening the warm band and priming distant routes are the same moment:
      // the point where the reel is on screen and the load has calmed down.
      warmExpandedRef.current = true;

      const count = displayVideos.length;
      const from = Math.max(baseIndexRef.current, 0);
      for (let step = 0; step < count; step += 1) {
        const video = displayVideos[mod(from + step, count)];
        warmMediaSource(nativeMediaSrc(video, 0));
      }
    }, IDLE_WARM_DELAY_MS);

    return () => {
      window.clearTimeout(start);
      clearMediaWarmQueue();
    };
  }, [carouselActive, displayVideos, tabHidden]);

  // The reduced-motion reel is a plain scroller, so bands are measured from how
  // far each card sits outside the viewport rather than from the track offset.
  // The observer margin has to reach past the warm band for this to see the
  // cards it needs to start buffering early.
  useEffect(() => {
    if (animate) return;
    const root = viewportRef.current;
    if (!root) return;

    const maxPlay = isMobile ? 1 : 2;
    const maxWarm = isMobile ? 2 : 4;
    const warmGap = isMobile ? STATIC_WARM_MARGIN_PX : STATIC_WARM_MARGIN_PX * 2;
    const frameGap = isMobile
      ? STATIC_FRAME_MARGIN_PX
      : STATIC_FRAME_MARGIN_PX * 2;
    // Holds the cards inside the observer margin. Their distances are measured
    // fresh on every publish, because an entry that has not crossed a threshold
    // recently would otherwise carry a stale rect from an earlier scroll.
    const tracked = new Map<string, HTMLElement>();

    const publish = () => {
      const bounds = root.getBoundingClientRect();
      const entries = [...tracked.entries()].map(([id, card]) => {
        const rect = card.getBoundingClientRect();
        const overlap =
          Math.min(rect.right, bounds.right) - Math.max(rect.left, bounds.left);
        return [
          id,
          {
            ratio: rect.width > 0 ? Math.max(overlap, 0) / rect.width : 0,
            gap: Math.max(bounds.left - rect.right, rect.left - bounds.right, 0),
          },
        ] as const;
      });

      const nextPlay = entries
        .filter(([, item]) => item.ratio >= 0.08)
        .sort((left, right) => right[1].ratio - left[1].ratio)
        .slice(0, maxPlay)
        .map(([id]) => id);
      // Capped as well as bounded by distance: the observer margin reaches a
      // long way, and buffering everything inside it would pull most of the
      // reel down at full size.
      const nextWarm = entries
        .filter(([id, item]) => item.gap <= warmGap && !nextPlay.includes(id))
        .sort((left, right) => left[1].gap - right[1].gap)
        .slice(0, maxWarm)
        .map(([id]) => id);
      // Everything the observer can see at all, so cards past the warm band
      // still hold a frame while those past the margin stay dormant.
      const nextFrame = entries.map(([id]) => id);
      setStaticPlayIds((previous) =>
        sameIds(previous, nextPlay) ? previous : nextPlay,
      );
      setStaticWarmIds((previous) =>
        sameIds(previous, nextWarm) ? previous : nextWarm,
      );
      setStaticFrameIds((previous) =>
        sameIds(previous, nextFrame) ? previous : nextFrame,
      );
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const card = entry.target as HTMLElement;
          const id = card.dataset.videoId;
          if (!id) continue;
          if (entry.isIntersecting) tracked.set(id, card);
          else tracked.delete(id);
        }
        publish();
      },
      {
        root,
        rootMargin: `0px ${frameGap}px`,
        threshold: [0, 0.08, 0.25, 0.5],
      },
    );

    root
      .querySelectorAll<HTMLElement>("[data-reel-card]")
      .forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [animate, isMobile, videoSignature]);

  useLayoutEffect(() => {
    if (!animate) return;

    const track = trackRef.current;
    const viewport = viewportRef.current;
    const root = rootRef.current;
    if (!track || !viewport || !root) return;

    const paintTrack = () => {
      track.style.transform = `translate3d(${offsetRef.current}px, 0, 0)`;
    };

    const paintSlots = () => {
      const stride = strideRef.current;
      const logical = slotLogicalRef.current;
      const nodes = slotElsRef.current;
      for (let index = 0; index < logical.length; index += 1) {
        const node = nodes[index];
        if (!node) continue;
        node.style.transform = `translate3d(${logical[index] * stride}px, 0, 0)`;
      }
    };
    paintSlotsRef.current = paintSlots;

    /**
     * Moves the window to `desiredBase` while disturbing as few slots as
     * possible. A slot that still holds a wanted index keeps it, which is what
     * lets its element keep the video it has already buffered and decoded;
     * only slots that fell outside the window pick up the indices that just
     * entered it. Rewriting every slot in order instead would shuffle videos
     * between elements and force all of them to load again.
     */
    const alignSlots = (desiredBase: number) => {
      const logical = slotLogicalRef.current;
      const pool = logical.length;
      if (pool === 0) return;

      const desired = new Set<number>();
      for (let index = 0; index < pool; index += 1) {
        desired.add(desiredBase + index);
      }

      const claimed = new Set<number>();
      const freeSlots: number[] = [];
      for (let index = 0; index < pool; index += 1) {
        const current = logical[index];
        // `claimed` also guards against a duplicate index surviving in two
        // slots, which would otherwise leave the window with a hole.
        if (desired.has(current) && !claimed.has(current)) {
          claimed.add(current);
        } else {
          freeSlots.push(index);
        }
      }

      let cursor = 0;
      for (const slot of freeSlots) {
        while (cursor < pool && claimed.has(desiredBase + cursor)) {
          cursor += 1;
        }
        if (cursor >= pool) break;
        logical[slot] = desiredBase + cursor;
        claimed.add(desiredBase + cursor);
        cursor += 1;
      }
    };

    const syncReactWindow = (force = false) => {
      const list = videosRef.current;
      const logical = slotLogicalRef.current;
      const count = list.length;
      if (count === 0 || logical.length === 0) return;

      const stride = strideRef.current;
      const cardWidth = cardWidthRef.current;
      const viewportWidth = viewportWidthRef.current;
      const offset = offsetRef.current;
      // The desktop reel spans a wide range of widths, so the cap scales with
      // how many cards actually fit: every card that can be on screen, plus one
      // pre-play slot. Eligibility below still decides the real count, so this
      // only ever raises the ceiling on wide displays.
      const fitsOnScreen = stride > 0 ? Math.floor(viewportWidth / stride) : 0;
      const playLimit = isMobile
        ? MOBILE_PLAY_COUNT
        : Math.max(DESKTOP_MIN_PLAY_COUNT, fitsOnScreen + 2);
      /**
       * How far outside the viewport a card may start playing. Cards travel
       * right-to-left, so this lets the next card spin up before it crosses the
       * edge and prevents a visible pause on entry.
       */
      const playLead = stride * PLAY_LEAD_STRIDES;
      /**
       * The two bands outside the play lead-in. Everything inside `warmPad` is
       * buffered and decoded so it can be shown the instant it is dragged in;
       * the band out to `metaPad` holds headers so promotion is cheap. Both are
       * symmetric, which covers dragging in either direction.
       */
      // Both bands are held at the play lead-in until the page has settled, so
      // the first load only pulls the cards that are actually on screen. They
      // open up once there is idle time to spend on the ones either side.
      const expanded = warmExpandedRef.current;
      const warmPad = expanded
        ? stride * (isMobile ? MOBILE_WARM_STRIDES : DESKTOP_WARM_STRIDES)
        : playLead;
      const framePad = expanded
        ? stride * (isMobile ? MOBILE_FRAME_STRIDES : DESKTOP_FRAME_STRIDES)
        : playLead;
      const nextIds: string[] = [];
      const nextVideos: CreatorVideo[] = [];
      const metrics = logical.map((logicalIndex, slot) => {
        const video = list[mod(logicalIndex, count)];
        nextVideos[slot] = video;
        nextIds[slot] = video.id;
        const left = offset + logicalIndex * stride;
        const right = left + cardWidth;
        const center = left + cardWidth / 2;
        const focus = viewportWidth * FOCUS_X_RATIO;
        const dist = Math.abs(center - focus);
        const overlap = Math.min(right, viewportWidth) - Math.max(left, 0);
        const visibleEnough = overlap >= cardWidth * 0.08;
        const withinWarm = right > -warmPad && left < viewportWidth + warmPad;
        const withinFrame =
          right > -framePad && left < viewportWidth + framePad;
        const playEligible =
          right > -playLead && left < viewportWidth + playLead;
        // A card past the focus point is on its way out, so it yields its slot
        // before an approaching card is left unplayed. Continuous at zero, so
        // ranking never flips back and forth as a card crosses focus.
        const fromFocus = center - focus;
        const playRank =
          fromFocus >= 0 ? fromFocus : -fromFocus * EXITING_RANK_PENALTY;
        return {
          slot,
          dist,
          visibleEnough,
          withinWarm,
          withinFrame,
          playEligible,
          playRank,
        };
      });

      const playingSlots = new Set(
        metrics
          .filter((item) => item.playEligible)
          .sort((left, right) => left.playRank - right.playRank)
          .slice(0, playLimit)
          .map((item) => item.slot),
      );

      const nextTiers: PlayTier[] = metrics.map((item) => {
        if (playingSlots.has(item.slot)) return "play";
        if (item.withinWarm) return "warm";
        return item.withinFrame ? "frame" : "idle";
      });

      if (!isMobile) {
        const span = Math.max(viewportWidth * 0.52, 1);
        for (const item of metrics) {
          const node = slotElsRef.current[item.slot];
          if (!node) continue;
          const distNorm = item.dist / span;
          const depth =
            !item.visibleEnough || distNorm >= 0.68
              ? "edge"
              : distNorm < 0.3
                ? "focus"
                : "near";
          if (node.dataset.depth !== depth) node.dataset.depth = depth;
        }
      }

      if (
        !force &&
        sameIds(slotIdsRef.current, nextIds) &&
        sameTiers(slotTiersRef.current, nextTiers)
      ) {
        return;
      }

      slotIdsRef.current = nextIds;
      slotTiersRef.current = nextTiers;
      setSlotVideos(nextVideos);
      setSlotTiers(nextTiers);
    };

    const commitOffset = (nextOffset: number) => {
      const width = setWidthRef.current;
      const stride = strideRef.current;
      const previous = offsetRef.current;
      const wrapped = wrapOffset(nextOffset, width);
      let slotsMoved = false;
      const count = videosRef.current.length;

      if (width > 0 && count > 0) {
        const jump = wrapped - previous;
        if (jump > width * 0.5) {
          for (let index = 0; index < slotLogicalRef.current.length; index += 1) {
            slotLogicalRef.current[index] -= count;
          }
          slotsMoved = true;
        } else if (jump < -width * 0.5) {
          for (let index = 0; index < slotLogicalRef.current.length; index += 1) {
            slotLogicalRef.current[index] += count;
          }
          slotsMoved = true;
        }
      }

      offsetRef.current = wrapped;
      const lead = leadSlotsRef.current;
      const nextBase =
        stride > 0 ? Math.floor(-wrapped / stride) - lead : -lead;
      if (nextBase !== baseIndexRef.current) {
        baseIndexRef.current = nextBase;
        alignSlots(nextBase);
        slotsMoved = true;
      }

      paintTrack();
      if (slotsMoved) paintSlots();

      const now = performance.now();
      if (slotsMoved || now - lastReactSyncRef.current >= 90) {
        lastReactSyncRef.current = now;
        syncReactWindow(slotsMoved);
      }
    };
    commitOffsetRef.current = commitOffset;

    const measure = () => {
      const probe = slotElsRef.current.find(Boolean);
      const cardWidth = probe?.offsetWidth ?? 0;
      const gap = readCssLength(root, "--creator-reel-gap");
      const stride = cardWidth + gap;
      const count = videosRef.current.length;
      cardWidthRef.current = cardWidth;
      strideRef.current = stride;
      viewportWidthRef.current = viewport.clientWidth;

      // The lead can only be as deep as the pool allows once the visible cards
      // have taken their slots, otherwise a wide display would run out of slots
      // on the right and leave a real gap in the reel.
      const pool = slotLogicalRef.current.length;
      const fits = stride > 0 ? Math.ceil(viewport.clientWidth / stride) : 0;
      const wanted = isMobile ? MOBILE_LEAD_SLOTS : DESKTOP_LEAD_SLOTS;
      leadSlotsRef.current =
        pool > 0 ? Math.max(1, Math.min(wanted, pool - fits - 1)) : wanted;
      setWidthRef.current = stride > 0 && count > 0 ? stride * count : 0;
      autoVelocityRef.current =
        setWidthRef.current > 0 ? -AUTO_SPEED_PX_PER_MS : 0;
      if (!draggingRef.current && Math.abs(velocityRef.current) < 0.0001) {
        velocityRef.current = autoVelocityRef.current;
      }
      commitOffset(offsetRef.current);
      paintSlots();
    };

    measure();
    velocityRef.current = autoVelocityRef.current;
    syncReactWindow(true);

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(root);
    resizeObserver.observe(viewport);

    if (!carouselActive || tabHidden) {
      return () => {
        resizeObserver.disconnect();
        commitOffsetRef.current = () => {};
      };
    }

    // Re-seeded on every resume, so returning from a hidden tab cannot produce
    // a large delta and make the reel leap forward.
    let lastFrame = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(now - lastFrame, 32);
      lastFrame = now;
      const width = setWidthRef.current;

      if (width > 0) {
        if (draggingRef.current) {
          const dx = pendingPointerDxRef.current;
          if (dx !== 0) {
            pendingPointerDxRef.current = 0;
            commitOffset(offsetRef.current + dx);
          }
        } else {
          const autoVelocity = autoVelocityRef.current;
          const alpha = 1 - Math.exp(-dt / SETTLE_MS);
          velocityRef.current += (autoVelocity - velocityRef.current) * alpha;
          commitOffset(offsetRef.current + velocityRef.current * dt);
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      resizeObserver.disconnect();
      commitOffsetRef.current = () => {};
    };
  }, [animate, carouselActive, isMobile, tabHidden, videoSignature]);

  useEffect(() => {
    if (!animate) return;
    const root = rootRef.current;
    if (!root) return;

    const pruneSamples = (now: number) => {
      const cutoff = now - VELOCITY_SAMPLE_WINDOW_MS;
      const samples = samplesRef.current;
      while (samples.length > 0 && samples[0].at < cutoff) {
        samples.shift();
      }
    };

    const estimateReleaseVelocity = () => {
      const samples = samplesRef.current;
      if (samples.length === 0) return velocityRef.current;

      let weighted = 0;
      let weightSum = 0;
      const newest = samples[samples.length - 1].at;

      for (const sample of samples) {
        const age = newest - sample.at;
        const weight = 1 - age / VELOCITY_SAMPLE_WINDOW_MS;
        if (weight <= 0) continue;
        weighted += sample.vx * weight;
        weightSum += weight;
      }

      return weightSum > 0 ? weighted / weightSum : velocityRef.current;
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 && event.pointerType === "mouse") return;

      pointerIdRef.current = event.pointerId;
      startXRef.current = event.clientX;
      startYRef.current = event.clientY;
      lastXRef.current = event.clientX;
      lastTimeRef.current = performance.now();
      dragDistanceRef.current = 0;
      pendingPointerDxRef.current = 0;
      samplesRef.current = [];
      gestureAxisRef.current =
        event.pointerType === "mouse" ? "horizontal" : "pending";

      if (gestureAxisRef.current === "horizontal") {
        draggingRef.current = true;
        setDragging(true);
        root.setPointerCapture(event.pointerId);
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      if (pointerIdRef.current !== event.pointerId) return;

      const now = performance.now();

      if (gestureAxisRef.current === "pending") {
        const totalX = event.clientX - startXRef.current;
        const totalY = event.clientY - startYRef.current;
        if (
          Math.max(Math.abs(totalX), Math.abs(totalY)) <
          GESTURE_AXIS_THRESHOLD
        ) {
          return;
        }

        if (Math.abs(totalY) >= Math.abs(totalX)) {
          gestureAxisRef.current = "vertical";
          return;
        }

        gestureAxisRef.current = "horizontal";
        draggingRef.current = true;
        setDragging(true);
        root.setPointerCapture(event.pointerId);

        const dt = Math.max(now - lastTimeRef.current, 1);
        dragDistanceRef.current = Math.abs(totalX);
        pendingPointerDxRef.current += totalX;
        const vx = totalX / dt;
        samplesRef.current.push({ vx, at: now });
        velocityRef.current = vx;
        lastXRef.current = event.clientX;
        lastTimeRef.current = now;
        event.preventDefault();
        return;
      }

      if (gestureAxisRef.current !== "horizontal") return;

      const dx = event.clientX - lastXRef.current;
      const dt = Math.max(now - lastTimeRef.current, 1);

      dragDistanceRef.current += Math.abs(dx);
      pendingPointerDxRef.current += dx;

      const vx = dx / dt;
      samplesRef.current.push({ vx, at: now });
      pruneSamples(now);
      velocityRef.current = vx;

      lastXRef.current = event.clientX;
      lastTimeRef.current = now;

      event.preventDefault();
    };

    const endDrag = (event: PointerEvent) => {
      if (pointerIdRef.current !== event.pointerId) return;

      if (!draggingRef.current) {
        pointerIdRef.current = null;
        gestureAxisRef.current = null;
        samplesRef.current = [];
        return;
      }

      if (pendingPointerDxRef.current !== 0) {
        commitOffsetRef.current(
          offsetRef.current + pendingPointerDxRef.current,
        );
        pendingPointerDxRef.current = 0;
      }

      const maximumThrow =
        event.pointerType === "touch"
          ? MOBILE_MAX_THROW_PX_PER_MS
          : DESKTOP_MAX_THROW_PX_PER_MS;
      velocityRef.current = Math.max(
        -maximumThrow,
        Math.min(maximumThrow, estimateReleaseVelocity()),
      );
      if (
        Math.abs(velocityRef.current) <
        Math.abs(autoVelocityRef.current) * 0.2
      ) {
        velocityRef.current = autoVelocityRef.current;
      }
      draggingRef.current = false;
      pointerIdRef.current = null;
      gestureAxisRef.current = null;
      setDragging(false);

      if (root.hasPointerCapture(event.pointerId)) {
        root.releasePointerCapture(event.pointerId);
      }
    };

    const onClickCapture = (event: MouseEvent) => {
      if (dragDistanceRef.current > DRAG_CLICK_THRESHOLD) {
        event.preventDefault();
        event.stopPropagation();
        dragDistanceRef.current = 0;
      }
    };

    const onWheel = (event: WheelEvent) => {
      const absX = Math.abs(event.deltaX);
      const absY = Math.abs(event.deltaY);
      const horizontal = absX > absY || (event.shiftKey && absY > 0);

      if (!horizontal || (absX < 0.5 && !event.shiftKey)) return;

      const delta = event.shiftKey && absX < absY ? event.deltaY : event.deltaX;
      if (Math.abs(delta) < 0.5) return;

      event.preventDefault();
      if (setWidthRef.current <= 0) return;

      commitOffsetRef.current(offsetRef.current - delta);
      velocityRef.current = -delta / 16;
    };

    root.addEventListener("pointerdown", onPointerDown);
    root.addEventListener("pointermove", onPointerMove);
    root.addEventListener("pointerup", endDrag);
    root.addEventListener("pointercancel", endDrag);
    root.addEventListener("click", onClickCapture, true);
    root.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      root.removeEventListener("pointerdown", onPointerDown);
      root.removeEventListener("pointermove", onPointerMove);
      root.removeEventListener("pointerup", endDrag);
      root.removeEventListener("pointercancel", endDrag);
      root.removeEventListener("click", onClickCapture, true);
      root.removeEventListener("wheel", onWheel);
    };
  }, [animate]);

  if (displayVideos.length === 0) return null;

  // Elements stay mounted when the hero scrolls away so their buffered media
  // survives; playback itself is what gets gated below.
  const playersEnabled = !usePlaceholderOnly;
  const playbackAllowed = carouselActive && !tabHidden;

  return (
    <div
      ref={rootRef}
      className={cn(
        "hero-creator-reel",
        animate ? undefined : "hero-creator-reel--static",
        dragging && "hero-creator-reel--dragging",
      )}
      aria-label="Creator campaign preview reel"
      aria-roledescription="carousel"
    >
      <div ref={viewportRef} className="hero-creator-reel__viewport">
        {animate ? (
          <div
            ref={trackRef}
            className="hero-creator-reel__track hero-creator-reel__track--virtual"
          >
            {Array.from({ length: poolSize }, (_, index) => {
              const video =
                slotVideos[index] ??
                displayVideos[mod(index - 1, displayVideos.length)];
              return (
              <div
                key={index}
                ref={(node) => {
                  slotElsRef.current[index] = node;
                }}
                className="hero-creator-reel__slot"
                data-reel-card=""
                data-video-id={video.id}
              >
                <SocialVideoCard
                  video={video}
                  tier={resolveTier(slotTiers[index] ?? "idle", playbackAllowed)}
                  playersEnabled={playersEnabled}
                  onVideoPlayable={handleVideoPlayable}
                  onVideoFailure={handleVideoFailure}
                />
              </div>
              );
            })}
          </div>
        ) : (
          <div className="hero-creator-reel__track">
            <div className="hero-creator-reel__set">
              {displayVideos.map((video) => (
                <div
                  key={video.id}
                  data-reel-card={video.id}
                  data-video-id={video.id}
                >
                  <SocialVideoCard
                    video={video}
                    tier={resolveTier(
                      staticPlayIds.includes(video.id)
                        ? "play"
                        : staticWarmIds.includes(video.id)
                          ? "warm"
                          : staticFrameIds.includes(video.id)
                            ? "frame"
                            : "idle",
                      playbackAllowed,
                    )}
                    playersEnabled={playersEnabled}
                    onVideoPlayable={handleVideoPlayable}
                    onVideoFailure={handleVideoFailure}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
