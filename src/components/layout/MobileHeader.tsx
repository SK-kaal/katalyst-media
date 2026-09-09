"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { Wordmark } from "@/components/ui/Wordmark";
import { SectionNavLink } from "@/components/ui/SectionNavLink";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import {
  company,
  getPrimaryContactHref,
  hasPublicEmail,
} from "@/content/company";
import { primaryCta, primaryNav } from "@/content/navigation";
import { useActiveSection } from "@/hooks/useActiveSection";
import { cn } from "@/lib/utils";
import { gsap, motionDuration, motionEase, useGSAP } from "@/lib/motion";

export function MobileHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(false);
  const timelineRef = useRef<ReturnType<typeof gsap.timeline> | null>(null);
  const activeId = useActiveSection();
  const isHome = pathname === "/";
  const reduceMotion = useReducedMotion();
  const motionOk = reduceMotion === false;

  useGSAP(
    () => {
      const shell = shellRef.current;
      const overlay = overlayRef.current;
      const panel = panelRef.current;
      if (!shell || !overlay || !panel) return;

      const items = panel.querySelectorAll(".mobile-nav-item, .mobile-nav-foot");
      gsap.set(shell, { autoAlpha: 0 });
      gsap.set(overlay, { autoAlpha: 0 });
      // `x: 0` is required: the panel also carries Tailwind's `translate-x-full`
      // for the pre-hydration state, and GSAP would otherwise parse that 100%
      // offset into its own `x` baseline and add `xPercent` on top, leaving the
      // open position one full panel-width off screen.
      gsap.set(panel, { x: 0, xPercent: 100, autoAlpha: 0 });
      gsap.set(items, { autoAlpha: 0, y: 10 });

      if (!motionOk) return;

      const timeline = gsap.timeline({
        paused: true,
        defaults: { ease: motionEase.ui },
        onStart: () => {
          gsap.set(shell, { autoAlpha: 1 });
        },
        onReverseComplete: () => {
          gsap.set(shell, { autoAlpha: 0 });
        },
      });

      timeline
        .to(overlay, { autoAlpha: 1, duration: motionDuration.micro }, 0)
        .to(
          panel,
          { xPercent: 0, autoAlpha: 1, duration: 0.45, ease: motionEase.enter },
          0,
        )
        .to(
          items,
          {
            autoAlpha: 1,
            y: 0,
            duration: motionDuration.ui,
            stagger: 0.04,
            ease: motionEase.enter,
          },
          0.12,
        );

      timelineRef.current = timeline;
      return () => {
        timeline.kill();
        timelineRef.current = null;
      };
    },
    { dependencies: [motionOk] },
  );

  useEffect(() => {
    const timeline = timelineRef.current;
    if (motionOk && timeline) {
      if (open) timeline.play();
      else timeline.reverse();
      return;
    }

    const shell = shellRef.current;
    const overlay = overlayRef.current;
    const panel = panelRef.current;
    if (!shell || !overlay || !panel) return;
    const items = panel.querySelectorAll(".mobile-nav-item, .mobile-nav-foot");
    gsap.set(shell, { autoAlpha: open ? 1 : 0 });
    gsap.set(overlay, { autoAlpha: open ? 1 : 0 });
    gsap.set(panel, {
      x: 0,
      xPercent: open ? 0 : 100,
      autoAlpha: open ? 1 : 0,
    });
    gsap.set(items, { autoAlpha: 1, y: 0 });
  }, [open, motionOk]);

  useEffect(() => {
    if (!open) return;

    wasOpenRef.current = true;
    // The document element is the scroll container here, so locking `body`
    // has no effect — its height simply grows to the full content height.
    const scroller = document.documentElement;
    const previousOverflow = scroller.style.overflow;
    scroller.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      scroller.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open || !wasOpenRef.current) return;
    const focusTimer = window.setTimeout(() => triggerRef.current?.focus(), 280);
    return () => window.clearTimeout(focusTimer);
  }, [open]);

  // The drawer is hidden by `lg:hidden` above 1024px, so an open menu that
  // survives a resize would leave the overlay and scroll lock live but
  // unreachable — and re-appear on the way back down to mobile.
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const sync = () => {
      if (desktop.matches) setOpen(false);
    };
    sync();
    desktop.addEventListener("change", sync);
    return () => desktop.removeEventListener("change", sync);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-border-dark bg-carbon/95 lg:hidden">
        <div className="flex h-16 items-center justify-between gap-4 px-5">
          <Wordmark className="text-[0.8rem]" />
          <button
            ref={triggerRef}
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-[8px] border border-border-dark text-off-white"
            aria-label={open ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={open}
            onClick={() => setOpen((previous) => !previous)}
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>
        </div>
      </header>

      <div
        ref={shellRef}
        className="invisible pointer-events-none fixed inset-0 z-[60] overflow-hidden lg:hidden"
        role="dialog"
        aria-modal={open ? "true" : undefined}
        aria-labelledby={titleId}
        style={{ pointerEvents: open ? "auto" : "none" }}
      >
        <button
          ref={overlayRef}
          type="button"
          className="absolute inset-0 bg-dark-overlay opacity-0"
          aria-label="Close menu"
          tabIndex={open ? 0 : -1}
          onClick={() => setOpen(false)}
        />
        <div
          ref={panelRef}
          className="absolute inset-y-0 right-0 flex w-full max-w-md translate-x-full flex-col bg-carbon px-5 pb-8 pt-6 opacity-0 will-change-transform"
        >
            <div className="flex items-center justify-between">
              <Wordmark className="text-[0.8rem]" />
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex size-11 items-center justify-center rounded-[8px] border border-border-dark text-off-white"
                aria-label="Close navigation menu"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>

            <p id={titleId} className="sr-only">
              Site navigation
            </p>

            <div className="mt-8 border-t border-border-dark pt-5">
              <p className="label-caps text-muted-grey">{company.focusLabel}</p>
              <p className="mt-2 text-sm text-soft-grey">{company.positioning}</p>
            </div>

            <nav className="mt-8 flex flex-1 flex-col gap-1" aria-label="Mobile">
              {primaryNav.map((item) => {
                const active = isHome && activeId === item.id;

                return (
                  <SectionNavLink
                    key={item.id}
                    item={item}
                    onNavigate={() => setOpen(false)}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "mobile-nav-item flex items-center gap-4 border-b border-border-dark py-3.5 font-display text-xl font-semibold tracking-[-0.03em]",
                      active ? "text-acid-lime" : "text-off-white",
                    )}
                  >
                    <span className="w-8 text-sm text-muted-grey">{item.number}</span>
                    {item.label}
                  </SectionNavLink>
                );
              })}
              {!isHome ? (
                <Link
                  href="/"
                  onClick={() => setOpen(false)}
                  className="mobile-nav-item border-b border-border-dark py-4 font-display text-2xl font-semibold text-off-white"
                >
                  Home
                </Link>
              ) : null}
            </nav>

            <div className="mobile-nav-foot mt-6 space-y-4 border-t border-border-dark pt-6">
              <PrimaryButton
                href={getPrimaryContactHref()}
                className="w-full"
                onClick={() => setOpen(false)}
              >
                {primaryCta.label}
              </PrimaryButton>
              {hasPublicEmail() ? (
                <a
                  href={`mailto:${company.email}`}
                  className="block text-sm text-off-white underline-offset-4 hover:underline"
                >
                  {company.email}
                </a>
              ) : null}
            </div>
        </div>
      </div>
    </>
  );
}
