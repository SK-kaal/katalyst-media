"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  motion,
  type MotionValue,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { processCopy } from "@/content/homepage";
import { cn } from "@/lib/utils";
import { MusicAnalysisHud } from "@/components/home/MusicAnalysisHud";
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

const SAMPLE_COUNT = 240;
const OVERVIEW_SHORT = [
  "Music",
  "Audience",
  "Strategy",
  "Launch",
  "Optimise",
] as const;

const INTRO_PARTICLES = [
  { x: 16, y: 26, s: 0.7 },
  { x: 82, y: 22, s: 0.52 },
  { x: 10, y: 58, s: 0.46 },
  { x: 88, y: 54, s: 0.6 },
  { x: 24, y: 80, s: 0.42 },
  { x: 74, y: 84, s: 0.5 },
  { x: 7, y: 40, s: 0.38 },
  { x: 93, y: 36, s: 0.44 },
  { x: 46, y: 14, s: 0.4 },
] as const;

const DESKTOP_GEOMETRY: JourneyGeometry = {
  width: 1000,
  height: 10200,
  vh: 1020,
  viewBox: "0 0 1000 10200",
  start: { x: 500, y: 1620 },
  nodes: [
    { x: 380, y: 2700 },
    { x: 620, y: 4050 },
    { x: 370, y: 5400 },
    { x: 630, y: 6750 },
    { x: 400, y: 8100 },
  ],
  overview: { x: 500, y: 9080 },
  recap: [
    { x: 200, y: 9380, d: "M 500 9080 C 410 9160 270 9280 200 9380" },
    { x: 350, y: 9280, d: "M 500 9080 C 450 9140 380 9220 350 9280" },
    { x: 500, y: 9240, d: "M 500 9080 C 500 9140 500 9200 500 9240" },
    { x: 650, y: 9280, d: "M 500 9080 C 550 9140 620 9220 650 9280" },
    { x: 800, y: 9380, d: "M 500 9080 C 590 9160 730 9280 800 9380" },
  ],
  recapLayout: "fan",
  textSides: ["before", "after", "before", "after", "before"],
  route:
    "M 500 1620 C 560 1880 460 2220 380 2700 C 430 3060 540 3520 620 4050 C 680 4420 460 4880 370 5400 C 430 5780 550 6280 630 6750 C 680 7120 480 7640 400 8100 C 360 8380 450 8780 500 9080 C 508 9140 504 9180 500 9220",
};

const TABLET_GEOMETRY: JourneyGeometry = {
  width: 1000,
  height: 9700,
  vh: 970,
  viewBox: "0 0 1000 9700",
  start: { x: 500, y: 1580 },
  nodes: [
    { x: 390, y: 2580 },
    { x: 610, y: 3880 },
    { x: 380, y: 5180 },
    { x: 620, y: 6480 },
    { x: 410, y: 7740 },
  ],
  overview: { x: 500, y: 8680 },
  recap: [
    { x: 220, y: 8960, d: "M 500 8680 C 420 8760 280 8880 220 8960" },
    { x: 360, y: 8880, d: "M 500 8680 C 450 8740 390 8820 360 8880" },
    { x: 500, y: 8840, d: "M 500 8680 C 500 8740 500 8800 500 8840" },
    { x: 640, y: 8880, d: "M 500 8680 C 550 8740 610 8820 640 8880" },
    { x: 780, y: 8960, d: "M 500 8680 C 580 8760 720 8880 780 8960" },
  ],
  recapLayout: "fan",
  textSides: ["before", "after", "before", "after", "before"],
  route:
    "M 500 1580 C 548 1820 468 2160 390 2580 C 440 2920 530 3380 610 3880 C 662 4240 468 4680 380 5180 C 436 5540 538 6020 620 6480 C 668 6840 488 7320 410 7740 C 380 8020 450 8400 500 8680 C 508 8740 504 8780 500 8820",
};

