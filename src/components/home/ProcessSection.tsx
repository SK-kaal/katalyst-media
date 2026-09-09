"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  motion,
  type MotionValue,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
} from "framer-motion";
import { processCopy } from "@/content/homepage";
import { campaignNote } from "@/content/process-campaign";
import { cn } from "@/lib/utils";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/motion";
import { MusicAnalysisHud } from "@/components/home/MusicAnalysisHud";
import { AudienceConstellation } from "@/components/home/AudienceConstellation";
import { StrategyEngine } from "@/components/home/StrategyEngine";
import { CampaignCommand } from "@/components/home/CampaignCommand";
import { OptimisationEngine } from "@/components/home/OptimisationEngine";
import {
  EASE_OUT,
  EASE_SOFT,
  clamp,
  introClearY,
  introDepart,
  introFade,
  introHintFade,
  introLineReveal,
  introProgress,
  INTRO_LOCK_SVH,
  smoothstep,
} from "@/components/home/process-motion";
import "./process-section.css";

type Point = { x: number; y: number };
type LayoutMode = "mobile" | "portrait" | "tablet" | "desktop";
type TextSide = "before" | "after";

type RecapPoint = Point & { d: string };

type JourneyGeometry = {
  width: number;
  height: number;
  vh: number;
  viewBox: string;
  route: string;
  start: Point;
  nodes: readonly Point[];
  overview: Point;
  recap: readonly RecapPoint[];
  recapLayout: "fan" | "stack";
  textSides: readonly TextSide[];
};

const SAMPLE_COUNT = 360;
const STAGE_HOLD_SVH = 42;
const INTRO_BEAT_SVH = 24;
const OVERVIEW_SHORT = [
  "Music",
  "Audience",
  "Strategy",
  "Launch",
  "Optimise",
] as const;

const DESKTOP_GEOMETRY: JourneyGeometry = {
  width: 1000,
  height: 11040,
  vh: 1104,
  viewBox: "0 0 1000 11040",
  start: { x: 500, y: 680 },
  nodes: [
    { x: 380, y: 4220 },
    { x: 620, y: 5570 },
    { x: 370, y: 6920 },
    { x: 630, y: 8270 },
    { x: 400, y: 9620 },
  ],
  overview: { x: 500, y: 10600 },
  recap: [
    { x: 200, y: 10900, d: "M 500 10600 C 410 10680 270 10800 200 10900" },
    { x: 350, y: 10800, d: "M 500 10600 C 450 10660 380 10740 350 10800" },
    { x: 500, y: 10760, d: "M 500 10600 C 500 10660 500 10720 500 10760" },
    { x: 650, y: 10800, d: "M 500 10600 C 550 10660 620 10740 650 10800" },
    { x: 800, y: 10900, d: "M 500 10600 C 590 10680 730 10800 800 10900" },
  ],
  recapLayout: "fan",
  textSides: ["before", "after", "before", "after", "before"],
  route:
    "M 500 680 C 500 1690 500 2860 492 3700 C 478 3980 420 4140 380 4220 C 430 4580 540 5040 620 5570 C 680 5940 460 6400 370 6920 C 430 7300 550 7800 630 8270 C 680 8640 480 9160 400 9620 C 360 9900 450 10300 500 10600",
};

const TABLET_GEOMETRY: JourneyGeometry = {
  width: 1000,
  height: 10540,
  vh: 1054,
  viewBox: "0 0 1000 10540",
  start: { x: 500, y: 660 },
  nodes: [
    { x: 390, y: 4020 },
    { x: 610, y: 5320 },
    { x: 380, y: 6620 },
    { x: 620, y: 7920 },
    { x: 410, y: 9180 },
  ],
  overview: { x: 500, y: 10120 },
  recap: [
    { x: 220, y: 10400, d: "M 500 10120 C 420 10200 280 10320 220 10400" },
    { x: 360, y: 10320, d: "M 500 10120 C 450 10180 390 10260 360 10320" },
    { x: 500, y: 10280, d: "M 500 10120 C 500 10180 500 10240 500 10280" },
    { x: 640, y: 10320, d: "M 500 10120 C 550 10180 610 10260 640 10320" },
    { x: 780, y: 10400, d: "M 500 10120 C 580 10200 720 10320 780 10400" },
  ],
  recapLayout: "fan",
  textSides: ["before", "after", "before", "after", "before"],
  route:
    "M 500 660 C 500 1590 500 2710 488 3520 C 472 3760 430 3920 390 4020 C 440 4360 530 4820 610 5320 C 662 5680 468 6120 380 6620 C 436 6980 538 7460 620 7920 C 668 8280 488 8760 410 9180 C 380 9460 450 9840 500 10120",
};

