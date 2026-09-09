"use client";

import { useRef } from "react";
import { ArrowDownRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useReducedMotion } from "framer-motion";
import { Wordmark } from "@/components/ui/Wordmark";
import { SectionNavLink } from "@/components/ui/SectionNavLink";
import { company, getPrimaryContactHref } from "@/content/company";
import { primaryCta, primaryNav } from "@/content/navigation";
import { useActiveSection } from "@/hooks/useActiveSection";
import { queueSectionScroll, scrollToSection } from "@/lib/scroll";
import { cn } from "@/lib/utils";
import { gsap, motionDuration, motionEase, useGSAP } from "@/lib/motion";
import "./sidebar.css";

export function Sidebar() {
  const pathname = usePathname();
  const activeId = useActiveSection();
  const isHome = pathname === "/";
  const reduceMotion = useReducedMotion();
  const motionOk = reduceMotion === false;
  const navRef = useRef<HTMLElement>(null);
  const markRef = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const nav = navRef.current;
      const mark = markRef.current;
      if (!nav || !mark) return;
      const active = nav.querySelector<HTMLElement>(".sidebar__nav-link--active");
      if (!active) {
        gsap.set(mark, { autoAlpha: 0 });
        return;
      }
      gsap.set(mark, { autoAlpha: 1, transformOrigin: "left top" });
      const base = mark.offsetHeight || 41.6;
      gsap.to(mark, {
        y: active.offsetTop + 2,
        scaleY: Math.max((active.offsetHeight - 4) / base, 0.35),
        duration: motionOk ? motionDuration.ui : 0,
        ease: motionEase.ui,
        overwrite: true,
      });
    },
    { dependencies: [activeId, isHome, motionOk] },
  );

  // Shares the same destination helper as every other contact CTA. When an
  // email is published the link becomes a mailto and must open normally;
  // otherwise it keeps the existing smooth scroll to the Contact section.
  const contactHref = getPrimaryContactHref();
  const contactIsMailto = contactHref.startsWith("mailto:");

  const handleContactClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (contactIsMailto) return;
    if (isHome) {
      event.preventDefault();
      scrollToSection(primaryCta.id);
      return;
    }
    queueSectionScroll(primaryCta.id);
  };

  return (
    <aside
      className="sidebar fixed inset-y-0 left-0 z-40 hidden flex-col lg:flex"
      aria-label="Site sidebar"
    >
      <div className="sidebar__inner">
        <div className="sidebar__brand">
          <Wordmark className="sidebar__wordmark text-[1.12rem] tracking-[0.13em]" />

          <p className="sidebar__positioning max-w-[12.8rem] label-caps text-[0.56rem] leading-[1.55] tracking-[0.12em] text-acid-lime">
            {company.sidebarEyebrow}
          </p>

          <p className="sidebar__description max-w-[12.6rem] text-[0.7rem] leading-[1.55] text-[#8a8a92]">
            {company.sidebarDescription}
          </p>
        </div>

        <nav ref={navRef} className="sidebar__nav" aria-label="Primary">
          <span ref={markRef} className="sidebar__nav-active" aria-hidden="true" />
          {primaryNav.map((item) => {
            const active = isHome && activeId === item.id;

            return (
              <SectionNavLink
                key={item.id}
                item={item}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "sidebar__nav-link",
                  active && "sidebar__nav-link--active",
                )}
              >
                <span className="sidebar__nav-index">{item.number}</span>
                <span className="sidebar__nav-label">{item.label}</span>
              </SectionNavLink>
            );
          })}
        </nav>

        <div className="sidebar__cta-wrap">
          <Link
            href={contactIsMailto ? contactHref : "/"}
            scroll={false}
            onClick={handleContactClick}
            className="sidebar__cta"
          >
            <span>{primaryCta.label}</span>
            <ArrowDownRight
              className="sidebar__cta-arrow size-3.5 shrink-0"
              aria-hidden="true"
            />
          </Link>

          <p className="sidebar__status">
            <span className="sidebar__status-dot" aria-hidden="true" />
            Available for enquiries
          </p>
          <p className="sidebar__location">{company.sidebarLocation}</p>
        </div>
      </div>
    </aside>
  );
}
