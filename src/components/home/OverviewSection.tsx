"use client";

import { useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { DirectionalLineBackground } from "@/components/brand/DirectionalLineBackground";
import { HeroCreatorCarousel } from "@/components/home/HeroCreatorCarousel";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { company, getPrimaryContactHref } from "@/content/company";
import { creatorVideos } from "@/content/creator-videos";
import { primaryCta } from "@/content/navigation";
import { gsap, motionDuration, motionEase, useGSAP } from "@/lib/motion";

export function OverviewSection() {
  const reduceMotion = useReducedMotion();
  const animate = reduceMotion === false;
  const rootRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root || !animate) return;

      const mm = gsap.matchMedia();
      mm.add("(min-width: 1024px)", () => {
        const accent = root.querySelector(".hero-bg-accent");
        if (!accent) return;
        gsap.fromTo(
          accent,
          { y: 0, opacity: 1 },
          {
            y: 14,
            opacity: 0.72,
            ease: motionEase.scrub,
            scrollTrigger: {
              trigger: root,
              start: "top top",
              end: "bottom top",
              scrub: 0.7,
            },
          },
        );
      });

      const timeline = gsap.timeline({
        defaults: { ease: motionEase.enter, overwrite: "auto" },
      });
      timeline
        .fromTo(
          ".hero-copy__eyebrow",
          { autoAlpha: 0, y: 16 },
          { autoAlpha: 1, y: 0, duration: motionDuration.ui },
        )
        .fromTo(
          ".hero-copy__heading",
          { autoAlpha: 0, y: 22 },
          { autoAlpha: 1, y: 0, duration: motionDuration.large },
          "-=0.28",
        )
        .fromTo(
          ".hero-copy__cta",
          { autoAlpha: 0, y: 14 },
          { autoAlpha: 1, y: 0, duration: motionDuration.ui },
          "-=0.48",
        )
        .fromTo(
          ".hero-copy__carousel",
          { autoAlpha: 0, y: 18 },
          { autoAlpha: 1, y: 0, duration: motionDuration.large },
          "-=0.42",
        );

      return () => mm.revert();
    },
    { dependencies: [animate], scope: rootRef },
  );

  return (
    <section
      ref={rootRef}
      id="overview"
      className="relative flex min-h-[calc(100svh-4.5rem)] scroll-mt-20 flex-col justify-center overflow-x-clip bg-carbon grain md:min-h-[90svh] lg:min-h-[100svh] lg:scroll-mt-0 main-offset"
      aria-labelledby="hero-heading"
    >
      <DirectionalLineBackground className="opacity-[0.48]" />

      <div className="relative mx-auto grid w-full max-w-[1680px] items-center gap-8 px-5 py-12 md:gap-9 md:px-8 md:py-14 lg:grid-cols-[minmax(26rem,28rem)_minmax(0,1fr)] lg:gap-x-5 lg:gap-y-0 lg:py-8 lg:pl-8 lg:pr-8 xl:grid-cols-[34rem_minmax(0,1fr)] xl:gap-x-6">
        <div className="min-w-0">
          <p className="hero-copy__eyebrow label-caps text-[0.68rem] tracking-[0.14em] text-acid-lime xl:whitespace-nowrap">
            {company.heroEyebrow}
          </p>

          <h1
            id="hero-heading"
            className="hero-copy__heading mt-4 font-display text-[clamp(2.5rem,2.05rem+1.85vw,3.75rem)] font-semibold leading-[1.05] tracking-[-0.045em] text-off-white"
          >
            <span className="block xl:whitespace-nowrap">Put your music in</span>
            <span className="block xl:whitespace-nowrap">
              front of the <span className="text-acid-lime">right</span>
            </span>
            <span className="block text-acid-lime">people.</span>
          </h1>

          <div className="hero-copy__cta mt-7 md:mt-8">
            <PrimaryButton
              href={getPrimaryContactHref()}
              className="shadow-[0_0_28px_rgba(198,255,0,0.16)] transition-[transform,filter,box-shadow] duration-200 hover:-translate-y-px hover:shadow-[0_0_34px_rgba(198,255,0,0.24)]"
            >
              {primaryCta.label}
            </PrimaryButton>
          </div>
        </div>

        {/* The negative inline-start margin widens only the reel's viewport into
            the empty space beside the copy; the grid tracks and the text column
            are untouched. */}
        <div className="hero-copy__carousel min-w-0 overflow-x-clip overflow-y-visible py-8 -my-8 lg:-ml-20">
          <HeroCreatorCarousel videos={creatorVideos} />
        </div>
      </div>

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-b from-transparent to-deep-black/70 md:h-12"
        aria-hidden="true"
      />
    </section>
  );
}