const PORTRAIT_GEOMETRY: JourneyGeometry = {
  width: 1000,
  height: 10080,
  vh: 1008,
  viewBox: "0 0 1000 10080",
  start: { x: 500, y: 660 },
  nodes: [
    { x: 320, y: 3840 },
    { x: 680, y: 5080 },
    { x: 330, y: 6320 },
    { x: 670, y: 7560 },
    { x: 360, y: 8760 },
  ],
  overview: { x: 500, y: 9640 },
  recap: [
    { x: 260, y: 9900, d: "M 500 9640 C 430 9720 300 9840 260 9900" },
    { x: 380, y: 9840, d: "M 500 9640 C 450 9700 400 9780 380 9840" },
    { x: 500, y: 9800, d: "M 500 9640 C 500 9700 500 9760 500 9800" },
    { x: 620, y: 9840, d: "M 500 9640 C 550 9700 600 9780 620 9840" },
    { x: 740, y: 9900, d: "M 500 9640 C 570 9720 700 9840 740 9900" },
  ],
  recapLayout: "stack",
  textSides: ["after", "before", "after", "before", "after"],
  route:
    "M 500 660 C 500 1520 490 2500 450 3320 C 400 3600 345 3740 320 3840 C 292 4100 430 4540 680 5080 C 712 5340 560 5800 330 6320 C 298 6580 450 7040 670 7560 C 702 7820 540 8280 360 8760 C 340 9060 440 9400 500 9640",
};

const MOBILE_GEOMETRY: JourneyGeometry = {
  width: 1000,
  height: 11760,
  vh: 1298,
  viewBox: "0 0 1000 11760",
  start: { x: 500, y: 620 },
  nodes: [
    { x: 300, y: 3910 },
    { x: 700, y: 5110 },
    { x: 310, y: 6310 },
    { x: 690, y: 7510 },
    { x: 340, y: 9060 },
  ],
  overview: { x: 500, y: 11060 },
  recap: [
    { x: 280, y: 11320, d: "M 500 11060 C 430 11140 320 11260 280 11320" },
    { x: 390, y: 11260, d: "M 500 11060 C 450 11120 410 11200 390 11260" },
    { x: 500, y: 11220, d: "M 500 11060 C 500 11120 500 11180 500 11220" },
    { x: 610, y: 11260, d: "M 500 11060 C 550 11120 590 11200 610 11260" },
    { x: 720, y: 11320, d: "M 500 11060 C 570 11140 680 11260 720 11320" },
  ],
  recapLayout: "stack",
  textSides: ["after", "before", "after", "before", "after"],
  route:
    "M 500 620 C 500 1520 480 2510 430 3370 C 380 3650 325 3810 300 3910 C 272 4190 430 4650 700 5110 C 728 5370 560 5810 310 6310 C 282 6590 450 7050 690 7510 C 718 7910 520 8490 340 9060 C 328 9660 430 10460 500 11060",
};

function geometryFor(layoutMode: LayoutMode) {
  if (layoutMode === "desktop") return DESKTOP_GEOMETRY;
  if (layoutMode === "tablet") return TABLET_GEOMETRY;
  if (layoutMode === "portrait") return PORTRAIT_GEOMETRY;
  return MOBILE_GEOMETRY;
}

type PathMap = {
  total: number;
  x: Float64Array;
  y: Float64Array;
  len: Float64Array;
};

function buildPathMap(route: SVGPathElement): PathMap {
  const total = route.getTotalLength();
  const x = new Float64Array(SAMPLE_COUNT + 1);
  const y = new Float64Array(SAMPLE_COUNT + 1);
  const len = new Float64Array(SAMPLE_COUNT + 1);
  for (let index = 0; index <= SAMPLE_COUNT; index += 1) {
    const distance = (total * index) / SAMPLE_COUNT;
    const point = route.getPointAtLength(distance);
    x[index] = point.x;
    y[index] = point.y;
    len[index] = distance;
  }
  return { total, x, y, len };
}

function sampleAtY(map: PathMap, targetY: number) {
  const last = map.y.length - 1;
  if (targetY <= map.y[0]) {
    return { x: map.x[0], y: map.y[0], len: 0, t: 0 };
  }
  if (targetY >= map.y[last]) {
    return { x: map.x[last], y: map.y[last], len: map.total, t: 1 };
  }
  let low = 0;
  let high = last;
  while (high - low > 1) {
    const mid = (low + high) >> 1;
    if (map.y[mid] < targetY) low = mid;
    else high = mid;
  }
  const span = map.y[high] - map.y[low] || 1;
  const mix = (targetY - map.y[low]) / span;
  return {
    x: map.x[low] + (map.x[high] - map.x[low]) * mix,
    y: map.y[low] + (map.y[high] - map.y[low]) * mix,
    len: map.len[low] + (map.len[high] - map.len[low]) * mix,
    t: mix,
  };
}

type JourneyStop = { id: number; y: number; len: number };

function lengthAtStop(map: PathMap, point: Point) {
  return sampleAtY(map, point.y).len;
}

function visualStops(
  canvasHeight: number,
  map: PathMap,
  points: readonly Point[],
  svgHeight: number,
): JourneyStop[] {
  const height = Math.max(canvasHeight, 1);
  return points.map((point, id) => ({
    id,
    y: (point.y / Math.max(svgHeight, 1)) * height,
    len: lengthAtStop(map, point),
  }));
}

function sampleAtLength(map: PathMap, target: number) {
  const last = map.len.length - 1;
  if (target <= 0) {
    return { x: map.x[0], y: map.y[0], len: 0 };
  }
  if (target >= map.total) {
    return { x: map.x[last], y: map.y[last], len: map.total };
  }
  let low = 0;
  let high = last;
  while (high - low > 1) {
    const mid = (low + high) >> 1;
    if (map.len[mid] < target) low = mid;
    else high = mid;
  }
  const span = map.len[high] - map.len[low] || 1;
  const mix = (target - map.len[low]) / span;
  return {
    x: map.x[low] + (map.x[high] - map.x[low]) * mix,
    y: map.y[low] + (map.y[high] - map.y[low]) * mix,
    len: target,
  };
}

