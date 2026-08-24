export const company = {
  name: "Katalyst Media",
  legalName: "Katalyst Media",
  tagline: "Put your music in front of the right people.",
  positioning:
    "Creator campaigns, paid media and release strategy for artists, producers, managers and labels.",
  heroEyebrow: "For artists, producers, managers and labels",
  heroSupport:
    "Creator campaigns, paid media and release strategy for artists, producers, managers and labels.",
  sidebarEyebrow: "Music marketing for artists, producers, managers & labels",
  sidebarDescription: "Creator campaigns, paid media & release strategy.",
  description:
    "Katalyst Media builds and manages release campaigns through creator marketing, paid media, content and release strategy.",
  focusLabel: "What we do",
  location: "United Kingdom",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.katalystmedia.xyz",
  pageTitle: "Katalyst Media | Music Marketing for Artists & Labels",
  email: (process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "").trim(),
  instagramUrl: (process.env.NEXT_PUBLIC_INSTAGRAM_URL ?? "").trim(),
  linkedinUrl: (process.env.NEXT_PUBLIC_LINKEDIN_URL ?? "").trim(),
} as const;

export type SocialLink = {
  label: string;
  href: string;
};

export function getSocialLinks(): SocialLink[] {
  const links: SocialLink[] = [];
  if (company.instagramUrl) {
    links.push({ label: "Instagram", href: company.instagramUrl });
  }
  if (company.linkedinUrl) {
    links.push({ label: "LinkedIn", href: company.linkedinUrl });
  }
  return links;
}

export function hasPublicEmail() {
  return Boolean(company.email);
}

export function hasInstagram() {
  return Boolean(company.instagramUrl);
}

export function getMailtoHref() {
  if (!company.email) return "/";
  return `mailto:${company.email}`;
}

/**
 * Primary conversion destination for contact CTAs.
 * Prefers mailto when NEXT_PUBLIC_CONTACT_EMAIL is set; otherwise Contact section.
 */
export function getPrimaryContactHref() {
  if (company.email) return `mailto:${company.email}`;
  return "#contact";
}
