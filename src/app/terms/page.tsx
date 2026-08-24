import { Container } from "@/components/layout/Container";
import { PageHero } from "@/components/ui/PageHero";
import { company, hasPublicEmail } from "@/content/company";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "Terms and Conditions",
  description: "Website terms of use for Katalyst Media.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <>
      <PageHero
        eyebrow="Legal"
        title="Terms and Conditions"
        description="Terms of use for the Katalyst Media website and service information."
      />
      <section className="section-pad bg-carbon">
        <Container className="max-w-3xl space-y-8 text-soft-grey">
          <div>
            <h2 className="font-display text-2xl font-semibold text-off-white">
              Website purpose
            </h2>
            <p className="mt-3 leading-relaxed">
              This website describes music marketing services offered by {company.name}.
              Those services may include:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed">
              <li>Music marketing</li>
              <li>Creator campaigns</li>
              <li>Paid advertising</li>
              <li>Short-form content</li>
              <li>Creative direction</li>
              <li>Release strategy</li>
              <li>Social media marketing</li>
              <li>Campaign management</li>
              <li>Reporting</li>
            </ul>
            <p className="mt-3 leading-relaxed">
              Information on this website is provided for general guidance and does not form
              a binding offer unless confirmed separately in writing.
            </p>
          </div>

          <div>
            <h2 className="font-display text-2xl font-semibold text-off-white">
              No performance guarantees
            </h2>
            <p className="mt-3 leading-relaxed">{company.name} does not guarantee:</p>
            <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed">
              <li>Viral performance</li>
              <li>A specific number of views</li>
              <li>A specific number of streams</li>
              <li>Follower growth</li>
              <li>Revenue</li>
              <li>Playlist placement</li>
              <li>Record-label attention</li>
              <li>Specific advertising performance</li>
            </ul>
            <p className="mt-3 leading-relaxed">
              Campaign outcomes can depend on factors including the music, creative material,
              audience response, budget, platform performance, market conditions, timing and
              campaign duration.
            </p>
          </div>

          <div>
            <h2 className="font-display text-2xl font-semibold text-off-white">
              Intellectual property
            </h2>
            <p className="mt-3 leading-relaxed">
              Branding, copy, design and other materials on this site remain the property of{" "}
              {company.name} unless otherwise stated. You may not copy or reuse site materials
              without permission.
            </p>
          </div>

          <div>
            <h2 className="font-display text-2xl font-semibold text-off-white">
              Third-party links
            </h2>
            <p className="mt-3 leading-relaxed">
              This website may link to third-party platforms or resources. {company.name} is
              not responsible for the content or practices of external sites.
            </p>
          </div>

          <div>
            <h2 className="font-display text-2xl font-semibold text-off-white">Contact</h2>
            <p className="mt-3 leading-relaxed">
              Questions about these terms can be sent to {company.name}
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
                " through the Contact section on this website once contact details are published"
              )}
              .
            </p>
          </div>
        </Container>
      </section>
    </>
  );
}
