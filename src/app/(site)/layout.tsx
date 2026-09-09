import { SiteFooter } from "@/components/layout/SiteFooter";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { Sidebar } from "@/components/layout/Sidebar";
import { SkipToContent } from "@/components/layout/SkipToContent";
import { ActiveSectionProvider } from "@/components/providers/ActiveSectionProvider";
import { organizationJsonLd } from "@/lib/metadata";

export default function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ActiveSectionProvider>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <SkipToContent />
      <Sidebar />
      <div className="flex min-h-full flex-col">
        <MobileHeader />
        <main id="main-content" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </div>
    </ActiveSectionProvider>
  );
}
