"use client";

import { useEffect, useState } from "react";
import {
  motion,
  type MotionValue,
  useMotionValueEvent,
  useTransform,
} from "framer-motion";
import { cn } from "@/lib/utils";
import {
  EASE_SOFT,
  stageEnterY,
  stageIsQuiet,
  stageOpacity,
} from "@/components/home/process-motion";
import { ProcessFlip, useCycleIndex } from "@/components/home/ProcessFlip";
import { campaignAudience } from "@/content/process-campaign";
import "./audience-constellation.css";

type HudSide = "before" | "after";

const CX = 200;
const CY = 200;

const FIELD_DOTS = Array.from({ length: 28 }, (_, index) => {
  const angle = (index * 2.513) % (Math.PI * 2);
  const radius = 54 + ((index * 47) % 128);
  return {
    x: CX + Math.cos(angle) * radius,
    y: CY + Math.sin(angle) * radius,
    r: 1.05 + (index % 4) * 0.28,
    delay: `${((index * 0.17) % 3.6).toFixed(2)}s`,
  };
}).filter((dot) => {
  const dx = dot.x - CX;
  const dy = dot.y - CY;
  return dx * dx + dy * dy > 46 * 46;
});

const KEY_NODES = [
  { id: "age", x: 128, y: 74, delay: "0s" },
  { id: "location", x: 78, y: 178, delay: "0.45s" },
  { id: "behaviour", x: 118, y: 304, delay: "0.9s" },
  { id: "platform", x: 304, y: 86, delay: "0.25s" },
  { id: "interest", x: 318, y: 286, delay: "0.7s" },
  { id: "aux-a", x: 168, y: 132, delay: "1.1s" },
  { id: "aux-b", x: 246, y: 148, delay: "0.35s" },
  { id: "aux-c", x: 252, y: 254, delay: "0.85s" },
] as const;

const LINKS: Array<[number, number]> = [
  [5, 0],
  [5, 1],
  [6, 3],
  [6, 0],
  [7, 4],
  [7, 2],
  [5, 6],
  [6, 7],
];

const CYCLES = campaignAudience;

type FocusId = "age" | "location" | "behaviour" | "platform" | "interest";

