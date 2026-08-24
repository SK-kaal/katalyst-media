"use client";

import { useEffect } from "react";
import {
  consumeQueuedSectionScroll,
  scrollToSection,
} from "@/lib/scroll";

/**
 * On homepage load, scroll to a queued section (from nav on other pages)
 * or clear a legacy hash from the URL after scrolling once.
 */
export function HashScroll() {
  useEffect(() => {
    const queued = consumeQueuedSectionScroll();
    const legacyHash = window.location.hash.replace(/^#/, "");
    const id = queued || legacyHash;
    if (!id) return;

    window.requestAnimationFrame(() => {
      scrollToSection(id);
    });
  }, []);

  return null;
}
