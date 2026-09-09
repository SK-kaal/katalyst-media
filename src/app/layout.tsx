import { Manrope, Inter } from "next/font/google";
import type { Metadata } from "next";
import { company } from "@/content/company";
import { createMetadata } from "@/lib/metadata";
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
        {children}
      </body>
    </html>
  );
}