export function AudienceConstellation({
  nodeY,
  side,
  compact,
  readY,
  motionEnabled,
}: {
  nodeY: number;
  side: HudSide;
  compact: boolean;
  readY: MotionValue<number>;
  motionEnabled: boolean;
}) {
  const opacity = useTransform(readY, (value) => stageOpacity(value, nodeY));
  const y = useTransform(readY, (value) => stageEnterY(value, nodeY));
  const [quiet, setQuiet] = useState(true);

  useMotionValueEvent(readY, "change", (value) => {
    const next = stageIsQuiet(value, nodeY);
    setQuiet((current) => (current === next ? current : next));
  });

  useEffect(() => {
    setQuiet(stageIsQuiet(readY.get(), nodeY));
  }, [nodeY, readY]);

  const cycling = motionEnabled && !quiet;
  const ageIndex = useCycleIndex(CYCLES.age.length, 2000, 0, cycling);
  const locationIndex = useCycleIndex(CYCLES.location.length, 1700, 240, cycling);
  const behaviourIndex = useCycleIndex(CYCLES.behaviour.length, 2200, 880, cycling);
  const platformIndex = useCycleIndex(CYCLES.platform.length, 1900, 420, cycling);
  const interestIndex = useCycleIndex(CYCLES.interest.length, 2300, 1100, cycling);
  const [focus, setFocus] = useState<FocusId>("location");
  const focusNode = KEY_NODES.find((node) => node.id === focus) ?? KEY_NODES[1];

  useEffect(() => {
    setFocus("age");
  }, [ageIndex]);
  useEffect(() => {
    setFocus("location");
  }, [locationIndex]);
  useEffect(() => {
    setFocus("behaviour");
  }, [behaviourIndex]);
  useEffect(() => {
    setFocus("platform");
  }, [platformIndex]);
  useEffect(() => {
    setFocus("interest");
  }, [interestIndex]);

  return (
    <div
      className={cn(
        "process-audience",
        compact ? "process-audience--compact" : `process-audience--${side}`,
        quiet && "process-audience--quiet",
      )}
      aria-hidden="true"
    >
      <motion.div
        className="process-audience__motion"
        style={motionEnabled ? { opacity, y } : { opacity: 1 }}
      >
        <span className="process-audience__watermark">02</span>
        <div className="process-audience__glow" />

        <div className="process-audience__stage">
          <svg
            className="process-audience__svg"
            viewBox="0 0 400 400"
            fill="none"
          >
            <circle className="process-audience__ring" cx={CX} cy={CY} r="168" />
            <circle
              className="process-audience__ring process-audience__ring--dashed"
              cx={CX}
              cy={CY}
              r="132"
            />
            <circle
              className="process-audience__ring process-audience__ring--soft"
              cx={CX}
              cy={CY}
              r="96"
            />
            <circle
              className="process-audience__scan"
              cx={CX}
              cy={CY}
              r="58"
            />
            <circle
              className="process-audience__scan process-audience__scan--late"
              cx={CX}
              cy={CY}
              r="58"
            />

            {[-36, 18, 72, 128].map((angle) => (
              <g
                key={angle}
                className="process-audience__cross"
                transform={`rotate(${angle} ${CX} ${CY})`}
              >
                <line x1="332" y1={CY} x2="344" y2={CY} />
                <line x1="338" y1="194" x2="338" y2="206" />
              </g>
            ))}

            {LINKS.map(([from, to]) => {
              const hot =
                KEY_NODES[from].id === focus || KEY_NODES[to].id === focus;
              return (
                <line
                  key={`${KEY_NODES[from].id}-${KEY_NODES[to].id}`}
                  className={cn(
                    "process-audience__link",
                    hot && "is-hot",
                  )}
                  x1={KEY_NODES[from].x}
                  y1={KEY_NODES[from].y}
                  x2={KEY_NODES[to].x}
                  y2={KEY_NODES[to].y}
                />
              );
            })}
            {KEY_NODES.slice(0, 5).map((node) => (
              <line
                key={`core-${node.id}`}
                className={cn(
                  "process-audience__link process-audience__link--core",
                  node.id === focus && "is-hot",
                )}
                x1={CX}
                y1={CY}
                x2={node.x}
                y2={node.y}
              />
            ))}

            {FIELD_DOTS.map((dot) => (
              <circle
                key={`${dot.x}-${dot.y}`}
                className="process-audience__field"
                cx={dot.x}
                cy={dot.y}
                r={dot.r}
                style={{ ["--audience-delay" as string]: dot.delay }}
              />
            ))}

            {KEY_NODES.map((node) => (
              <g
                key={node.id}
                className={cn(node.id === focus && "is-hot")}
              >
                <circle
                  className="process-audience__node-halo"
                  cx={node.x}
                  cy={node.y}
                  r="7.5"
                  style={{ ["--audience-delay" as string]: node.delay }}
                />
                <circle
                  className="process-audience__node"
                  cx={node.x}
                  cy={node.y}
                  r="2.6"
                  style={{ ["--audience-delay" as string]: node.delay }}
                />
              </g>
            ))}

            {cycling ? (
              <motion.circle
                key={focus}
                className="process-audience__packet"
                r="2.05"
                initial={{ cx: focusNode.x, cy: focusNode.y, opacity: 0 }}
                animate={{ cx: CX, cy: CY, opacity: [0, 1, 1, 0] }}
                transition={{
                  duration: 0.9,
                  ease: EASE_SOFT,
                  times: [0, 0.12, 0.78, 1],
                }}
              />
            ) : null}

            <circle className="process-audience__core-ring" cx={CX} cy={CY} r="34" />
            <circle className="process-audience__core" cx={CX} cy={CY} r="27" />
          </svg>

          <div className="process-audience__core-label">
            <span>Core Audience</span>
          </div>

          <div className="process-audience__callout process-audience__callout--age">
            <span>Age</span>
            <ProcessFlip
              value={CYCLES.age[ageIndex]}
              enabled={cycling}
              className="process-audience__value"
            />
          </div>
          <div className="process-audience__callout process-audience__callout--location">
            <span>Location</span>
            <ProcessFlip
              value={CYCLES.location[locationIndex]}
              enabled={cycling}
              className="process-audience__value"
            />
          </div>
          <div className="process-audience__callout process-audience__callout--behaviour">
            <span>Behaviour</span>
            <ProcessFlip
              value={CYCLES.behaviour[behaviourIndex]}
              enabled={cycling}
              className="process-audience__value"
            />
          </div>
          <div className="process-audience__callout process-audience__callout--platform">
            <span>Platform</span>
            <ProcessFlip
              value={CYCLES.platform[platformIndex]}
              enabled={cycling}
              className="process-audience__value"
            />
          </div>
          <div className="process-audience__callout process-audience__callout--interest">
            <span>Interest</span>
            <ProcessFlip
              value={CYCLES.interest[interestIndex]}
              enabled={cycling}
              className="process-audience__value"
            />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
