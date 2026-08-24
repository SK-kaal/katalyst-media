"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/content/navigation";
import { useSetActiveSection } from "@/components/providers/ActiveSectionProvider";
import { queueSectionScroll, scrollToSection } from "@/lib/scroll";
import { cn } from "@/lib/utils";

type SectionNavLinkProps = {
  item: NavItem;
  className?: string;
  children: React.ReactNode;
  onNavigate?: () => void;
  "aria-current"?: "true" | "page" | undefined;
};

export function SectionNavLink({
  item,
  className,
  children,
  onNavigate,
  "aria-current": ariaCurrent,
}: SectionNavLinkProps) {
  const pathname = usePathname();
  const setActiveId = useSetActiveSection();
  const isHome = pathname === "/";

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    onNavigate?.();
    setActiveId?.(item.id);

    if (isHome) {
      event.preventDefault();
      scrollToSection(item.id);
      return;
    }

    queueSectionScroll(item.id);
  };

  return (
    <Link
      href="/"
      onClick={handleClick}
      className={cn(className)}
      aria-current={ariaCurrent}
      scroll={false}
    >
      {children}
    </Link>
  );
}
