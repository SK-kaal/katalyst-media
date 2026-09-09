"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
  ScrollTrigger.config({
    ignoreMobileResize: true,
  });
}

gsap.defaults({
  ease: "power2.out",
  duration: 0.55,
});

export { gsap, ScrollTrigger, useGSAP };

export const motionEase = {
  enter: "power3.out",
  ui: "power2.out",
  cinematic: "power2.inOut",
  ambient: "sine.inOut",
  scrub: "none",
} as const;

export const motionDuration = {
  micro: 0.28,
  ui: 0.55,
  large: 1.05,
} as const;
