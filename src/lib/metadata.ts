import type { Metadata } from "next";
import { company, getSocialLinks } from "@/content/company";

const siteUrl = company.url;

export function createMetadata({
  title,
  description,
  path = "/",
  type = "website",
}: {
  title: string;
  description: string;
  path?: string;
  type?: "website" | "article";
}): Metadata {
  const url = `${siteUrl}${path}`;
  const absoluteTitle =
    title === company.name || title === company.pageTitle
      ? company.pageTitle
      : `${title} | ${company.name}`;

  return {
    title: absoluteTitle,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: absoluteTitle,
      description,
      url,
      siteName: company.name,
      type,
      locale: "en_GB",
    },
    twitter: {
      card: "summary_large_image",
      title: absoluteTitle,
      description,
    },
  };
}

const sameAs = getSocialLinks().map((link) => link.href);

export const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: company.name,
  url: siteUrl,
  description: company.description,
  ...(company.email ? { email: company.email } : {}),
  ...(sameAs.length > 0 ? { sameAs } : {}),
};
