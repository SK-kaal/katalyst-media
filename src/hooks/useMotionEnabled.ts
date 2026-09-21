"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * Returns true only after hydration and only when the user allows motion.
 * Framer Motion cannot know the browser preference during SSR, so exposing it
 * directly can make the first client render differ from the server markup.
 */
export function useMotionEnabled() {
  const reduceMotion = useReducedMotion();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setHydrated(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return hydrated && reduceMotion === false;
}
