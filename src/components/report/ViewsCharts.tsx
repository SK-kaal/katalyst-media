"use client";

import { useId, useMemo, useState } from "react";
import {
  formatCompactNumber,
  formatFullNumber,
  type ReportChartPoint,
} from "@/lib/portal/metrics";
import "@/components/report/report.css";

type Mode = "cumulative" | "daily";

function formatAxisDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(d);
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
  const [mode, setMode] = useState<Mode>("cumulative");
  const [hover, setHover] = useState<number | null>(null);
  const gid = useId().replace(/:/g, "");

  const values = useMemo(
    () => series.map((p) => (mode === "cumulative" ? p.cumulative : p.daily)),
    [series, mode],
  );

  const hasData = series.length >= 2;
  const valuesDistinct =
    hasData && new Set(values.map((v) => Math.round(Number(v) || 0))).size > 1;
  // Flat identical snapshots are not a meaningful chart yet.
  const showChart =
    hasData &&
    (mode === "daily"
      ? values.some((v) => Math.abs(v) > 0)
      : valuesDistinct);
  const max = Math.max(...values, 1);
  const min = mode === "cumulative" ? Math.min(...values, 0) : 0;
  const span = Math.max(max - min, 1);

  const w = 640;
  const h = 260;
  const padL = 48;
  const padR = 18;
  const padT = 22;
  const padB = 36;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const points = series.map((row, index) => {
    const value = values[index] ?? 0;
    const x =
      series.length === 1
        ? padL + plotW / 2
        : padL + (index / (series.length - 1)) * plotW;
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
      label: formatCompactNumber(Math.round(value)),
    };
  });

  const xLabels = (() => {
    if (series.length === 0) return [];
    const idxs = new Set<number>([0, series.length - 1]);
    if (series.length > 2) idxs.add(Math.floor((series.length - 1) / 2));
    if (series.length > 5) {
      idxs.add(Math.floor((series.length - 1) / 4));
      idxs.add(Math.floor(((series.length - 1) * 3) / 4));
    }
    return [...idxs].sort((a, b) => a - b).map((i) => ({
      x: points[i]?.x ?? padL,
      label: formatAxisDate(series[i].date),
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

  return (
    <div className="report-panel report-chart-card">
      <div className="report-panel__head report-chart-card__head">
        <div>
          <p className="report-chart-card__eyebrow">{title}</p>
          {displayTotal != null ? (
            <>
              <p className="report-chart-card__total">
                {formatFullNumber(displayTotal)}
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
            onClick={() => setMode("cumulative")}
          >
            Cumulative
          </button>
          <button
            type="button"
            className={mode === "daily" ? "is-active" : ""}
            onClick={() => setMode("daily")}
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
          onMouseLeave={() => setHover(null)}
        >
          <svg
            viewBox={`0 0 ${w} ${h}`}
            className="w-full"
            role="img"
            aria-label={`${title} ${mode} chart`}
          >
            <defs>
              <linearGradient id={`fill-${gid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(198,255,0,0.22)" />
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
              <polygon points={area} fill={`url(#fill-${gid})`} />
            ) : null}

            <polyline
              points={line}
              fill="none"
              stroke="#c6ff00"
              strokeWidth="2.2"
              strokeLinejoin="round"
              strokeLinecap="round"
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
              />
            ))}
          </svg>

          {active ? (
            <div
              className="report-chart-tooltip"
              style={{
                left: `${(active.x / w) * 100}%`,
                top: `${(active.y / h) * 100}%`,
              }}
            >
              <p className="report-chart-tooltip__date">
                {formatAxisDate(active.row.date)}
              </p>
              <p className="report-chart-tooltip__value">
                <span className="report-chart-tooltip__dot" aria-hidden="true" />
                {mode === "cumulative" ? "Total" : "Daily"} {valueNoun}:{" "}
                <strong>{formatFullNumber(active.value)}</strong>
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
          emptyHint="More historical data will appear after additional sound refreshes."
        />
      ) : null}
      <ChartCard
        title="Campaign Views"
        totalLabel="Total campaign views"
        totalValue={viewsTotal}
        series={views}
        valueNoun="views"
        emptyHint="Tracking has just started. Charts appear after additional refreshes."
      />
    </div>
  );
}
