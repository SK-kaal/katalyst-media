const SCROLL_KEY = "katalyst-scroll-section";

/**
 * Smoothly scroll to a homepage section by id without updating the URL hash.
 */
export function scrollToSection(id: string) {
  const element = document.getElementById(id);
  if (!element) return false;

  element.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
    block: "start",
  });

  // Keep the address bar clean — remove any existing hash
  if (window.location.hash) {
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}`,
    );
  }

  return true;
}

/** Queue a section scroll for after navigating to the homepage. */
export function queueSectionScroll(id: string) {
  try {
    sessionStorage.setItem(SCROLL_KEY, id);
  } catch {
    // Ignore private-mode / unavailable storage
  }
}

/** Read and clear a queued homepage section scroll target. */
export function consumeQueuedSectionScroll(): string | null {
  try {
    const id = sessionStorage.getItem(SCROLL_KEY);
    if (id) sessionStorage.removeItem(SCROLL_KEY);
    return id;
  } catch {
    return null;
  }
}

/** Extract a section id from `#id` or `/#id` hrefs. */
export function sectionIdFromHref(href: string): string | null {
  if (href.startsWith("/#")) return href.slice(2) || null;
  if (href.startsWith("#") && !href.startsWith("#main-content")) {
    return href.slice(1) || null;
  }
  return null;
}
