"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
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
  emptyTitle = "Not enough data yet",
  emptyHint,
  valueNoun,
  tracking = true,
}: {
  title: string;
  totalLabel: string;
  totalValue: number | null;
  series: ReportChartPoint[];
  emptyTitle?: string;
  emptyHint: string;
  valueNoun: string;
  /** Whether the empty state is still waiting on data worth scanning for. */
  tracking?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<SVGPolylineElement>(null);
  const areaRef = useRef<SVGPolygonElement>(null);
  const toggleRef = useRef<HTMLDivElement>(null);
  const toggleIndicatorRef = useRef<HTMLSpanElement>(null);
  const toggleGeometryRef = useRef<{ left: number; width: number } | null>(null);
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

  // The chart is drawn one user unit per pixel of its own box, so the plot's
  // height is whatever the stylesheet gives it and nothing inside the drawing
  // scales with the card. Previously the viewBox was fixed and stretched to
  // the available width, which tied the height to the width and sized the
  // axis labels and points along with it — about 5px on a phone and 19px on a
  // wide card. The box has a fixed CSS height, so measuring it cannot feed
  // back into its own size.
  const [plotBox, setPlotBox] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const plot = plotRef.current;
    if (!plot) return;

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect || rect.width === 0) return;
      const next = { w: Math.round(rect.width), h: Math.round(rect.height) };
      setPlotBox((current) =>
        current && current.w === next.w && current.h === next.h
          ? current
          : next,
      );
    });
    observer.observe(plot);
    return () => observer.disconnect();
  }, [showChart]);

  // Close to the rendered proportions, so the first paint before the box is
  // measured is not noticeably different.
  const w = plotBox?.w ?? 640;
  const h = plotBox?.h ?? 240;
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
      const toggle = toggleRef.current;
      const indicator = toggleIndicatorRef.current;
      const activeButton = toggle?.querySelector<HTMLButtonElement>(
        `button[data-mode="${mode}"]`,
      );
      if (!toggle || !indicator || !activeButton) return;

      const left = activeButton.offsetLeft;
      const width = activeButton.offsetWidth;
      const previous = toggleGeometryRef.current;
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      if (!previous || reduceMotion) {
        gsap.set(indicator, { x: left, width, scaleX: 1, opacity: 1 });
      } else {
        // Width is set instantly and the travel is done with transforms, so
        // the slide never triggers layout.
        gsap.set(indicator, {
          width,
          x: previous.left,
          scaleX: previous.width / width,
          opacity: 1,
        });
        gsap.to(indicator, {
          x: left,
          scaleX: 1,
          duration: 0.32,
          ease: "power2.inOut",
          overwrite: true,
        });
      }

      toggleGeometryRef.current = { left, width };
    },
    { scope: toggleRef, dependencies: [mode] },
  );

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
      dependencies: [showChart],
      revertOnUpdate: true,
    },
  );

  return (
    <div ref={rootRef} className="report-panel report-chart-card">
      <div className="report-panel__head report-chart-card__head">
        <div>
          <p className="report-chart-card__eyebrow">{title}</p>
          {/* No dangling label when there is no figure to label. */}
          {displayTotal != null ? (
            <>
              <p className="report-chart-card__total">
                <AnimatedValue value={displayTotal} />
              </p>
              <p className="report-chart-card__total-label">{totalLabel}</p>
            </>
          ) : null}
        </div>
        {/* No toggle when there is no chart to toggle. */}
        {showChart ? (
          <div
            ref={toggleRef}
            className="report-toggle"
            role="group"
            aria-label={`${title} mode`}
            data-mode={mode}
          >
            <span
              ref={toggleIndicatorRef}
              className="report-toggle__indicator"
              aria-hidden="true"
            />
            <button
              type="button"
              className={mode === "cumulative" ? "is-active" : ""}
              data-mode="cumulative"
              aria-pressed={mode === "cumulative"}
              onClick={() => changeMode("cumulative")}
            >
              Cumulative
            </button>
            <button
              type="button"
              className={mode === "daily" ? "is-active" : ""}
              data-mode="daily"
              aria-pressed={mode === "daily"}
              onClick={() => changeMode("daily")}
            >
              Daily
            </button>
          </div>
        ) : null}
      </div>

      {!showChart ? (
        <div
          className={`report-empty${
            tracking ? " report-empty--chart" : ""
          }`}
        >
          <p>{emptyTitle}</p>
          <p className="report-empty__hint">{emptyHint}</p>
        </div>
      ) : (
        <div
          ref={plotRef}
          className="report-chart-plot"
          onPointerLeave={(event) => {
            if (event.pointerType !== "touch") setHover(null);
          }}
        >
          <svg
            key={mode}
            viewBox={`0 0 ${w} ${h}`}
            className="report-chart-svg w-full"
            role="img"
            aria-label={`${title} ${mode} chart`}
          >
            <defs>
              {/*
                Stops are proportions of the filled area, so on a tall plot
                they have to fall away sooner — held at the old positions the
                light stops reading as a glow under the line and becomes a
                field of green.
              */}
              <linearGradient id={`fill-${gid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(191,255,0,0.1)" />
                <stop offset="34%" stopColor="rgba(191,255,0,0.028)" />
                <stop offset="78%" stopColor="rgba(191,255,0,0)" />
              </linearGradient>
            </defs>

            {yTicks.map((tick) => (
              <g key={tick.y}>
                <line
                  className="report-chart-grid"
                  x1={padL}
                  x2={padL + plotW}
                  y1={tick.y}
                  y2={tick.y}
                  vectorEffect="non-scaling-stroke"
                />
                <text
                  className="report-chart-axis"
                  x={padL - 10}
                  y={tick.y + 3}
                  textAnchor="end"
                >
                  {tick.label}
                </text>
              </g>
            ))}

            {/*
              The first and last dates sit on the ends of the axis, so they
              are anchored inward — centred on their point they hang over the
              edge of the plot and get clipped.
            */}
            {xLabels.map((label, index) => (
              <text
                key={`${label.x}-${label.label}`}
                className="report-chart-axis"
                x={label.x}
                y={h - 10}
                textAnchor={
                  index === 0
                    ? "start"
                    : index === xLabels.length - 1
                      ? "end"
                      : "middle"
                }
              >
                {label.label}
              </text>
            ))}

            {mode === "cumulative" && area ? (
              <polygon
                ref={areaRef}
                points={area}
                className="report-chart-area"
                fill={`url(#fill-${gid})`}
              />
            ) : null}

            <polyline
              ref={lineRef}
              points={line}
              className="report-chart-line"
              fill="none"
              stroke="#bfff00"
              strokeWidth="1.8"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />

            {points.length >= 2 ? (
              <polyline
                points={line}
                className="report-chart-pulse"
                pathLength={100}
                vectorEffect="non-scaling-stroke"
              />
            ) : null}

            {active ? (
              <>
                <line
                  className="report-chart-crosshair"
                  x1={active.x}
                  x2={active.x}
                  y1={padT}
                  y2={padT + plotH}
                />
                <circle
                  cx={active.x}
                  cy={active.y}
                  r="4.5"
                  fill="#0a0a0a"
                  stroke="#bfff00"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                />
              </>
            ) : latest ? (
              <>
                <circle
                  className="report-chart-latest-pulse"
                  cx={latest.x}
                  cy={latest.y}
                  r="5"
                  fill="none"
                  stroke="rgba(191,255,0,0.32)"
                  vectorEffect="non-scaling-stroke"
                />
                <circle
                  className="report-chart-latest-point"
                  cx={latest.x}
                  cy={latest.y}
                  r="3.5"
                  fill="#bfff00"
                />
              </>
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
  // TikTok stopped publishing how many videos use a sound, so this chart can
  // be waiting on a second day of history or on a figure that will never
  // arrive. Saying "not enough data yet" for the second case promises the
  // client something that no amount of waiting delivers.
  const creationsUnavailable = creations.length === 0 && creationsTotal == null;

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
          emptyTitle={
            creationsUnavailable ? "Not published by TikTok" : "Building history"
          }
          emptyHint={
            creationsUnavailable
              ? "TikTok no longer shares how many videos use a sound. Every other figure on this report is tracked daily."
              : "One day recorded so far. This chart appears once there are two days to compare."
          }
          // A scanning line implies something is still being looked for. When
          // TikTok simply does not publish the figure, nothing is.
          tracking={!creationsUnavailable}
        />
      ) : null}
      <ChartCard
        title="Campaign Views"
        totalLabel="Total campaign views"
        totalValue={viewsTotal}
        series={views}
        valueNoun="views"
        emptyTitle="Building history"
        emptyHint="Views are recorded daily. This chart appears once there are two days to compare."
      />
    </div>
  );
}
