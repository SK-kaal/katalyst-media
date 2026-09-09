"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  type MotionValue,
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
import { campaignOptimisation } from "@/content/process-campaign";
import "./optimisation-engine.css";

type HudSide = "before" | "after";
type OptState = "quiet" | "analysing" | "testing" | "adjusting" | "optimised";
type MetricId = "ctr" | "cpc" | "engagement" | "reach" | "conversion";
type ChannelId = "tiktok" | "meta" | "instagram" | "spotify";
type LoopId = "data" | "analyse" | "adjust" | "improve";

const CX = 200;
const CY = 196;
const GRAPH_SLOTS = 10;
const GRAPH_W = 168;
const GRAPH_H = 54;
const EASE_OUT = [0.215, 0.61, 0.355, 1] as const;
const EASE_SOFT = [0.22, 1, 0.36, 1] as const;

const LOOP = [
  { id: "data" as const, label: "Performance Data", angle: 0 },
  { id: "analyse" as const, label: "Analyse", angle: 90 },
  { id: "adjust" as const, label: "Adjust", angle: 180 },
  { id: "improve" as const, label: "Improve", angle: 270 },
];

const METRICS: ReadonlyArray<{
  id: MetricId;
  label: string;
  from: string;
  steps: readonly string[];
}> = campaignOptimisation.metrics;

const STATES: ReadonlyArray<{ id: Exclude<OptState, "quiet">; label: string }> = [
  { id: "analysing", label: "Analysing" },
  { id: "testing", label: "Testing" },
  { id: "adjusting", label: "Adjusting" },
  { id: "optimised", label: "Optimised" },
];

const ORIGINAL_LINE = [28, 32, 30, 34, 33, 36, 35, 37, 36, 38];
const OPT_SEED = [28, 34, 40, 47, 54];

const AB_STEPS = [
  { a: 50, b: 50 },
  { a: 48, b: 52 },
  { a: 44, b: 56 },
  { a: 42, b: 58 },
] as const;

// Starts from the split shown at launch and evolves from there. Each set totals 100.
const BUDGET_SETS: ReadonlyArray<Record<ChannelId, number>> =
  campaignOptimisation.allocationSets;

const CHANNEL_LABELS: Record<ChannelId, string> = {
  tiktok: "TikTok",
  meta: "Meta",
  instagram: "Instagram",
  spotify: "Spotify",
};

const LOOP_FOR_STATE: Record<OptState, readonly LoopId[]> = {
  quiet: [],
  analysing: ["data", "analyse"],
  testing: ["analyse"],
  adjusting: ["adjust"],
  optimised: ["improve"],
};

const CORE_STATUS: Record<OptState, string> = {
  quiet: "Performance analysis",
  analysing: "Performance analysis",
  testing: "Testing",
  adjusting: "Adjusting",
  optimised: "Optimised",
};

function clamp(value: number, min = 0, max = 1) {
  return Math.min(Math.max(value, min), max);
}

function jitter(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + Math.cos(rad) * r, y: cy + Math.sin(rad) * r };
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

function growOptimised(prev: number[]) {
  const last = prev[prev.length - 1] ?? 54;
  const nextVal = Math.min(92, last + 3.2);
  if (prev.length < GRAPH_SLOTS) return [...prev, nextVal];
  const next = prev.slice();
  next[next.length - 1] = nextVal;
  return next;
}

function paddedGraph(values: readonly number[]) {
  const pts = values.slice(0, GRAPH_SLOTS);
  const last = pts[pts.length - 1] ?? 54;
  while (pts.length < GRAPH_SLOTS) pts.push(last);
  return pts;
}

