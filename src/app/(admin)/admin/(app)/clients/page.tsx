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
  searchParams: Promise<{ q?: string; new?: string }>;
}) {
  const { q = "", new: showNew } = await searchParams;
  const supabase = await createAdminClient();
  const { data: clients } = await supabase
    .from("clients")
    .select(
      "*, campaigns(id, release_title, sound_title, status, updated_at, tiktok_posts(views, likes, comments, shares))",
    )
    .order("name");

  const filtered = (clients ?? []).filter((client) => {
    if (!q.trim()) return true;
    const hay = `${client.name} ${client.handle ?? ""}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });

  return (
    <div>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="admin-page-eyebrow">Clients</p>
          <h1 className="admin-page-title">Clients</h1>
          <p className="admin-page-desc">Artists and client accounts.</p>
        </div>
        <Link href="/admin/clients?new=1#add-client" className="admin-btn admin-btn--primary">
          <Plus className="size-3.5" />
          Add Client
        </Link>
      </div>

      <form method="get" className="mt-5 max-w-md">
        <input
          className="admin-input"
          name="q"
          defaultValue={q}
          placeholder="Search clients…"
          aria-label="Search clients"
        />
      </form>

      {filtered.length === 0 ? (
        <div className="admin-empty mt-8">
          <p className="font-display text-lg font-semibold">No clients yet</p>
          <p className="mt-2 text-sm text-soft-grey">
            Create your first client to start building campaigns.
          </p>
          <Link href="/admin/clients?new=1#add-client" className="admin-btn admin-btn--primary mt-4">
            + Create Client
          </Link>
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
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((client) => {
                const campaigns = Array.isArray(client.campaigns)
                  ? client.campaigns
                  : [];
                const latest = [...campaigns].sort(
                  (a, b) => +new Date(b.updated_at) - +new Date(a.updated_at),
                )[0];
                const allPosts = campaigns.flatMap((c) =>
                  Array.isArray(c.tiktok_posts) ? c.tiktok_posts : [],
                );
                const metrics = calculateMetrics(allPosts);
                return (
                  <tr key={client.id}>
                    <td>
                      <div className="flex items-center gap-3">
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
                          <p className="font-semibold text-off-white">
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
                          <p>{latest.sound_title || latest.release_title}</p>
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
                    <td>
                      <Link
                        href={`/admin/clients/${client.id}`}
                        className="text-sm font-semibold text-acid-lime"
                      >
                        Open Profile →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {(showNew || filtered.length === 0) && (
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
