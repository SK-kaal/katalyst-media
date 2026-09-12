"use client";

import { useId, useMemo, useRef, useState } from "react";
import {
  formatEngagementRate,
  formatFullNumber,
} from "@/lib/portal/metrics";
import type { ReportMetricHistoryPoint } from "@/lib/portal/report";
import { gsap, useGSAP } from "@/lib/motion";

type MetricFormat = "number" | "percent";

const TOOLTIP_DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/London",
});

function formatMetric(value: number, format: MetricFormat) {
  return format === "percent"
    ? formatEngagementRate(value)
    : formatFullNumber(value);
}

function chartPoints(
  series: ReportMetricHistoryPoint[],
  width: number,
  height: number,
) {
  const inset = 3;
  const values = series.map((point) => point.value);
  const rawMin = Math.min(...values, 0);
  const rawMax = Math.max(...values, 0);
  const rawSpan = rawMax - rawMin;
  const span = rawSpan > 0 ? rawSpan : Math.max(Math.abs(rawMax) * 0.08, 1);
  const min = rawSpan > 0 ? rawMin : rawMin - span / 2;
  const max = rawSpan > 0 ? rawMax : rawMax + span / 2;

  return series.map((point, index) => ({
    ...point,
    x:
      series.length === 1
        ? width / 2
        : inset + (index / (series.length - 1)) * (width - inset * 2),
    y:
      inset +
      ((max - point.value) / Math.max(max - min, 1)) *
        (height - inset * 2),
  }));
}

export function ReportMetricChart({
  label,
  series,
  format = "number",
  featured = false,
  animationDelay = 0,
}: {
  label: string;
  series: ReportMetricHistoryPoint[];
  format?: MetricFormat;
  featured?: boolean;
  animationDelay?: number;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<SVGPolylineElement>(null);
  const areaRef = useRef<SVGPolygonElement>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const gradientId = useId().replace(/:/g, "");
  const width = featured ? 640 : 180;
  const height = featured ? 118 : 50;
  const points = useMemo(
    () => chartPoints(series, width, height),
    [height, series, width],
  );
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area =
    points.length >= 2
      ? `0,${height} ${line} ${width},${height}`
      : "";
  const active = activeIndex != null ? points[activeIndex] : null;
  const latest = points[points.length - 1];
  const hasDrawableHistory = points.length >= 2;

  useGSAP(
    () => {
      const lineElement = lineRef.current;
      if (!lineElement || points.length < 2) return;

      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
        const length = lineElement.getTotalLength();
        const timeline = gsap.timeline({
          delay: animationDelay,
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
            duration: featured ? 0.78 : 0.56,
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
              duration: 0.38,
              clearProps: "opacity,visibility",
            },
            featured ? 0.18 : 0.1,
          );
        }
      });

      return () => media.revert();
    },
    {
      scope: rootRef,
      dependencies: [animationDelay, featured, hasDrawableHistory],
      revertOnUpdate: true,
    },
  );

  if (points.length === 0) {
    return (
      <div
        className={`report-metric-plot report-metric-plot--waiting${
          featured ? " report-metric-plot--featured" : ""
        }`}
        role="img"
        aria-label={`${label} history is not available yet`}
      >
        <span>Awaiting history</span>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className={`report-metric-plot${
        featured ? " report-metric-plot--featured" : ""
      }${points.length === 1 ? " report-metric-plot--single" : ""}`}
      onPointerLeave={(event) => {
        if (
          event.pointerType !== "touch" &&
          !rootRef.current?.contains(document.activeElement)
        ) {
          setActiveIndex(null);
        }
      }}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${label} historical trend`}
      >
        <defs>
          <linearGradient
            id={`report-metric-fill-${gradientId}`}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            {/* Falls away quickly so a flat series reads as a soft light
                under the line rather than a solid green block. */}
            <stop
              offset="0%"
              stopColor={
                featured ? "rgba(191,255,0,0.14)" : "rgba(191,255,0,0.1)"
              }
            />
            <stop
              offset="55%"
              stopColor={
                featured ? "rgba(191,255,0,0.04)" : "rgba(191,255,0,0.03)"
              }
            />
            <stop offset="100%" stopColor="rgba(191,255,0,0)" />
          </linearGradient>
        </defs>

        {area ? (
          <polygon
            ref={areaRef}
            points={area}
            className="report-metric-plot__area"
            fill={`url(#report-metric-fill-${gradientId})`}
          />
        ) : null}
        {points.length === 1 ? (
          <line
            x1="0"
            x2={width}
            y1={height / 2}
            y2={height / 2}
            className="report-metric-plot__line report-metric-plot__line--flat"
          />
        ) : (
          <polyline
            ref={lineRef}
            points={line}
            className="report-metric-plot__line"
          />
        )}

        {latest && points.length >= 2 ? (
          <>
            <circle
              className="report-metric-plot__latest-pulse"
              cx={latest.x}
              cy={latest.y}
              r={featured ? 4.5 : 3.5}
              fill="none"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              className="report-metric-plot__latest-point"
              cx={latest.x}
              cy={latest.y}
              r={featured ? 2.4 : 1.8}
              vectorEffect="non-scaling-stroke"
            />
          </>
        ) : null}

        {points.map((point, index) => (
          <circle
            key={`${point.capturedAt}-${index}`}
            cx={points.length === 1 ? width / 2 : point.x}
            cy={points.length === 1 ? height / 2 : point.y}
            r={featured ? 12 : 10}
            fill="transparent"
            tabIndex={0}
            role="button"
            aria-label={`${TOOLTIP_DATE.format(
              new Date(point.capturedAt),
            )}, ${label} ${formatMetric(point.value, format)}`}
            onMouseEnter={() => setActiveIndex(index)}
            onPointerDown={() => setActiveIndex(index)}
            onFocus={() => setActiveIndex(index)}
            onBlur={() => setActiveIndex(null)}
          />
        ))}
      </svg>

      {active ? (
        <span
          className="report-metric-plot__tooltip"
          style={{
            left: `${Math.min(84, Math.max(16, (active.x / width) * 100))}%`,
            top: `${Math.min(78, Math.max(12, (active.y / height) * 100))}%`,
          }}
        >
          <span>{TOOLTIP_DATE.format(new Date(active.capturedAt))}</span>
          <strong>{formatMetric(active.value, format)}</strong>
        </span>
      ) : null}
    </div>
  );
}
