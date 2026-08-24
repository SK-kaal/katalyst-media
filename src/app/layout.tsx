import { Manrope, Inter } from "next/font/google";
import type { Metadata } from "next";
import { Footer } from "@/components/layout/Footer";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { Sidebar } from "@/components/layout/Sidebar";
import { SkipToContent } from "@/components/layout/SkipToContent";
import { ActiveSectionProvider } from "@/components/providers/ActiveSectionProvider";
import { company } from "@/content/company";
import { createMetadata, organizationJsonLd } from "@/lib/metadata";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  ...createMetadata({
    title: company.pageTitle,
    description: company.description,
    path: "/",
  }),
  metadataBase: new URL(company.url),
  icons: {
    icon: [{ url: "/icon.png", sizes: "48x48", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-GB" className={`${manrope.variable} ${inter.variable} h-full`}>
      <body className="min-h-full bg-carbon font-sans text-off-white antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <ActiveSectionProvider>
          <SkipToContent />
          <Sidebar />
          <div className="flex min-h-full flex-col">
            <MobileHeader />
            <main id="main-content" className="flex-1">
              {children}
            </main>
            <Footer />
          </div>
        </ActiveSectionProvider>
      </body>
    </html>
  );
}
