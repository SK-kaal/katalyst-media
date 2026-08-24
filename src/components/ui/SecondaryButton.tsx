"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  queueSectionScroll,
  scrollToSection,
  sectionIdFromHref,
} from "@/lib/scroll";
import { cn } from "@/lib/utils";

type SecondaryButtonProps = {
  children: React.ReactNode;
  href: string;
  className?: string;
  onDark?: boolean;
  onClick?: () => void;
};

export function SecondaryButton({
  children,
  href,
  className,
  onDark = true,
  onClick,
}: SecondaryButtonProps) {
  const pathname = usePathname();
  const classes = cn(
    "inline-flex min-h-11 items-center justify-center rounded-[8px] border px-5 py-3.5 text-[0.9375rem] font-medium transition-colors duration-200 ease-out",
    onDark
      ? "border-border-dark bg-transparent text-off-white hover:border-lime-border"
      : "border-border-light bg-transparent text-carbon hover:border-lime-on-light",
    className,
  );

  const isExternal = href.startsWith("http");
  const isMail = href.startsWith("mailto:");
  const sectionId = sectionIdFromHref(href);

  if (isExternal || isMail) {
    return (
      <a
        href={href}
        className={classes}
        onClick={onClick}
        {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {children}
      </a>
    );
  }

  if (sectionId) {
    return (
      <Link
        href="/"
        scroll={false}
        className={classes}
        onClick={(event) => {
          onClick?.();
          if (pathname === "/") {
            event.preventDefault();
            scrollToSection(sectionId);
            return;
          }
          queueSectionScroll(sectionId);
        }}
      >
        {children}
      </Link>
    );
  }

  return (
    <Link href={href} className={classes} onClick={onClick}>
      {children}
    </Link>
  );
}
