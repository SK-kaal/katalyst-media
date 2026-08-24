"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import type { CreatorVideo } from "@/content/creator-videos";
import { cn } from "@/lib/utils";
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

type TikTokPlayerMessage = {
  "x-tiktok-player"?: boolean;
  type?: string;
  value?: unknown;
};

type PlayerStatus =
  | "idle"
  | "loading"
  | "ready"
  | "playing"
  | "buffering"
  | "failed";

const AUTOPLAY_RETRY_DELAY_MS = 300;
const FIRST_READY_TIMEOUT_MS = 8_000;
const RETRY_READY_TIMEOUT_MS = 10_000;

function getTikTokPlayerUrl(video: CreatorVideo) {
  const params = new URLSearchParams({
    autoplay: "1",
    muted: "1",
    loop: "1",
    controls: "0",
    progress_bar: "0",
    play_button: "0",
    volume_control: "0",
    fullscreen_button: "0",
    timestamp: "0",
    music_info: "0",
    description: "0",
    rel: "0",
    native_context_menu: "0",
    closed_caption: "0",
  });

  return `https://www.tiktok.com/player/v1/${video.id}?${params.toString()}`;
}

function interleavePlayableVideos(
  videos: readonly CreatorVideo[],
  failedVideoIds: ReadonlySet<string>,
) {
  const playable = videos.filter((video) => !failedVideoIds.has(video.id));
  if (playable.length <= 1) return playable;

  const creatorOrder = Array.from(
    new Set(playable.map((video) => video.creator)),
  );
  const sourceQueues = creatorOrder.map((creator) =>
    playable.filter((video) => video.creator === creator),
  );

  for (let startIndex = 0; startIndex < creatorOrder.length; startIndex += 1) {
    const counts = sourceQueues.map((queue) => queue.length);
    if (counts[startIndex] === 0) continue;
    const sequence = [startIndex];
    const deadEnds = new Set<string>();
    counts[startIndex] -= 1;

    const completeSequence = (lastIndex: number): boolean => {
      const remaining = counts.reduce((sum, count) => sum + count, 0);
      if (remaining === 0) return lastIndex !== startIndex;

      const stateKey = `${counts.join(",")}|${lastIndex}`;
      if (deadEnds.has(stateKey)) return false;

      const candidates = creatorOrder
        .map((_, index) => index)
        .filter(
          (index) =>
            counts[index] > 0 &&
            index !== lastIndex &&
            !(remaining === 1 && index === startIndex),
        )
        .sort((a, b) => {
          const distanceA =
            (a - lastIndex + creatorOrder.length) % creatorOrder.length;
          const distanceB =
            (b - lastIndex + creatorOrder.length) % creatorOrder.length;
          const distanceDifference = distanceA - distanceB;
          if (distanceDifference !== 0) return distanceDifference;
          return counts[b] - counts[a];
        });

      for (const candidate of candidates) {
        counts[candidate] -= 1;
        sequence.push(candidate);
        if (completeSequence(candidate)) return true;
        sequence.pop();
        counts[candidate] += 1;
      }

      deadEnds.add(stateKey);
      return false;
    };

    if (!completeSequence(startIndex)) continue;

    const queues = sourceQueues.map((queue) => [...queue]);
    return sequence.flatMap((creatorIndex) => {
      const video = queues[creatorIndex].shift();
      return video ? [video] : [];
    });
  }

  return playable;
}

