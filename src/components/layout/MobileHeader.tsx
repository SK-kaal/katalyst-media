"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Wordmark } from "@/components/ui/Wordmark";
import { SectionNavLink } from "@/components/ui/SectionNavLink";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { company, hasPublicEmail } from "@/content/company";
import { primaryCta, primaryNav } from "@/content/navigation";
import { useActiveSection } from "@/hooks/useActiveSection";
import { cn } from "@/lib/utils";

export function MobileHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(false);
  const activeId = useActiveSection();
  const isHome = pathname === "/";

  useEffect(() => {
    if (!open) return;

    wasOpenRef.current = true;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
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
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open || !wasOpenRef.current) return;
    wasOpenRef.current = false;
    const focusTimer = window.setTimeout(() => triggerRef.current?.focus(), 300);
    return () => window.clearTimeout(focusTimer);
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-border-dark bg-carbon/95 lg:hidden">
        <div className="flex h-16 items-center justify-between gap-4 px-5">
          <Wordmark className="text-[0.8rem]" />
          <button
            ref={triggerRef}
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-[8px] border border-border-dark text-off-white"
            aria-label="Open navigation menu"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>
        </div>
      </header>

      <div
        className={cn(
          "fixed inset-0 z-[60] overflow-hidden transition-[visibility] duration-300 motion-reduce:delay-0 motion-reduce:transition-none lg:hidden",
          open
            ? "visible pointer-events-auto"
            : "invisible pointer-events-none delay-300",
        )}
        role="dialog"
        aria-modal={open ? "true" : undefined}
        aria-labelledby={titleId}
      >
        <button
          type="button"
          className={cn(
            "absolute inset-0 bg-dark-overlay transition-opacity duration-200 ease-out motion-reduce:transition-none",
            open ? "opacity-100" : "opacity-0",
          )}
          aria-label="Close menu"
          tabIndex={open ? 0 : -1}
          onClick={() => setOpen(false)}
        />
        <div
          ref={panelRef}
          className={cn(
            "absolute inset-y-0 right-0 flex w-full max-w-md transform-gpu flex-col bg-carbon px-5 pb-8 pt-6 will-change-transform transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
            open
              ? "translate-x-0 opacity-100"
              : "translate-x-full opacity-0",
          )}
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
                      "flex items-center gap-4 border-b border-border-dark py-3.5 font-display text-xl font-semibold tracking-[-0.03em]",
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
                  className="border-b border-border-dark py-4 font-display text-2xl font-semibold text-off-white"
                >
                  Home
                </Link>
              ) : null}
            </nav>

            <div className="mt-6 space-y-4 border-t border-border-dark pt-6">
              <PrimaryButton
                href={`#${primaryCta.id}`}
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
