"use client";

import { ArrowDownRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "@/components/ui/Wordmark";
import { SectionNavLink } from "@/components/ui/SectionNavLink";
import { company } from "@/content/company";
import { primaryCta, primaryNav } from "@/content/navigation";
import { useActiveSection } from "@/hooks/useActiveSection";
import { queueSectionScroll, scrollToSection } from "@/lib/scroll";
import { cn } from "@/lib/utils";
import "./sidebar.css";

export function Sidebar() {
  const pathname = usePathname();
  const activeId = useActiveSection();
  const isHome = pathname === "/";

  const handleContactClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
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
          <Wordmark className="sidebar__wordmark text-[1.17rem] tracking-[0.13em]" />

          <p className="sidebar__positioning max-w-[13.75rem] label-caps text-[0.58rem] leading-[1.55] tracking-[0.11em] text-acid-lime">
            {company.sidebarEyebrow}
          </p>

          <p className="sidebar__description max-w-[13.5rem] text-[0.72rem] leading-[1.55] text-[#8a8a92]">
            {company.sidebarDescription}
          </p>
        </div>

        <nav className="sidebar__nav" aria-label="Primary">
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
                <span className="sidebar__nav-rail" aria-hidden="true" />
                <span className="sidebar__nav-index">{item.number}</span>
                <span className="sidebar__nav-label">{item.label}</span>
              </SectionNavLink>
            );
          })}
        </nav>

        <div className="sidebar__cta-wrap">
          <Link
            href="/"
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
        </div>
      </div>
    </aside>
  );
}
