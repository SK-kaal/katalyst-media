"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { sectionIds } from "@/content/navigation";
import { ScrollTrigger, useGSAP } from "@/lib/motion";

type ActiveSectionContextValue = {
  activeId: string;
  setActiveId: (id: string) => void;
};

const ActiveSectionContext = createContext<ActiveSectionContextValue | null>(
  null,
);

const scrollSections: { id: string; navId: string }[] = [
  { id: "overview", navId: "overview" },
  { id: "process", navId: "process" },
  { id: "contact", navId: "contact" },
];

type NavGeometry = {
  /** Section tops as absolute document offsets, in source order. */
  tops: { top: number; navId: string }[];
  viewport: number;
  docHeight: number;
};

/**
 * Section offsets only change on resize or a ScrollTrigger refresh, so they are
 * measured there rather than on every scroll tick. This keeps the hot path free
 * of forced layout reads while producing the same boundaries as before:
 * `rect.top <= probe` is equivalent to `absoluteTop <= scrollTop + probe`.
 */
function measureNavGeometry(): NavGeometry {
  const scrollTop = window.scrollY || document.documentElement.scrollTop;
  const tops: { top: number; navId: string }[] = [];

  for (const section of scrollSections) {
    const el = document.getElementById(section.id);
    if (!el) continue;
    tops.push({
      top: el.getBoundingClientRect().top + scrollTop,
      navId: section.navId,
    });
  }

  return {
    tops,
    viewport: window.innerHeight,
    docHeight: Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight,
    ),
  };
}

function readActiveFromScroll(geometry: NavGeometry, defaultId: string) {
  if (geometry.tops.length === 0) return defaultId;

  const scrollTop = window.scrollY || document.documentElement.scrollTop;

  if (scrollTop + geometry.viewport >= geometry.docHeight - 2) {
    return sectionIds[sectionIds.length - 1] ?? defaultId;
  }

  const probe = scrollTop + geometry.viewport * 0.28;
  let nextId = defaultId;

  for (const item of geometry.tops) {
    if (item.top <= probe) nextId = item.navId;
  }

  return nextId;
}

export function ActiveSectionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [activeId, setActiveIdState] = useState("overview");

  const setActiveId = useCallback((id: string) => {
    setActiveIdState(id);
  }, []);

  useGSAP(
    () => {
      if (pathname !== "/") return;

      let geometry = measureNavGeometry();

      const activate = () => {
        // Process layout / pin growth can change document height after the
        // initial measure. Remeasure when it drifts so Home → Process → Contact
        // highlighting stays correct without reading layout on every tick.
        const liveHeight = Math.max(
          document.documentElement.scrollHeight,
          document.body.scrollHeight,
        );
        if (Math.abs(liveHeight - geometry.docHeight) > 2) {
          geometry = measureNavGeometry();
        }

        const next = readActiveFromScroll(geometry, "overview");
        setActiveIdState((current) => (current === next ? current : next));
      };

      const remeasure = () => {
        geometry = measureNavGeometry();
        activate();
      };

      const trigger = ScrollTrigger.create({
        id: "nav-tracker",
        start: 0,
        end: "max",
        invalidateOnRefresh: true,
        onUpdate: activate,
        onRefresh: remeasure,
      });

      const resizeObserver = new ResizeObserver(() => {
        remeasure();
      });
      resizeObserver.observe(document.documentElement);

      // Process path measurement settles after first paint; catch that layout.
      const raf = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(remeasure);
      });
      const settleTimer = window.setTimeout(remeasure, 320);

      activate();
      return () => {
        trigger.kill();
        resizeObserver.disconnect();
        window.cancelAnimationFrame(raf);
        window.clearTimeout(settleTimer);
      };
    },
    { dependencies: [pathname] },
  );

  const resolvedActiveId = pathname === "/" ? activeId : "overview";

  const value = useMemo(
    () => ({ activeId: resolvedActiveId, setActiveId }),
    [resolvedActiveId, setActiveId],
  );

  return (
    <ActiveSectionContext.Provider value={value}>
      {children}
    </ActiveSectionContext.Provider>
  );
}

export function useActiveSection(defaultId = "overview") {
  const ctx = useContext(ActiveSectionContext);
  if (!ctx) return defaultId;
  return ctx.activeId;
}

export function useSetActiveSection() {
  const ctx = useContext(ActiveSectionContext);
  return ctx?.setActiveId;
}
