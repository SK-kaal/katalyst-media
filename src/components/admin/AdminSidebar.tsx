"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LogOut, Menu, X } from "lucide-react";
import { Wordmark } from "@/components/ui/Wordmark";
import { logoutAdmin } from "@/lib/admin-auth/actions";
import { cn } from "@/lib/utils";

const nav = [
  { number: "01", label: "Campaigns", href: "/admin" },
  { number: "02", label: "Clients", href: "/admin/clients" },
] as const;

function AdminNavLinks({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="admin-sidebar__nav" aria-label="Admin">
      {nav.map((item) => {
        const active =
          item.href === "/admin"
            ? pathname === "/admin" || pathname.startsWith("/admin/campaigns")
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className="admin-sidebar__link"
            onClick={onNavigate}
          >
            <span className="admin-sidebar__index">{item.number}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function LogoutButton({ className }: { className?: string }) {
  return (
    <form action={logoutAdmin} className={className}>
      <button type="submit" className="admin-btn admin-btn--ghost w-full">
        <LogOut className="size-3.5" aria-hidden="true" />
        Log out
      </button>
    </form>
  );
}

export function AdminSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <aside className="admin-sidebar" aria-label="Admin sidebar">
        <div className="admin-sidebar__brand">
          <Wordmark className="text-[0.95rem] tracking-[0.12em]" />
          <p className="admin-sidebar__eyebrow label-caps">Private Portal</p>
        </div>
        <AdminNavLinks pathname={pathname} />
        <div className="admin-sidebar__foot">
          <p className="admin-sidebar__user">Authorised access</p>
          <LogoutButton />
        </div>
      </aside>

      <div className="admin-mobile-bar">
        <div>
          <Wordmark className="text-[0.82rem] tracking-[0.12em]" />
          <p className="mt-1 text-[0.58rem] uppercase tracking-[0.14em] text-acid-lime">
            Private Portal
          </p>
        </div>
        <button
          type="button"
          className="admin-btn admin-btn--ghost size-10 p-0"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X className="size-4" /> : <Menu className="size-4" />}
        </button>
      </div>

      {open ? (
        <div className="mb-4 rounded-[12px] border border-white/10 bg-carbon p-3 lg:hidden">
          <AdminNavLinks pathname={pathname} onNavigate={() => setOpen(false)} />
          <div className="mt-3 border-t border-white/10 pt-3">
            <p className="admin-sidebar__user">Authorised access</p>
            <LogoutButton />
          </div>
        </div>
      ) : null}
    </>
  );
}

export function StatusBadge({
  status,
  className,
}: {
  status: "draft" | "live" | "paused" | "closed" | "in_progress";
  className?: string;
}) {
  const normalized =
    status === "in_progress" ? "draft" : (status as "draft" | "live" | "paused" | "closed");
  const label =
    normalized === "live"
      ? "Live"
      : normalized === "paused"
        ? "Paused"
        : normalized === "closed"
          ? "Closed"
          : "Draft";

  return (
    <span className={cn("admin-status", `admin-status--${normalized}`, className)}>
      {label}
    </span>
  );
}