function TikTokPlayer({
  video,
  shouldPlay,
  onPlayable,
  onFailure,
}: {
  video: CreatorVideo;
  shouldPlay: boolean;
  onPlayable: (videoId: string) => void;
  onFailure: (videoId: string) => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const readyRef = useRef(false);
  const playedRef = useRef(false);
  const shouldPlayRef = useRef(shouldPlay);
  const iframeRetryRef = useRef(0);
  const autoplayRecoveryRef = useRef(false);
  const reportedPlayableRef = useRef(false);
  const playbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [iframeVersion, setIframeVersion] = useState(0);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [status, setStatus] = useState<PlayerStatus>("loading");

  const postPlayerCommand = useCallback((type: "mute" | "play" | "pause") => {
    iframeRef.current?.contentWindow?.postMessage(
      {
        type,
        value: undefined,
        "x-tiktok-player": true,
      },
      "https://www.tiktok.com",
    );
  }, []);

  const requestPlayback = useCallback(() => {
    postPlayerCommand("mute");
    postPlayerCommand("play");
  }, [postPlayerCommand]);

  const clearPlaybackTimer = useCallback(() => {
    if (!playbackTimerRef.current) return;
    clearTimeout(playbackTimerRef.current);
    playbackTimerRef.current = null;
  }, []);

  const schedulePlaybackRequest = useCallback(
    (delay = AUTOPLAY_RETRY_DELAY_MS) => {
      if (playbackTimerRef.current) return;
      playbackTimerRef.current = setTimeout(() => {
        playbackTimerRef.current = null;
        if (shouldPlayRef.current && readyRef.current) requestPlayback();
      }, delay);
    },
    [requestPlayback],
  );

  const retryIframeOrFail = useCallback(() => {
    clearPlaybackTimer();
    if (iframeRetryRef.current === 0) {
      iframeRetryRef.current = 1;
      autoplayRecoveryRef.current = false;
      readyRef.current = false;
      playedRef.current = false;
      setHasPlayed(false);
      setStatus("loading");
      setIframeVersion(1);
      return;
    }

    setStatus("failed");
    onFailure(video.id);
  }, [clearPlaybackTimer, onFailure, video.id]);

  useEffect(() => {
    shouldPlayRef.current = shouldPlay;
  }, [shouldPlay]);

  useEffect(() => {
    const onMessage = (event: MessageEvent<TikTokPlayerMessage>) => {
      if (
        event.origin !== "https://www.tiktok.com" ||
        event.source !== iframeRef.current?.contentWindow ||
        event.data?.["x-tiktok-player"] !== true
      ) {
        return;
      }

      if (event.data.type === "onPlayerReady") {
        readyRef.current = true;
        autoplayRecoveryRef.current = false;
        setStatus("ready");
        requestPlayback();
        return;
      }

      if (event.data.type === "onStateChange") {
        const state = event.data.value;
        if (state === 1) {
          autoplayRecoveryRef.current = false;
          playedRef.current = true;
          clearPlaybackTimer();
          setHasPlayed(true);
          setStatus("playing");
          if (!reportedPlayableRef.current) {
            reportedPlayableRef.current = true;
            onPlayable(video.id);
          }
          if (!shouldPlayRef.current) postPlayerCommand("pause");
        } else if (state === 3) {
          setStatus("buffering");
        } else if (state === -1 || state === 0 || state === 2) {
          setStatus("ready");
          if (shouldPlayRef.current) schedulePlaybackRequest();
        }
        return;
      }

      if (event.data.type === "onPlayerError") {
        const errorValue = event.data.value;
        const errorCode =
          typeof errorValue === "object" &&
          errorValue !== null &&
          "errorCode" in errorValue
            ? (errorValue as { errorCode?: unknown }).errorCode
            : undefined;

        if (errorCode === 3002) {
          if (!autoplayRecoveryRef.current) {
            autoplayRecoveryRef.current = true;
            requestPlayback();
            schedulePlaybackRequest(600);
            return;
          }

          retryIframeOrFail();
          return;
        }

        retryIframeOrFail();
      }
    };

    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      clearPlaybackTimer();
    };
  }, [
    clearPlaybackTimer,
    onFailure,
    onPlayable,
    postPlayerCommand,
    requestPlayback,
    retryIframeOrFail,
    schedulePlaybackRequest,
    video.id,
  ]);

  useEffect(() => {
    if (!readyRef.current) return;

    if (shouldPlay) {
      requestPlayback();
    } else {
      clearPlaybackTimer();
      autoplayRecoveryRef.current = false;
      postPlayerCommand("pause");
    }
  }, [clearPlaybackTimer, postPlayerCommand, requestPlayback, shouldPlay]);

  useEffect(() => {
    const timeout = setTimeout(
      () => {
        if (!playedRef.current) retryIframeOrFail();
      },
      iframeVersion === 0 ? FIRST_READY_TIMEOUT_MS : RETRY_READY_TIMEOUT_MS,
    );

    return () => clearTimeout(timeout);
  }, [iframeVersion, retryIframeOrFail]);

  if (status === "failed") return null;

  return (
    <iframe
      key={iframeVersion}
      ref={iframeRef}
      className={cn(
        "hero-creator-reel__player",
        hasPlayed && "hero-creator-reel__player--playing",
      )}
      src={getTikTokPlayerUrl(video)}
      title={`${video.creator} TikTok video`}
      allow="autoplay; fullscreen"
      allowFullScreen
      loading="eager"
      referrerPolicy="strict-origin-when-cross-origin"
      onError={retryIframeOrFail}
      tabIndex={-1}
    />
  );
}

