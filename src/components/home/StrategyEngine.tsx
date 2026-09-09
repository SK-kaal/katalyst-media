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
  stageIsLive,
  stageIsQuiet,
  stageOpacity,
} from "@/components/home/process-motion";
import { ProcessFlip } from "@/components/home/ProcessFlip";
import { campaignPlan } from "@/content/process-campaign";
import "./strategy-engine.css";

type HudSide = "before" | "after";
type ModuleId = "creators" | "content" | "paid";

const CX = 280;
const CY = 188;
const EASE_OUT = [0.215, 0.61, 0.355, 1] as const;
const EASE_SOFT = [0.22, 1, 0.36, 1] as const;

const MODULES = [
  {
    id: "creators" as const,
    title: "Creators",
    items: campaignPlan.creatorItems,
    from: { x: 156, y: 118 },
    magnet: { x: -16, y: -8 },
    path: `M 156 118 C 204 148 244 170 264 182`,
  },
  {
    id: "content" as const,
    title: "Content",
    items: campaignPlan.contentItems[0],
    from: { x: 404, y: 118 },
    magnet: { x: 16, y: -8 },
    path: `M 404 118 C 356 148 316 170 296 182`,
  },
  {
    id: "paid" as const,
    title: "Paid Media",
    items: campaignPlan.paidItems,
    from: { x: 280, y: 276 },
    magnet: { x: 0, y: 14 },
    path: `M 280 276 C 280 252 280 228 280 212`,
  },
] as const;

// The plan itself is fixed once agreed — these read from the shared campaign
// config so stage 04 launches exactly what stage 03 specified.
const METRICS = [
  {
    id: "budget",
    label: "Budget",
    values: [campaignPlan.budgetLabel],
    start: 0,
    cluster: "left",
  },
  {
    id: "duration",
    label: "Duration",
    values: [campaignPlan.durationLabel],
    start: 0,
    cluster: "left",
  },
  {
    id: "assets",
    label: "Content",
    values: [campaignPlan.assetsLabel],
    start: 0,
    cluster: "left",
  },
  {
    id: "creators",
    label: "Creators",
    values: [`${campaignPlan.creators}`],
    start: 0,
    cluster: "right",
  },
  {
    id: "platforms",
    label: "Platforms",
    values: [`${campaignPlan.platforms}`],
    start: 0,
    cluster: "right",
  },
] as const;

const CARD_SETS: Record<ModuleId, readonly (readonly string[])[]> = {
  creators: [campaignPlan.creatorItems],
  content: campaignPlan.contentItems,
  paid: [campaignPlan.paidItems],
};

const PARTICLES = [
  { x: 16, y: 24, s: 0.55, d: "0s" },
  { x: 84, y: 18, s: 0.42, d: "1.6s" },
  { x: 22, y: 72, s: 0.36, d: "2.8s" },
  { x: 78, y: 68, s: 0.44, d: "0.9s" },
  { x: 50, y: 10, s: 0.32, d: "3.4s" },
] as const;

const DECISIONS: ReadonlyArray<{ module: ModuleId; item: number }> = [
  { module: "creators", item: 1 },
  { module: "content", item: 2 },
  { module: "paid", item: 1 },
  { module: "content", item: 0 },
  { module: "paid", item: 0 },
  { module: "creators", item: 0 },
];

type MetricId = (typeof METRICS)[number]["id"];
type Packet = { id: number; from: ModuleId };

const INITIAL_METRICS: Record<MetricId, number> = {
  budget: 0,
  duration: 0,
  assets: 0,
  creators: 0,
  platforms: 0,
};

function clamp(value: number, min = 0, max = 1) {
  return Math.min(Math.max(value, min), max);
}

function smoothstep(value: number) {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
}

function MetricValue({
  value,
  enabled,
}: {
  value: string;
  enabled: boolean;
}) {
  return (
    <span className="process-strategy__metric-value">
      <AnimatePresence mode="wait" initial={false}>
        <motion.strong
          key={value}
          initial={enabled ? { opacity: 0, y: 6 } : false}
          animate={{ opacity: 1, y: 0 }}
          exit={enabled ? { opacity: 0, y: -6 } : undefined}
          transition={{ duration: 0.36, ease: EASE_SOFT }}
        >
          {value}
        </motion.strong>
      </AnimatePresence>
    </span>
  );
}

function CreatorsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="process-strategy__icon" fill="none">
      <circle cx="9" cy="8" r="2.15" />
      <path d="M5.1 16.4c.45-2.15 2.05-3.3 3.9-3.3s3.45 1.15 3.9 3.3" />
      <circle cx="16.2" cy="8.3" r="1.75" />
      <path d="M14.4 16.4c.35-1.55 1.5-2.5 3-2.5 1.55 0 2.7 1 3.05 2.5" />
    </svg>
  );
}

function ContentIcon() {
  return (
    <svg viewBox="0 0 24 24" className="process-strategy__icon" fill="none">
      <circle cx="12" cy="12" r="7.2" />
      <path className="process-strategy__icon-play" d="M10.2 9.1 16 12l-5.8 2.9V9.1Z" />
    </svg>
  );
}

function PaidIcon() {
  return (
    <svg viewBox="0 0 24 24" className="process-strategy__icon" fill="none">
      <path d="M5.2 10.2 14 7.4v9.2l-8.8-2.8v-3.6Z" />
      <path d="M14 9.2c1.7.55 2.9 1.55 2.9 2.8s-1.2 2.25-2.9 2.8" />
      <path d="M6.4 14.8v2.1c0 .7.7 1.2 1.45.95l1.7-.55" />
    </svg>
  );
}

const ICONS = {
  creators: CreatorsIcon,
  content: ContentIcon,
  paid: PaidIcon,
} as const;

