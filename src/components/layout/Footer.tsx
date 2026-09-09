"use client";

import { useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useReducedMotion } from "framer-motion";
import { Container } from "@/components/layout/Container";
import { Wordmark } from "@/components/ui/Wordmark";
import { company, getSocialLinks, hasPublicEmail } from "@/content/company";
import { footerNav, legalNav } from "@/content/navigation";
import { gsap, motionDuration, motionEase, useGSAP } from "@/lib/motion";
import { queueSectionScroll, scrollToSection, sectionIdFromHref } from "@/lib/scroll";
import { cn } from "@/lib/utils";

export function Footer({
  className,
  variant = "default",
}: {
  className?: string;
  variant?: "default" | "ending";
}) {
  const year = new Date().getFullYear();
  const socialLinks = getSocialLinks();
  const pathname = usePathname();
  const footerRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const ending = variant === "ending";

  useGSAP(
    () => {
      const footer = footerRef.current;
      if (!ending || !footer || reduceMotion !== false) return;
      gsap.from(footer, {
        y: 6,
        duration: motionDuration.ui,
        ease: motionEase.enter,
        scrollTrigger: {
          trigger: footer,
          start: "top 94%",
          once: true,
        },
      });
    },
    { dependencies: [ending, reduceMotion] },
  );

  const handleSectionClick = (
    event: React.MouseEvent<HTMLAnchorElement>,
    href: string,
  ) => {
    const id = sectionIdFromHref(href);
    if (!id) return;
    if (pathname === "/") {
      event.preventDefault();
      scrollToSection(id);
      return;
    }
    queueSectionScroll(id);
  };

  if (ending) {
    return (
      <footer
        ref={footerRef}
        className={cn("site-footer--ending", className)}
      >
        <div className="site-footer__inner">
          <div className="site-footer__brand">
            <Wordmark className="site-footer__mark" />
          </div>
          <div className="site-footer__meta">
            <ul className="site-footer__links">
              {footerNav.map((item) => (
                <li key={item.href}>
                  <Link
                    href="/"
                    scroll={false}
                    onClick={(event) => handleSectionClick(event, item.href)}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            <ul className="site-footer__links site-footer__legal">
              {legalNav.map((item) => (
                <li key={item.href}>
                  <Link href={item.href}>{item.label}</Link>
                </li>
              ))}
            </ul>
            <p className="site-footer__copy">
              © {year} {company.legalName}
            </p>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer ref={footerRef} className={cn("border-t border-border-dark bg-deep-black main-offset", className)}>
      <Container className="py-8 md:py-9">
        <div className="grid gap-8 md:grid-cols-[1.2fr_1fr]">
          <div>
            <Wordmark />
            {hasPublicEmail() ? (
              <a
                href={`mailto:${company.email}`}
                className="mt-4 block text-sm text-soft-grey underline-offset-4 hover:text-acid-lime hover:underline"
              >
                {company.email}
              </a>
            ) : null}
            {socialLinks.length > 0 ? (
              <ul className="mt-4 flex flex-wrap gap-4">
                {socialLinks.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-soft-grey underline-offset-4 transition-colors hover:text-acid-lime hover:underline"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="flex flex-col gap-6 md:items-end">
            <ul className="flex flex-wrap gap-x-5 gap-y-3 md:justify-end">
              {footerNav.map((item) => (
                <li key={item.href}>
                  <Link
                    href="/"
                    scroll={false}
                    onClick={(event) => handleSectionClick(event, item.href)}
                    className="text-sm text-soft-grey transition-colors hover:text-off-white"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            <ul className="flex flex-wrap gap-x-5 gap-y-3 md:justify-end">
              {legalNav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-muted-grey transition-colors hover:text-off-white"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted-grey">
              © {year} {company.legalName}
            </p>
          </div>
        </div>
      </Container>
    </footer>
  );
}