function HeroReelCard({
  video,
  shouldLoad,
  shouldPlay,
  isDuplicate,
  playersEnabled,
  onVideoPlayable,
  onVideoFailure,
}: {
  video: CreatorVideo;
  shouldLoad: boolean;
  shouldPlay: boolean;
  isDuplicate: boolean;
  playersEnabled: boolean;
  onVideoPlayable: (videoId: string) => void;
  onVideoFailure: (videoId: string) => void;
}) {
  return (
    <article className="hero-creator-reel__card">
      <div className="hero-creator-reel__card-surface">
        <div
          className="hero-creator-reel__placeholder"
          aria-hidden="true"
        >
          <div className="hero-creator-reel__placeholder-grid" />
          <span className="hero-creator-reel__placeholder-letter">
            {video.creator.charAt(0)}
          </span>
        </div>

        {playersEnabled && shouldLoad && video.platform === "tiktok" ? (
          <TikTokPlayer
            video={video}
            shouldPlay={shouldPlay}
            onPlayable={onVideoPlayable}
            onFailure={onVideoFailure}
          />
        ) : null}

        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-deep-black/85 via-deep-black/15 to-transparent"
          aria-hidden="true"
        />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-3">
          <p className="font-display text-sm font-semibold tracking-[-0.02em] text-off-white">
            {video.creator}
          </p>
          <p className="mt-0.5 text-[0.65rem] uppercase tracking-[0.12em] text-soft-grey">
            {video.platform}
          </p>
        </div>

        <a
          className="hero-creator-reel__post-link"
          href={video.url}
          target="_blank"
          rel="noreferrer"
          aria-label={`View ${video.creator} ${video.platform} post`}
          aria-hidden={isDuplicate || !shouldLoad}
          draggable={false}
          tabIndex={!isDuplicate && shouldLoad ? 0 : -1}
        />
      </div>
    </article>
  );
}

function ReelSet({
  videos,
  keyPrefix,
  hidden = false,
  loadKeys,
  playKeys,
  playersEnabled,
  onVideoPlayable,
  onVideoFailure,
  setRef,
}: {
  videos: readonly CreatorVideo[];
  keyPrefix: string;
  hidden?: boolean;
  loadKeys: Set<string>;
  playKeys: Set<string>;
  playersEnabled: boolean;
  onVideoPlayable: (videoId: string) => void;
  onVideoFailure: (videoId: string) => void;
  setRef?: (node: HTMLDivElement | null) => void;
}) {
  return (
    <div
      ref={setRef}
      className="hero-creator-reel__set"
      aria-hidden={hidden || undefined}
    >
      {videos.map((video) => {
        const key = `${keyPrefix}:${video.id}`;
        return (
          <div key={key} data-reel-card={key} data-video-id={video.id}>
            <HeroReelCard
              video={video}
              shouldLoad={loadKeys.has(key)}
              shouldPlay={playKeys.has(key)}
              isDuplicate={hidden}
              playersEnabled={playersEnabled}
              onVideoPlayable={onVideoPlayable}
              onVideoFailure={onVideoFailure}
            />
          </div>
        );
      })}
    </div>
  );
}

