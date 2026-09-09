"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { EASE_SOFT } from "@/components/home/process-motion";

export function useCycleIndex(
  length: number,
  interval: number,
  delay: number,
  enabled: boolean,
) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!enabled || length < 2) return;
    let intervalId = 0;
    const startId = window.setTimeout(() => {
      intervalId = window.setInterval(() => {
        setIndex((current) => (current + 1) % length);
      }, interval);
    }, delay);
    return () => {
      window.clearTimeout(startId);
      window.clearInterval(intervalId);
    };
  }, [delay, enabled, interval, length]);

  return index;
}

export function ProcessFlip({
  value,
  enabled,
  className,
  as: Tag = "strong",
}: {
  value: string;
  enabled: boolean;
  className?: string;
  as?: "strong" | "span" | "em";
}) {
  return (
    <span className={cn("process-flip", className)}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={value}
          initial={enabled ? { opacity: 0, y: 5 } : false}
          animate={{ opacity: 1, y: 0 }}
          exit={enabled ? { opacity: 0, y: -5 } : undefined}
          transition={{ duration: 0.38, ease: EASE_SOFT }}
        >
          <Tag>{value}</Tag>
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
