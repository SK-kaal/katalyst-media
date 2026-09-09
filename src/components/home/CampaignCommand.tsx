"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import {
  AnimatePresence,
  motion,
  type MotionValue,
  useMotionValue,
  useMotionValueEvent,
  useTransform,
} from "framer-motion";
import { cn } from "@/lib/utils";
import {
  stageEnterY,
  stageHoldOpacity,
  stageHoldScale,
  stageHoldShift,
  stageOpacity,
} from "@/components/home/process-motion";
import {
  campaignAllocation,
  campaignAllocationSteps,
  campaignChannels,
  campaignPerformance,
  campaignPlan,
} from "@/content/process-campaign";
import "./campaign-command.css";

type HudSide = "before" | "after";
type ChannelId = "tiktok" | "meta" | "instagram" | "spotify";
type CoreMode = "ready" | "live";
type StatusMode = (typeof STATUS_VALUES)[number];
type ChannelState = "live" | "delivering" | "analysing" | "traffic";
type GraphFocus = 0 | 1 | 2;

const CX = 248;
const CY = 186;
const EASE_OUT = [0.215, 0.61, 0.355, 1] as const;
const EASE_SOFT = [0.22, 1, 0.36, 1] as const;

const CHANNELS = [
  {
    id: "tiktok" as const,
    ...campaignChannels.tiktok,
    from: { x: 262, y: 46 },
    path: "M 262 62 C 258 110 252 148 248 158",
  },
  {
    id: "meta" as const,
    ...campaignChannels.meta,
    from: { x: 64, y: 176 },
    path: "M 92 178 C 148 180 198 184 216 186",
  },
  {
    id: "instagram" as const,
    ...campaignChannels.instagram,
    from: { x: 392, y: 176 },
    path: "M 368 176 C 336 180 300 184 280 186",
  },
  {
    id: "spotify" as const,
    ...campaignChannels.spotify,
    from: { x: 268, y: 340 },
    path: "M 262 318 C 256 274 252 232 248 214",
  },
] as const;

const REACH_START: number = campaignPerformance.reachStart;
const REACH_TARGET: number = campaignPerformance.reachTarget;
const REACH_MIN: number = campaignPerformance.reachFloor;
const REACH_MAX: number = campaignPerformance.reachCeiling;
const ENGAGE_START: number = campaignPerformance.engageStart;
const ENGAGE_MIN: number = campaignPerformance.engageMin;
const ENGAGE_MAX: number = campaignPerformance.engageMax;
const SPEND_START: number = campaignPerformance.spendStart;
const SPEND_TARGET: number = campaignPerformance.spendTarget;
const SPEND_FLOOR: number = campaignPerformance.spendFloor;
const CONTENT_START: number = campaignPerformance.assetsAtLaunch;
const CONTENT_MAX: number = campaignPlan.assets;
const CREATORS_START: number = campaignPerformance.creatorsAtLaunch;
const CREATORS_MAX: number = campaignPlan.creators;
const GRAPH_SLOTS = 10;
const GRAPH_W = 240;
const GRAPH_H = 64;
const BUDGET = campaignPlan.budget;
const STATUS_VALUES = ["OPTIMISING", "DELIVERING", "ANALYSING", "SCALING"] as const;
const REACH_SEED = [26, 32, 38, 46, 54, 61, 68, 76, 82, 86];
const ENGAGE_SEED = [32, 36, 34, 41, 44, 43, 48, 50, 49, 51];
const SPEND_SEED = [14, 15, 16, 15, 17, 16, 18, 17, 18, 17];

const OPT_STEPS: ReadonlyArray<{
  channel: ChannelId;
  to: Record<ChannelId, number>;
  label: string;
}> = campaignAllocationSteps;

type Packet = { id: number; channel: ChannelId; dir: "in" | "out" };

function clamp(value: number, min = 0, max = 1) {
  return Math.min(Math.max(value, min), max);
}

function smoothstep(value: number) {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + Math.cos(rad) * r, y: cy + Math.sin(rad) * r };
}

function arcPath(r: number, start: number, sweep: number) {
  const a = polar(CX, CY, r, start);
  const b = polar(CX, CY, r, start + sweep);
  const large = sweep > 180 ? 1 : 0;
  return `M ${a.x} ${a.y} A ${r} ${r} 0 ${large} 1 ${b.x} ${b.y}`;
}

