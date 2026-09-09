"use client";

import { useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { gsap, motionDuration, motionEase, ScrollTrigger, useGSAP } from "@/lib/motion";

type RevealProps = {
  children: React.ReactNode;
  className?: string;
  delay?: number;
};

export function Reveal({ children, className, delay = 0 }: RevealProps) {
  const reduceMotion = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const motionOk = reduceMotion === false;

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root || !motionOk) return;
      gsap.set(root, { autoAlpha: 0, y: 12 });
      const trigger = ScrollTrigger.create({
        trigger: root,
        start: "top 90%",
        once: true,
        onEnter: () => {
          gsap.to(root, {
            autoAlpha: 1,
            y: 0,
            duration: motionDuration.ui,
            delay,
            ease: motionEase.enter,
          });
        },
      });
      return () => trigger.kill();
    },
    { dependencies: [delay, motionOk] },
  );

  return (
    <div ref={rootRef} className={cn(className)}>
      {children}
    </div>
  );
}