function applyTravelledRoute(
  paths: Array<SVGPathElement | null>,
  map: PathMap | null,
  from: number,
  to: number,
) {
  if (!map) {
    for (const path of paths) {
      if (!path) continue;
      path.removeAttribute("stroke-dasharray");
      path.removeAttribute("stroke-dashoffset");
    }
    return;
  }
  const start = clamp(from, 0, map.total);
  const end = clamp(to, 0, map.total);
  const drawn = Math.max(end - start, 0);
  for (const path of paths) {
    if (!path) continue;
    path.setAttribute(
      "stroke-dasharray",
      drawn <= 0.35
        ? `0 ${map.total}`
        : `0 ${start} ${drawn} ${map.total}`,
    );
    path.setAttribute("stroke-dashoffset", "0");
  }
}

type HeldJourney = {
  len: number;
  head: number;
  holding: boolean;
};

function lerp(from: number, to: number, t: number) {
  return from + (to - from) * t;
}

function journeyWithHolds(
  stops: JourneyStop[],
  cameraPx: number,
  holdPx: number,
  pause?: { y: number; len: number; holdPx: number },
): HeldJourney {
  if (stops.length < 2) {
    return { len: 0, head: 0, holding: false };
  }

  const first = stops[0];
  const last = stops[stops.length - 1];
  if (cameraPx <= first.y) {
    return { len: first.len, head: first.id, holding: false };
  }

  for (let index = 0; index < stops.length - 1; index += 1) {
    const from = stops[index];
    const to = stops[index + 1];
    const stageHold = from.id >= 1 && from.id <= 5 ? holdPx : 0;

    if (stageHold > 0 && cameraPx <= from.y + stageHold) {
      return { len: from.len, head: from.id, holding: true };
    }

    const travelStart = from.y + stageHold;
    const pauseHere =
      pause && pause.y > travelStart && pause.y < to.y ? pause : undefined;

    if (pauseHere) {
      if (cameraPx <= pauseHere.y) {
        const t = clamp(
          (cameraPx - travelStart) / Math.max(pauseHere.y - travelStart, 1),
        );
        return {
          len: lerp(from.len, pauseHere.len, t),
          head: lerp(
            from.id,
            from.id + (pauseHere.y - from.y) / Math.max(to.y - from.y, 1),
            t,
          ),
          holding: false,
        };
      }
      if (cameraPx <= pauseHere.y + pauseHere.holdPx) {
        return {
          len: pauseHere.len,
          head: from.id + (pauseHere.y - from.y) / Math.max(to.y - from.y, 1),
          holding: true,
        };
      }
      if (cameraPx <= to.y) {
        const after = pauseHere.y + pauseHere.holdPx;
        const t = clamp((cameraPx - after) / Math.max(to.y - after, 1));
        return {
          len: lerp(pauseHere.len, to.len, t),
          head: lerp(
            from.id + (pauseHere.y - from.y) / Math.max(to.y - from.y, 1),
            to.id,
            t,
          ),
          holding: false,
        };
      }
    } else if (cameraPx <= to.y) {
      const t = clamp(
        (cameraPx - travelStart) / Math.max(to.y - travelStart, 1),
      );
      return {
        len: lerp(from.len, to.len, t),
        head: lerp(from.id, to.id, t),
        holding: false,
      };
    }
  }

  return { len: last.len, head: last.id, holding: false };
}

function JourneyStage({
  step,
  nodeY,
  side,
  stackedLines,
  feature,
  readY,
  motionEnabled,
  lead = 560,
}: {
  step: (typeof processCopy.steps)[number];
  nodeY: number;
  side: TextSide;
  stackedLines?: readonly [string, string];
  feature?: boolean;
  readY: MotionValue<number>;
  motionEnabled: boolean;
  lead?: number;
}) {
  const numberOpacity = useTransform(readY, (value) => {
    const entered = smoothstep((value - (nodeY - lead)) / 380);
    const faded = smoothstep((value - (nodeY + 280)) / 920);
    return entered * (1 - faded * 0.62);
  });
  const titleOpacity = useTransform(readY, (value) => {
    const entered = smoothstep((value - (nodeY - (lead - 40))) / 360);
    const faded = smoothstep((value - (nodeY + 300)) / 940);
    return entered * (1 - faded * 0.62);
  });
  const descriptionOpacity = useTransform(readY, (value) => {
    const entered = smoothstep((value - (nodeY - (lead - 90))) / 340);
    const faded = smoothstep((value - (nodeY + 320)) / 960);
    return entered * (1 - faded * 0.64);
  });
  const titleY = useTransform(readY, (value) => {
    const entered = smoothstep((value - (nodeY - (lead - 40))) / 360);
    return (1 - entered) * 16;
  });
  const descriptionY = useTransform(readY, (value) => {
    const entered = smoothstep((value - (nodeY - (lead - 90))) / 340);
    return (1 - entered) * 14;
  });

  return (
    <article
      className={cn(
        "process-stage-copy",
        stackedLines && "process-stage-copy--feature",
        feature && "process-stage-copy--feature",
        side === "before"
          ? "process-stage-copy--before"
          : "process-stage-copy--after",
      )}
    >
      <motion.p
        className="process-stage-copy__counter font-sans tabular-nums"
        style={motionEnabled ? { opacity: numberOpacity } : undefined}
      >
        <span>{step.number}</span>
        <span> / 05</span>
      </motion.p>
      <motion.h3
        className="process-stage-copy__title font-display font-semibold text-off-white text-balance"
        style={
          motionEnabled ? { opacity: titleOpacity, y: titleY } : undefined
        }
      >
        {stackedLines ? (
          <>
            <span>{stackedLines[0]}</span>
            <span>{stackedLines[1]}</span>
          </>
        ) : (
          step.title
        )}
      </motion.h3>
      <motion.p
        className="process-stage-copy__description"
        style={
          motionEnabled
            ? { opacity: descriptionOpacity, y: descriptionY }
            : undefined
        }
      >
        {step.description}
      </motion.p>
    </article>
  );
}

