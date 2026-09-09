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
  stageEnterY,
  stageIsQuiet,
  stageOpacity,
} from "@/components/home/process-motion";
import { ProcessFlip, useCycleIndex } from "@/components/home/ProcessFlip";
import { campaignTrack } from "@/content/process-campaign";
import "./music-analysis-hud.css";

type HudSide = "before" | "after";

const CX = 200;
const CY = 200;

function hash(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function polar(radius: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: CX + Math.cos(rad) * radius, y: CY + Math.sin(rad) * radius };
}

function arcPath(radius: number, start: number, sweep: number) {
  const a = polar(radius, start);
  const b = polar(radius, start + sweep);
  const large = sweep > 180 ? 1 : 0;
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${radius} ${radius} 0 ${large} 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}

function buildSpectrum(count: number, seed: number, floor: number) {
  return Array.from({ length: count }, (_, index) => {
    const t = index / count;
    const envelope =
      0.2 +
      0.42 * Math.abs(Math.sin(t * Math.PI * 9.4 + seed)) ** 1.35 +
      0.22 * Math.abs(Math.sin(t * Math.PI * 21.6 + seed * 1.8)) ** 2.1 +
      0.14 * Math.abs(Math.sin(t * Math.PI * 41 + seed * 0.37));
    const jitter = hash(index * 1.73 + seed) * 0.38;
    const peak = hash(index * 4.1 + seed * 2) > 0.86 ? 0.22 : 0;
    const micro = hash(index * 2.9 + seed) < 0.38 ? 0.42 : 1;
    const length = Math.min(1, Math.max(floor, (envelope + jitter + peak) * micro));
    return {
      angle: (index / count) * 360,
      length,
      width: 0.45 + hash(index + seed) * 0.55,
      delay: `${((index * 0.041 + seed) % 2.2).toFixed(2)}s`,
      duration: `${(1.55 + (index % 11) * 0.19).toFixed(2)}s`,
    };
  });
}

const MAIN_SPIKES = buildSpectrum(108, 1.2, 0.16);
const MICRO_SPIKES = buildSpectrum(148, 4.7, 0.08);
const TICKS = Array.from({ length: 48 }, (_, index) => {
  const angle = (index / 48) * 360 - 12;
  const major = index % 4 === 0;
  return {
    angle,
    inner: major ? 156 : 160,
    outer: 166,
    major,
  };
}).filter((_, index) => index < 31 || index > 36);

const ENERGY_BLOCKS = 11;

const TEMPO = campaignTrack.tempo;
const ENERGY = campaignTrack.energy;
const MOOD = campaignTrack.mood;
const AUDIENCE = campaignTrack.audience;
const REGION = campaignTrack.region;
const GENRE = campaignTrack.genre;
const GENRE_SUB = campaignTrack.genreSub;

const MOOD_PATHS: Record<string, string> = {
  Atmospheric:
    "M 0 6.4 C 9 8.4 17 3.8 27 6.6 C 36 9 45 4.4 56 6.2",
  Energetic:
    "M 0 6 L 3 2.2 L 6 9.4 L 9 1.6 L 12 8.6 L 15 3.1 L 18 10 L 21 2 L 24 7.2 L 27 1.4 L 30 8.8 L 33 3.4 L 36 8.1 L 39 2.2 L 42 7.6 L 45 3.2 L 48 8.2 L 52 4.1 L 56 6",
};

const MAIN_INNER = 71;
const MAIN_SPAN = 50;
const MICRO_INNER = 69;
const MICRO_SPAN = 36;

