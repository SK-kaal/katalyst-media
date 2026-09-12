"use client";

import type { ReactNode } from "react";
import { useRef } from "react";
import {
  formatEngagementRate,
  formatFullNumber,
  formatGbpExact,
} from "@/lib/portal/metrics";
import { gsap, useGSAP } from "@/lib/motion";

type ValueKind = "number" | "currency" | "percent";

function formatValue(value: number, kind: ValueKind) {
  if (kind === "currency") return formatGbpExact(value);
  if (kind === "percent") return formatEngagementRate(value);
  return formatFullNumber(value);
}

export function AnimatedValue({
  value,
  kind = "number",
}: {
  value: number;
  kind?: ValueKind;
}) {
  const visualRef = useRef<HTMLSpanElement>(null);
  const finalValue = formatValue(value, kind);

  useGSAP(
    () => {
      const visual = visualRef.current;
      if (!visual) return;

      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
        const counter = { value: 0 };
        visual.textContent = formatValue(0, kind);

        gsap.to(counter, {
          value: Math.max(0, value),
          duration: 0.78,
          delay: 0.18,
          ease: "power3.out",
          onUpdate: () => {
            visual.textContent = formatValue(counter.value, kind);
          },
          onComplete: () => {
            visual.textContent = finalValue;
          },
        });
      });

      return () => media.revert();
    },
    { scope: visualRef },
  );

  return (
    <span className="report-animated-value" aria-label={finalValue}>
      <span ref={visualRef} aria-hidden="true">
        {finalValue}
      </span>
    </span>
  );
}

export function ReportMotion({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root) return;

      const updateVisibility = () => {
        root.classList.toggle("report-motion-root--paused", document.hidden);
      };
      updateVisibility();
      document.addEventListener("visibilitychange", updateVisibility);

      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
        const campaign = root.querySelector(".report-summary");
        const delivery = root.querySelector(".report-delivery-card");
        const results = root.querySelector(".report-results");
        const metrics = root.querySelectorAll(".report-metric-card");
        const charts = root.querySelectorAll(".report-chart-card");
        const progress = root.querySelector(".report-progress__fill");
        const entranceTargets = [campaign, delivery, results, ...metrics, ...charts]
          .filter((target): target is Element => target != null);

        gsap.set(entranceTargets, { autoAlpha: 0, y: 10 });
        if (progress) {
          gsap.set(progress, { scaleX: 0, transformOrigin: "left center" });
        }

        const timeline = gsap.timeline({
          defaults: { ease: "power3.out" },
        });

        if (campaign) {
          timeline.to(campaign, {
            autoAlpha: 1,
            y: 0,
            duration: 0.36,
            clearProps: "opacity,visibility,transform",
          });
        }
        if (delivery) {
          delivery.classList.add("is-entering");
          timeline.to(
            delivery,
            {
              autoAlpha: 1,
              y: 0,
              duration: 0.36,
              clearProps: "opacity,visibility,transform",
              onComplete: () => {
                window.setTimeout(() => {
                  delivery.classList.remove("is-entering");
                }, 1100);
              },
            },
            0.08,
          );
        }
        if (progress) {
          timeline.to(
            progress,
            {
              scaleX: 1,
              duration: 0.72,
              ease: "power2.out",
              clearProps: "transform,transform-origin",
            },
            0.16,
          );
        }
        if (results) {
          timeline.to(
            results,
            {
              autoAlpha: 1,
              y: 0,
              duration: 0.38,
              clearProps: "opacity,visibility,transform",
            },
            0.2,
          );
        }
        if (metrics.length > 0) {
          timeline.to(
            metrics,
            {
              autoAlpha: 1,
              y: 0,
              duration: 0.28,
              stagger: 0.07,
              clearProps: "opacity,visibility,transform",
            },
            0.32,
          );
        }
        if (charts.length > 0) {
          timeline.to(
            charts,
            {
              autoAlpha: 1,
              y: 0,
              duration: 0.34,
              stagger: 0.08,
              clearProps: "opacity,visibility,transform",
            },
            0.58,
          );
        }
      });

      return () => {
        document.removeEventListener("visibilitychange", updateVisibility);
        media.revert();
      };
    },
    { scope: rootRef },
  );

  return (
    <div ref={rootRef} className="report-motion-root">
      {children}
    </div>
  );
}