function IntroAtmosphere({
  readY,
  unitsPerVh,
  motionEnabled,
}: {
  readY: MotionValue<number>;
  unitsPerVh: number;
  motionEnabled: boolean;
}) {
  const recede = useTransform(readY, (value) =>
    introDepart(introProgress(value, unitsPerVh)),
  );
  const fade = useTransform(readY, (value) =>
    introFade(introProgress(value, unitsPerVh)),
  );
  const atmosphereOpacity = useTransform(fade, (value) => 1 - value);
  const atmosphereLift = useTransform(fade, (value) => value * -48);
  const glowOpacity = useTransform(fade, (value) => 0.88 * (1 - value * 0.82));
  const glowScale = useTransform(recede, (value) => 1 - value * 0.02);
  const ringOpacity = useTransform(fade, (value) => 0.78 * (1 - value * 0.7));
  const ringScale = useTransform(recede, (value) => 1 - value * 0.025);
  const enter = { opacity: 1, scale: 1 };
  const viewport = { once: true, amount: 0.42 as const };

  return (
    <motion.div
      className="process-intro__atmosphere"
      aria-hidden="true"
      style={
        motionEnabled
          ? { opacity: atmosphereOpacity, y: atmosphereLift }
          : undefined
      }
    >
      <div className="process-intro__grid" />
      <div className="process-intro__haze process-intro__haze--left" />
      <div className="process-intro__haze process-intro__haze--right" />
      <div className="process-intro__vignette" />

      <div className="process-intro__glow-slot">
        <motion.div
          initial={motionEnabled ? { opacity: 0, scale: 0.97 } : false}
          whileInView={enter}
          viewport={viewport}
          transition={{ duration: 1.4, delay: 0.04, ease: EASE_SOFT }}
        >
          <motion.div
            className="process-intro__glow"
            style={
              motionEnabled
                ? { opacity: glowOpacity, scale: glowScale }
                : { opacity: 0.7 }
            }
          >
            <span className="process-intro__glow-core" />
          </motion.div>
        </motion.div>
      </div>

      <div className="process-intro__rings-slot">
        <motion.div
          initial={motionEnabled ? { opacity: 0, scale: 0.97 } : false}
          whileInView={enter}
          viewport={viewport}
          transition={{ duration: 1.25, delay: 0.14, ease: EASE_SOFT }}
        >
          <motion.div
            className="process-intro__rings"
            style={
              motionEnabled
                ? { opacity: ringOpacity, scale: ringScale }
                : { opacity: 0.68 }
            }
          >
            <svg viewBox="0 0 200 200" className="process-intro__rings-svg">
              <g className="process-intro__ring-static">
                <circle
                  cx="100"
                  cy="100"
                  r="28"
                  className="process-intro__orbit process-intro__orbit--hair"
                />
                <circle
                  cx="100"
                  cy="100"
                  r="48"
                  className="process-intro__orbit process-intro__orbit--soft"
                />
                <circle
                  cx="100"
                  cy="100"
                  r="68"
                  className="process-intro__orbit process-intro__orbit--mid"
                />
                <circle
                  cx="100"
                  cy="100"
                  r="90"
                  className="process-intro__orbit process-intro__orbit--outer"
                />
              </g>
              <g className="process-intro__ring-cw">
                <circle
                  cx="100"
                  cy="100"
                  r="58"
                  className="process-intro__orbit process-intro__orbit--dashed"
                />
                <path
                  d="M 100 18 A 82 82 0 0 1 164 72"
                  className="process-intro__arc"
                />
              </g>
              <g className="process-intro__ring-ccw">
                <circle
                  cx="100"
                  cy="100"
                  r="78"
                  className="process-intro__orbit process-intro__orbit--sparse"
                />
              </g>
            </svg>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}

function BloomStem({
  d,
  revealed,
  delay,
  motionEnabled,
}: {
  d: string;
  revealed: boolean;
  delay: number;
  motionEnabled: boolean;
}) {
  return (
    <g>
      <motion.path
        className="process-recap-stem process-recap-stem--glow"
        d={d}
        strokeLinecap="round"
        initial={false}
        animate={
          revealed
            ? { pathLength: 1, opacity: 0.85 }
            : { pathLength: 0, opacity: 0 }
        }
        transition={{
          duration: motionEnabled ? 0.55 : 0,
          delay: motionEnabled ? delay : 0,
          ease: EASE_OUT,
        }}
      />
      <motion.path
        className="process-recap-stem"
        d={d}
        strokeLinecap="round"
        initial={false}
        animate={
          revealed
            ? { pathLength: 1, opacity: 1 }
            : { pathLength: 0, opacity: 0 }
        }
        transition={{
          duration: motionEnabled ? 0.55 : 0,
          delay: motionEnabled ? delay : 0,
          ease: EASE_OUT,
        }}
      />
    </g>
  );
}

function OverviewLanding({
  geometry,
  readY,
  motionEnabled,
}: {
  geometry: JourneyGeometry;
  readY: MotionValue<number>;
  motionEnabled: boolean;
}) {
  const copyOpacity = useTransform(readY, (value) =>
    smoothstep((value - (geometry.overview.y - 40)) / 90),
  );
  const copyY = useTransform(readY, (value) => {
    const entered = smoothstep((value - (geometry.overview.y - 40)) / 90);
    return (1 - entered) * 12;
  });

  return (
    <motion.div
      className="process-overview-end"
      style={{
        top: `${((geometry.overview.y + (geometry.recapLayout === "fan" ? 270 : 280)) / geometry.height) * 100}%`,
        x: "-50%",
        ...(motionEnabled
          ? { opacity: copyOpacity, y: copyY }
          : { opacity: 1 }),
      }}
    >
      <p className="process-overview-end__eyebrow label-caps text-acid-lime">
        {processCopy.overviewEyebrow}
      </p>
      <p className="process-overview-end__lede">{processCopy.overviewLede}</p>
      {geometry.recapLayout === "stack" ? (
        <ol className="process-overview-end__list">
          {processCopy.steps.map((step, index) => (
            <li key={step.number}>
              <span>{step.number}</span>
              {OVERVIEW_SHORT[index]}
            </li>
          ))}
        </ol>
      ) : null}
    </motion.div>
  );
}

function RecapMark({
  point,
  label,
  number,
  width,
  height,
  revealed,
  delay,
  showLabel,
  motionEnabled,
}: {
  point: Point;
  label: string;
  number: string;
  width: number;
  height: number;
  revealed: boolean;
  delay: number;
  showLabel: boolean;
  motionEnabled: boolean;
}) {
  const appear = (extra: number) => ({
    duration: motionEnabled ? 0.38 : 0,
    delay: motionEnabled ? delay + extra : 0,
    ease: EASE_OUT,
  });

  return (
    <div
      className="process-recap-mark"
      style={{
        left: `${(point.x / width) * 100}%`,
        top: `${(point.y / height) * 100}%`,
      }}
    >
      <span className="process-recap-mark__dot-slot">
        <motion.span
          className="process-recap-mark__dot"
          initial={false}
          animate={
            revealed
              ? { opacity: 1, scale: [0.7, 1.08, 1] }
              : { opacity: 0, scale: 0.4 }
          }
          transition={{
            duration: motionEnabled ? 0.55 : 0,
            delay: motionEnabled ? delay + 0.18 : 0,
            ease: EASE_OUT,
          }}
        />
      </span>
      {showLabel ? (
        <span className="process-recap-mark__label">
          <motion.span
            className="process-recap-mark__number"
            initial={false}
            animate={revealed ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
            transition={appear(0.22)}
          >
            {number}
          </motion.span>
          <motion.span
            initial={false}
            animate={revealed ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
            transition={appear(0.32)}
          >
            {label}
          </motion.span>
        </span>
      ) : null}
    </div>
  );
}

function Checkpoint({
  point,
  width,
  height,
  stopId,
  headProgress,
  emphasized = false,
  origin = false,
  finale = false,
  motionEnabled,
  veil,
}: {
  point: Point;
  width: number;
  height: number;
  stopId: number;
  headProgress: MotionValue<number>;
  emphasized?: boolean;
  origin?: boolean;
  finale?: boolean;
  motionEnabled: boolean;
  veil?: MotionValue<number>;
}) {
  const intensity = useTransform(headProgress, (value) => {
    const delta = value - stopId;
    if (delta < -0.55) return origin ? 0.42 : 0.12;
    if (delta < -0.04) return 0.22 + smoothstep((delta + 0.55) / 0.51) * 0.5;
    if (delta <= 0.08) return origin ? 0.82 : 1;
    return finale || origin || emphasized ? 0.72 : 0.5;
  });
  const scale = useTransform(headProgress, (value) => {
    const active = Math.abs(value - stopId) <= 0.08;
    if (!active) return finale ? 1.04 : 1;
    return finale || emphasized ? 1.1 : 1.08;
  });
  const ringOpacity = useTransform(intensity, (value) => 0.2 + value * 0.58);
  const coreOpacity = useTransform(intensity, (value) => 0.16 + value * 0.84);

  return (
    <motion.div
      className={cn(
        "process-node",
        emphasized && "process-node--result",
        origin && "process-node--origin",
        finale && "process-node--finale",
      )}
      data-process-stop={stopId}
      style={{
        left: `${(point.x / width) * 100}%`,
        top: `${(point.y / height) * 100}%`,
        ...(veil ? { opacity: veil } : {}),
      }}
    >
      <motion.span
        className="process-node__ring"
        style={
          motionEnabled ? { opacity: ringOpacity, scale } : undefined
        }
      />
      <motion.span
        className="process-node__core"
        style={motionEnabled ? { opacity: coreOpacity } : undefined}
      />
    </motion.div>
  );
}

export function ProcessSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const glowPathRef = useRef<SVGPathElement>(null);
  const completePathRef = useRef<SVGPathElement>(null);
  const signalRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<PathMap | null>(null);
  const stopsRef = useRef<JourneyStop[]>([]);
  const reduceMotion = useReducedMotion();
  const motionEnabled = reduceMotion === false;
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("mobile");
  const [overviewBloom, setOverviewBloom] = useState(false);
  const introSceneRef = useRef<HTMLDivElement>(null);
  const geometry = geometryFor(layoutMode);
  const geometryRef = useRef(geometry);
  geometryRef.current = geometry;

  const headProgress = useMotionValue(0);
  const signalX = useMotionValue(geometry.start.x);
  const signalY = useMotionValue(geometry.start.y);
  const signalOpacity = useMotionValue(0);
  const signalScale = useMotionValue(1);
  const readY = useMotionValue(0);
  const hazeX = useMotionValue(`${(geometry.start.x / geometry.width) * 100}%`);
  const hazeY = useMotionValue(`${(geometry.start.y / geometry.height) * 100}%`);

  const unitsPerVh = geometry.height / geometry.vh;
  const introProgressValue = useTransform(readY, (value) =>
    introProgress(value, unitsPerVh),
  );
  const introRecede = useTransform(introProgressValue, (value) =>
    introDepart(value),
  );
  const introScale = useTransform(introRecede, (value) => 1 - value * 0.01);
  const introOpacity = useTransform(introProgressValue, (value) =>
    1 - introFade(value),
  );
  const introLift = useTransform(introProgressValue, (value) =>
    introFade(value) * -56,
  );
  const hintOpacity = useTransform(introProgressValue, (value) =>
    1 - introHintFade(value),
  );
  const lineReveal = useTransform(introProgressValue, (value) =>
    introLineReveal(value),
  );
  const signalLeft = useTransform(
    signalX,
    (value) => `${(value / geometry.width) * 100}%`,
  );
  const signalTop = useTransform(
    signalY,
    (value) => `${(value / geometry.height) * 100}%`,
  );

  const updateFromScroll = useCallback(
    () => {
      const geometry = geometryRef.current;
      const section = sectionRef.current;
      const canvas = canvasRef.current;
      const map = mapRef.current;
      if (!section || !canvas || !map) return;
      const viewport = window.innerHeight;
      const canvasHeight = canvas.offsetHeight || 1;
      const units = geometry.height / geometry.vh;
      const readPx = viewport * 0.5 - section.getBoundingClientRect().top;
      const holdPx = viewport * (STAGE_HOLD_SVH / 100);
      const beatPx = viewport * (INTRO_BEAT_SVH / 100);
      const introY = introClearY(units);
      const introYpx = (introY / geometry.height) * canvasHeight;
      const startLen = sampleAtY(map, introY).len;
      const held = journeyWithHolds(
        stopsRef.current,
        readPx,
        holdPx,
        motionEnabled
          ? { y: introYpx, len: startLen, holdPx: beatPx }
          : undefined,
      );
      const visualY = clamp(readPx / canvasHeight, 0, 1) * geometry.height;
      readY.set(visualY);
      if (!motionEnabled) {
        glowPathRef.current?.removeAttribute("stroke-dasharray");
        completePathRef.current?.removeAttribute("stroke-dasharray");
        headProgress.set(6);
        signalOpacity.set(0);
        signalScale.set(1);
        signalRef.current?.classList.remove("is-holding");
        const end = sampleAtY(map, map.y[map.y.length - 1]);
        signalX.set(end.x);
        signalY.set(end.y);
        hazeX.set(`${(end.x / geometry.width) * 100}%`);
        hazeY.set(`${(end.y / geometry.height) * 100}%`);
        return;
      }
      const reveal = introLineReveal(introProgress(visualY, units));
      const arrived = held.head >= 6 - 0.04;
      const from = startLen;
      const to =
        reveal <= 0
          ? startLen
          : Math.min(map.total, Math.max(held.len, startLen));
      applyTravelledRoute(
        [glowPathRef.current, completePathRef.current],
        map,
        from,
        to,
      );
      const tipLength = Math.min(Math.max(to, 0), map.total);
      const route = pathRef.current;
      const tip = route
        ? route.getPointAtLength(tipLength)
        : sampleAtLength(map, tipLength);
      headProgress.set(held.head);
      signalX.set(arrived ? geometry.overview.x : tip.x);
      signalY.set(arrived ? geometry.overview.y : tip.y);
      signalOpacity.set(arrived ? 0.12 : reveal);
      signalScale.set(held.holding ? 1.07 : 1);
      signalRef.current?.classList.toggle("is-holding", held.holding);
      hazeX.set(
        `${((arrived ? geometry.overview.x : tip.x) / geometry.width) * 100}%`,
      );
      hazeY.set(
        `${((arrived ? geometry.overview.y : tip.y) / geometry.height) * 100}%`,
      );
    },
    [hazeX, hazeY, headProgress, motionEnabled, readY, signalOpacity, signalScale, signalX, signalY],
  );

  const measurePath = useCallback(() => {
    const route = pathRef.current;
    const canvas = canvasRef.current;
    if (!route || !canvas) return;
    const map = buildPathMap(route);
    mapRef.current = map;
    stopsRef.current = visualStops(
      canvas.offsetHeight,
      map,
      [geometry.start, ...geometry.nodes, geometry.overview],
      geometry.height,
    );
    updateFromScroll();
  }, [geometry.height, geometry.nodes, geometry.overview, geometry.start, updateFromScroll]);

  useEffect(() => {
    const portraitQuery = window.matchMedia("(min-width: 768px)");
    const tabletQuery = window.matchMedia("(min-width: 1024px)");
    const desktopQuery = window.matchMedia("(min-width: 1200px)");
    const update = () => {
      if (desktopQuery.matches) setLayoutMode("desktop");
      else if (tabletQuery.matches) setLayoutMode("tablet");
      else if (portraitQuery.matches) setLayoutMode("portrait");
      else setLayoutMode("mobile");
    };
    update();
    portraitQuery.addEventListener("change", update);
    tabletQuery.addEventListener("change", update);
    desktopQuery.addEventListener("change", update);
    return () => {
      portraitQuery.removeEventListener("change", update);
      tabletQuery.removeEventListener("change", update);
      desktopQuery.removeEventListener("change", update);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (!cancelled) measurePath();
    };
    const frame = requestAnimationFrame(() => {
      run();
      requestAnimationFrame(run);
    });
    window.addEventListener("resize", measurePath);
    window.addEventListener("orientationchange", measurePath);
    window.visualViewport?.addEventListener("resize", measurePath);
    const observer =
      typeof ResizeObserver !== "undefined" && sectionRef.current
        ? new ResizeObserver(measurePath)
        : null;
    if (sectionRef.current && observer) observer.observe(sectionRef.current);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", measurePath);
      window.removeEventListener("orientationchange", measurePath);
      window.visualViewport?.removeEventListener("resize", measurePath);
      observer?.disconnect();
    };
  }, [geometry.route, measurePath]);

  useGSAP(
    () => {
      const section = sectionRef.current;
      const canvas = canvasRef.current;
      if (!section) return;
      if (canvas) gsap.set(canvas, { clearProps: "transform" });
      const trigger = ScrollTrigger.create({
        id: "process-journey",
        trigger: section,
        start: "top bottom",
        end: "bottom top",
        invalidateOnRefresh: true,
        onUpdate: updateFromScroll,
        onRefresh: updateFromScroll,
      });
      updateFromScroll();
      return () => trigger.kill();
    },
    { dependencies: [updateFromScroll, geometry.route, layoutMode] },
  );

  // Pauses the intro's blurred haze and orbit rings once the intro scene has
  // scrolled away. Toggled straight on the DOM so it costs no React renders.
  useEffect(() => {
    const scene = introSceneRef.current;
    const section = sectionRef.current;
    if (!scene || !section || !motionEnabled) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        section.classList.toggle(
          "process-journey--intro-idle",
          !entry.isIntersecting,
        );
      },
      { rootMargin: "120px 0px", threshold: 0 },
    );
    observer.observe(scene);

    return () => {
      observer.disconnect();
      section.classList.remove("process-journey--intro-idle");
    };
  }, [motionEnabled]);

  useEffect(() => {
    if (reduceMotion) setOverviewBloom(true);
    else setOverviewBloom(headProgress.get() >= 5.78);
  }, [headProgress, reduceMotion]);

  useMotionValueEvent(headProgress, "change", (value) => {
    if (reduceMotion) return;
    const bloom = value >= 5.78;
    setOverviewBloom((was) => (was === bloom ? was : bloom));
  });

  return (
    <section
      ref={sectionRef}
      id="process"
      className={cn(
        "process-journey relative scroll-mt-0 border-b border-border-dark bg-carbon main-offset",
        `process-journey--${layoutMode}`,
        !motionEnabled && "process-journey--reduced",
      )}
      aria-labelledby="process-heading"
      style={{
        ["--process-vh" as string]: `${geometry.vh}svh`,
        ["--process-scroll" as string]: `${geometry.vh}svh`,
        ["--process-intro-lock" as string]: `${INTRO_LOCK_SVH}svh`,
      }}
    >
      <div className="process-journey__vignette" aria-hidden="true" />
      <div className="process-journey__grain" aria-hidden="true" />

      <div ref={canvasRef} className="process-journey__canvas">
        <motion.div
          className="process-journey__haze"
          aria-hidden="true"
          style={
            motionEnabled
              ? { left: hazeX, top: hazeY, opacity: signalOpacity }
              : undefined
          }
        />

        <svg
          className="process-route"
          viewBox={geometry.viewBox}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            ref={pathRef}
            className="process-route__measure"
            d={geometry.route}
            fill="none"
          />
          <path
            ref={glowPathRef}
            className="process-route__glow"
            d={geometry.route}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            ref={completePathRef}
            className="process-route__complete"
            d={geometry.route}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {geometry.recap.map((mark, index) => (
            <BloomStem
              key={mark.d}
              d={mark.d}
              revealed={overviewBloom}
              delay={index * 0.04}
              motionEnabled={motionEnabled}
            />
          ))}
        </svg>

        <motion.div
          ref={signalRef}
          className="process-signal"
          aria-hidden="true"
          style={
            motionEnabled
              ? {
                  left: signalLeft,
                  top: signalTop,
                  opacity: signalOpacity,
                  scale: signalScale,
                }
              : { opacity: 0 }
          }
        >
          <span className="process-signal__halo" />
          <span className="process-signal__core" />
        </motion.div>

        {geometry.nodes.map((node, index) => (
          <Checkpoint
            key={processCopy.steps[index].number}
            point={node}
            stopId={index + 1}
            headProgress={headProgress}
            width={geometry.width}
            height={geometry.height}
            finale={index === 4}
            motionEnabled={motionEnabled}
          />
        ))}
        <Checkpoint
          point={geometry.start}
          stopId={0}
          headProgress={headProgress}
          width={geometry.width}
          height={geometry.height}
          origin
          veil={lineReveal}
          motionEnabled={motionEnabled}
        />
        <Checkpoint
          point={geometry.overview}
          stopId={6}
          headProgress={headProgress}
          width={geometry.width}
          height={geometry.height}
          emphasized
          motionEnabled={motionEnabled}
        />
        {geometry.recap.map((mark, index) => (
          <RecapMark
            key={OVERVIEW_SHORT[index]}
            point={mark}
            label={OVERVIEW_SHORT[index]}
            number={processCopy.steps[index].number}
            width={geometry.width}
            height={geometry.height}
            revealed={overviewBloom}
            delay={index * 0.04}
            showLabel={geometry.recapLayout === "fan"}
            motionEnabled={motionEnabled}
          />
        ))}

        {processCopy.steps.map((step, index) => (
          <div
            key={step.number}
            className="process-stage-slot"
            style={{
              top: `${(geometry.nodes[index].y / geometry.height) * 100}%`,
              ["--node-x" as string]: `${(geometry.nodes[index].x / geometry.width) * 100}%`,
            }}
          >
            <JourneyStage
              step={step}
              nodeY={geometry.nodes[index].y}
              side={geometry.textSides[index]}
              stackedLines={
                index === 0
                  ? ["Understand", "the Music"]
                  : index === 1
                    ? ["Understand", "the Audience"]
                    : undefined
              }
              feature={index === 2 || index === 3 || index === 4}
              readY={readY}
              motionEnabled={motionEnabled}
              lead={index === 0 ? 640 : 560}
            />
            {index === 0 ? (
              <MusicAnalysisHud
                nodeY={geometry.nodes[0].y}
                side={
                  geometry.textSides[0] === "before" ? "after" : "before"
                }
                compact={layoutMode === "mobile"}
                readY={readY}
                motionEnabled={motionEnabled}
                enterLead={640}
              />
            ) : null}
            {index === 1 ? (
              <AudienceConstellation
                nodeY={geometry.nodes[1].y}
                side={
                  geometry.textSides[1] === "after" ? "before" : "after"
                }
                compact={layoutMode === "mobile"}
                readY={readY}
                motionEnabled={motionEnabled}
              />
            ) : null}
            {index === 2 ? (
              <StrategyEngine
                nodeY={geometry.nodes[2].y}
                side={
                  geometry.textSides[2] === "before" ? "after" : "before"
                }
                compact={layoutMode === "mobile"}
                readY={readY}
                motionEnabled={motionEnabled}
              />
            ) : null}
            {index === 3 ? (
              <CampaignCommand
                nodeY={geometry.nodes[3].y}
                side={
                  geometry.textSides[3] === "after" ? "before" : "after"
                }
                compact={layoutMode === "mobile"}
                readY={readY}
                motionEnabled={motionEnabled}
                exitY={
                  layoutMode === "mobile" ? geometry.nodes[4].y : undefined
                }
              />
            ) : null}
            {index === 4 ? (
              <OptimisationEngine
                nodeY={geometry.nodes[4].y}
                side={
                  geometry.textSides[4] === "before" ? "after" : "before"
                }
                compact={layoutMode === "mobile"}
                readY={readY}
                motionEnabled={motionEnabled}
                exitY={
                  layoutMode === "mobile" ? geometry.overview.y : undefined
                }
              />
            ) : null}
          </div>
        ))}

        <OverviewLanding
          geometry={geometry}
          readY={readY}
          motionEnabled={motionEnabled}
        />
      </div>

      <div
        ref={introSceneRef}
        className="process-intro-lock process-intro-lock--scene"
      >
        <div className="process-intro">
          <IntroAtmosphere
            readY={readY}
            unitsPerVh={unitsPerVh}
            motionEnabled={motionEnabled}
          />
        </div>
      </div>

      <div className="process-intro-lock">
        <header className="process-intro">
          <motion.div
            className="process-intro__copy"
            style={
              motionEnabled
                ? {
                    opacity: introOpacity,
                    scale: introScale,
                    y: introLift,
                    originX: 0.5,
                    originY: 0.5,
                  }
                : undefined
            }
          >
            <p className="process-intro__eyebrow label-caps text-acid-lime">
              <span className="process-intro__eyebrow-rule" />
              {processCopy.eyebrow}
            </p>
            <h2
              id="process-heading"
              className="process-intro__headline font-display font-semibold text-off-white"
            >
              {processCopy.headline}
            </h2>
            <p className="process-intro__note">{campaignNote}</p>
          </motion.div>
          <motion.p
            className="process-intro__hint"
            style={motionEnabled ? { opacity: hintOpacity } : undefined}
          >
            <span className="process-intro__hint-inner">
              {processCopy.scrollHint}
              <span className="process-intro__hint-arrow" aria-hidden="true">
                ↓
              </span>
            </span>
          </motion.p>
        </header>
      </div>
    </section>
  );
}