export function MusicAnalysisHud({
  nodeY,
  side,
  compact,
  readY,
  motionEnabled,
  enterLead = 540,
}: {
  nodeY: number;
  side: HudSide;
  compact: boolean;
  readY: MotionValue<number>;
  motionEnabled: boolean;
  enterLead?: number;
}) {
  const opacity = useTransform(readY, (value) =>
    stageOpacity(value, nodeY, enterLead),
  );
  const y = useTransform(readY, (value) =>
    stageEnterY(value, nodeY, enterLead),
  );
  const [quiet, setQuiet] = useState(true);

  useMotionValueEvent(readY, "change", (value) => {
    const next = stageIsQuiet(value, nodeY, enterLead);
    setQuiet((current) => (current === next ? current : next));
  });

  useEffect(() => {
    setQuiet(stageIsQuiet(readY.get(), nodeY, enterLead));
  }, [enterLead, nodeY, readY]);

  const cycling = motionEnabled && !quiet;
  const tempoIndex = useCycleIndex(TEMPO.length, 1900, 0, cycling);
  const energyIndex = useCycleIndex(ENERGY.length, 2100, 500, cycling);
  const moodIndex = useCycleIndex(MOOD.length, 2300, 1100, cycling);
  const audienceIndex = useCycleIndex(AUDIENCE.length, 2000, 220, cycling);
  const regionIndex = useCycleIndex(REGION.length, 2500, 1400, cycling);
  const genreIndex = useCycleIndex(GENRE.length, 2400, 780, cycling);
  const genreSubIndex = useCycleIndex(GENRE_SUB.length, 2600, 1700, cycling);

  const tempo = TEMPO[tempoIndex];
  const energy = ENERGY[energyIndex];
  const mood = MOOD[moodIndex];
  const audience = AUDIENCE[audienceIndex];
  const region = REGION[regionIndex];
  const genre = GENRE[genreIndex];
  const genreSub = GENRE_SUB[genreSubIndex];
  const filled = Math.max(2, Math.round((energy / 100) * ENERGY_BLOCKS));
  const tempoBpm = Number.parseInt(tempo, 10) || 128;

  return (
    <div
      className={cn(
        "process-hud",
        compact ? "process-hud--compact" : `process-hud--${side}`,
        quiet && "process-hud--quiet",
      )}
      style={{
        ["--hud-amp" as string]: (0.84 + energy / 420).toFixed(3),
        ["--hud-speed" as string]: (0.82 + (tempoBpm - 118) / 90).toFixed(3),
        ["--hud-shift" as string]: `${moodIndex * 7}deg`,
      }}
      aria-hidden="true"
    >
      <motion.div
        className="process-hud__motion"
        style={motionEnabled ? { opacity, y } : { opacity: 1 }}
      >
        <span className="process-hud__watermark">01</span>
        <div className="process-hud__glow" />

        <div className="process-hud__stage">
          <svg className="process-hud__svg" viewBox="0 0 400 400" fill="none">
            <circle className="process-hud__ring process-hud__ring--ghost" cx={CX} cy={CY} r="178" />
            <circle className="process-hud__ring process-hud__ring--soft" cx={CX} cy={CY} r="148" />
            <path className="process-hud__ring process-hud__ring--broken" d={arcPath(166, 208, 86)} />
            <path className="process-hud__ring process-hud__ring--dotted" d={arcPath(132, -18, 248)} />
            <path className="process-hud__ring process-hud__ring--hair" d={arcPath(118, 42, 168)} />

            <g className="process-hud__ticks">
              {TICKS.map((tick) => {
                const a = polar(tick.inner, tick.angle);
                const b = polar(tick.outer, tick.angle);
                return (
                  <line
                    key={tick.angle}
                    className={tick.major ? "is-major" : undefined}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                  />
                );
              })}
            </g>

            <g className="process-hud__orbit process-hud__orbit--cw">
              <path className="process-hud__arc" d={arcPath(172, -38, 78)} />
              <circle className="process-hud__marker" cx={polar(172, 40).x} cy={polar(172, 40).y} r="1.5" />
            </g>
            <g className="process-hud__orbit process-hud__orbit--ccw">
              <path className="process-hud__arc process-hud__arc--dim" d={arcPath(172, 118, 64)} />
              <path className="process-hud__arc process-hud__arc--mid" d={arcPath(158, 210, 72)} />
              <circle
                className="process-hud__marker process-hud__marker--pulse"
                cx={polar(158, 282).x}
                cy={polar(158, 282).y}
                r="1.35"
              />
            </g>
            <path className="process-hud__arc process-hud__arc--faint" d={arcPath(172, 52, 42)} />
            <path className="process-hud__arc process-hud__arc--faint" d={arcPath(158, 328, 46)} />

            <g className="process-hud__guides">
              <line x1={CX} y1="18" x2={CX} y2="44" />
              <circle cx={CX} cy="44" r="1.2" />
              <line x1="22" y1="176" x2="48" y2="176" />
              <circle cx="48" cy="176" r="1.15" />
              <line x1="352" y1="142" x2="378" y2="142" />
              <circle cx="352" cy="142" r="1.15" />
              <line x1="78" y1="322" x2="104" y2="302" />
              <circle cx="104" cy="302" r="1.1" />
              <line x1="296" y1="302" x2="322" y2="322" />
              <circle cx="296" cy="302" r="1.1" />
            </g>

            <line className="process-hud__scan" x1={CX} y1={CY} x2={CX} y2="28" />

            <g className="process-hud__wave process-hud__wave--micro">
              {MICRO_SPIKES.map((spike) => {
                const y2 = CY - MICRO_INNER - spike.length * MICRO_SPAN;
                return (
                  <g key={`m-${spike.angle}`} transform={`rotate(${spike.angle} ${CX} ${CY})`}>
                    <line
                      className="process-hud__spike process-hud__spike--micro"
                      x1={CX}
                      y1={CY - MICRO_INNER}
                      x2={CX}
                      y2={y2}
                      strokeWidth={spike.width * 0.7}
                      style={{
                        ["--hud-delay" as string]: spike.delay,
                        ["--hud-duration" as string]: spike.duration,
                      }}
                    />
                  </g>
                );
              })}
            </g>

            <g className="process-hud__wave process-hud__wave--main">
              {MAIN_SPIKES.map((spike) => {
                const y2 = CY - MAIN_INNER - spike.length * MAIN_SPAN;
                return (
                  <g key={spike.angle} transform={`rotate(${spike.angle} ${CX} ${CY})`}>
                    <line
                      className="process-hud__spike"
                      x1={CX}
                      y1={CY - MAIN_INNER}
                      x2={CX}
                      y2={y2}
                      strokeWidth={0.7 + spike.width * 0.55}
                      style={{
                        ["--hud-delay" as string]: spike.delay,
                        ["--hud-duration" as string]: spike.duration,
                      }}
                    />
                  </g>
                );
              })}
            </g>

            <circle className="process-hud__core-fill" cx={CX} cy={CY} r="34" />
            <circle className="process-hud__core-dotted" cx={CX} cy={CY} r="21" />
            <circle className="process-hud__core-ring" cx={CX} cy={CY} r="28" />
            <circle className="process-hud__core" cx={CX} cy={CY} r="2.15" />
          </svg>

          <div className="process-hud__callout process-hud__callout--tempo">
            <span className="process-hud__label">Tempo</span>
            <ProcessFlip value={tempo} enabled={cycling} className="process-hud__value" />
          </div>
          <div className="process-hud__callout process-hud__callout--mood">
            <span className="process-hud__label">Mood</span>
            <ProcessFlip value={mood} enabled={cycling} className="process-hud__value" />
            <svg className="process-hud__mini-wave" viewBox="0 0 56 12">
              <path d={MOOD_PATHS[mood]} />
            </svg>
          </div>
          <div className="process-hud__callout process-hud__callout--genre">
            <span className="process-hud__label">Genre</span>
            <ProcessFlip value={genre} enabled={cycling} className="process-hud__value" />
            <ProcessFlip
              value={genreSub}
              enabled={cycling}
              as="em"
              className="process-hud__sub"
            />
          </div>
          <div className="process-hud__callout process-hud__callout--audience">
            <span className="process-hud__label">Audience</span>
            <ProcessFlip value={audience} enabled={cycling} className="process-hud__value" />
            <ProcessFlip
              value={region}
              enabled={cycling}
              as="em"
              className="process-hud__sub"
            />
            <svg className="process-hud__globe" viewBox="0 0 28 28">
              <circle cx="14" cy="14" r="8.2" />
              <ellipse cx="14" cy="14" rx="3.4" ry="8.2" />
              <path d="M 6.2 14 H 21.8" />
              <path d="M 8.1 9.2 H 19.9" />
              <path d="M 8.1 18.8 H 19.9" />
            </svg>
          </div>
          <div className="process-hud__callout process-hud__callout--energy">
            <span className="process-hud__label">Energy</span>
            <div className="process-hud__energy">
              {Array.from({ length: ENERGY_BLOCKS }, (_, index) => (
                <i
                  key={index}
                  className={index < filled ? "is-on" : undefined}
                />
              ))}
            </div>
            <ProcessFlip value={`${energy}%`} enabled={cycling} className="process-hud__value" />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
