"use client";

import { motion, useReducedMotion } from "framer-motion";
import { DirectionalLineBackground } from "@/components/brand/DirectionalLineBackground";
import { HeroCreatorCarousel } from "@/components/home/HeroCreatorCarousel";
import { Container } from "@/components/layout/Container";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { company, getPrimaryContactHref } from "@/content/company";
import { creatorVideos } from "@/content/creator-videos";

export function OverviewSection() {
  const reduceMotion = useReducedMotion();
  const animate = reduceMotion === false;

  return (
    <section
      id="overview"
      className="relative flex min-h-[calc(100svh-4.5rem)] scroll-mt-20 flex-col justify-center overflow-x-clip overflow-y-hidden bg-carbon grain md:min-h-[90svh] lg:min-h-[100svh] lg:scroll-mt-0 main-offset"
      aria-labelledby="hero-heading"
    >
      <DirectionalLineBackground />

      <Container className="relative grid w-full items-center gap-8 py-12 md:gap-10 md:py-14 lg:grid-cols-12 lg:gap-8 lg:py-10 xl:gap-10">
        <div className="min-w-0 lg:col-span-5 xl:col-span-5">
          <motion.p
            className="label-caps max-w-[26rem] text-acid-lime sm:max-w-none"
            initial={animate ? { opacity: 0, y: 12 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
          >
            {company.heroEyebrow}
          </motion.p>

          <motion.h1
            id="hero-heading"
            className="mt-4 max-w-[14ch] font-display text-[clamp(2.4rem,4.6vw,3.75rem)] font-semibold leading-[1.02] tracking-[-0.045em] text-off-white sm:max-w-xl"
            initial={animate ? { opacity: 0, y: 16 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.06 }}
          >
            Put your music in front of the{" "}
            <span className="text-acid-lime">right people.</span>
          </motion.h1>

          <motion.p
            className="mt-4 max-w-md text-sm leading-relaxed text-soft-grey md:text-[0.95rem] md:leading-[1.65]"
            initial={animate ? { opacity: 0, y: 12 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.1 }}
          >
            {company.heroSupport}
          </motion.p>

          <motion.div
            className="mt-7"
            initial={animate ? { opacity: 0, y: 12 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.14 }}
          >
            <PrimaryButton
              href={getPrimaryContactHref()}
              className="shadow-[0_0_28px_rgba(198,255,0,0.16)]"
            >
              Contact Us
            </PrimaryButton>
          </motion.div>
        </div>

        <motion.div
          className="min-w-0 overflow-hidden lg:col-span-7 xl:col-span-7"
          initial={animate ? { opacity: 0, y: 18 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.16 }}
        >
          <HeroCreatorCarousel videos={creatorVideos} />
        </motion.div>
      </Container>

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-b from-transparent to-deep-black/70 md:h-12"
        aria-hidden="true"
      />
    </section>
  );
}