const PORTRAIT_GEOMETRY: JourneyGeometry = {
  width: 1000,
  height: 9300,
  vh: 930,
  viewBox: "0 0 1000 9300",
  start: { x: 500, y: 1560 },
  nodes: [
    { x: 320, y: 2480 },
    { x: 680, y: 3720 },
    { x: 330, y: 4960 },
    { x: 670, y: 6200 },
    { x: 360, y: 7400 },
  ],
  overview: { x: 500, y: 8280 },
  recap: [
    { x: 260, y: 8540, d: "M 500 8280 C 430 8360 300 8480 260 8540" },
    { x: 380, y: 8480, d: "M 500 8280 C 450 8340 400 8420 380 8480" },
    { x: 500, y: 8440, d: "M 500 8280 C 500 8340 500 8400 500 8440" },
    { x: 620, y: 8480, d: "M 500 8280 C 550 8340 600 8420 620 8480" },
    { x: 740, y: 8540, d: "M 500 8280 C 570 8360 700 8480 740 8540" },
  ],
  recapLayout: "stack",
  textSides: ["after", "before", "after", "before", "after"],
  route:
    "M 500 1560 C 540 1780 430 2080 320 2480 C 292 2740 430 3180 680 3720 C 712 3980 560 4440 330 4960 C 298 5220 450 5680 670 6200 C 702 6460 540 6920 360 7400 C 340 7700 440 8040 500 8280 C 508 8340 504 8380 500 8420",
};

const MOBILE_GEOMETRY: JourneyGeometry = {
  width: 1000,
  height: 8900,
  vh: 890,
  viewBox: "0 0 1000 8900",
  start: { x: 500, y: 1580 },
  nodes: [
    { x: 300, y: 2500 },
    { x: 700, y: 3700 },
    { x: 310, y: 4900 },
    { x: 690, y: 6100 },
    { x: 340, y: 7200 },
  ],
  overview: { x: 500, y: 7880 },
  recap: [
    { x: 280, y: 8140, d: "M 500 7880 C 430 7960 320 8080 280 8140" },
    { x: 390, y: 8080, d: "M 500 7880 C 450 7940 410 8020 390 8080" },
    { x: 500, y: 8040, d: "M 500 7880 C 500 7940 500 8000 500 8040" },
    { x: 610, y: 8080, d: "M 500 7880 C 550 7940 590 8020 610 8080" },
    { x: 720, y: 8140, d: "M 500 7880 C 570 7960 680 8080 720 8140" },
  ],
  recapLayout: "stack",
  textSides: ["after", "before", "after", "before", "after"],
  route:
    "M 500 1580 C 536 1800 420 2100 300 2500 C 272 2780 430 3240 700 3700 C 728 3960 560 4400 310 4900 C 282 5180 450 5640 690 6100 C 718 6360 540 6840 340 7200 C 330 7480 440 7720 500 7880 C 508 7940 504 7980 500 8020",
};

function geometryFor(layoutMode: LayoutMode) {
  if (layoutMode === "desktop") return DESKTOP_GEOMETRY;
  if (layoutMode === "tablet") return TABLET_GEOMETRY;
  if (layoutMode === "portrait") return PORTRAIT_GEOMETRY;
  return MOBILE_GEOMETRY;
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(Math.max(value, min), max);
}