export function StrategyEngine({
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
  const startedRef = useRef(false);
  const [assembled, setAssembled] = useState(!motionEnabled);
  const [ambient, setAmbient] = useState(!motionEnabled);
  const [live, setLive] = useState(!motionEnabled);
  const liveRef = useRef(live);
  liveRef.current = live;
  const [quiet, setQuiet] = useState(false);
  const [pulse, setPulse] = useState(0);
  const [coreHot, setCoreHot] = useState(false);
  const [recalc, setRecalc] = useState(false);
  const [hot, setHot] = useState<{ module: ModuleId; item: number } | null>(
    null,
  );
  const [packets, setPackets] = useState<Packet[]>([]);
  const [cardSet, setCardSet] = useState(0);
  const [metricIndex, setMetricIndex] =
    useState<Record<MetricId, number>>(INITIAL_METRICS);

  const opacity = useTransform(readY, (value) => stageOpacity(value, nodeY));
  const y = useTransform(readY, (value) => stageEnterY(value, nodeY));
  const parallax = useTransform(readY, (value) =>
    clamp((value - nodeY) / 640, -1, 1),
  );
  const depth = compact ? 0.4 : 1;
  const bgY = useTransform(parallax, (value) => value * 12 * depth);
  const midY = useTransform(parallax, (value) => value * 5 * depth);
  const fgY = useTransform(parallax, (value) => value * -5 * depth);

  const applyVisibility = useCallback(
    (value: number) => {
      const visible = stageOpacity(value, nodeY);
      if (!startedRef.current && visible > 0.42) {
        startedRef.current = true;
        if (motionEnabled) setAssembled(true);
      }
      const nextLive = stageIsLive(value, nodeY);
      const nextQuiet = stageIsQuiet(value, nodeY);
      setLive((current) => (current === nextLive ? current : nextLive));
      setQuiet((current) => (current === nextQuiet ? current : nextQuiet));
    },
    [motionEnabled, nodeY],
  );

  useMotionValueEvent(readY, "change", applyVisibility);

  useEffect(() => {
    applyVisibility(readY.get());
  }, [applyVisibility, readY]);

  useEffect(() => {
    if (pulse === 0) return;
    setCoreHot(true);
    const id = window.setTimeout(() => setCoreHot(false), 420);
    return () => window.clearTimeout(id);
  }, [pulse]);

  useEffect(() => {
    if (!assembled || !motionEnabled) return;
    const id = window.setTimeout(() => setAmbient(true), 2150);
    return () => window.clearTimeout(id);
  }, [assembled, motionEnabled]);

  useEffect(() => {
    if (!ambient || !motionEnabled) return;

    let cancelled = false;
    let packetTimer = 0;
    let decisionTimer = 0;
    let cardTimer = 0;
    let settleTimer = 0;
    let packetPtr = 0;
    let decisionPtr = 0;
    const order: ModuleId[] = ["creators", "content", "paid"];
    const metricIds = METRICS.map((metric) => metric.id);

    const sendPacket = (from: ModuleId) => {
      if (cancelled || !liveRef.current) return;
      setPackets((current) => {
        const next = current.length > 2 ? current.slice(-2) : current;
        return [...next, { id: Date.now() + Math.random(), from }];
      });
    };

    const schedulePacket = () => {
      packetTimer = window.setTimeout(() => {
        sendPacket(order[packetPtr % order.length]);
        packetPtr += 1;
        schedulePacket();
      }, 1680 + Math.random() * 1180);
    };

    const scheduleDecision = () => {
      decisionTimer = window.setTimeout(() => {
        if (cancelled) return;
        if (liveRef.current) {
          const decision = DECISIONS[decisionPtr % DECISIONS.length];
          const metricId = metricIds[decisionPtr % metricIds.length];
          decisionPtr += 1;
          setHot(decision);
          setRecalc(true);
          sendPacket(decision.module);
          setMetricIndex((current) => {
            const metric = METRICS.find((item) => item.id === metricId);
            if (!metric) return current;
            return {
              ...current,
              [metricId]: (current[metricId] + 1) % metric.values.length,
            };
          });
          settleTimer = window.setTimeout(() => {
            if (cancelled) return;
            setHot(null);
            setRecalc(false);
          }, 880);
        }
        scheduleDecision();
      }, 2200 + Math.random() * 800);
    };

    const scheduleCards = () => {
      cardTimer = window.setTimeout(() => {
        if (cancelled) return;
        if (liveRef.current) {
          setCardSet((current) => current + 1);
          setHot(DECISIONS[decisionPtr % DECISIONS.length]);
          settleTimer = window.setTimeout(() => {
            if (cancelled) return;
            setHot(null);
          }, 900);
        }
        scheduleCards();
      }, 2800 + Math.random() * 700);
    };

    packetTimer = window.setTimeout(() => {
      sendPacket("creators");
      packetPtr = 1;
      schedulePacket();
    }, 420);
    scheduleDecision();
    scheduleCards();

    return () => {
      cancelled = true;
      window.clearTimeout(packetTimer);
      window.clearTimeout(decisionTimer);
      window.clearTimeout(cardTimer);
      window.clearTimeout(settleTimer);
    };
  }, [ambient, motionEnabled]);

  const shown = assembled || !motionEnabled;
  const lineState = shown ? "shown" : "hidden";
  const enterDelay = (seconds: number) => (motionEnabled ? seconds : 0);

  return (
    <div
      className={cn(
        "process-strategy",
        compact ? "process-strategy--compact" : `process-strategy--${side}`,
        quiet && "process-strategy--quiet",
        recalc && "process-strategy--recalc",
      )}
      aria-hidden="true"
    >
      <motion.div
        className="process-strategy__motion"
        style={motionEnabled ? { opacity, y } : { opacity: 1 }}
      >
        <motion.span
          className="process-strategy__watermark"
          style={motionEnabled ? { y: bgY } : undefined}
        >
          03
        </motion.span>

        <motion.div
          className="process-strategy__particles"
          style={motionEnabled ? { y: bgY } : undefined}
        >
          {PARTICLES.map((particle) => (
            <span
              key={`${particle.x}-${particle.y}`}
              className="process-strategy__particle"
              style={{
                left: `${particle.x}%`,
                top: `${particle.y}%`,
                width: `${particle.s * 0.22}rem`,
                height: `${particle.s * 0.22}rem`,
                animationDelay: particle.d,
              }}
            />
          ))}
        </motion.div>

        <div className="process-strategy__stage">
          <motion.div
            className="process-strategy__glow-slot"
            initial={false}
            animate={
              shown
                ? { opacity: 1, scale: coreHot ? 1.05 : 1 }
                : { opacity: 0, scale: 0.92 }
            }
            transition={{ duration: coreHot ? 0.36 : 0.55, ease: EASE_OUT }}
          >
            <div className="process-strategy__glow" />
          </motion.div>

          <motion.svg
            className="process-strategy__svg"
            viewBox="0 0 560 500"
            fill="none"
            style={motionEnabled ? { y: bgY } : undefined}
          >
            <motion.g
              initial={false}
              animate={shown ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.94 }}
              transition={{ duration: 0.5, ease: EASE_OUT }}
              style={{ transformOrigin: `${CX}px ${CY}px` }}
            >
              <circle className="process-strategy__ring" cx={CX} cy={CY} r="228" />
              <circle
                className="process-strategy__ring process-strategy__ring--ticks"
                cx={CX}
                cy={CY}
                r="186"
              />
              <circle
                className="process-strategy__ring process-strategy__ring--cw"
                cx={CX}
                cy={CY}
                r="148"
              />
              <circle
                className="process-strategy__ring process-strategy__ring--ccw"
                cx={CX}
                cy={CY}
                r="108"
              />
              <circle
                className="process-strategy__ring process-strategy__ring--soft"
                cx={CX}
                cy={CY}
                r="72"
              />
              <circle
                className="process-strategy__ring process-strategy__ring--drift"
                cx={CX}
                cy={CY}
                r="164"
              />
              <g className="process-strategy__orbit">
                <circle cx={CX + 108} cy={CY} r="1.6" />
                <circle cx={CX} cy={CY - 108} r="1.35" />
                <circle cx={CX - 76} cy={CY + 76} r="1.2" />
              </g>
              <g className="process-strategy__orbit process-strategy__orbit--slow">
                <circle cx={CX + 148} cy={CY + 18} r="1.1" />
                <circle cx={CX - 132} cy={CY - 54} r="1.2" />
              </g>
              <line
                className="process-strategy__scanner"
                x1={CX}
                y1={CY}
                x2={CX + 186}
                y2={CY}
              />
              {[28, 96, 158, 214].map((angle) => (
                <g
                  key={angle}
                  className="process-strategy__cross"
                  transform={`rotate(${angle} ${CX} ${CY})`}
                >
                  <line x1="452" y1={CY} x2="464" y2={CY} />
                  <line x1="458" y1="182" x2="458" y2="194" />
                </g>
              ))}
            </motion.g>

            {MODULES.map((module, index) => (
              <g key={module.id}>
                <motion.path
                  className={cn(
                    "process-strategy__link",
                    hot?.module === module.id && "process-strategy__link--hot",
                  )}
                  d={module.path}
                  initial={false}
                  animate={lineState}
                  variants={{
                    hidden: { pathLength: 0, opacity: 0 },
                    shown: {
                      pathLength: 1,
                      opacity: 1,
                      transition: {
                        duration: 0.55,
                        delay: enterDelay(1.08 + index * 0.08),
                        ease: EASE_OUT,
                      },
                    },
                  }}
                />
                <motion.path
                  className="process-strategy__energy"
                  d={module.path}
                  initial={false}
                  animate={lineState}
                  variants={{
                    hidden: { pathLength: 0, opacity: 0 },
                    shown: {
                      pathLength: 1,
                      opacity: 1,
                      transition: {
                        duration: 0.55,
                        delay: enterDelay(1.16 + index * 0.08),
                        ease: EASE_OUT,
                      },
                    },
                  }}
                />
              </g>
            ))}

            {packets.map((packet) => {
              const module = MODULES.find((item) => item.id === packet.from);
              if (!module) return null;
              return (
                <motion.circle
                  key={packet.id}
                  className="process-strategy__packet"
                  r="2.35"
                  initial={{
                    cx: module.from.x,
                    cy: module.from.y,
                    opacity: 0,
                  }}
                  animate={{
                    cx: CX,
                    cy: CY,
                    opacity: [0, 1, 1, 0],
                  }}
                  transition={{
                    duration: 1.12,
                    ease: EASE_SOFT,
                    times: [0, 0.12, 0.82, 1],
                  }}
                  onAnimationComplete={() => {
                    setPulse((current) => current + 1);
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
                shown
                  ? { opacity: 1, scale: 1 }
                  : { opacity: 0, scale: 0.86 }
              }
              transition={{ duration: 0.52, delay: enterDelay(0.26), ease: EASE_OUT }}
              style={{ transformOrigin: `${CX}px ${CY}px` }}
            >
              {pulse > 0 ? (
                <circle
                  key={pulse}
                  className="process-strategy__core-halo"
                  cx={CX}
                  cy={CY}
                  r="48"
                />
              ) : null}
              <circle className="process-strategy__core-ring" cx={CX} cy={CY} r="42" />
              <circle className="process-strategy__core" cx={CX} cy={CY} r="34" />
            </motion.g>
          </motion.svg>

          <motion.div
            className="process-strategy__fg"
            style={motionEnabled ? { y: fgY } : undefined}
          >
            <motion.div
              className="process-strategy__core-label"
              initial={false}
              animate={shown ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: 0.45, delay: enterDelay(0.32), ease: EASE_OUT }}
            >
              <span>Campaign</span>
              <span>Strategy</span>
            </motion.div>

            {MODULES.map((module, index) => {
              const Icon = ICONS[module.id];
              const items =
                CARD_SETS[module.id][cardSet % CARD_SETS[module.id].length];
              return (
                <div
                  key={module.id}
                  className={cn(
                    "process-strategy__card-slot",
                    `process-strategy__card-slot--${module.id}`,
                  )}
                >
                  <motion.article
                    className={cn(
                      "process-strategy__card",
                      `process-strategy__card--${module.id}`,
                      hot?.module === module.id && "process-strategy__card--hot",
                    )}
                    initial={false}
                    animate={
                      shown
                        ? { opacity: 1, x: 0, y: 0 }
                        : {
                            opacity: 0,
                            x: module.magnet.x,
                            y: module.magnet.y,
                          }
                    }
                    transition={{
                      duration: 0.72,
                      delay: enterDelay(0.5 + index * 0.26),
                      ease: EASE_OUT,
                    }}
                  >
                    <div
                      className={cn(
                        "process-strategy__card-float",
                        `process-strategy__card-float--${module.id}`,
                      )}
                    >
                      <div className="process-strategy__card-head">
                        <Icon />
                        <h4>{module.title}</h4>
                      </div>
                      <ul>
                        {items.map((item, itemIndex) => (
                          <li
                            key={`${module.id}-${itemIndex}`}
                            className={
                              hot?.module === module.id &&
                              hot.item === itemIndex
                                ? "is-lit"
                                : undefined
                            }
                          >
                            <ProcessFlip value={item} enabled={motionEnabled} as="span" />
                          </li>
                        ))}
                      </ul>
                    </div>
                  </motion.article>
                </div>
              );
            })}
          </motion.div>

          <motion.div
            className="process-strategy__metrics"
            style={motionEnabled ? { y: midY } : undefined}
          >
            <motion.div
              className="process-strategy__metrics-inner"
              initial={false}
              animate={shown ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
              transition={{ duration: 0.5, delay: enterDelay(1.52), ease: EASE_OUT }}
            >
            <div className="process-strategy__metrics-col">
              {METRICS.filter((metric) => metric.cluster === "left").map(
                (metric) => (
                  <p
                    key={metric.id}
                    className={`process-strategy__metric process-strategy__metric--${metric.id}`}
                  >
                    <span>{metric.label}</span>
                    <span className="process-strategy__metric-rule">—</span>
                    <MetricValue
                      value={metric.values[metricIndex[metric.id] ?? metric.start]}
                      enabled={motionEnabled}
                    />
                  </p>
                ),
              )}
            </div>
            <div className="process-strategy__metrics-col">
              {METRICS.filter((metric) => metric.cluster === "right").map(
                (metric) => (
                  <p
                    key={metric.id}
                    className={`process-strategy__metric process-strategy__metric--${metric.id}`}
                  >
                    <span>{metric.label}</span>
                    <span className="process-strategy__metric-rule">—</span>
                    <MetricValue
                      value={metric.values[metricIndex[metric.id] ?? metric.start]}
                      enabled={motionEnabled}
                    />
                  </p>
                ),
              )}
            </div>
            </motion.div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
