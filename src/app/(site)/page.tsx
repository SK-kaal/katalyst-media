import { HashScroll } from "@/components/home/HashScroll";
import { HomeEnding } from "@/components/home/HomeEnding";
import { OverviewSection } from "@/components/home/OverviewSection";
import { ProcessSection } from "@/components/home/ProcessSection";
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
      <ProcessSection />
      <HomeEnding />
    </>
  );
}
