"use client";

import {
  Crosshair,
  Megaphone,
  Users,
  Video,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Reveal } from "@/components/ui/Reveal";
import { servicesCopy } from "@/content/homepage";

const serviceIcons: Record<
  (typeof servicesCopy.items)[number]["icon"],
  LucideIcon
> = {
  users: Users,
  megaphone: Megaphone,
  target: Crosshair,
  video: Video,
};

export function ServicesSection() {
  return (
    <section
      id="services"
      className="relative scroll-mt-20 overflow-hidden border-b border-t border-border-dark bg-deep-black section-pad lg:scroll-mt-0"
      aria-labelledby="services-heading"
    >
      <Container>
        <Reveal className="max-w-2xl">
          <p className="label-caps text-acid-lime">{servicesCopy.eyebrow}</p>
          <h2
            id="services-heading"
            className="mt-2.5 font-display text-[length:var(--text-h2)] font-semibold leading-[1.12] tracking-[-0.03em] text-off-white text-balance"
          >
            {servicesCopy.headline}
          </h2>
        </Reveal>

        <ul className="mt-7 grid gap-3.5 sm:grid-cols-2 lg:mt-8 lg:gap-4">
          {servicesCopy.items.map((service, index) => {
            const Icon = serviceIcons[service.icon];
            return (
              <li key={service.title}>
                <Reveal delay={0.04 + index * 0.03} className="h-full">
                  <article className="flex h-full flex-col rounded-[16px] border border-white/[0.09] bg-gradient-to-b from-[#121215] to-[#0a0a0c] p-4 shadow-[0_12px_36px_rgba(0,0,0,0.22)] transition-[border-color,box-shadow] duration-200 hover:border-acid-lime/35 hover:shadow-[0_12px_36px_rgba(0,0,0,0.22),0_0_24px_rgba(198,255,0,0.08)] md:p-5">
                    <span className="inline-flex size-9 items-center justify-center rounded-[10px] border border-lime-border/40 bg-acid-lime/10 text-acid-lime">
                      <Icon
                        className="size-[1.05rem]"
                        strokeWidth={1.6}
                        aria-hidden="true"
                      />
                    </span>
                    <h3 className="mt-3.5 font-display text-lg font-semibold tracking-[-0.02em] text-off-white md:text-xl">
                      {service.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-soft-grey md:text-[0.925rem]">
                      {service.description}
                    </p>
                  </article>
                </Reveal>
              </li>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}
