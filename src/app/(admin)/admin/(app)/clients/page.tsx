import Link from "next/link";
import { Plus } from "lucide-react";
import { StatusBadge } from "@/components/admin/AdminSidebar";
import { ClientForm } from "@/components/admin/ClientForm";
import {
  calculateMetrics,
  formatCompactNumber,
} from "@/lib/portal/metrics";
import { createAdminClient } from "@/lib/admin-auth/client";
import type { CampaignStatus } from "@/lib/supabase/database.types";
import { createClientRecord } from "@/lib/portal/actions";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; new?: string; view?: string }>;
}) {
  const { q = "", new: showNew, view } = await searchParams;
  const showArchived = view === "archived";
  const supabase = await createAdminClient();
  let clientsQuery = supabase
    .from("clients")
    .select(
      "*, campaigns(id, sound_title, display_title, status, updated_at, trashed_at, tiktok_posts(views, likes, comments, shares))",
    )
    .order("name");

  if (showArchived) {
    clientsQuery = clientsQuery.not("archived_at", "is", null);
  } else {
    clientsQuery = clientsQuery.is("archived_at", null);
  }

  const { data: clients } = await clientsQuery;

  const filtered = (clients ?? []).filter((client) => {
    if (!q.trim()) return true;
    const hay = `${client.name} ${client.handle ?? ""}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });
  const hasSearch = Boolean(q.trim());

  return (
    <div>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="admin-page-eyebrow">Clients</p>
          <h1 className="admin-page-title">
            {showArchived ? "Archived Clients" : "Clients"}
          </h1>
          <p className="admin-page-desc">Artists and client accounts.</p>
        </div>
        {!showArchived ? (
          <Link
            href="/admin/clients?new=1#add-client"
            className="admin-btn admin-btn--primary"
          >
            <Plus className="size-3.5" />
            Add Client
          </Link>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <form method="get" className="max-w-md flex-1">
          {showArchived ? (
            <input type="hidden" name="view" value="archived" />
          ) : null}
          <input
            className="admin-input"
            name="q"
            defaultValue={q}
            placeholder="Search clients…"
            aria-label="Search clients"
          />
        </form>
        {hasSearch ? (
          <Link
            href={showArchived ? "/admin/clients?view=archived" : "/admin/clients"}
            className="admin-btn admin-btn--ghost"
          >
            Clear Search
          </Link>
        ) : null}
        <div className="flex gap-2">
          <Link
            href="/admin/clients"
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
              !showArchived
                ? "border-acid-lime text-acid-lime"
                : "border-white/10 text-soft-grey"
            }`}
          >
            Active
          </Link>
          <Link
            href="/admin/clients?view=archived"
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
              showArchived
                ? "border-acid-lime text-acid-lime"
                : "border-white/10 text-soft-grey"
            }`}
          >
            Archived
          </Link>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="admin-empty mt-8">
          <p className="font-display text-lg font-semibold">
            {hasSearch
              ? "No clients found"
              : showArchived
                ? "No archived clients"
                : "No clients yet"}
          </p>
          <p className="mt-2 text-sm text-soft-grey">
            {hasSearch
              ? "Try another search or clear the search."
              : showArchived
              ? "Archived clients keep campaigns and reports intact."
              : "Create your first client to start building campaigns."}
          </p>
          {hasSearch ? null : !showArchived ? (
            <Link
              href="/admin/clients?new=1#add-client"
              className="admin-btn admin-btn--primary mt-4"
            >
              + Create Client
            </Link>
          ) : (
            <Link href="/admin/clients" className="admin-btn admin-btn--ghost mt-4">
              Back to Active
            </Link>
          )}
        </div>
      ) : (
        <div className="admin-panel mt-6 overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Campaigns</th>
                <th>Tracked Views</th>
                <th>Latest</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((client) => {
                const campaigns = (
                  Array.isArray(client.campaigns) ? client.campaigns : []
                ).filter((c) => !c.trashed_at);
                const latest = [...campaigns].sort(
                  (a, b) => +new Date(b.updated_at) - +new Date(a.updated_at),
                )[0];
                const allPosts = campaigns.flatMap((c) =>
                  Array.isArray(c.tiktok_posts) ? c.tiktok_posts : [],
                );
                const metrics = calculateMetrics(allPosts);
                return (
                  <tr key={client.id} className="group">
                    <td className="relative">
                      <Link
                        href={`/admin/clients/${client.id}`}
                        className="absolute inset-0"
                        aria-label={`Open ${client.name}`}
                      />
                      <div className="pointer-events-none flex items-center gap-3">
                        <div className="size-9 overflow-hidden rounded-[6px] bg-graphite">
                          {client.profile_image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={client.profile_image_url}
                              alt=""
                              className="size-full object-cover"
                            />
                          ) : null}
                        </div>
                        <div>
                          <p className="font-semibold text-off-white group-hover:text-acid-lime">
                            {client.name}
                          </p>
                          <p className="text-xs text-muted-grey">
                            {client.handle || "—"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td>{campaigns.length}</td>
                    <td>{formatCompactNumber(metrics.views)}</td>
                    <td>
                      {latest ? (
                        <div>
                          <p>
                            {latest.display_title ||
                              latest.sound_title ||
                              "Untitled campaign"}
                          </p>
                          <div className="mt-1">
                            <StatusBadge
                              status={latest.status as CampaignStatus}
                            />
                          </div>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {(showNew ||
        (!showArchived && !hasSearch && (clients ?? []).length === 0)) && (
        <div id="add-client" className="mt-8">
          <h2 className="font-display text-lg font-semibold tracking-[-0.03em]">
            Add Client
          </h2>
          <div className="mt-3">
            <ClientForm mode="create" onSubmit={createClientRecord} />
          </div>
        </div>
      )}
    </div>
  );
}