function jitter(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function linePath(values: readonly number[], width: number, height: number, slots = values.length) {
  if (values.length === 0) return "";
  const denom = Math.max(slots - 1, 1);
  return values
    .map((value, index) => {
      const x = (index / denom) * width;
      const y = height - (value / 100) * height;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function toGraph(value: number, min: number, max: number, lo = 16, hi = 88) {
  return lo + clamp((value - min) / (max - min), 0, 1) * (hi - lo);
}

function pushGraph(prev: number[], next: number) {
  const clipped = Math.min(92, Math.max(12, next));
  if (prev.length < GRAPH_SLOTS) return [...prev, clipped];
  return [...prev.slice(1), clipped];
}

// Reach builds towards the campaign target, then holds with small movement
// rather than collapsing back to its starting figure.
function stepReach(current: number, drifting: { current: boolean }) {
  const shown = Math.round(current);
  if (shown < REACH_TARGET) {
    return Math.min(REACH_TARGET, shown + 12 + Math.floor(Math.random() * 18));
  }
  drifting.current = !drifting.current;
  const delta = 3 + Math.floor(Math.random() * 6);
  const next = drifting.current ? shown - delta : shown + delta;
  return Math.min(REACH_MAX, Math.max(REACH_TARGET - 12, next));
}

function stepEngage(current: number) {
  const shown = Number(current.toFixed(1));
  const down =
    shown >= ENGAGE_MAX - 0.3 ||
    (shown > ENGAGE_MIN + 0.3 && Math.random() < 0.32);
  const delta = 0.1 + Math.round(Math.random() * 2) / 10;
  let next = Number((shown + (down ? -delta : delta)).toFixed(1));
  next = Math.min(ENGAGE_MAX, Math.max(ENGAGE_MIN, next));
  if (next === shown) next = Number((shown >= ENGAGE_MAX - 0.15 ? shown - 0.2 : shown + 0.2).toFixed(1));
  return next;
}

// Spend only ever increases and eases towards the pacing target, so it always
// stays inside the agreed budget.
function stepSpend(current: number) {
  const shown = Math.round(current);
  if (shown >= SPEND_TARGET) return SPEND_TARGET;
  const remaining = SPEND_TARGET - shown;
  const pace = Math.max(20, Math.round(remaining * 0.06));
  return Math.min(SPEND_TARGET, shown + pace + Math.floor(Math.random() * 24));
}

function rampTo(current: number, target: number) {
  return current >= target ? target : current + 1;
}

function formatReach(value: number) {
  return `${Math.round(value)}K`;
}

function formatEngage(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatSpend(value: number) {
  return `£${Math.round(value).toLocaleString("en-GB")}`;
}

function FlipValue({
  value,
  enabled,
  className,
}: {
  value: string;
  enabled: boolean;
  className?: string;
}) {
  return (
    <span className={cn("process-command__flip", className)}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={value}
          initial={enabled ? { opacity: 0, y: 4 } : false}
          animate={{ opacity: 1, y: 0 }}
          exit={enabled ? { opacity: 0, y: -4 } : undefined}
          transition={{ duration: 0.36, ease: EASE_SOFT }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function TikTokGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="process-command__glyph" fill="none">
      <rect x="8" y="4.5" width="8" height="15" rx="1.6" />
      <path d="M11 16.2c1.6 0 2.6-.8 3.1-1.8" />
    </svg>
  );
}

function MetaGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="process-command__glyph" fill="none">
      <rect x="5" y="6.5" width="10.5" height="8" rx="1.4" />
      <rect x="8.5" y="9.5" width="10.5" height="8" rx="1.4" />
    </svg>
  );
}

function InstagramGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="process-command__glyph" fill="none">
      <rect x="5.6" y="5.6" width="12.8" height="12.8" rx="3.8" />
      <circle cx="12" cy="12" r="3.2" />
    </svg>
  );
}

function SpotifyGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="process-command__glyph" fill="none">
      <path d="M7 14.5V9.5M10.2 16.2V7.8M13.4 14.8V9.2M16.6 16.6V7.4" />
    </svg>
  );
}

const GLYPHS = {
  tiktok: TikTokGlyph,
  meta: MetaGlyph,
  instagram: InstagramGlyph,
  spotify: SpotifyGlyph,
} as const;

