import { ContactSection } from "@/components/home/ContactSection";
import { HashScroll } from "@/components/home/HashScroll";
import { OverviewSection } from "@/components/home/OverviewSection";
import { ProcessSection } from "@/components/home/ProcessSection";
import { ServicesSection } from "@/components/home/ServicesSection";
import { company } from "@/content/company";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: company.pageTitle,
  description: company.description,
  path: "/",
});

export default function HomePage() {
  return (
    <>
      <HashScroll />
      <OverviewSection />
      <ServicesSection />
      <ProcessSection />
      <ContactSection />
    </>
  );
}
