import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminToastProvider } from "@/components/admin/AdminToast";
import { readAdminSessionFromCookies } from "@/lib/admin-auth/guard";

export default async function AdminAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ok = await readAdminSessionFromCookies();
  if (!ok) redirect("/admin");

  return (
    <AdminToastProvider>
      <div className="admin-shell">
        <div className="admin-shell__frame">
          <AdminSidebar />
          <div className="admin-main min-w-0 flex-1">{children}</div>
        </div>
      </div>
    </AdminToastProvider>
  );
}
