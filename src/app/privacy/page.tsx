import { Container } from "@/components/layout/Container";
import { PageHero } from "@/components/ui/PageHero";
import { company, hasPublicEmail } from "@/content/company";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "Privacy Policy",
  description: "Privacy notice for Katalyst Media website visitors and contact enquiries.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <>
      <PageHero
        eyebrow="Legal"
        title="Privacy Policy"
        description="How Katalyst Media handles information related to this website and contact enquiries."
      />
      <section className="section-pad bg-carbon">
        <Container className="max-w-3xl space-y-8 text-soft-grey">
          <div>
            <h2 className="font-display text-2xl font-semibold text-off-white">Who we are</h2>
            <p className="mt-3 leading-relaxed">
              {company.name} operates this website
              {hasPublicEmail() ? (
                <>
                  {" "}
                  and can be contacted at{" "}
                  <a
                    href={`mailto:${company.email}`}
                    className="text-off-white underline underline-offset-4"
                  >
                    {company.email}
                  </a>
                </>
              ) : null}
              . We help independent artists promote their music through music marketing,
              creator campaigns, short-form content, release strategy and paid advertising.
            </p>
          </div>

          <div>
            <h2 className="font-display text-2xl font-semibold text-off-white">
              Information we may receive
            </h2>
            <p className="mt-3 leading-relaxed">
              {company.name} may receive information when someone contacts the business through
              email, social media or another published contact method. That information may
              include:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed">
              <li>Name</li>
              <li>Email address</li>
              <li>Social-media information</li>
              <li>Message content</li>
              <li>Information voluntarily provided</li>
            </ul>
            <p className="mt-3 leading-relaxed">
              Server logs may also record basic technical data required to operate the site
              securely.
            </p>
          </div>

          <div>
            <h2 className="font-display text-2xl font-semibold text-off-white">
              How we use information
            </h2>
            <p className="mt-3 leading-relaxed">Information may be used to:</p>
            <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed">
              <li>Respond to enquiries</li>
              <li>Discuss potential services</li>
              <li>Communicate about possible work</li>
              <li>Maintain necessary business correspondence</li>
            </ul>
            <p className="mt-3 leading-relaxed">We do not sell personal information.</p>
          </div>

          <div>
            <h2 className="font-display text-2xl font-semibold text-off-white">Retention</h2>
            <p className="mt-3 leading-relaxed">
              Correspondence is retained only for as long as needed to manage the conversation
              and maintain reasonable business records, unless a longer period is required by
              law.
            </p>
          </div>

          <div>
            <h2 className="font-display text-2xl font-semibold text-off-white">Your rights</h2>
            <p className="mt-3 leading-relaxed">
              Depending on applicable law, you may request access to, correction of, or
              deletion of personal information we hold about you. Contact {company.name}
              {hasPublicEmail() ? (
                <>
                  {" "}
                  at{" "}
                  <a
                    href={`mailto:${company.email}`}
                    className="text-off-white underline underline-offset-4"
                  >
                    {company.email}
                  </a>
                </>
              ) : (
                <> through the Contact section on this website once contact details are published</>
              )}{" "}
              to make a request.
            </p>
          </div>

          <div>
            <h2 className="font-display text-2xl font-semibold text-off-white">Updates</h2>
            <p className="mt-3 leading-relaxed">
              This notice may be updated as the website or operating practices change. The
              latest version will always be available on this page.
            </p>
          </div>
        </Container>
      </section>
    </>
  );
}
