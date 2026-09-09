"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { ContactHud } from "@/components/home/ContactHud";
import { getPrimaryContactHref } from "@/content/company";
import { contactCopy } from "@/content/homepage";
import { gsap, motionDuration, motionEase, ScrollTrigger, useGSAP } from "@/lib/motion";
import { cn } from "@/lib/utils";
import "./contact-stage.css";

export function ContactSection({ className }: { className?: string }) {
  const sectionRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const motionEnabled = reduceMotion === false;
  const primaryHref = getPrimaryContactHref();

  useGSAP(
    () => {
      const section = sectionRef.current;
      if (!section || !motionEnabled) return;

      const items = section.querySelectorAll(".contact-copy__item");
      const glow = section.querySelector(".contact-stage__glow");
      const hud = section.querySelector(".contact-hud-slot");
      let played = false;

      const play = () => {
        if (played) return;
        played = true;
        section.classList.add("contact-stage--in");
        gsap
          .timeline({ defaults: { ease: motionEase.enter } })
          .to(glow, { autoAlpha: 1, duration: motionDuration.large }, 0)
          .to(
            items,
            {
              autoAlpha: 1,
              y: 0,
              duration: motionDuration.ui,
              stagger: 0.08,
            },
            0.06,
          )
          .to(hud, { autoAlpha: 1, duration: motionDuration.large }, 0.22);
      };

      gsap.set(glow, { autoAlpha: 0.4 });
      gsap.set(hud, { autoAlpha: 0 });
      gsap.set(items, { autoAlpha: 0, y: 10 });
      section.classList.add("contact-stage--ready");

      const trigger = ScrollTrigger.create({
        trigger: section,
        start: "top 86%",
        once: true,
        onEnter: play,
      });

      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            play();
            observer.disconnect();
          }
        },
        { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
      );
      observer.observe(section);

      if (section.getBoundingClientRect().top < window.innerHeight * 0.9) {
        play();
      }

      return () => {
        trigger.kill();
        observer.disconnect();
      };
    },
    { dependencies: [motionEnabled] },
  );

  // Keeps the ambient rotation and glow breathing paused while Contact is out
  // of view. Class is toggled on the DOM directly to avoid re-rendering.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section || !motionEnabled) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        section.classList.toggle("contact-stage--idle", !entry.isIntersecting);
      },
      { rootMargin: "150px 0px", threshold: 0 },
    );
    observer.observe(section);

    return () => {
      observer.disconnect();
      section.classList.remove("contact-stage--idle");
    };
  }, [motionEnabled]);

  return (
    <section
      ref={sectionRef}
      id="contact"
      className={cn(
        "contact-stage scroll-mt-24 lg:scroll-mt-8",
        !motionEnabled && "contact-stage--reduced",
        className,
      )}
      aria-labelledby="contact-heading"
    >
      <div className="contact-stage__atmosphere" aria-hidden="true">
        <div className="contact-stage__grid" />
        <svg
          className="contact-stage__diagonals"
          viewBox="0 0 1440 900"
          preserveAspectRatio="none"
        >
          <line x1="520" y1="0" x2="70" y2="900" />
          <line x1="1320" y1="40" x2="780" y2="900" />
        </svg>
        <div className="contact-stage__vignette" />
        <div className="contact-stage__glow" />
        <div className="contact-hud-slot">
          <ContactHud />
        </div>
      </div>

      <div className="contact-stage__copy">
        <p className="contact-stage__label contact-copy__item label-caps">
          {contactCopy.eyebrow}
        </p>
        <h2 id="contact-heading" className="contact-stage__headline contact-copy__item">
          Let&apos;s talk about your{" "}
          <span>next release.</span>
        </h2>
        <p className="contact-stage__description contact-copy__item">
          {contactCopy.description}
        </p>
        <PrimaryButton href={primaryHref} className="contact-stage__cta contact-copy__item">
          {contactCopy.primaryCta}
        </PrimaryButton>
        <p className="contact-stage__status contact-copy__item">
          <span className="contact-stage__dot" aria-hidden="true" />
          {contactCopy.availability}
        </p>
      </div>
    </section>
  );
}
