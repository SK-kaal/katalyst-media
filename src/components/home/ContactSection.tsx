import { Container } from "@/components/layout/Container";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Reveal } from "@/components/ui/Reveal";
import { SecondaryButton } from "@/components/ui/SecondaryButton";
import {
  company,
  getPrimaryContactHref,
  getSocialLinks,
  hasInstagram,
  hasPublicEmail,
} from "@/content/company";
import { contactCopy } from "@/content/homepage";

export function ContactSection() {
  const socialLinks = getSocialLinks().filter((link) => link.label !== "Instagram");
  const showEmail = hasPublicEmail();
  const showInstagram = hasInstagram();
  const primaryHref = getPrimaryContactHref();

  return (
    <section
      id="contact"
      className="scroll-mt-24 border-t border-border-dark bg-deep-black section-pad lg:scroll-mt-8"
      aria-labelledby="contact-heading"
    >
      <Container>
        <Reveal className="max-w-2xl">
          <p className="label-caps text-acid-lime">{contactCopy.eyebrow}</p>
          <h2
            id="contact-heading"
            className="mt-2.5 font-display text-[length:var(--text-h2)] font-semibold tracking-[-0.03em] text-off-white text-balance"
          >
            Let&apos;s talk about your{" "}
            <span className="text-acid-lime">next release.</span>
          </h2>
          <p className="mt-3.5 max-w-xl text-sm leading-relaxed text-soft-grey md:text-[0.95rem]">
            {contactCopy.description}
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <PrimaryButton
              href={primaryHref}
              className="shadow-[0_0_28px_rgba(198,255,0,0.16)]"
            >
              {contactCopy.primaryCta}
            </PrimaryButton>
            {showInstagram ? (
              <SecondaryButton href={company.instagramUrl} onDark>
                {contactCopy.instagramButton}
              </SecondaryButton>
            ) : null}
          </div>

          {showEmail ? (
            <a
              href={`mailto:${company.email}`}
              className="mt-5 inline-block text-sm text-acid-lime underline-offset-4 hover:underline"
            >
              {company.email}
            </a>
          ) : (
            <p className="mt-5 inline-flex items-center gap-2 text-sm text-soft-grey">
              <span
                className="size-1.5 shrink-0 rounded-full bg-acid-lime shadow-[0_0_10px_rgba(198,255,0,0.35)]"
                aria-hidden="true"
              />
              {contactCopy.availability}
            </p>
          )}

          {socialLinks.length > 0 ? (
            <ul className="mt-5 flex flex-wrap gap-4">
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
        </Reveal>
      </Container>
    </section>
  );
}