export function HeroCreatorCarousel({ videos }: HeroCreatorCarouselProps) {
  const reduceMotion = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const measureSetRef = useRef<HTMLDivElement | null>(null);
  const offsetRef = useRef(0);
  const setWidthRef = useRef(0);
  /** Default auto-scroll velocity in px/ms (negative = left). */
  const autoVelocityRef = useRef(0);
  /** Current motion velocity in px/ms. */
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
  const unloadTimersRef = useRef(
    new Map<string, ReturnType<typeof setTimeout>>(),
  );
  const [failedVideoIds, setFailedVideoIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [playableVideoIds, setPlayableVideoIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [nearKeys, setNearKeys] = useState<Set<string>>(() => new Set());
  const [playKeys, setPlayKeys] = useState<Set<string>>(() => new Set());
  const [isMobile, setIsMobile] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 767px)").matches,
  );
  const [carouselActive, setCarouselActive] = useState(true);
  const [dragging, setDragging] = useState(false);
  const animate = reduceMotion === false;
  const canonicalVideos = useMemo(
    () => interleavePlayableVideos(videos, new Set()),
    [videos],
  );
  const activeVideos = useMemo(
    () => interleavePlayableVideos(videos, failedVideoIds),
    [failedVideoIds, videos],
  );
  const usePlaceholderOnly =
    (failedVideoIds.size >= 4 && playableVideoIds.size === 0) ||
    (failedVideoIds.size >= 8 && playableVideoIds.size < 4) ||
    (failedVideoIds.size > 0 && activeVideos.length < 8);
  const displayVideos = usePlaceholderOnly ? canonicalVideos : activeVideos;
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

  const observerDeps = useMemo(
    () => displayVideos.map((item) => item.id).join("|"),
    [displayVideos],
  );
  const loadKeys = useMemo(() => {
    const keyByVideo = new Map<string, string>();
    for (const key of nearKeys) {
      const videoId = key.slice(key.indexOf(":") + 1);
      if (!keyByVideo.has(videoId)) keyByVideo.set(videoId, key);
    }
    return new Set(keyByVideo.values());
  }, [nearKeys]);
  const activePlayKeys = useMemo(
    () => (carouselActive ? playKeys : new Set<string>()),
    [carouselActive, playKeys],
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

  useEffect(() => {
    const root = viewportRef.current;
    if (!root) return;

    const cards = root.querySelectorAll<HTMLElement>("[data-reel-card]");
    if (cards.length === 0) return;
    const unloadDelay = isMobile ? 2_600 : 4_000;
    const unloadTimers = unloadTimersRef.current;

    const preloadObserver = new IntersectionObserver(
      (entries) => {
        setNearKeys((prev) => {
          const next = new Set(prev);
          let changed = false;
          for (const entry of entries) {
            const key = (entry.target as HTMLElement).dataset.reelCard;
            if (!key) continue;
            if (entry.isIntersecting) {
              const pendingUnload = unloadTimers.get(key);
              if (pendingUnload) {
                clearTimeout(pendingUnload);
                unloadTimers.delete(key);
              }
              if (!next.has(key)) {
                next.add(key);
                changed = true;
              }
            } else if (next.has(key) && !unloadTimers.has(key)) {
              const timer = setTimeout(() => {
                unloadTimers.delete(key);
                setNearKeys((current) => {
                  if (!current.has(key)) return current;
                  const pruned = new Set(current);
                  pruned.delete(key);
                  return pruned;
                });
              }, unloadDelay);
              unloadTimers.set(key, timer);
            }
          }
          return changed ? next : prev;
        });
      },
      {
        root,
        rootMargin: isMobile
          ? "0px 190px 0px 100px"
          : "0px 420px 0px 300px",
        threshold: 0.01,
      },
    );

    const playbackObserver = new IntersectionObserver(
      (entries) => {
        setPlayKeys((prev) => {
          const next = new Set(prev);
          let changed = false;
          for (const entry of entries) {
            const key = (entry.target as HTMLElement).dataset.reelCard;
            if (!key) continue;
            const shouldPlay =
              entry.isIntersecting && entry.intersectionRatio >= 0.08;
            if (shouldPlay && !next.has(key)) {
              next.add(key);
              changed = true;
            } else if (!shouldPlay && next.delete(key)) {
              changed = true;
            }
          }
          return changed ? next : prev;
        });
      },
      {
        root,
        threshold: [0, 0.08],
      },
    );

    cards.forEach((card) => {
      preloadObserver.observe(card);
      playbackObserver.observe(card);
    });
    return () => {
      preloadObserver.disconnect();
      playbackObserver.disconnect();
      for (const timer of unloadTimers.values()) clearTimeout(timer);
      unloadTimers.clear();
    };
  }, [observerDeps, animate, isMobile]);

  useEffect(() => {
    if (!animate || !carouselActive) return;

    const track = trackRef.current;
    if (!track) return;

    const applyTransform = () => {
      track.style.transform = `translate3d(${offsetRef.current}px, 0, 0)`;
    };

    const measure = () => {
      const width = measureSetRef.current?.offsetWidth ?? 0;
      setWidthRef.current = width;
      const autoVelocity = width > 0 ? -AUTO_SPEED_PX_PER_MS : 0;
      autoVelocityRef.current = autoVelocity;
      // Seed current velocity to auto if it was idle.
      if (!draggingRef.current && Math.abs(velocityRef.current) < 0.0001) {
        velocityRef.current = autoVelocity;
      }
      offsetRef.current = wrapOffset(offsetRef.current, width);
      applyTransform();
    };

    measure();
    velocityRef.current = autoVelocityRef.current;

    const resizeObserver = new ResizeObserver(measure);
    if (measureSetRef.current) resizeObserver.observe(measureSetRef.current);

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
            offsetRef.current = wrapOffset(offsetRef.current + dx, width);
            applyTransform();
          }
        } else {
          const autoVelocity = autoVelocityRef.current;
          // Exponential blend toward resting auto-scroll velocity (frame-rate independent).
          const alpha = 1 - Math.exp(-dt / SETTLE_MS);
          velocityRef.current +=
            (autoVelocity - velocityRef.current) * alpha;
          offsetRef.current = wrapOffset(
            offsetRef.current + velocityRef.current * dt,
            width,
          );
          applyTransform();
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      resizeObserver.disconnect();
    };
  }, [animate, carouselActive, observerDeps]);

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

      // Flush any remaining pointer delta before releasing into momentum.
      const width = setWidthRef.current;
      if (width > 0 && pendingPointerDxRef.current !== 0) {
        offsetRef.current = wrapOffset(
          offsetRef.current + pendingPointerDxRef.current,
          width,
        );
        pendingPointerDxRef.current = 0;
        if (trackRef.current) {
          trackRef.current.style.transform = `translate3d(${offsetRef.current}px, 0, 0)`;
        }
      }

      const maximumThrow =
        event.pointerType === "touch"
          ? MOBILE_MAX_THROW_PX_PER_MS
          : DESKTOP_MAX_THROW_PX_PER_MS;
      velocityRef.current = Math.max(
        -maximumThrow,
        Math.min(maximumThrow, estimateReleaseVelocity()),
      );
      // Gentle release: keep resting auto motion instead of falling to a stop.
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

      const width = setWidthRef.current;
      if (width <= 0) return;

      // Inject wheel as an immediate offset nudge + velocity impulse (no pause).
      offsetRef.current = wrapOffset(offsetRef.current - delta, width);
      velocityRef.current = -delta / 16;
      if (trackRef.current) {
        trackRef.current.style.transform = `translate3d(${offsetRef.current}px, 0, 0)`;
      }
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
        <div ref={trackRef} className="hero-creator-reel__track">
          <ReelSet
            videos={displayVideos}
            keyPrefix="a"
            loadKeys={loadKeys}
            playKeys={activePlayKeys}
            playersEnabled={!usePlaceholderOnly && carouselActive}
            onVideoPlayable={handleVideoPlayable}
            onVideoFailure={handleVideoFailure}
            setRef={(node) => {
              measureSetRef.current = node;
            }}
          />
          {animate ? (
            <ReelSet
              videos={displayVideos}
              keyPrefix="b"
              hidden
              loadKeys={loadKeys}
              playKeys={activePlayKeys}
              playersEnabled={!usePlaceholderOnly && carouselActive}
              onVideoPlayable={handleVideoPlayable}
              onVideoFailure={handleVideoFailure}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
