import type { Metadata } from "next";
import "@/components/admin/admin.css";

export const metadata: Metadata = {
  title: "Admin | Katalyst Media",
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
