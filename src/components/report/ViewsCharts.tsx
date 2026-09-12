"use client";

import { useId, useMemo, useRef, useState } from "react";
import { AnimatedValue } from "@/components/report/ReportMotion";
import {
  formatCompactNumber,
  formatFullNumber,
  formatSignedCompactNumber,
  formatSignedFullNumber,
  type ReportChartPoint,
} from "@/lib/portal/metrics";
import { gsap, useGSAP } from "@/lib/motion";
import "@/components/report/report.css";

type Mode = "cumulative" | "daily";

const AXIS_DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "Europe/London",
});

const TOOLTIP_DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/London",
});

function formatChartDate(iso: string, includeYear = false): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return (includeYear ? TOOLTIP_DATE_FORMATTER : AXIS_DATE_FORMATTER).format(d);
}

function ChartCard({
  title,
  totalLabel,
  totalValue,
  series,
  emptyHint,
  valueNoun,
}: {
  title: string;
  totalLabel: string;
  totalValue: number | null;
  series: ReportChartPoint[];
  emptyHint: string;
  valueNoun: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<SVGPolylineElement>(null);
  const areaRef = useRef<SVGPolygonElement>(null);
  const [mode, setMode] = useState<Mode>("cumulative");
  const [hover, setHover] = useState<number | null>(null);
  const gid = useId().replace(/:/g, "");
  const changeMode = (nextMode: Mode) => {
    setHover(null);
    setMode(nextMode);
  };

  const chartSeries = useMemo(
    () => (mode === "cumulative" ? series : series.slice(1)),
    [series, mode],
  );

  const values = useMemo(
    () =>
      chartSeries.map((point) =>
        mode === "cumulative" ? point.cumulative : point.daily,
      ),
    [chartSeries, mode],
  );

  const hasData = series.length >= 2;
  const showChart = hasData;
  const max = Math.max(...values, mode === "cumulative" ? 1 : 0);
  const min = Math.min(...values, 0);
  const span = Math.max(max - min, 1);

  const w = 640;
  const h = 220;
  const padL = 48;
  const padR = 18;
  const padT = 18;
  const padB = 32;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const points = chartSeries.map((row, index) => {
    const value = values[index] ?? 0;
    const x =
      chartSeries.length === 1
        ? padL + plotW / 2
        : padL + (index / (chartSeries.length - 1)) * plotW;
    const y = padT + plotH - ((value - min) / span) * plotH;
    return { x, y, row, value };
  });

  const line = points.map((p) => `${p.x},${p.y}`).join(" ");
  const area =
    points.length > 0
      ? `${padL},${padT + plotH} ${line} ${padL + plotW},${padT + plotH}`
      : "";

  const yTicks = [0, 0.33, 0.66, 1].map((t) => {
    const value = min + span * (1 - t);
    return {
      y: padT + plotH * t,
      label:
        mode === "daily"
          ? formatSignedCompactNumber(Math.round(value))
          : formatCompactNumber(Math.round(value)),
    };
  });

  const xLabels = (() => {
    if (chartSeries.length === 0) return [];
    const idxs = new Set<number>([0, chartSeries.length - 1]);
    if (chartSeries.length > 2) {
      idxs.add(Math.floor((chartSeries.length - 1) / 2));
    }
    if (chartSeries.length > 5) {
      idxs.add(Math.floor((chartSeries.length - 1) / 4));
      idxs.add(Math.floor(((chartSeries.length - 1) * 3) / 4));
    }
    return [...idxs].sort((a, b) => a - b).map((i) => ({
      x: points[i]?.x ?? padL,
      label: formatChartDate(chartSeries[i].date),
    }));
  })();

  const active = hover != null ? points[hover] : null;
  const latest = points[points.length - 1];
  const displayTotal =
    totalValue != null
      ? totalValue
      : latest
        ? latest.row.cumulative
        : null;
  const tooltipLabel =
    mode === "cumulative" ? `Total ${valueNoun}` : `New ${valueNoun}`;
  const tooltipValue = active
    ? mode === "cumulative"
      ? formatFullNumber(active.value)
      : formatSignedFullNumber(active.value)
    : "";

  useGSAP(
    () => {
      const lineElement = lineRef.current;
      if (!lineElement || !showChart) return;

      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
        const length = lineElement.getTotalLength();
        const timeline = gsap.timeline({
          scrollTrigger: {
            trigger: rootRef.current,
            start: "top 94%",
            once: true,
          },
        });

        timeline.fromTo(
          lineElement,
          {
            strokeDasharray: length,
            strokeDashoffset: length,
          },
          {
            strokeDashoffset: 0,
            duration: 0.72,
            ease: "power2.out",
            clearProps: "stroke-dasharray,stroke-dashoffset",
          },
        );
        if (areaRef.current) {
          timeline.fromTo(
            areaRef.current,
            { autoAlpha: 0 },
            {
              autoAlpha: 1,
              duration: 0.42,
              clearProps: "opacity,visibility",
            },
            0.16,
          );
        }
      });

      return () => media.revert();
    },
    {
      scope: rootRef,
      dependencies: [area, line, mode, showChart],
      revertOnUpdate: true,
    },
  );

  return (
    <div ref={rootRef} className="report-panel report-chart-card">
      <div className="report-panel__head report-chart-card__head">
        <div>
          <p className="report-chart-card__eyebrow">{title}</p>
          {displayTotal != null ? (
            <>
              <p className="report-chart-card__total">
                <AnimatedValue value={displayTotal} />
              </p>
              <p className="report-chart-card__total-label">{totalLabel}</p>
            </>
          ) : (
            <p className="report-chart-card__total-label">{totalLabel}</p>
          )}
        </div>
        <div className="report-toggle" role="group" aria-label={`${title} mode`}>
          <button
            type="button"
            className={mode === "cumulative" ? "is-active" : ""}
            aria-pressed={mode === "cumulative"}
            onClick={() => changeMode("cumulative")}
          >
            Cumulative
          </button>
          <button
            type="button"
            className={mode === "daily" ? "is-active" : ""}
            aria-pressed={mode === "daily"}
            onClick={() => changeMode("daily")}
          >
            Daily
          </button>
        </div>
      </div>

      {!showChart ? (
        <div className="report-empty report-empty--chart">
          <p>Not enough data yet</p>
          <p className="report-empty__hint">{emptyHint}</p>
        </div>
      ) : (
        <div
          className="report-chart-plot"
          onPointerLeave={(event) => {
            if (event.pointerType !== "touch") setHover(null);
          }}
        >
          <svg
            viewBox={`0 0 ${w} ${h}`}
            className="w-full"
            role="img"
            aria-label={`${title} ${mode} chart`}
          >
            <defs>
              <linearGradient id={`fill-${gid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(198,255,0,0.12)" />
                <stop offset="100%" stopColor="rgba(198,255,0,0)" />
              </linearGradient>
            </defs>

            {yTicks.map((tick) => (
              <g key={tick.y}>
                <line
                  x1={padL}
                  x2={padL + plotW}
                  y1={tick.y}
                  y2={tick.y}
                  stroke="rgba(255,255,255,0.06)"
                  vectorEffect="non-scaling-stroke"
                />
                <text
                  x={padL - 10}
                  y={tick.y + 3}
                  textAnchor="end"
                  fill="rgba(255,255,255,0.38)"
                  fontSize="10"
                >
                  {tick.label}
                </text>
              </g>
            ))}

            {xLabels.map((label) => (
              <text
                key={`${label.x}-${label.label}`}
                x={label.x}
                y={h - 10}
                textAnchor="middle"
                fill="rgba(255,255,255,0.38)"
                fontSize="10"
              >
                {label.label}
              </text>
            ))}

            {mode === "cumulative" && area ? (
              <polygon
                ref={areaRef}
                points={area}
                fill={`url(#fill-${gid})`}
              />
            ) : null}

            <polyline
              ref={lineRef}
              points={line}
              fill="none"
              stroke="#c6ff00"
              strokeWidth="1.8"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />

            {active ? (
              <>
                <line
                  x1={active.x}
                  x2={active.x}
                  y1={padT}
                  y2={padT + plotH}
                  stroke="rgba(255,255,255,0.18)"
                  strokeDasharray="4 4"
                />
                <circle
                  cx={active.x}
                  cy={active.y}
                  r="4.5"
                  fill="#0a0a0a"
                  stroke="#c6ff00"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                />
              </>
            ) : latest ? (
              <circle
                cx={latest.x}
                cy={latest.y}
                r="3.5"
                fill="#c6ff00"
              />
            ) : null}

            {/* Invisible hit targets */}
            {points.map((p, index) => (
              <circle
                key={p.row.date}
                cx={p.x}
                cy={p.y}
                r="14"
                fill="transparent"
                onMouseEnter={() => setHover(index)}
                onPointerDown={() => setHover(index)}
                onClick={() => setHover(index)}
                onFocus={() => setHover(index)}
                onBlur={() => setHover(null)}
                tabIndex={0}
                role="button"
                aria-label={`${formatChartDate(p.row.date, true)}, ${tooltipLabel} ${
                  mode === "cumulative"
                    ? formatFullNumber(p.value)
                    : formatSignedFullNumber(p.value)
                }`}
              />
            ))}
          </svg>

          {active ? (
            <div
              className={`report-chart-tooltip${
                active.y < 76 ? " is-below" : ""
              }`}
              style={{
                left: `${Math.min(
                  84,
                  Math.max(16, (active.x / w) * 100),
                )}%`,
                top: `${(active.y / h) * 100}%`,
              }}
            >
              <p className="report-chart-tooltip__date">
                {formatChartDate(active.row.date, true)}
              </p>
              <p className="report-chart-tooltip__value">
                <span className="report-chart-tooltip__dot" aria-hidden="true" />
                {tooltipLabel}
                <strong>{tooltipValue}</strong>
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function ViewsCharts({
  creations,
  views,
  creationsTotal,
  viewsTotal,
  showCreations = true,
}: {
  creations: ReportChartPoint[];
  views: ReportChartPoint[];
  creationsTotal: number | null;
  viewsTotal: number | null;
  showCreations?: boolean;
}) {
  return (
    <div
      className={`report-charts${showCreations ? "" : " report-charts--single"}`}
    >
      {showCreations ? (
        <ChartCard
          title="TikTok Creations"
          totalLabel="Total creations"
          totalValue={creationsTotal}
          series={creations}
          valueNoun="creations"
          emptyHint="Tracking has just started. Charts will appear after additional sound refreshes."
        />
      ) : null}
      <ChartCard
        title="Campaign Views"
        totalLabel="Total campaign views"
        totalValue={viewsTotal}
        series={views}
        valueNoun="views"
        emptyHint="Tracking has just started. Charts will appear after additional refreshes."
      />
    </div>
  );
}