function FlipValue({
  value,
  enabled,
  lime = false,
}: {
  value: string;
  enabled: boolean;
  lime?: boolean;
}) {
  return (
    <span className={cn("process-opt__flip", lime && "is-lime")}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={value}
          initial={enabled ? { opacity: 0, y: 4 } : false}
          animate={{ opacity: 1, y: 0 }}
          exit={enabled ? { opacity: 0, y: -4 } : undefined}
          transition={{ duration: 0.42, ease: EASE_SOFT }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function IconSearch() {
  return (
    <svg viewBox="0 0 16 16" className="process-opt__mini" fill="none">
      <circle cx="7" cy="7" r="3.1" />
      <path d="m9.4 9.4 2.4 2.4" />
    </svg>
  );
}

function IconSliders() {
  return (
    <svg viewBox="0 0 16 16" className="process-opt__mini" fill="none">
      <path d="M3 5.5h10M6 3.5v4M3 10.5h10M10 8.5v4" />
    </svg>
  );
}

function IconRise() {
  return (
    <svg viewBox="0 0 16 16" className="process-opt__mini" fill="none">
      <path d="M3 11.5 6.4 8l2.4 1.8L13 5.2" />
      <path d="M9.8 5.2H13v3.2" />
    </svg>
  );
}

function IconPlay() {
  return (
    <svg viewBox="0 0 16 16" className="process-opt__mini" fill="none">
      <rect x="3.4" y="4.2" width="5.2" height="7.6" rx="0.8" />
      <path d="M10.2 10.6c.7 0 1.4-.4 1.7-1" />
    </svg>
  );
}

function IconFeed() {
  return (
    <svg viewBox="0 0 16 16" className="process-opt__mini" fill="none">
      <rect x="3.2" y="4.2" width="6.2" height="5.2" rx="0.8" />
      <rect x="6.4" y="6.6" width="6.4" height="5.2" rx="0.8" />
    </svg>
  );
}

function IconGrid() {
  return (
    <svg viewBox="0 0 16 16" className="process-opt__mini" fill="none">
      <rect x="3.4" y="3.4" width="9.2" height="9.2" rx="2.6" />
      <circle cx="8" cy="8" r="2.2" />
    </svg>
  );
}

function IconWave() {
  return (
    <svg viewBox="0 0 16 16" className="process-opt__mini" fill="none">
      <path d="M4 9.4V6.6M6.4 11V5M8.8 9.8V6.2M11.2 11.4V4.8" />
    </svg>
  );
}

function DataWave({ active }: { active: boolean }) {
  return (
    <span className={cn("process-opt__data-wave", active && "is-on")}>
      {Array.from({ length: 5 }, (_, index) => (
        <b key={index} />
      ))}
    </span>
  );
}

const LOOP_ICONS = {
  analyse: IconSearch,
  adjust: IconSliders,
  improve: IconRise,
} as const;

const CHANNEL_ICONS = {
  tiktok: IconPlay,
  meta: IconFeed,
  instagram: IconGrid,
  spotify: IconWave,
} as const;

export function OptimisationEngine({
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
  const engineRef = useRef<HTMLDivElement>(null);
  const metricEls = useRef<Partial<Record<MetricId, HTMLElement | null>>>({});
  const abRef = useRef<HTMLDivElement>(null);
  const budgetRef = useRef<HTMLDivElement>(null);
  const [assembled, setAssembled] = useState(!motionEnabled);
  const [ambient, setAmbient] = useState(!motionEnabled);
  const [quiet, setQuiet] = useState(false);
  const [optState, setOptState] = useState<OptState>(motionEnabled ? "quiet" : "analysing");
  const [focusMetric, setFocusMetric] = useState<MetricId | null>(null);
  const [metricStep, setMetricStep] = useState<Record<MetricId, number>>({
    ctr: -1,
    cpc: -1,
    engagement: -1,
    reach: -1,
    conversion: -1,
  });
  const [ab, setAb] = useState({ a: 50, b: 50 });
  const [selected, setSelected] = useState(false);
  const [alloc, setAlloc] = useState<Record<ChannelId, number>>({
    ...BUDGET_SETS[0],
  });
  const [optPts, setOptPts] = useState<number[]>(() => [...OPT_SEED]);
  const [graphGlow, setGraphGlow] = useState(0);
  const [feed, setFeed] = useState<{
    key: number;
    x1: string;
    y1: string;
    x2: string;
    y2: string;
  } | null>(null);
  const [loopKey, setLoopKey] = useState(0);

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
  const bgY = useTransform(parallax, (value) => value * 12 * depth);
  const midY = useTransform(parallax, (value) => value * 5 * depth);
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
    const id = window.setTimeout(() => setAmbient(true), 720);
    return () => window.clearTimeout(id);
  }, [assembled, motionEnabled]);

  const sendFeed = useCallback((fromEl: HTMLElement | null) => {
    const stage = stageRef.current;
    const engine = engineRef.current;
    if (!stage || !fromEl || !engine) return;
    const s = stage.getBoundingClientRect();
    const f = fromEl.getBoundingClientRect();
    const e = engine.getBoundingClientRect();
    if (s.width < 8 || s.height < 8) return;
    setFeed({
      key: Date.now(),
      x1: `${(((f.right + f.left) / 2 - s.left) / s.width) * 100}%`,
      y1: `${((f.top + f.height / 2 - s.top) / s.height) * 100}%`,
      x2: `${((e.left + e.width / 2 - s.left) / s.width) * 100}%`,
      y2: `${((e.top + e.height / 2 - s.top) / s.height) * 100}%`,
    });
  }, []);

  useEffect(() => {
    if (!ambient || !motionEnabled) return;
    let cancelled = false;
    const timers = new Set<number>();
    let metricPtr = 0;
    let abPtr = 0;
    let budgetPtr = 0;

    const later = (fn: () => void, ms: number) => {
      const id = window.setTimeout(() => {
        timers.delete(id);
        if (!cancelled) fn();
      }, ms);
      timers.add(id);
    };

    const runCycle = () => {
      if (cancelled) return;
      if (!liveRef.current) {
        later(runCycle, 900);
        return;
      }

      const metric = METRICS[metricPtr % METRICS.length];
      metricPtr += 1;
      const analysingMs = jitter(1200, 1500);
      const testingMs = jitter(1400, 1800);
      const adjustingMs = jitter(1200, 1500);
      const optimisedMs = jitter(1000, 1300);
      const pauseMs = jitter(1500, 2500);

      setFocusMetric(metric.id);
      setOptState("analysing");
      later(() => sendFeed(metricEls.current[metric.id] ?? null), 80);

      later(() => {
        if (cancelled || !liveRef.current) return;
        setOptState("testing");
        setLoopKey((value) => value + 1);
        if (abPtr < AB_STEPS.length - 1) {
          abPtr += 1;
          setAb(AB_STEPS[abPtr]);
          if (abPtr >= AB_STEPS.length - 1) setSelected(true);
        }
        later(() => sendFeed(abRef.current), 420);
      }, analysingMs);

      later(() => {
        if (cancelled || !liveRef.current) return;
        setOptState("adjusting");
        setMetricStep((current) => {
          const next = Math.min(current[metric.id] + 1, metric.steps.length - 1);
          if (next === current[metric.id]) return current;
          return { ...current, [metric.id]: next };
        });
        budgetPtr += 1;
        setAlloc(BUDGET_SETS[budgetPtr % BUDGET_SETS.length]);
        later(() => sendFeed(budgetRef.current), 180);
        later(() => {
          if (cancelled || !liveRef.current) return;
          setOptPts((current) => growOptimised(current));
        }, 380);
      }, analysingMs + testingMs);

      later(() => {
        if (cancelled || !liveRef.current) return;
        setOptState("optimised");
        setGraphGlow((value) => value + 1);
      }, analysingMs + testingMs + adjustingMs);

      later(() => {
        if (cancelled) return;
        setOptState("quiet");
        setFocusMetric(null);
        later(runCycle, pauseMs);
      }, analysingMs + testingMs + adjustingMs + optimisedMs);
    };

    runCycle();

    return () => {
      cancelled = true;
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [ambient, motionEnabled, sendFeed]);

  const shown = assembled || !motionEnabled;
  const enterDelay = (seconds: number) => (motionEnabled ? seconds : 0);
  const graphPts = paddedGraph(optPts);
  const originalPath = linePath(ORIGINAL_LINE, GRAPH_W, GRAPH_H, GRAPH_SLOTS);
  const optimisedPath = linePath(graphPts, GRAPH_W, GRAPH_H, GRAPH_SLOTS);
  const graphLength = clamp(optPts.length / GRAPH_SLOTS, 0.2, 1);
  const lastOpt = optPts[optPts.length - 1] ?? 54;
  const tipX = ((optPts.length - 1) / (GRAPH_SLOTS - 1)) * GRAPH_W;
  const tipY = GRAPH_H - (lastOpt / 100) * GRAPH_H;
  const analysing = optState === "analysing";
  const testing = optState === "testing";
  const adjusting = optState === "adjusting";
  const activeLoops = LOOP_FOR_STATE[optState];

  return (
    <div
      className={cn(
        "process-opt",
        compact ? "process-opt--compact" : `process-opt--${side}`,
        quiet && "process-opt--quiet",
        optState !== "quiet" && `process-opt--${optState}`,
      )}
      aria-hidden="true"
    >
      <motion.div
        className="process-opt__motion"
        style={motionEnabled ? { opacity, y, scale: holdScale } : { opacity: 1 }}
      >
        <motion.span
          className="process-opt__watermark"
          style={motionEnabled ? { y: bgY } : undefined}
        >
          05
        </motion.span>

        <div className="process-opt__stage" ref={stageRef}>
          {feed ? (
            <motion.span
              key={feed.key}
              className="process-opt__feed"
              initial={{ left: feed.x1, top: feed.y1, opacity: 0, scale: 0.6 }}
              animate={{
                left: feed.x2,
                top: feed.y2,
                opacity: [0, 1, 1, 0],
                scale: [0.6, 1, 1, 0.4],
              }}
              transition={{ duration: 0.82, ease: EASE_SOFT, times: [0, 0.12, 0.78, 1] }}
              onAnimationComplete={() => setFeed((current) => (current?.key === feed.key ? null : current))}
            />
          ) : null}
          <motion.div
            className="process-opt__metrics"
            style={motionEnabled ? { y: midY } : undefined}
            initial={false}
            animate={shown ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.48, delay: enterDelay(0.72), ease: EASE_OUT }}
          >
            {METRICS.map((metric) => {
              const step = metricStep[metric.id];
              const current = step < 0 ? metric.from : metric.steps[step];
              return (
                <p
                  key={metric.id}
                  ref={(el) => {
                    metricEls.current[metric.id] = el;
                  }}
                  className={cn(
                    "process-opt__metric",
                    focusMetric === metric.id && "is-focus",
                  )}
                >
                  <span>{metric.label}</span>
                  <FlipValue value={current} enabled={motionEnabled} />
                </p>
              );
            })}
          </motion.div>

          <motion.div
            ref={engineRef}
            className="process-opt__engine"
            style={motionEnabled ? { y: fgY } : undefined}
          >
            <motion.div
              className="process-opt__glow-slot"
              initial={false}
              animate={
                shown
                  ? {
                      opacity: 1,
                      scale:
                        optState === "adjusting"
                          ? 1.06
                          : optState === "optimised"
                            ? 1.04
                            : 1,
                    }
                  : { opacity: 0, scale: 0.9 }
              }
              transition={{ duration: 0.5, delay: enterDelay(0.18), ease: EASE_OUT }}
            >
              <div className="process-opt__glow" />
            </motion.div>

            <svg className="process-opt__svg" viewBox="0 0 400 400" fill="none">
              <defs>
                <marker
                  id="process-opt-arrow"
                  markerWidth="7"
                  markerHeight="7"
                  refX="6"
                  refY="3.5"
                  orient="auto"
                >
                  <path d="M1 1.2 6 3.5 1 5.8" />
                </marker>
              </defs>
              <motion.g
                initial={false}
                animate={shown ? { opacity: 1 } : { opacity: 0 }}
                transition={{ duration: 0.5, delay: enterDelay(0.08), ease: EASE_OUT }}
              >
                <circle className="process-opt__ring" cx={CX} cy={CY} r="168" />
                <circle className="process-opt__ring process-opt__ring--ticks" cx={CX} cy={CY} r="148" />
                <circle className="process-opt__ring process-opt__ring--cw" cx={CX} cy={CY} r="118" />
                <circle className="process-opt__ring process-opt__ring--ccw" cx={CX} cy={CY} r="86" />
                <circle className="process-opt__ring process-opt__ring--soft" cx={CX} cy={CY} r="58" />
                <circle
                  className={cn("process-opt__scan", analysing && "is-on")}
                  cx={CX}
                  cy={CY}
                  r="132"
                />
                <g className="process-opt__orbit">
                  <circle cx={CX} cy={CY - 148} r="1.4" />
                  <circle cx={CX + 105} cy={CY + 105} r="1.15" />
                  <circle cx={CX - 118} cy={CY} r="1.2" />
                </g>
              </motion.g>
              {(
                [
                  "M 200 48 A 148 148 0 0 1 348 196",
                  "M 348 196 A 148 148 0 0 1 200 344",
                  "M 200 344 A 148 148 0 0 1 52 196",
                  "M 52 196 A 148 148 0 0 1 200 48",
                ] as const
              ).map((d, index) => (
                <motion.path
                  key={d}
                  className="process-opt__loop"
                  d={d}
                  markerEnd="url(#process-opt-arrow)"
                  initial={false}
                  animate={shown ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
                  transition={{
                    duration: 0.55,
                    delay: enterDelay(0.34 + index * 0.08),
                    ease: EASE_OUT,
                  }}
                />
              ))}

              {testing && loopKey > 0 ? (
                <motion.g
                  key={`loop-${loopKey}`}
                  className="process-opt__courier"
                  style={{ transformOrigin: `${CX}px ${CY}px` }}
                  initial={{ rotate: 0, opacity: 0 }}
                  animate={{ rotate: 360, opacity: [0, 1, 1, 0] }}
                  transition={{
                    duration: 1.55,
                    ease: "linear",
                    times: [0, 0.08, 0.88, 1],
                  }}
                >
                  <circle className="process-opt__packet" cx={CX} cy={CY - 148} r="2.05" />
                </motion.g>
              ) : null}

              <motion.g
                initial={false}
                animate={
                  shown
                    ? {
                        opacity: 1,
                        scale:
                          optState === "adjusting"
                            ? 0.96
                            : optState === "optimised"
                              ? 1.04
                              : analysing
                                ? 1.02
                                : 1,
                      }
                    : { opacity: 0, scale: 0.86 }
                }
                transition={{
                  opacity: { duration: 0.48, delay: enterDelay(0.22), ease: EASE_OUT },
                  scale: { duration: 0.42, ease: EASE_OUT },
                }}
                style={{ transformOrigin: `${CX}px ${CY}px` }}
              >
                <circle className="process-opt__core-ring" cx={CX} cy={CY} r="42" />
                <circle className="process-opt__core" cx={CX} cy={CY} r="34" />
              </motion.g>
            </svg>

            <div className="process-opt__core-label">
              <motion.div
                initial={false}
                animate={shown ? { opacity: 1 } : { opacity: 0 }}
                transition={{ duration: 0.4, delay: enterDelay(0.28), ease: EASE_OUT }}
              >
                <strong>
                  Optimisation
                  <br />
                  Engine
                </strong>
                <span>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.em
                      key={CORE_STATUS[optState]}
                      initial={motionEnabled ? { opacity: 0, y: 4 } : false}
                      animate={{ opacity: 1, y: 0 }}
                      exit={motionEnabled ? { opacity: 0, y: -4 } : undefined}
                      transition={{ duration: 0.32, ease: EASE_SOFT }}
                    >
                      {CORE_STATUS[optState]}
                    </motion.em>
                  </AnimatePresence>
                </span>
              </motion.div>
            </div>

            {LOOP.map((item, index) => {
              const Icon = item.id === "data" ? null : LOOP_ICONS[item.id];
              const point = polar(50, 49, item.angle % 180 === 90 ? 34 : 41, item.angle);
              return (
                <div
                  key={item.id}
                  className={cn(
                    "process-opt__loop-label",
                    `process-opt__loop-label--${item.id}`,
                    activeLoops.includes(item.id) && "is-on",
                  )}
                  style={{ left: `${point.x}%`, top: `${point.y}%` }}
                >
                  <motion.div
                    initial={false}
                    animate={shown ? { opacity: 1 } : { opacity: 0 }}
                    transition={{
                      duration: 0.4,
                      delay: enterDelay(1.72 + index * 0.06),
                      ease: EASE_OUT,
                    }}
                  >
                    {item.id === "data" ? (
                      <DataWave active={analysing} />
                    ) : Icon ? (
                      <Icon />
                    ) : null}
                    <span>{item.label}</span>
                  </motion.div>
                </div>
              );
            })}
          </motion.div>

          <motion.div
            className="process-opt__side"
            style={motionEnabled ? { y: midY } : undefined}
            initial={false}
            animate={shown ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.45, delay: enterDelay(1), ease: EASE_OUT }}
          >
            <div className="process-opt__graph">
              <div className="process-opt__graph-head">
                <p>Performance over time</p>
                <ul>
                  <li>Original</li>
                  <li>Optimised</li>
                </ul>
              </div>
              <svg viewBox={`0 0 ${GRAPH_W} 58`} className="process-opt__graph-svg">
                <motion.path
                  className="process-opt__graph-line process-opt__graph-line--original"
                  d={originalPath}
                  initial={false}
                  animate={shown ? { pathLength: 1, opacity: 0.55 } : { pathLength: 0, opacity: 0 }}
                  transition={{ duration: 0.9, delay: enterDelay(1.04), ease: EASE_OUT }}
                />
                <motion.path
                  className="process-opt__graph-line"
                  d={optimisedPath}
                  initial={false}
                  animate={
                    shown
                      ? { pathLength: graphLength, opacity: 1 }
                      : { pathLength: 0, opacity: 0 }
                  }
                  transition={{
                    pathLength: { duration: 0.7, ease: EASE_SOFT },
                    opacity: { duration: 0.4 },
                  }}
                />
                {graphGlow > 0 ? (
                  <motion.circle
                    key={`glow-${graphGlow}`}
                    className="process-opt__graph-tip-glow"
                    cx={tipX}
                    cy={tipY}
                    r="5.2"
                    initial={{ opacity: 0.55, scale: 0.5 }}
                    animate={{ opacity: 0, scale: 1.8 }}
                    transition={{ duration: 0.85, ease: EASE_OUT }}
                  />
                ) : null}
                <motion.circle
                  className="process-opt__graph-tip"
                  r="2.15"
                  initial={false}
                  animate={{
                    cx: tipX,
                    cy: tipY,
                    opacity: optState === "optimised" ? 1 : 0.88,
                    scale: optState === "optimised" ? 1.35 : 1,
                  }}
                  transition={{ duration: 0.55, ease: EASE_SOFT }}
                />
              </svg>
            </div>

            <ul className="process-opt__states">
              {STATES.map((item) => (
                <li
                  key={item.id}
                  className={cn(optState === item.id && "is-on")}
                >
                  <i />
                  {item.id === "analysing" ? (
                    <span className={cn("process-opt__wave", analysing && "is-on")}>
                      {Array.from({ length: 7 }, (_, index) => (
                        <b key={index} />
                      ))}
                    </span>
                  ) : null}
                  {item.label}
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            ref={abRef}
            className={cn(
              "process-opt__ab",
              testing && "is-live",
              selected && "is-done",
            )}
            style={motionEnabled ? { y: midY } : undefined}
            initial={false}
            animate={shown ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.42, delay: enterDelay(1.35), ease: EASE_OUT }}
          >
            <p className={cn("process-opt__ab-row", selected && "is-dim")}>
              <span>Creative A</span>
              <FlipValue value={`${ab.a}%`} enabled={motionEnabled} />
              <span className="process-opt__bar">
                <motion.span
                  animate={{ scaleX: ab.a / 100 }}
                  transition={{ duration: 0.7, ease: EASE_SOFT }}
                />
              </span>
            </p>
            <p className={cn("process-opt__ab-row", selected && "is-win")}>
              <span>Creative B</span>
              <FlipValue value={`${ab.b}%`} enabled={motionEnabled} />
              <span className="process-opt__bar">
                <motion.span
                  animate={{ scaleX: ab.b / 100 }}
                  transition={{ duration: 0.7, ease: EASE_SOFT }}
                />
              </span>
            </p>
            <p className={cn("process-opt__picked", selected && "is-on")}>B selected</p>
          </motion.div>

          <motion.div
            ref={budgetRef}
            className={cn("process-opt__budget", adjusting && "is-hot")}
            style={motionEnabled ? { y: midY } : undefined}
            initial={false}
            animate={shown ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.42, delay: enterDelay(1.55), ease: EASE_OUT }}
          >
            <p>Budget allocation</p>
            <ul>
              {(["tiktok", "meta", "instagram", "spotify"] as const).map((id) => {
                const Icon = CHANNEL_ICONS[id];
                return (
                  <li key={id}>
                    <span className="process-opt__budget-head">
                      <Icon />
                      {CHANNEL_LABELS[id]}
                    </span>
                    <FlipValue value={`${alloc[id]}%`} enabled={motionEnabled} />
                    <span className="process-opt__bar">
                      <motion.span
                        animate={{ scaleX: alloc[id] / 50 }}
                        transition={{ duration: 0.75, ease: EASE_SOFT }}
                      />
                    </span>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
