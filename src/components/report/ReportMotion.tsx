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
        const results = root.querySelector(".report-results");
        const resultCards = root.querySelectorAll(
          ".report-results__featured, .report-metric-card",
        );
        const chartsWrap = root.querySelector(".report-charts");
        const charts = root.querySelectorAll(".report-chart-card");
        const sections = root.querySelectorAll(".report-section");

        // The above-the-fold entrance is CSS (see report.css) so that it is
        // not waiting on hydration. Everything here is revealed on scroll.
        //
        // Anything already on screen when hydration finishes is left alone:
        // dimming it first so it can fade back in reads as a flicker, not an
        // entrance. Only content the reader has not reached yet animates.
        const offScreen = (element: Element) =>
          element.getBoundingClientRect().top > window.innerHeight * 0.92;

        if (results && offScreen(results)) {
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

        if (chartsWrap && charts.length > 0 && offScreen(chartsWrap)) {
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
          if (!offScreen(section)) return;
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