function smoothstep(value: number) {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
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

function JourneyStage({
  step,
  nodeY,
  side,
  stacked = false,
  readY,
  motionEnabled,
}: {
  step: (typeof processCopy.steps)[number];
  nodeY: number;
  side: TextSide;
  stacked?: boolean;
  readY: MotionValue<number>;
  motionEnabled: boolean;
}) {
  const numberOpacity = useTransform(readY, (value) => {
    const entered = smoothstep((value - (nodeY - 520)) / 280);
    const faded = smoothstep((value - (nodeY + 220)) / 900);
    return entered * (1 - faded * 0.7);
  });
  const titleOpacity = useTransform(readY, (value) => {
    const entered = smoothstep((value - (nodeY - 420)) / 260);
    const faded = smoothstep((value - (nodeY + 240)) / 920);
    return entered * (1 - faded * 0.7);
  });
  const descriptionOpacity = useTransform(readY, (value) => {
    const entered = smoothstep((value - (nodeY - 320)) / 250);
    const faded = smoothstep((value - (nodeY + 260)) / 940);
    return entered * (1 - faded * 0.72);
  });
  const titleY = useTransform(readY, (value) => {
    const entered = smoothstep((value - (nodeY - 420)) / 260);
    return (1 - entered) * 18;
  });
  const descriptionY = useTransform(readY, (value) => {
    const entered = smoothstep((value - (nodeY - 320)) / 250);
    return (1 - entered) * 16;
  });

  return (
    <article
      className={cn(
        "process-stage-copy",
        stacked && "process-stage-copy--feature",
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
        {stacked ? (
          <>
            <span>Understand</span>
            <span>the Music</span>
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
  const pull = useTransform(readY, (value) =>
    smoothstep((value - 0.48 * 100 * unitsPerVh) / (108 * unitsPerVh)),
  );
  const glowOpacity = useTransform(pull, (value) => 0.92 * (1 - value * 0.82));
  const glowScale = useTransform(pull, (value) => 1 + value * 0.18);
  const ringOpacity = useTransform(pull, (value) => 0.12 + value * 0.34);
  const ringScale = useTransform(pull, (value) => 0.86 + value * 0.38);
  const particleOpacity = useTransform(pull, (value) => 0.18 + value * 0.28);

  return (
    <div className="process-intro__atmosphere" aria-hidden="true">
      <div className="process-intro__glow-slot">
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
      </div>
      <div className="process-intro__rings-slot">
        <motion.div
          className="process-intro__rings"
          style={
            motionEnabled
              ? { opacity: ringOpacity, scale: ringScale }
              : { opacity: 0.22 }
          }
        >
          <svg viewBox="0 0 100 100" className="process-intro__rings-svg">
            <circle cx="50" cy="50" r="17" />
            <circle cx="50" cy="50" r="28" />
            <circle cx="50" cy="50" r="40" />
          </svg>
        </motion.div>
      </div>
      <motion.div
        className="process-intro__particles"
        style={motionEnabled ? { opacity: particleOpacity } : { opacity: 0.28 }}
      >
        {INTRO_PARTICLES.map((particle) => (
          <span
            key={`${particle.x}-${particle.y}`}
            className="process-intro__particle"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              width: `${particle.s * 0.28}rem`,
              height: `${particle.s * 0.28}rem`,
            }}
          />
        ))}
      </motion.div>
    </div>
  );
}

function BloomStem({
  d,
  readY,
  hubY,
  delay,
  motionEnabled,
}: {
  d: string;
  readY: MotionValue<number>;
  hubY: number;
  delay: number;
  motionEnabled: boolean;
}) {
  const pathLength = useTransform(readY, (value) =>
    smoothstep((value - (hubY + 40 + delay)) / 240),
  );
  const opacity = useTransform(pathLength, (value) => 0.2 + value * 0.8);

  return (
    <g>
      <motion.path
        className="process-recap-stem process-recap-stem--glow"
        d={d}
        strokeLinecap="round"
        style={motionEnabled ? { pathLength, opacity } : undefined}
      />
      <motion.path
        className="process-recap-stem"
        d={d}
        strokeLinecap="round"
        style={motionEnabled ? { pathLength, opacity } : undefined}
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
    smoothstep((value - (geometry.overview.y + 160)) / 220),
  );
  const copyY = useTransform(readY, (value) => {
    const entered = smoothstep((value - (geometry.overview.y + 160)) / 220);
    return (1 - entered) * 18;
  });

  return (
    <motion.div
      className="process-overview-end"
      style={{
        top: `${((geometry.overview.y + (geometry.recapLayout === "fan" ? 480 : 560)) / geometry.height) * 100}%`,
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
  readY,
  hubY,
  delay,
  showLabel,
  motionEnabled,
}: {
  point: Point;
  label: string;
  number: string;
  width: number;
  height: number;
  readY: MotionValue<number>;
  hubY: number;
  delay: number;
  showLabel: boolean;
  motionEnabled: boolean;
}) {
  const opacity = useTransform(readY, (value) =>
    smoothstep((value - (hubY + 90 + delay)) / 180),
  );

  return (
    <motion.div
      className="process-recap-mark"
      style={{
        left: `${(point.x / width) * 100}%`,
        top: `${(point.y / height) * 100}%`,
        ...(motionEnabled ? { opacity } : { opacity: 1 }),
      }}
    >
      <span className="process-recap-mark__dot" />
      {showLabel ? (
        <span className="process-recap-mark__label">
          <span className="process-recap-mark__number">{number}</span>
          {label}
        </span>
      ) : null}
    </motion.div>
  );
}

function Checkpoint({
  point,
  readY,
  width,
  height,
  emphasized = false,
  origin = false,
  motionEnabled,
}: {
  point: Point;
  readY: MotionValue<number>;
  width: number;
  height: number;
  emphasized?: boolean;
  origin?: boolean;
  motionEnabled: boolean;
}) {
  const state = useTransform(readY, (value) => {
    const delta = value - point.y;
    const lead = origin ? 220 : 90;
    if (delta < -lead) return 0;
    if (delta < 80) return smoothstep((delta + lead) / (lead + 80));
    return 1;
  });
  const ringOpacity = useTransform(state, (value) => 0.22 + value * 0.55);
  const coreOpacity = useTransform(state, (value) => 0.18 + value * 0.82);

  return (
    <div
      className={cn(
        "process-node",
        emphasized && "process-node--result",
        origin && "process-node--origin",
      )}
      style={{
        left: `${(point.x / width) * 100}%`,
        top: `${(point.y / height) * 100}%`,
      }}
    >
      <motion.span
        className="process-node__ring"
        style={motionEnabled ? { opacity: ringOpacity } : undefined}
      />
      <motion.span
        className="process-node__core"
        style={motionEnabled ? { opacity: coreOpacity } : undefined}
      />
    </div>
  );
}

export function ProcessSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const mapRef = useRef<PathMap | null>(null);
  const reduceMotion = useReducedMotion();
  const motionEnabled = reduceMotion === false;
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("mobile");
  const geometry = geometryFor(layoutMode);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  const pathLength = useMotionValue(motionEnabled ? 0 : 1);
  const signalX = useMotionValue(geometry.start.x);
  const signalY = useMotionValue(geometry.start.y);
  const signalOpacity = useMotionValue(0);
  const readY = useMotionValue(0);
  const hazeX = useMotionValue(`${(geometry.start.x / geometry.width) * 100}%`);
  const hazeY = useMotionValue(`${(geometry.start.y / geometry.height) * 100}%`);

  const unitsPerVh = geometry.height / geometry.vh;
  const introPull = useTransform(readY, (value) =>
    smoothstep((value - 0.48 * 100 * unitsPerVh) / (108 * unitsPerVh)),
  );
  const introScale = useTransform(introPull, (value) => 1 - value * 0.3);
  const introY = useTransform(introPull, (value) => value * -78);
  const introOpacity = useTransform(readY, (value) => {
    const pull = smoothstep(
      (value - 0.48 * 100 * unitsPerVh) / (108 * unitsPerVh),
    );
    const leave = smoothstep(
      (value - (geometry.start.y + 80)) / (70 * unitsPerVh),
    );
    return (1 - pull * 0.12) * (1 - leave);
  });
  const signalLeft = useTransform(
    signalX,
    (value) => `${(value / geometry.width) * 100}%`,
  );
  const signalTop = useTransform(
    signalY,
    (value) => `${(value / geometry.height) * 100}%`,
  );

  const updateFromScroll = useCallback(
    (progress: number) => {
      const section = sectionRef.current;
      const map = mapRef.current;
      if (!section || !map) return;
      const sectionHeight = section.offsetHeight;
      const viewport = window.innerHeight;
      const centerFrac =
        sectionHeight <= viewport
          ? progress
          : (progress * (sectionHeight - viewport) + 0.52 * viewport) /
            sectionHeight;
      const targetY = centerFrac * geometry.height;
      readY.set(targetY);
      if (!motionEnabled) {
        pathLength.set(1);
        signalOpacity.set(0);
        const end = sampleAtY(map, map.y[map.y.length - 1]);
        signalX.set(end.x);
        signalY.set(end.y);
        hazeX.set(`${(end.x / geometry.width) * 100}%`);
        hazeY.set(`${(end.y / geometry.height) * 100}%`);
        return;
      }
      const sample = sampleAtY(map, targetY);
      const arrived = sample.y >= geometry.overview.y - 10;
      const approachingOrigin = smoothstep(
        (targetY - (geometry.start.y - 180)) / 170,
      );
      const travelling =
        sample.len > 8 && sample.y > geometry.start.y + 8 && !arrived;
      pathLength.set(map.total === 0 ? 0 : sample.len / map.total);
      signalX.set(arrived ? geometry.overview.x : sample.x);
      signalY.set(arrived ? geometry.overview.y : sample.y);
      signalOpacity.set(arrived ? 0.2 : travelling ? 1 : approachingOrigin * 0.7);
      hazeX.set(
        `${((arrived ? geometry.overview.x : sample.x) / geometry.width) * 100}%`,
      );
      hazeY.set(
        `${((arrived ? geometry.overview.y : sample.y) / geometry.height) * 100}%`,
      );
    },
    [geometry.height, geometry.overview, geometry.start.y, geometry.width, hazeX, hazeY, motionEnabled, pathLength, readY, signalOpacity, signalX, signalY],
  );

  const measurePath = useCallback(() => {
    const route = pathRef.current;
    if (!route) return;
    mapRef.current = buildPathMap(route);
    updateFromScroll(scrollYProgress.get());
  }, [scrollYProgress, updateFromScroll]);

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
    const frame = requestAnimationFrame(measurePath);
    window.addEventListener("resize", measurePath);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", measurePath);
    };
  }, [geometry.route, measurePath]);

  useMotionValueEvent(scrollYProgress, "change", updateFromScroll);

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
      style={{ ["--process-vh" as string]: `${geometry.vh}svh` }}
    >
      <div className="process-journey__vignette" aria-hidden="true" />
      <div className="process-journey__grain" aria-hidden="true" />

      <div className="process-journey__canvas">
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
            className="process-route__base"
            d={geometry.route}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <motion.path
            className="process-route__glow"
            d={geometry.route}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={motionEnabled ? { pathLength } : undefined}
          />
          <motion.path
            className="process-route__complete"
            d={geometry.route}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={motionEnabled ? { pathLength } : undefined}
          />
          {geometry.recap.map((mark, index) => (
            <BloomStem
              key={mark.d}
              d={mark.d}
              readY={readY}
              hubY={geometry.overview.y}
              delay={index * 36}
              motionEnabled={motionEnabled}
            />
          ))}
        </svg>

        <motion.div
          className="process-signal"
          aria-hidden="true"
          style={
            motionEnabled
              ? { left: signalLeft, top: signalTop, opacity: signalOpacity }
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
            readY={readY}
            width={geometry.width}
            height={geometry.height}
            motionEnabled={motionEnabled}
          />
        ))}
        <Checkpoint
          point={geometry.start}
          readY={readY}
          width={geometry.width}
          height={geometry.height}
          origin
          motionEnabled={motionEnabled}
        />
        <Checkpoint
          point={geometry.overview}
          readY={readY}
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
            readY={readY}
            hubY={geometry.overview.y}
            delay={index * 36}
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
              stacked={index === 0}
              readY={readY}
              motionEnabled={motionEnabled}
            />
            {index === 0 ? (
              <MusicAnalysisHud
                nodeY={geometry.nodes[0].y}
                side={
                  geometry.textSides[0] === "before" ? "after" : "before"
                }
                compact={layoutMode === "mobile" || layoutMode === "portrait"}
                readY={readY}
                motionEnabled={motionEnabled}
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

      <div className="process-intro-lock">
        <header className="process-intro">
          <IntroAtmosphere
            readY={readY}
            unitsPerVh={unitsPerVh}
            motionEnabled={motionEnabled}
          />
          <motion.div
            className="process-intro__copy"
            style={
              motionEnabled
                ? { opacity: introOpacity, scale: introScale, y: introY }
                : undefined
            }
          >
            <p className="process-intro__eyebrow label-caps text-acid-lime">
              {processCopy.eyebrow}
            </p>
            <h2
              id="process-heading"
              className="process-intro__headline font-display font-semibold text-off-white"
            >
              {processCopy.headline}
            </h2>
          </motion.div>
        </header>
      </div>
    </section>
  );
}
