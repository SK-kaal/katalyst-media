import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { PageHero } from "@/components/ui/PageHero";
import { company, hasPublicEmail } from "@/content/company";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "Privacy Policy",
  description:
    "Privacy Policy for the Katalyst Media website, covering enquiries, technical information and third-party content.",
  path: "/privacy",
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

export default function PrivacyPage() {
  return (
    <>
      <PageHero
        eyebrow="Legal"
        title="Privacy Policy"
        description="How Katalyst Media handles personal information in connection with this website and business enquiries."
      >
        <p className="text-sm text-muted-grey">Last updated: {LAST_UPDATED}</p>
      </PageHero>

      <section className="section-pad bg-carbon">
        <Container className="max-w-3xl space-y-12 md:space-y-14">
          <Section id="privacy-policy" title="1. Privacy Policy">
            <p>
              This Privacy Policy explains how {company.name} (“we”, “us” or “our”)
              handles personal information when you visit{" "}
              <a href={company.url}>{company.url.replace(/^https?:\/\//, "")}</a>{" "}
              (the “website”) or contact us about our services.
            </p>
            <p>
              It is written for visitors and enquirers in the United Kingdom and is
              intended to be clear rather than overly legalistic. It applies to this
              website and to ordinary business communications connected with
              enquiries made through it.
            </p>
          </Section>

          <Section id="about" title="2. About Katalyst Media">
            <p>
              {company.name} is a music marketing business based in the United
              Kingdom. We help artists, producers, managers and labels promote
              releases through services such as:
            </p>
            <ul>
              <li>creator campaigns</li>
              <li>paid media</li>
              <li>release strategy</li>
              <li>content and campaign support</li>
              <li>social media marketing</li>
              <li>DSP pitching and wider release support, where agreed</li>
            </ul>
            <p>
              Further detail about what we offer appears on the Process and Contact
              sections of the website.
            </p>
          </Section>

          <Section id="information-we-collect" title="3. Information we collect">
            <p>
              We do not operate an account system or store enquiry submissions in a
              website database. The personal information we receive is generally
              limited to what people choose to share when getting in touch, together
              with basic technical information created when the website is used.
            </p>
            <p>Depending on how you contact us, this may include:</p>
            <ul>
              <li>name</li>
              <li>email address</li>
              <li>phone number, if you choose to provide one</li>
              <li>artist, company, label or project information</li>
              <li>details included in an enquiry or message</li>
              <li>related correspondence</li>
              <li>
                basic technical information such as IP address, browser or device
                information, request URLs, and similar server or hosting logs
                generated when you visit the website
              </li>
            </ul>
            <p>
              We do not currently use website analytics tools that create marketing
              profiles of visitors, and we do not knowingly collect special category
              personal data through this website.
            </p>
          </Section>

          <Section id="how-we-collect" title="4. How we collect information">
            <p>We may collect information:</p>
            <ul>
              <li>
                directly from you when you contact us through the website Contact /
                Get In Touch route, email (where published), or another contact
                method you choose to use
              </li>
              <li>
                automatically through ordinary website operation and hosting, such
                as server request logs
              </li>
              <li>
                from correspondence you send us in connection with a potential or
                ongoing campaign discussion
              </li>
            </ul>
            <p>
              Enquiry details are provided voluntarily. You do not need to create an
              account to browse the website.
            </p>
          </Section>

          <Section id="how-we-use" title="5. How we use personal information">
            <p>We use personal information where reasonably necessary to:</p>
            <ul>
              <li>respond to enquiries</li>
              <li>discuss potential campaigns or services</li>
              <li>provide services that have been requested or agreed</li>
              <li>manage ordinary business communications</li>
              <li>operate, maintain and improve the website</li>
              <li>help keep the website secure and diagnose technical issues</li>
              <li>comply with legal obligations where they apply</li>
            </ul>
            <p>
              We do not use this website to run an automated marketing email list,
              and we do not sell personal information.
            </p>
          </Section>

          <Section id="lawful-bases" title="6. Lawful bases for processing">
            <p>
              Where UK GDPR applies, we rely on the lawful basis that best matches
              the activity, for example:
            </p>
            <ul>
              <li>
                <strong>Legitimate interests</strong> — responding to business
                enquiries, operating and securing the website, and keeping ordinary
                business records, where this does not override your rights
              </li>
              <li>
                <strong>Steps at your request before a contract</strong> —
                discussing a potential campaign after you get in touch
              </li>
              <li>
                <strong>Performance of a contract</strong> — where we have agreed to
                provide services to you
              </li>
              <li>
                <strong>Legal obligation</strong> — where we must retain or disclose
                information to comply with the law
              </li>
              <li>
                <strong>Consent</strong> — only where consent is specifically
                required (for example, for a non-essential cookie or similar
                technology, if one is introduced)
              </li>
            </ul>
            <p>
              We do not rely on consent for every activity described in this policy.
            </p>
          </Section>

          <Section id="enquiries" title="7. Enquiries and communications">
            <p>
              The website includes a Contact section with a Get In Touch call to
              action. Depending on how the site is configured, that may open your
              email client or take you to the Contact section so you can get in
              touch.
            </p>
            <p>
              There is no contact form that stores submissions in our application
              database. If you email or message us, the information you include will
              be handled as ordinary business correspondence so we can reply and,
              where relevant, discuss possible work.
            </p>
            <p>
              Submitting an enquiry or starting a conversation does not, by itself,
              create a client contract. Separate terms would apply to any agreed
              campaign work.
            </p>
          </Section>

          <Section
            id="analytics"
            title="8. Website analytics and technical information"
          >
            <p>
              At the time of writing, this website does not use Google Analytics,
              Meta Pixel, or similar third-party analytics or advertising pixels.
            </p>
            <p>
              Like most websites, the hosting environment may generate technical
              logs when pages or media are requested. Those logs can include items
              such as IP address, browser user-agent, requested path, and timing
              information. They are used for operating, securing and troubleshooting
              the website rather than for advertising profiling.
            </p>
            <p>
              The site may also use the browser’s session storage for limited
              functional purposes (for example, remembering a section to scroll to
              after navigation). That is not used to build marketing profiles.
            </p>
          </Section>

          <Section
            id="third-party-content"
            title="9. TikTok / Instagram / third-party content"
          >
            <p>
              The homepage may show short-form video examples associated with
              platforms such as TikTok and Instagram. Those examples are generally
              delivered through our own website as HTML5 video media (including via
              first-party media routes on this site), rather than as live TikTok or
              Instagram embed players loaded in your browser.
            </p>
            <p>
              That means viewing those examples on this website does not, by itself,
              mean TikTok or Instagram receive the same kind of visitor interaction
              data that their official embed widgets would typically collect.
              Behind the scenes, our servers may retrieve media from third-party
              sources in order to display it.
            </p>
            <p>
              The website may still refer to, link to, or display branding or
              content connected with third-party platforms (including TikTok,
              Instagram / Meta, Spotify, YouTube and music streaming services). If
              you follow a link to an external platform, that platform’s own privacy
              notice and terms will apply.
            </p>
            <p>
              Ownership of third-party creator videos, music, trademarks and platform
              branding remains with the relevant rights holders.
            </p>
          </Section>

          <Section id="cookies" title="10. Cookies and similar technologies">
            <p>
              Based on the current website implementation, we do not set our own
              non-essential analytics or advertising cookies, and there is no cookie
              consent banner because we are not presently using non-essential
              tracking cookies for marketing analytics.
            </p>
            <p>
              Your browser or our hosting provider may still use strictly necessary
              or technical mechanisms needed to deliver pages securely and reliably.
              The site may also use session storage for limited functional
              navigation behaviour, as described above.
            </p>
            <p>
              If we later introduce non-essential cookies or similar tracking
              technologies, we will update this policy and, where required, provide
              an appropriate consent mechanism.
            </p>
            <p>
              You can usually control cookies through your browser settings. Blocking
              some cookies may affect how websites work.
            </p>
          </Section>

          <Section id="sharing" title="11. Sharing information with third parties">
            <p>
              We do not sell personal information. We may share information only
              where needed for the purposes described in this policy, for example
              with:
            </p>
            <ul>
              <li>website hosting and infrastructure providers</li>
              <li>
                email or communications providers, if you contact us by email or
                similar channels
              </li>
              <li>
                professional advisers (such as legal or accounting advisers), where
                necessary
              </li>
              <li>
                authorities, courts or regulators where we are legally required to
                do so
              </li>
            </ul>
            <p>
              Any service providers we use are expected to handle personal
              information only as needed to provide their services to us.
            </p>
          </Section>

          <Section
            id="international-transfers"
            title="12. International data transfers"
          >
            <p>
              Some service providers that help us operate the website or
              communications (including hosting infrastructure) may process
              information outside the United Kingdom.
            </p>
            <p>
              Where personal information is transferred internationally and UK data
              protection law requires it, we take steps to ensure appropriate
              safeguards are in place. The exact mechanism can depend on the
              provider and the circumstances.
            </p>
          </Section>

          <Section id="retention" title="13. How long information is retained">
            <p>
              We keep personal information only for as long as reasonably necessary
              for the purpose it was collected, including to:
            </p>
            <ul>
              <li>handle enquiries</li>
              <li>manage business relationships</li>
              <li>meet contractual or legal obligations</li>
              <li>deal with disputes or complaints</li>
              <li>maintain security and technical records</li>
            </ul>
            <p>
              Retention periods vary with the type of information and the nature of
              the relationship. Hosting and security logs are typically kept for a
              shorter operational period; enquiry correspondence may be kept for
              longer as part of ordinary business records.
            </p>
          </Section>

          <Section id="security" title="14. Data security">
            <p>
              We take reasonable technical and organisational steps to help protect
              personal information against accidental loss, unauthorised access or
              misuse. No method of transmission or storage over the internet is
              completely secure, so we cannot guarantee absolute security.
            </p>
          </Section>

          <Section id="rights" title="15. Your data protection rights">
            <p>
              Under UK data protection law, you may have rights in relation to your
              personal information, including rights to:
            </p>
            <ul>
              <li>access the personal information we hold about you</li>
              <li>request correction of inaccurate information</li>
              <li>request erasure in certain circumstances</li>
              <li>request restriction of processing in certain circumstances</li>
              <li>object to processing based on legitimate interests</li>
              <li>data portability, where applicable</li>
              <li>
                withdraw consent where we are relying on consent (this does not
                affect processing already carried out)
              </li>
            </ul>
            <p>
              These rights are not absolute. Whether a particular right applies can
              depend on the circumstances and the lawful basis we are relying on.
            </p>
            <p>
              To make a request, contact {company.name} via <ContactMethod />.
            </p>
          </Section>

          <Section id="complaints" title="16. Complaints">
            <p>
              If you have concerns about how we handle personal information, please
              contact us first so we can try to resolve the issue.
            </p>
            <p>
              You also have the right to complain to the UK Information
              Commissioner’s Office (ICO), which regulates data protection in the
              UK. Details are available at{" "}
              <a
                href="https://ico.org.uk"
                target="_blank"
                rel="noopener noreferrer"
              >
                ico.org.uk
              </a>
              .
            </p>
          </Section>

          <Section id="third-party-websites" title="17. Third-party websites">
            <p>
              This website may link to external websites or platforms. Those sites
              are outside our control. Their privacy notices and practices apply
              once you leave this website, and we are not responsible for them.
            </p>
          </Section>

          <Section id="changes" title="18. Changes to this Privacy Policy">
            <p>
              We may update this Privacy Policy from time to time, for example if
              the website, our services or our practices change. The latest version
              will always be available on this page, with the “Last updated” date
              shown above.
            </p>
          </Section>

          <Section id="contact" title="19. Contact">
            <p>
              For privacy questions or data protection requests, contact{" "}
              {company.name} via <ContactMethod />.
            </p>
            <p>
              Please do not send sensitive personal information unless it is
              necessary for your enquiry.
            </p>
          </Section>
        </Container>
      </section>
    </>
  );
}
