export type NavItem = {
  number: string;
  label: string;
  href: string;
  id: string;
};

export const primaryNav: NavItem[] = [
  { number: "01", label: "Homepage", href: "/#overview", id: "overview" },
  { number: "02", label: "Services", href: "/#services", id: "services" },
  { number: "03", label: "Process", href: "/#process", id: "process" },
  { number: "04", label: "Contact", href: "/#contact", id: "contact" },
];

export const footerNav = [
  { label: "Services", href: "/#services" },
  { label: "Process", href: "/#process" },
  { label: "Contact", href: "/#contact" },
] as const;

export const legalNav = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms and Conditions", href: "/terms" },
] as const;

export const sectionIds = primaryNav.map((item) => item.id);

export const primaryCta = {
  label: "Get In Touch",
  href: "/",
  id: "contact",
} as const;
