"use client";

import { motion, type MotionValue, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";
import "./music-analysis-hud.css";

type HudSide = "before" | "after";

const SPIKE_COUNT = 72;
const CX = 200;
const CY = 200;
const INNER = 74;
const OUTER_SPAN = 54;

const SPIKES = Array.from({ length: SPIKE_COUNT }, (_, index) => {
  const t = index / SPIKE_COUNT;
  const length =
    0.4 +
    0.3 * Math.abs(Math.sin(t * Math.PI * 8.2)) +
    0.18 * Math.abs(Math.sin(t * Math.PI * 17.4 + 0.6)) +
    0.12 * Math.abs(Math.sin(t * Math.PI * 3.1 + 1.1));
  return {
    angle: t * 360,
    length,
    delay: `${((index * 0.073) % 2.4).toFixed(2)}s`,
    duration: `${(2.4 + (index % 7) * 0.18).toFixed(2)}s`,
  };
});

const ENERGY_BLOCKS = [1, 1, 1, 1, 1, 1, 1, 0.45, 0.18, 0.18];

function clamp(value: number, min = 0, max = 1) {
  return Math.min(Math.max(value, min), max);
}

function smoothstep(value: number) {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
}

export function MusicAnalysisHud({
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
  const opacity = useTransform(readY, (value) => {
    const entered = smoothstep((value - (nodeY - 420)) / 280);
    const faded = smoothstep((value - (nodeY + 420)) / 780);
    return entered * (1 - faded);
  });
  const y = useTransform(readY, (value) => {
    const entered = smoothstep((value - (nodeY - 420)) / 280);
    return (1 - entered) * 22;
  });

  return (
    <div
      className={cn(
        "process-hud",
        compact ? "process-hud--compact" : `process-hud--${side}`,
      )}
      aria-hidden="true"
    >
      <motion.div
        className="process-hud__motion"
        style={motionEnabled ? { opacity, y } : { opacity: 1 }}
      >
      <span className="process-hud__watermark">01</span>
      <div className="process-hud__glow" />

      <div className="process-hud__stage">
        <svg
          className="process-hud__svg"
          viewBox="0 0 400 400"
          fill="none"
        >
          <circle className="process-hud__ring process-hud__ring--faint" cx={CX} cy={CY} r="168" />
          <circle className="process-hud__ring process-hud__ring--soft" cx={CX} cy={CY} r="142" />
          <circle className="process-hud__ring process-hud__ring--dotted" cx={CX} cy={CY} r="118" />
          <circle className="process-hud__ring process-hud__ring--core" cx={CX} cy={CY} r="62" />

          <g className="process-hud__orbit process-hud__orbit--slow">
            <path
              className="process-hud__arc"
              d="M 48 168 A 162 162 0 0 1 168 48"
            />
            <path
              className="process-hud__arc process-hud__arc--thin"
              d="M 332 52 A 162 162 0 0 1 368 176"
            />
            <circle className="process-hud__marker" cx="48" cy="168" r="2.1" />
            <circle className="process-hud__marker" cx="332" cy="52" r="1.7" />
          </g>

          <g className="process-hud__orbit process-hud__orbit--reverse">
            <path
              className="process-hud__arc process-hud__arc--mid"
              d="M 318 330 A 148 148 0 0 1 178 362"
            />
            <path
              className="process-hud__arc process-hud__arc--thin"
              d="M 62 248 A 148 148 0 0 1 94 94"
            />
            <circle className="process-hud__marker process-hud__marker--pulse" cx="318" cy="330" r="1.8" />
            <circle className="process-hud__marker process-hud__marker--pulse" cx="94" cy="94" r="1.5" />
          </g>

          <g className="process-hud__ticks">
            {Array.from({ length: 24 }, (_, index) => {
              const angle = (index / 24) * Math.PI * 2 - Math.PI / 2;
              const inner = index % 2 === 0 ? 154 : 158;
              return (
                <line
                  key={index}
                  x1={CX + Math.cos(angle) * inner}
                  y1={CY + Math.sin(angle) * inner}
                  x2={CX + Math.cos(angle) * 164}
                  y2={CY + Math.sin(angle) * 164}
                />
              );
            })}
          </g>

          <g className="process-hud__wave">
            {SPIKES.map((spike) => {
              const y2 = CY - INNER - spike.length * OUTER_SPAN;
              return (
                <g
                  key={spike.angle}
                  transform={`rotate(${spike.angle} ${CX} ${CY})`}
                >
                  <line
                    className="process-hud__spike"
                    x1={CX}
                    y1={CY - INNER}
                    x2={CX}
                    y2={y2}
                    style={{
                      ["--hud-delay" as string]: spike.delay,
                      ["--hud-duration" as string]: spike.duration,
                    }}
                  />
                </g>
              );
            })}
          </g>

          <circle className="process-hud__core-ring" cx={CX} cy={CY} r="28" />
          <circle className="process-hud__core" cx={CX} cy={CY} r="11" />
        </svg>

        <div className="process-hud__callout process-hud__callout--tempo">
          <span>Tempo</span>
          <strong>128 BPM</strong>
        </div>
        <div className="process-hud__callout process-hud__callout--mood">
          <span>Mood</span>
          <strong>Focused</strong>
          <svg className="process-hud__mini-wave" viewBox="0 0 54 12">
            <path d="M 0 6 C 4 2 8 10 12 6 C 16 2 20 10 24 6 C 28 1 32 11 36 6 C 40 2 44 10 48 6 C 50 4 52 8 54 6" />
          </svg>
        </div>
        <div className="process-hud__callout process-hud__callout--genre">
          <span>Genre</span>
          <strong>Melodic Techno</strong>
          <em>Progressive</em>
        </div>
        <div className="process-hud__callout process-hud__callout--audience">
          <span>Audience</span>
          <strong>18–34</strong>
          <em>Global</em>
        </div>
        <div className="process-hud__callout process-hud__callout--energy">
          <span>Energy</span>
          <div className="process-hud__energy">
            {ENERGY_BLOCKS.map((block, index) => (
              <i
                key={index}
                style={{ opacity: 0.18 + block * 0.82 }}
              />
            ))}
          </div>
          <strong>78%</strong>
        </div>
        </div>
      </motion.div>
    </div>
  );
}
