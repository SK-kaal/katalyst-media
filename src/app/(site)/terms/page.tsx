import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { PageHero } from "@/components/ui/PageHero";
import { company, hasPublicEmail } from "@/content/company";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "Terms and Conditions",
  description:
    "Website terms of use for Katalyst Media, covering site use, enquiries and service information.",
  path: "/terms",
});

const LAST_UPDATED = "26 August 2026";

function ContactMethod() {
  if (hasPublicEmail()) {
    return (
      <>
        email at{" "}
        <a
          href={`mailto:${company.email}`}
          className="text-off-white underline underline-offset-4 transition-colors hover:text-acid-lime"
        >
          {company.email}
        </a>
        , or through the Contact / Get In Touch section on this website
      </>
    );
  }

  return (
    <>
      the Contact / Get In Touch section on this website at{" "}
      <Link
        href="/#contact"
        className="text-off-white underline underline-offset-4 transition-colors hover:text-acid-lime"
      >
        katalystmedia.xyz/#contact
      </Link>
    </>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28 space-y-4">
      <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] text-acid-lime md:text-[1.65rem]">
        {title}
      </h2>
      <div className="space-y-4 text-[0.975rem] leading-[1.75] text-soft-grey [&_a]:text-off-white [&_a]:underline [&_a]:underline-offset-4 [&_a]:transition-colors hover:[&_a]:text-acid-lime [&_li]:leading-[1.7] [&_strong]:font-medium [&_strong]:text-off-white [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <>
      <PageHero
        eyebrow="Legal"
        title="Terms & Conditions"
        description="Website terms of use for the Katalyst Media site and the information published on it."
      >
        <p className="text-sm text-muted-grey">Last updated: {LAST_UPDATED}</p>
      </PageHero>

      <section className="section-pad bg-carbon">
        <Container className="max-w-3xl space-y-12 md:space-y-14">
          <Section id="terms" title="1. Terms & Conditions">
            <p>
              These Terms & Conditions (“Terms”) govern your use of the{" "}
              {company.name} website at{" "}
              <a href={company.url}>{company.url.replace(/^https?:\/\//, "")}</a>{" "}
              (the “website”).
            </p>
            <p>
              By using the website, you agree to these Terms. If you do not agree,
              please do not use the website.
            </p>
          </Section>

          <Section id="about-these-terms" title="2. About these terms">
            <p>
              These are website terms. They explain how you may use this site and
              how to treat the information published on it.
            </p>
            <p>
              They are not a full client services agreement. If you engage{" "}
              {company.name} for campaign or marketing work, that engagement will be
              governed by separate written terms covering scope, pricing,
              deliverables and responsibilities.
            </p>
          </Section>

          <Section id="about" title="3. About Katalyst Media">
            <p>
              {company.name} is a music marketing business based in the United
              Kingdom. We work with artists, producers, managers and labels on
              release-focused campaigns.
            </p>
            <p>Services described on the website may include:</p>
            <ul>
              <li>creator campaigns</li>
              <li>paid media</li>
              <li>release strategy</li>
              <li>campaign management</li>
              <li>content and social support</li>
              <li>social media marketing</li>
              <li>DSP pitching and release support, where applicable</li>
            </ul>
            <p>
              The exact services available for any project depend on what is agreed
              for that engagement.
            </p>
          </Section>

          <Section id="using-website" title="4. Using this website">
            <p>You agree to use the website only for lawful purposes. You must not:</p>
            <ul>
              <li>attempt to disrupt, damage or gain unauthorised access to the website or related systems</li>
              <li>use the website to send harmful, deceptive or unlawful material</li>
              <li>misuse any contact or enquiry route provided on the site</li>
              <li>
                copy, scrape or reuse site materials in a way that infringes our
                rights or the rights of others, except as allowed by law or with
                permission
              </li>
            </ul>
          </Section>

          <Section id="information" title="5. Information on the website">
            <p>
              Content on this website is provided for general information about{" "}
              {company.name} and the kinds of services we offer. It is not advice
              tailored to your specific circumstances.
            </p>
            <p>
              We aim to keep information accurate and up to date, but we do not
              warrant that every detail on the website is complete, current or
              error-free at all times.
            </p>
          </Section>

          <Section id="services" title="6. Services described on the website">
            <p>
              Descriptions of services, process steps and campaign approaches are
              illustrative. They explain how we typically work and do not create a
              commitment to provide any particular service, price, timeline or
              outcome unless confirmed separately in writing.
            </p>
            <p>
              Availability of specific services (including DSP pitching or paid
              media activity on particular platforms) may depend on the project,
              budget, creative assets and platform rules at the time.
            </p>
          </Section>

          <Section id="enquiries" title="7. Enquiries and potential engagements">
            <p>
              The website includes a Contact section and a Get In Touch call to
              action so you can get in touch about possible work.
            </p>
            <p>Please note:</p>
            <ul>
              <li>submitting an enquiry does not create a contract</li>
              <li>
                discussing a campaign does not guarantee that we will accept the
                project
              </li>
              <li>
                campaign scope, pricing, deliverables and obligations would be
                agreed separately
              </li>
              <li>
                separate written terms may apply to any client work that goes ahead
              </li>
            </ul>
            <p>
              Until those terms are agreed, communications remain exploratory.
            </p>
          </Section>

          <Section
            id="no-guarantee"
            title="8. No guarantee of campaign or commercial results"
          >
            <p>
              Music marketing outcomes depend on many factors outside anyone’s full
              control. {company.name} does not guarantee results such as:
            </p>
            <ul>
              <li>views</li>
              <li>streams</li>
              <li>followers</li>
              <li>engagement</li>
              <li>playlist placements</li>
              <li>chart positions</li>
              <li>sales</li>
              <li>revenue</li>
              <li>virality</li>
              <li>platform performance</li>
            </ul>
            <p>Performance can depend on factors including:</p>
            <ul>
              <li>audience response</li>
              <li>platform algorithms</li>
              <li>advertising platforms and their policies</li>
              <li>third-party creators, partners and tools</li>
              <li>market conditions and timing</li>
              <li>creative performance and available assets</li>
              <li>budget and campaign duration</li>
            </ul>
            <p>
              Any examples, case-style references or video content on the website
              are illustrative and should not be treated as a promise of similar
              results.
            </p>
          </Section>

          <Section
            id="third-party-platforms"
            title="9. Third-party platforms and services"
          >
            <p>
              Our work and this website may refer to or display content connected
              with third-party platforms and services, including TikTok, Instagram /
              Meta, Spotify, YouTube and other digital service providers (DSPs).
            </p>
            <p>Those services are operated by third parties. This means:</p>
            <ul>
              <li>their availability, features and policies may change</li>
              <li>
                {company.name} does not control their platforms, algorithms or
                moderation decisions
              </li>
              <li>
                use of those services is also subject to their own terms and
                policies
              </li>
            </ul>
            <p>
              Mention of a platform, creator or artist does not, by itself, mean
              endorsement by that platform, creator or artist.
            </p>
          </Section>

          <Section id="ip" title="10. Intellectual property">
            <p>
              Unless otherwise stated, the following are protected intellectual
              property of {company.name} or our licensors:
            </p>
            <ul>
              <li>website design and layout</li>
              <li>Katalyst Media branding and wordmark</li>
              <li>original copy written for this website</li>
              <li>original graphics and site presentation</li>
              <li>other original site content we create</li>
            </ul>
            <p>
              You may view the website for personal or internal business
              information purposes. You may not copy, adapt, distribute or
              commercially exploit our original site materials without permission,
              except where the law allows.
            </p>
            <p>
              This does <strong>not</strong> mean {company.name} owns third-party
              creator videos, platform logos, music, artist images, trademarks or
              other third-party content that may appear or be referenced on the
              site. Those rights remain with the relevant owners or licensees.
            </p>
          </Section>

          <Section id="user-submitted" title="11. User-submitted information">
            <p>
              If you contact us or send information in an enquiry, you are
              responsible for ensuring that what you send is accurate, lawful and
              something you are entitled to share.
            </p>
            <p>
              Do not send confidential material unless you are comfortable doing so
              and it is needed for your enquiry. We will handle enquiry information
              as described in our{" "}
              <Link href="/privacy">Privacy Policy</Link>.
            </p>
          </Section>

          <Section
            id="external-links"
            title="12. External links and embedded content"
          >
            <p>
              The website may include links to external sites and may display
              third-party media or branding for illustrative purposes. Ownership of
              third-party content remains with the relevant rights holders.
            </p>
            <p>
              We are not responsible for the content, availability or practices of
              external websites or platforms. Following an external link is at your
              own discretion.
            </p>
            <p>
              Short-form video examples on the homepage are generally delivered
              through this website rather than as live third-party embed players.
              Even so, any linked platform remains under that platform’s control.
            </p>
          </Section>

          <Section id="availability" title="13. Website availability">
            <p>
              We aim to keep the website available, but we do not guarantee
              uninterrupted access. The site may be unavailable from time to time
              because of maintenance, updates, hosting issues, or events outside
              our reasonable control.
            </p>
          </Section>

          <Section id="liability" title="14. Limitation of liability">
            <p>
              Nothing in these Terms excludes or limits liability that cannot
              lawfully be excluded or limited under the law of England and Wales,
              including liability for death or personal injury caused by negligence,
              or for fraud or fraudulent misrepresentation.
            </p>
            <p>
              Subject to that, to the fullest extent permitted by law:
            </p>
            <ul>
              <li>
                the website and its content are provided on an “as is” and “as
                available” basis
              </li>
              <li>
                we are not liable for loss arising from reliance on general
                information published on the website
              </li>
              <li>
                we are not responsible for third-party websites, platforms,
                services or content
              </li>
              <li>
                we are not liable for temporary unavailability of the website or
                for issues caused by events outside our reasonable control
              </li>
            </ul>
            <p>
              If you are a consumer, nothing in these Terms affects rights you
              cannot contract out of.
            </p>
          </Section>

          <Section id="indemnity" title="15. Indemnity">
            <p>
              If you misuse the website or submit unlawful or infringing material
              through an enquiry channel, you agree to reimburse {company.name} for
              reasonable losses, costs or claims that arise directly from that
              misuse, to the extent permitted by law.
            </p>
          </Section>

          <Section id="changes-website" title="16. Changes to the website">
            <p>
              We may update, amend or remove website content, features or services
              descriptions at any time without prior notice.
            </p>
          </Section>

          <Section id="changes-terms" title="17. Changes to these terms">
            <p>
              We may update these Terms from time to time. The latest version will
              be published on this page with the “Last updated” date shown above.
              Continued use of the website after changes are posted means you accept
              the updated Terms.
            </p>
          </Section>

          <Section id="governing-law" title="18. Governing law">
            <p>
              These Terms, and any dispute or claim arising out of or in connection
              with them or the website (including non-contractual disputes or
              claims), are governed by the law of England and Wales.
            </p>
            <p>
              The courts of England and Wales shall have exclusive jurisdiction,
              without prejudice to any mandatory consumer protections that may apply
              if you are a consumer living elsewhere.
            </p>
          </Section>

          <Section id="contact" title="19. Contact">
            <p>
              Questions about these Terms can be sent to {company.name} via{" "}
              <ContactMethod />.
            </p>
            <p>
              For how we handle personal information, see our{" "}
              <Link href="/privacy">Privacy Policy</Link>.
            </p>
          </Section>
        </Container>
      </section>
    </>
  );
}