function useCountTo(target: number, enabled: boolean, duration = 1200, delay = 0) {
  const [value, setValue] = useState(enabled ? 0 : target);

  useEffect(() => {
    if (!enabled) {
      setValue(target);
      return;
    }
    let frame = 0;
    const startId = window.setTimeout(() => {
      const start = performance.now();
      const tick = (now: number) => {
        const t = smoothstep((now - start) / duration);
        setValue(target * t);
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }, delay);
    return () => {
      window.clearTimeout(startId);
      cancelAnimationFrame(frame);
    };
  }, [delay, duration, enabled, target]);

  return value;
}

export function CampaignCommand({
  nodeY,
  side,
  compact,
  readY,
  motionEnabled,
  exitY,
}: {
  nodeY: number;
  side: HudSide;
  compact: boolean;
  readY: MotionValue<number>;
  motionEnabled: boolean;
  exitY?: number;
}) {
  const startedRef = useRef(false);
  const liveRef = useRef(!motionEnabled);
  const stageRef = useRef<HTMLDivElement>(null);
  const hoverChannelRef = useRef<ChannelId | null>(null);
  const channelBoxRef = useRef<Partial<Record<ChannelId, HTMLElement>>>({});
  const channelCenterRef = useRef<Partial<Record<ChannelId, { x: number; y: number }>>>({});
  const channelCenterAtRef = useRef(0);
  const [assembled, setAssembled] = useState(!motionEnabled);
  const [ambient, setAmbient] = useState(!motionEnabled);
  const [quiet, setQuiet] = useState(false);
  const [coreMode, setCoreMode] = useState<CoreMode>(
    motionEnabled ? "ready" : "live",
  );
  const [channelsOn, setChannelsOn] = useState<Record<ChannelId, boolean>>({
    tiktok: !motionEnabled,
    meta: !motionEnabled,
    instagram: !motionEnabled,
    spotify: !motionEnabled,
  });
  const [channelStatus, setChannelStatus] = useState<Record<ChannelId, ChannelState>>(
    {
      tiktok: "live",
      meta: "live",
      instagram: "live",
      spotify: "traffic",
    },
  );
  const [hotChannel, setHotChannel] = useState<ChannelId | null>(null);
  const [hoverChannel, setHoverChannel] = useState<ChannelId | null>(null);
  const [pulse, setPulse] = useState(0);
  const [coreHot, setCoreHot] = useState(false);
  const [packets, setPackets] = useState<Packet[]>([]);
  const [status, setStatus] = useState<StatusMode>(STATUS_VALUES[0]);
  const [optNote, setOptNote] = useState<{ channel: ChannelId; label: string } | null>(
    null,
  );
  const [alloc, setAlloc] = useState<Record<ChannelId, number>>({
    ...campaignAllocation,
  });
  const [reachLive, setReachLive] = useState(REACH_START);
  const [engageLive, setEngageLive] = useState(ENGAGE_START);
  const [spendLive, setSpendLive] = useState(SPEND_START);
  const [contentLive, setContentLive] = useState(CONTENT_START);
  const [creatorsLive, setCreatorsLive] = useState(CREATORS_START);
  const reachValRef = useRef(REACH_START);
  const engageValRef = useRef(ENGAGE_START);
  const spendValRef = useRef(SPEND_START);
  const contentValRef = useRef(CONTENT_START);
  const creatorsValRef = useRef(CREATORS_START);
  const reachEaseRef = useRef(false);
  const [reachPts, setReachPts] = useState<number[]>(() => [...REACH_SEED]);
  const [engagePts, setEngagePts] = useState<number[]>(() => [...ENGAGE_SEED]);
  const [spendPts, setSpendPts] = useState<number[]>(() => [...SPEND_SEED]);
  const [graphGlow, setGraphGlow] = useState(0);
  const [graphFocus, setGraphFocus] = useState<GraphFocus>(0);
  const [reacting, setReacting] = useState(false);
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const pointerOpacity = useMotionValue(0);

  const counting = assembled && motionEnabled;
  const reachCount = useCountTo(REACH_START, counting, 1250, 1320);
  const engageCount = useCountTo(ENGAGE_START, counting, 1250, 1380);
  const spendCount = useCountTo(SPEND_START, counting, 1250, 1440);
  const creatorsCount = useCountTo(CREATORS_START, counting, 1100, 1400);
  const contentCount = useCountTo(CONTENT_START, counting, 1200, 1480);

  const liveReach = ambient ? reachLive : reachCount;
  const liveEngage = ambient ? engageLive : engageCount;
  const liveSpend = ambient ? spendLive : spendCount;
  const liveContent = ambient ? contentLive : Math.round(contentCount);
  const liveCreators = ambient ? creatorsLive : Math.round(creatorsCount);
  const spendRatio = clamp(liveSpend / BUDGET);

  const opacity = useTransform(readY, (value) =>
    exitY != null
      ? stageHoldOpacity(value, nodeY, exitY)
      : stageOpacity(value, nodeY),
  );
  const y = useTransform(readY, (value) =>
    exitY != null
      ? stageHoldShift(value, nodeY, exitY)
      : stageEnterY(value, nodeY),
  );
  const holdScale = useTransform(readY, (value) =>
    exitY != null ? stageHoldScale(value, nodeY, exitY) : 1,
  );
  const parallax = useTransform(readY, (value) =>
    clamp((value - nodeY) / 640, -1, 1),
  );
  const depth = compact ? 0.4 : 1;
  const bgY = useTransform(parallax, (value) => value * 14 * depth);
  const midY = useTransform(parallax, (value) => value * 6 * depth);
  const fgY = useTransform(parallax, (value) => value * -6 * depth);

  const applyVisibility = useCallback(
    (value: number) => {
      const visible =
        exitY != null
          ? stageHoldOpacity(value, nodeY, exitY)
          : stageOpacity(value, nodeY);
      if (!startedRef.current && visible > 0.42) {
        startedRef.current = true;
        if (motionEnabled) setAssembled(true);
      }
      liveRef.current = visible > 0.24;
      setQuiet((current) => {
        const next = visible < 0.36;
        return current === next ? current : next;
      });
    },
    [exitY, motionEnabled, nodeY],
  );

  useMotionValueEvent(readY, "change", applyVisibility);

  useEffect(() => {
    applyVisibility(readY.get());
  }, [applyVisibility, readY]);

  useEffect(() => {
    if (!assembled || !motionEnabled) return;
    const timers = [
      window.setTimeout(() => setCoreMode("live"), 760),
      window.setTimeout(
        () => setChannelsOn((current) => ({ ...current, tiktok: true })),
        1120,
      ),
      window.setTimeout(
        () => setChannelsOn((current) => ({ ...current, meta: true })),
        1440,
      ),
      window.setTimeout(
        () => setChannelsOn((current) => ({ ...current, instagram: true })),
        1740,
      ),
      window.setTimeout(
        () => setChannelsOn((current) => ({ ...current, spotify: true })),
        2060,
      ),
      window.setTimeout(() => setAmbient(true), 1680),
    ];
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [assembled, motionEnabled]);

  useEffect(() => {
    if (pulse === 0) return;
    setCoreHot(true);
    setReacting(true);
    const hotId = window.setTimeout(() => setCoreHot(false), 420);
    const reactId = window.setTimeout(() => setReacting(false), 520);
    return () => {
      window.clearTimeout(hotId);
      window.clearTimeout(reactId);
    };
  }, [pulse]);

  useEffect(() => {
    if (!ambient) return;
    let cancelled = false;
    const timers = new Set<number>();
    let packetPtr = 0;
    let optPtr = 0;
    let statusI = 0;
    let metricSlot = 0;
    const packetPlan: Array<{ channel: ChannelId; dir: "in" | "out" }> = [
      { channel: "tiktok", dir: "in" },
      { channel: "meta", dir: "out" },
      { channel: "spotify", dir: "in" },
      { channel: "instagram", dir: "out" },
      { channel: "meta", dir: "in" },
      { channel: "tiktok", dir: "out" },
    ];

    const later = (fn: () => void, ms: number) => {
      const id = window.setTimeout(() => {
        timers.delete(id);
        fn();
      }, ms);
      timers.add(id);
      return id;
    };

    const sendPacket = (channel: ChannelId, dir: "in" | "out") => {
      if (cancelled || !liveRef.current) return;
      setPackets((current) => {
        const next = current.length > 2 ? current.slice(-2) : current;
        return [...next, { id: Date.now() + Math.random(), channel, dir }];
      });
    };

    const ping = () => setPulse((value) => value + 1);

    const bumpReach = () => {
      const reachEase = { current: reachEaseRef.current };
      reachValRef.current = stepReach(reachValRef.current, reachEase);
      reachEaseRef.current = reachEase.current;
      setReachLive(reachValRef.current);
      setReachPts((current) =>
        pushGraph(current, toGraph(reachValRef.current, REACH_MIN, REACH_MAX)),
      );
      setGraphGlow((value) => value + 1);
      setGraphFocus(0);
      ping();
    };

    const bumpEngage = () => {
      engageValRef.current = stepEngage(engageValRef.current);
      setEngageLive(engageValRef.current);
      setEngagePts((current) =>
        pushGraph(current, toGraph(engageValRef.current, ENGAGE_MIN, ENGAGE_MAX, 18, 82)),
      );
      setGraphGlow((value) => value + 1);
      setGraphFocus(1);
    };

    const bumpSpend = () => {
      spendValRef.current = stepSpend(spendValRef.current);
      setSpendLive(spendValRef.current);
      setSpendPts((current) =>
        pushGraph(current, toGraph(spendValRef.current, SPEND_FLOOR, BUDGET, 14, 78)),
      );
      setGraphGlow((value) => value + 1);
      setGraphFocus(2);
    };

    const bumpContent = () => {
      contentValRef.current = rampTo(contentValRef.current, CONTENT_MAX);
      setContentLive(contentValRef.current);
    };

    const bumpCreators = () => {
      creatorsValRef.current = rampTo(creatorsValRef.current, CREATORS_MAX);
      setCreatorsLive(creatorsValRef.current);
    };

    const schedulePacket = () => {
      later(() => {
        if (cancelled) return;
        if (liveRef.current) {
          const plan = packetPlan[packetPtr % packetPlan.length];
          packetPtr += 1;
          sendPacket(plan.channel, plan.dir);
          if (plan.dir === "out") {
            setHotChannel(plan.channel);
            setChannelStatus((current) => ({
              ...current,
              [plan.channel]: current[plan.channel] === "live" ? "delivering" : "live",
            }));
            later(() => {
              if (cancelled) return;
              setHotChannel(null);
              setChannelStatus((current) => ({
                ...current,
                [plan.channel]: plan.channel === "spotify" ? "traffic" : "live",
              }));
            }, 900);
          }
        }
        schedulePacket();
      }, jitter(1600, 2400));
    };

    // Every pump below is gated on liveRef so the stage stops committing React
    // state once the reader has scrolled away from it.
    const pumpMetrics = () => {
      if (cancelled) return;
      if (liveRef.current) {
        const which = metricSlot % 3;
        metricSlot += 1;
        if (which === 0) bumpReach();
        else if (which === 1) bumpEngage();
        else bumpSpend();
      }
      later(pumpMetrics, jitter(1200, 2000));
    };

    const scheduleContent = () => {
      if (cancelled) return;
      if (liveRef.current) {
        bumpContent();
        sendPacket("instagram", "out");
      }
      later(scheduleContent, jitter(4000, 7000));
    };

    const scheduleCreators = () => {
      if (cancelled) return;
      if (liveRef.current) bumpCreators();
      later(scheduleCreators, jitter(4000, 7000));
    };

    const scheduleStatus = () => {
      later(() => {
        if (cancelled) return;
        if (liveRef.current) {
          statusI = (statusI + 1) % STATUS_VALUES.length;
          setStatus(STATUS_VALUES[statusI]);
        }
        scheduleStatus();
      }, jitter(4000, 6000));
    };

    const scheduleOpt = () => {
      later(() => {
        if (cancelled) return;
        if (liveRef.current) {
          const step = OPT_STEPS[optPtr % OPT_STEPS.length];
          optPtr += 1;
          setHotChannel(step.channel);
          setOptNote({ channel: step.channel, label: "PERFORMANCE ↑" });
          setChannelStatus((current) => ({ ...current, [step.channel]: "analysing" }));
          setAlloc(step.to);
          sendPacket(step.channel, "in");
          later(() => {
            if (cancelled) return;
            setOptNote({ channel: step.channel, label: step.label });
          }, 900);
          later(() => {
            if (cancelled) return;
            setHotChannel(null);
            setOptNote(null);
            setChannelStatus((current) => ({
              ...current,
              [step.channel]: step.channel === "spotify" ? "traffic" : "live",
            }));
          }, 2100);
        }
        scheduleOpt();
      }, jitter(7800, 11600));
    };

    later(schedulePacket, jitter(400, 900));
    later(pumpMetrics, jitter(220, 480));
    later(scheduleContent, jitter(4000, 7000));
    later(scheduleCreators, jitter(4000, 7000));
    later(scheduleStatus, jitter(2400, 3600));
    later(scheduleOpt, jitter(5200, 7200));

    return () => {
      cancelled = true;
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [ambient]);

  const shown = assembled || !motionEnabled;
  const enterDelay = (seconds: number) => (motionEnabled ? seconds : 0);
  const reachPath = linePath(reachPts, GRAPH_W, GRAPH_H, GRAPH_SLOTS);
  const engagePath = linePath(engagePts, GRAPH_W, GRAPH_H, GRAPH_SLOTS);
  const spendPath = linePath(spendPts, GRAPH_W, GRAPH_H, GRAPH_SLOTS);
  const focusedPts =
    graphFocus === 1 ? engagePts : graphFocus === 2 ? spendPts : reachPts;
  const tipX = ((focusedPts.length - 1) / (GRAPH_SLOTS - 1)) * GRAPH_W;
  const tipY = GRAPH_H - ((focusedPts[focusedPts.length - 1] ?? 48) / 100) * GRAPH_H;
  const allocOrder: ChannelId[] = ["tiktok", "meta", "instagram", "spotify"];
  let allocAngle = -18;
  const allocArcs = allocOrder.map((id) => {
    const sweep = (alloc[id] / 100) * 328;
    const start = allocAngle;
    allocAngle += sweep + 8;
    return { id, d: arcPath(92, start, sweep) };
  });

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (compact || !motionEnabled) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    pointerX.set(event.clientX - bounds.left);
    pointerY.set(event.clientY - bounds.top);
    pointerOpacity.set(0.18);
    const now = performance.now();
    if (now - channelCenterAtRef.current > 180) {
      channelCenterAtRef.current = now;
      for (const channel of CHANNELS) {
        let slot = channelBoxRef.current[channel.id];
        if (!(slot instanceof HTMLElement)) {
          const found = event.currentTarget.querySelector(
            `.process-command__channel--${channel.id}`,
          );
          if (found instanceof HTMLElement) {
            channelBoxRef.current[channel.id] = found;
            slot = found;
          }
        }
        if (!(slot instanceof HTMLElement)) continue;
        const box = slot.getBoundingClientRect();
        channelCenterRef.current[channel.id] = {
          x: box.left + box.width / 2,
          y: box.top + box.height / 2,
        };
      }
    }
    let nearest: ChannelId | null = null;
    let best = 90;
    for (const channel of CHANNELS) {
      const center = channelCenterRef.current[channel.id];
      if (!center) continue;
      const dist = Math.hypot(event.clientX - center.x, event.clientY - center.y);
      if (dist < best) {
        best = dist;
        nearest = channel.id;
      }
    }
    if (hoverChannelRef.current !== nearest) {
      hoverChannelRef.current = nearest;
      setHoverChannel(nearest);
    }
  };

  return (
    <div
      className={cn(
        "process-command",
        compact ? "process-command--compact" : `process-command--${side}`,
        quiet && "process-command--quiet",
        reacting && "process-command--react",
        coreMode === "live" && "process-command--live",
      )}
      aria-hidden="true"
    >
      <motion.div
        className="process-command__motion"
        style={motionEnabled ? { opacity, y, scale: holdScale } : { opacity: 1 }}
      >
        <motion.span
          className="process-command__watermark"
          style={motionEnabled ? { y: bgY } : undefined}
        >
          04
        </motion.span>

        <div
          ref={stageRef}
          className="process-command__stage"
          onPointerMove={onPointerMove}
          onPointerLeave={() => {
            pointerOpacity.set(0);
            hoverChannelRef.current = null;
            setHoverChannel(null);
          }}
        >
          <motion.div
            className="process-command__pointer-slot"
            style={
              motionEnabled
                ? { x: pointerX, y: pointerY, opacity: pointerOpacity }
                : { opacity: 0 }
            }
          >
            <span className="process-command__pointer" />
          </motion.div>

          <motion.div
            className="process-command__metrics"
            style={motionEnabled ? { y: midY } : undefined}
            initial={false}
            animate={shown ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.45, delay: enterDelay(1.28), ease: EASE_OUT }}
          >
            <p className="process-command__eyebrow">Campaign command centre</p>
            <p className="process-command__metric">
              <span>Reach</span>
              <FlipValue
                value={formatReach(liveReach)}
                enabled={motionEnabled}
                className="process-command__metric-value"
              />
              <em>{campaignPerformance.reachDelta}</em>
            </p>
            <p className="process-command__metric">
              <span>Engagement</span>
              <FlipValue
                value={formatEngage(liveEngage)}
                enabled={motionEnabled}
                className="process-command__metric-value"
              />
              <em>{campaignPerformance.engageDelta}</em>
            </p>
            <p className="process-command__metric process-command__metric--spend">
              <span>Spend</span>
              <FlipValue
                value={`${formatSpend(liveSpend)} / ${campaignPlan.budgetLabel}`}
                enabled={motionEnabled}
                className="process-command__metric-value"
              />
              <span className="process-command__spend">
                <motion.span
                  className="process-command__spend-fill"
                  animate={{ scaleX: spendRatio }}
                  transition={{ duration: 0.7, ease: EASE_OUT }}
                />
              </span>
            </p>
            <p className="process-command__metric">
              <span>Creators active</span>
              <FlipValue
                value={`${liveCreators} / ${CREATORS_MAX}`}
                enabled={motionEnabled}
                className="process-command__metric-value"
              />
              <span className="process-command__dots">
                {Array.from({ length: CREATORS_MAX }, (_, index) => (
                  <i
                    key={index}
                    className={index < liveCreators ? "is-on" : undefined}
                  />
                ))}
              </span>
            </p>
            <p className="process-command__metric">
              <span>Content active</span>
              <FlipValue
                value={`${liveContent} / ${CONTENT_MAX}`}
                enabled={motionEnabled}
                className="process-command__metric-value"
              />
              <span className="process-command__dots process-command__dots--wide">
                {Array.from({ length: CONTENT_MAX }, (_, index) => (
                  <i
                    key={index}
                    className={index < liveContent ? "is-on" : undefined}
                  />
                ))}
              </span>
            </p>
            <p className="process-command__metric process-command__metric--status">
              <span>Status</span>
              <FlipValue
                value={status}
                enabled={motionEnabled}
                className="process-command__status"
              />
            </p>
          </motion.div>

          <motion.div
            className="process-command__engine"
            style={motionEnabled ? { y: fgY } : undefined}
          >
            <motion.div
              className="process-command__glow-slot"
              initial={false}
              animate={
                shown
                  ? { opacity: 1, scale: coreHot ? 1.04 : 1 }
                  : { opacity: 0, scale: 0.92 }
              }
              transition={{ duration: coreHot ? 0.34 : 0.55, ease: EASE_OUT }}
            >
              <div className="process-command__glow" />
            </motion.div>

            <svg className="process-command__svg" viewBox="0 0 496 400" fill="none">
              <motion.g
                initial={false}
                animate={shown ? { opacity: 1 } : { opacity: 0 }}
                transition={{ duration: 0.5, ease: EASE_OUT }}
              >
                <circle className="process-command__ring" cx={CX} cy={CY} r="168" />
                <circle
                  className="process-command__ring process-command__ring--ticks"
                  cx={CX}
                  cy={CY}
                  r="138"
                />
                <circle
                  className="process-command__ring process-command__ring--cw"
                  cx={CX}
                  cy={CY}
                  r="112"
                />
                <circle
                  className="process-command__ring process-command__ring--ccw"
                  cx={CX}
                  cy={CY}
                  r="78"
                />
                <circle
                  className="process-command__ring process-command__ring--soft"
                  cx={CX}
                  cy={CY}
                  r="54"
                />
                <line
                  className="process-command__scanner"
                  x1={CX}
                  y1={CY}
                  x2={CX + 138}
                  y2={CY}
                />
                <g className="process-command__orbit">
                  <circle cx={CX + 112} cy={CY} r="1.5" />
                  <circle cx={CX} cy={CY - 112} r="1.2" />
                  <circle cx={CX - 78} cy={CY + 78} r="1.1" />
                </g>
                {allocArcs.map((arc) => (
                  <path
                    key={arc.id}
                    className={cn(
                      "process-command__alloc",
                      hotChannel === arc.id && "is-hot",
                    )}
                    d={arc.d}
                  />
                ))}
              </motion.g>

              {CHANNELS.map((channel, index) => (
                <motion.path
                  key={channel.id}
                  className={cn(
                    "process-command__link",
                    (hotChannel === channel.id || hoverChannel === channel.id) &&
                      "is-hot",
                  )}
                  d={channel.path}
                  initial={false}
                  animate={
                    shown
                      ? { pathLength: 1, opacity: 1 }
                      : { pathLength: 0, opacity: 0 }
                  }
                  transition={{
                    duration: 0.55,
                    delay: enterDelay(0.92 + index * 0.08),
                    ease: EASE_OUT,
                  }}
                />
              ))}

              {packets.map((packet) => {
                const channel = CHANNELS.find((item) => item.id === packet.channel);
                if (!channel) return null;
                const from = packet.dir === "in" ? channel.from : { x: CX, y: CY };
                const to = packet.dir === "in" ? { x: CX, y: CY } : channel.from;
                return (
                  <motion.circle
                    key={packet.id}
                    className="process-command__packet"
                    r="2.2"
                    initial={{ cx: from.x, cy: from.y, opacity: 0 }}
                    animate={{ cx: to.x, cy: to.y, opacity: [0, 1, 1, 0] }}
                    transition={{
                      duration: 1.05,
                      ease: EASE_SOFT,
                      times: [0, 0.12, 0.82, 1],
                    }}
                    onAnimationComplete={() => {
                      if (packet.dir === "in") setPulse((current) => current + 1);
                      setPackets((current) =>
                        current.filter((item) => item.id !== packet.id),
                      );
                    }}
                  />
                );
              })}

              <motion.g
                initial={false}
                animate={
                  shown ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.86 }
                }
                transition={{ duration: 0.5, delay: enterDelay(0.2), ease: EASE_OUT }}
                style={{ transformOrigin: `${CX}px ${CY}px` }}
              >
                {pulse > 0 ? (
                  <circle
                    key={pulse}
                    className="process-command__core-halo"
                    cx={CX}
                    cy={CY}
                    r="46"
                  />
                ) : null}
                <circle className="process-command__core-ring" cx={CX} cy={CY} r="40" />
                <circle className="process-command__core" cx={CX} cy={CY} r="32" />
              </motion.g>
            </svg>

            <div className="process-command__core-label">
              <motion.div
                initial={false}
                animate={shown ? { opacity: 1 } : { opacity: 0 }}
                transition={{ duration: 0.4, delay: enterDelay(0.28), ease: EASE_OUT }}
              >
              <AnimatePresence mode="wait" initial={false}>
                <motion.strong
                  key={coreMode}
                  initial={motionEnabled ? { opacity: 0, y: 6 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  exit={motionEnabled ? { opacity: 0, y: -6 } : undefined}
                  transition={{ duration: 0.32, ease: EASE_SOFT }}
                >
                  {coreMode === "live" ? (
                    <>
                      Campaign
                      <br />
                      Running
                    </>
                  ) : (
                    "Ready"
                  )}
                </motion.strong>
              </AnimatePresence>
              <span className={cn("process-command__active", coreMode === "live" && "is-on")}>
                Active
              </span>
              </motion.div>
            </div>

            {CHANNELS.map((channel, index) => {
              const Glyph = GLYPHS[channel.id];
              const on = channelsOn[channel.id];
              const state = channelStatus[channel.id];
              const statusLabel =
                state === "analysing"
                  ? "ANALYSING"
                  : state === "delivering"
                    ? "DELIVERING"
                    : state === "traffic"
                      ? "TRAFFIC ACTIVE"
                      : channel.detail;
              return (
                <motion.article
                  key={channel.id}
                  className={cn(
                    "process-command__channel",
                    `process-command__channel--${channel.id}`,
                    on && "is-on",
                    (hotChannel === channel.id || hoverChannel === channel.id) &&
                      "is-hot",
                  )}
                  initial={false}
                  animate={
                    on
                      ? { opacity: 1, scale: 1 }
                      : { opacity: 0, scale: 0.92 }
                  }
                  transition={{
                    duration: 0.45,
                    delay: enterDelay(on ? 0 : 1.1 + index * 0.3),
                    ease: EASE_OUT,
                  }}
                >
                  <span className="process-command__channel-frame">
                    <Glyph />
                  </span>
                  <div>
                    <h4>{channel.name}</h4>
                    <p>{statusLabel}</p>
                    {optNote?.channel === channel.id ? (
                      <em>{optNote.label}</em>
                    ) : null}
                  </div>
                </motion.article>
              );
            })}
          </motion.div>

          <motion.div
            className="process-command__graph"
            style={motionEnabled ? { y: midY } : undefined}
            initial={false}
            animate={shown ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.5, delay: enterDelay(1.72), ease: EASE_OUT }}
          >
            <div className="process-command__graph-head">
              <p>Performance over time</p>
              <ul>
                <li className={graphFocus === 0 ? "is-on" : undefined}>Reach</li>
                <li className={graphFocus === 1 ? "is-on" : undefined}>Engagement</li>
                <li className={graphFocus === 2 ? "is-on" : undefined}>Spend</li>
              </ul>
            </div>
            <svg viewBox={`0 0 ${GRAPH_W} 72`} className="process-command__graph-svg">
              <motion.path
                className="process-command__graph-line process-command__graph-line--spend"
                d={spendPath}
                initial={false}
                animate={
                  shown
                    ? { pathLength: 1, opacity: 0.35, d: spendPath }
                    : { pathLength: 0, opacity: 0 }
                }
                transition={{
                  pathLength: { duration: 1.1, delay: enterDelay(1.78), ease: EASE_OUT },
                  opacity: { duration: 0.45 },
                  d: { duration: 0.8, ease: EASE_SOFT },
                }}
              />
              <motion.path
                className="process-command__graph-line process-command__graph-line--engage"
                d={engagePath}
                initial={false}
                animate={
                  shown
                    ? { pathLength: 1, opacity: 0.5, d: engagePath }
                    : { pathLength: 0, opacity: 0 }
                }
                transition={{
                  pathLength: { duration: 1.15, delay: enterDelay(1.86), ease: EASE_OUT },
                  opacity: { duration: 0.45 },
                  d: { duration: 0.8, ease: EASE_SOFT },
                }}
              />
              <motion.path
                className="process-command__graph-line"
                d={reachPath}
                initial={false}
                animate={
                  shown
                    ? { pathLength: 1, opacity: 1, d: reachPath }
                    : { pathLength: 0, opacity: 0 }
                }
                transition={{
                  pathLength: { duration: 1.2, delay: enterDelay(1.92), ease: EASE_OUT },
                  opacity: { duration: 0.45 },
                  d: { duration: 0.82, ease: EASE_SOFT },
                }}
              />
              {graphGlow > 0 ? (
                <motion.circle
                  key={`glow-${graphGlow}`}
                  className="process-command__graph-tip-glow"
                  cx={tipX}
                  cy={tipY}
                  r="5.4"
                  initial={{ opacity: 0.5, scale: 0.55 }}
                  animate={{ opacity: 0, scale: 1.85 }}
                  transition={{ duration: 0.7, ease: EASE_OUT }}
                />
              ) : null}
              <motion.circle
                className="process-command__graph-tip"
                cx={tipX}
                cy={tipY}
                r="2.1"
                animate={{ opacity: 1, scale: graphGlow % 2 === 0 ? 1.28 : 1 }}
                transition={{ duration: 0.4 }}
              />
            </svg>
            <p className="process-command__graph-axis">
              {campaignPerformance.axis.map((mark) => (
                <span key={mark}>{mark}</span>
              ))}
            </p>
            <p className="process-command__live-note">Campaign data</p>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
