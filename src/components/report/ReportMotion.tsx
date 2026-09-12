"use client";

import type { ReactNode } from "react";
import { useRef } from "react";
import {
  formatEngagementRate,
  formatFullNumber,
  formatGbpExact,
} from "@/lib/portal/metrics";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/motion";

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
  const hasRevealedRef = useRef(false);
  const previousValueRef = useRef(value);
  const finalValue = formatValue(value, kind);

  useGSAP(
    () => {
      const visual = visualRef.current;
      if (!visual) return;

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        visual.textContent = finalValue;
        hasRevealedRef.current = true;
        previousValueRef.current = value;
        return;
      }

      let valueTween: gsap.core.Tween | null = null;
      let feedbackTween: gsap.core.Tween | null = null;

      if (!hasRevealedRef.current) {
        visual.textContent = formatValue(0, kind);
        const revealTrigger = ScrollTrigger.create({
          trigger: visual,
          start: "top 96%",
          once: true,
          onEnter: () => {
            hasRevealedRef.current = true;
            previousValueRef.current = value;

            const counter = { value: 0 };
            valueTween = gsap.to(counter, {
              value: Math.max(0, value),
              duration: 0.82,
              ease: "power3.out",
              onUpdate: () => {
                visual.textContent = formatValue(counter.value, kind);
              },
              onComplete: () => {
                visual.textContent = finalValue;
              },
            });
          },
        });

        return () => {
          revealTrigger.kill();
          valueTween?.kill();
        };
      }

      const previousValue = previousValueRef.current;
      previousValueRef.current = value;

      if (previousValue !== value) {
        const counter = { value: Math.max(0, previousValue) };
        visual.textContent = formatValue(counter.value, kind);

        valueTween = gsap.to(counter, {
          value: Math.max(0, value),
          duration: 0.62,
          ease: "power2.out",
          onUpdate: () => {
            visual.textContent = formatValue(counter.value, kind);
          },
          onComplete: () => {
            visual.textContent = finalValue;
          },
        });

        feedbackTween = gsap.fromTo(
          visual,
          {
            color: "#dcff75",
            textShadow: "0 0 12px rgba(191, 255, 0, 0.28)",
          },
          {
            color: "inherit",
            textShadow: "0 0 0 rgba(191, 255, 0, 0)",
            duration: 0.58,
            ease: "power2.out",
            clearProps: "color,text-shadow",
          },
        );
      }

      return () => {
        valueTween?.kill();
        feedbackTween?.kill();
      };
    },
    {
      scope: visualRef,
      dependencies: [finalValue, kind, value],
      revertOnUpdate: true,
    },
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
        const atmosphere = root.querySelector(".report-atmosphere");
        const header = root.querySelector(".report-header");
        const waveform = root.querySelector(".report-summary__waveform");
        const liveIndicators = root.querySelectorAll(
          ".report-status, .report-results__live",
        );
        const overviewCards = root.querySelectorAll(".report-overview-card");
        const delivery = root.querySelector<HTMLElement>(".report-delivery-card");
        const results = root.querySelector(".report-results");
        const resultCards = root.querySelectorAll(
          ".report-results__featured, .report-metric-card",
        );
        const chartsWrap = root.querySelector(".report-charts");
        const charts = root.querySelectorAll(".report-chart-card");
        const sections = root.querySelectorAll(".report-section");
        const progress = root.querySelector(".report-progress__fill");

        gsap.set(overviewCards, { opacity: 0, y: 9 });
        if (progress) {
          gsap.set(progress, { scaleX: 0, transformOrigin: "left center" });
        }

        // Above-the-fold intro plays immediately: atmosphere, header, cards,
        // waveform, then the live indicators. Interaction is never blocked.
        const intro = gsap.timeline({ defaults: { ease: "power3.out" } });

        if (atmosphere) {
          intro.fromTo(
            atmosphere,
            { opacity: 0 },
            { opacity: 1, duration: 0.8, clearProps: "opacity" },
            0,
          );
        }

        if (header) {
          intro.fromTo(
            header,
            { opacity: 0, y: -6 },
            {
              opacity: 1,
              y: 0,
              duration: 0.42,
              clearProps: "opacity,transform",
            },
            0,
          );
        }

        if (overviewCards.length > 0) {
          intro.to(
            overviewCards,
            {
              opacity: 1,
              y: 0,
              duration: 0.44,
              stagger: 0.08,
              clearProps: "opacity,transform",
              onStart: () => delivery?.classList.add("is-entering"),
            },
            0.12,
          );
        }

        if (waveform) {
          intro.fromTo(
            waveform,
            { opacity: 0 },
            { opacity: 1, duration: 0.7, clearProps: "opacity" },
            0.34,
          );
        }

        if (progress) {
          intro.to(
            progress,
            {
              scaleX: 1,
              duration: 0.78,
              ease: "power2.out",
              clearProps: "transform,transform-origin",
            },
            0.26,
          );
        }

        if (liveIndicators.length > 0) {
          intro.fromTo(
            liveIndicators,
            { autoAlpha: 0 },
            {
              autoAlpha: 1,
              duration: 0.4,
              stagger: 0.1,
              clearProps: "opacity,visibility",
            },
            0.62,
          );
        }

        if (delivery) {
          intro.call(
            () => delivery.classList.remove("is-entering"),
            [],
            1.24,
          );
        }

        if (results) {
          gsap.set(results, { opacity: 0.35, y: 9 });
          gsap.set(resultCards, { opacity: 0.4, y: 7 });

          const resultsTimeline = gsap.timeline({
            defaults: { ease: "power3.out" },
            scrollTrigger: {
              trigger: results,
              start: "top 92%",
              once: true,
            },
          });

          resultsTimeline
            .to(results, {
              opacity: 1,
              y: 0,
              duration: 0.46,
              clearProps: "opacity,transform",
            })
            .to(
              resultCards,
              {
                opacity: 1,
                y: 0,
                duration: 0.36,
                stagger: 0.055,
                clearProps: "opacity,transform",
              },
              0.1,
            );
        }

        if (chartsWrap && charts.length > 0) {
          gsap.set(charts, { opacity: 0.35, y: 9 });
          gsap.to(charts, {
            opacity: 1,
            y: 0,
            duration: 0.44,
            stagger: 0.08,
            ease: "power3.out",
            clearProps: "opacity,transform",
            scrollTrigger: {
              trigger: chartsWrap,
              start: "top 92%",
              once: true,
            },
          });
        }

        sections.forEach((section) => {
          gsap.fromTo(
            section,
            { opacity: 0.45, y: 9 },
            {
              opacity: 1,
              y: 0,
              duration: 0.46,
              ease: "power3.out",
              clearProps: "opacity,transform",
              scrollTrigger: {
                trigger: section,
                start: "top 92%",
                once: true,
              },
            },
          );
        });
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
