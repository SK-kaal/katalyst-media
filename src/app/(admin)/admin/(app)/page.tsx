import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { StatusBadge } from "@/components/admin/AdminSidebar";
import { CampaignActionsMenu } from "@/components/admin/CampaignActions";
import {
  calculateMetrics,
  campaignArtwork,
  formatCompactNumber,
  formatEngagementRate,
  formatGbp,
  formatRelativeUpdated,
} from "@/lib/portal/metrics";
import { createAdminClient } from "@/lib/admin-auth/client";
import type { CampaignStatus } from "@/lib/supabase/database.types";

type SearchParams = Promise<{
  q?: string;
  status?: string;
  sort?: string;
}>;

export default async function CampaignLibraryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const supabase = await createAdminClient();
  const q = (params.q || "").trim().toLowerCase();
  const status = params.status || "all";
  const sort = params.sort || "updated";

  const { data: campaigns } = await supabase
    .from("campaigns")
    .select(
      "*, clients(id, name, handle, profile_image_url), tiktok_posts(views, likes, comments, shares)",
    )
    .order("updated_at", { ascending: sort === "oldest" });

  let list = campaigns ?? [];

  if (sort === "newest") {
    list = [...list].sort(
      (a, b) => +new Date(b.created_at) - +new Date(a.created_at),
    );
  } else if (sort === "updated") {
    list = [...list].sort(
      (a, b) => +new Date(b.updated_at) - +new Date(a.updated_at),
    );
  }

  if (status !== "all") {
    list = list.filter((c) => c.status === status);
  }

  if (q) {
    list = list.filter((c) => {
      const client = Array.isArray(c.clients) ? c.clients[0] : c.clients;
      const hay =
        `${client?.name ?? ""} ${c.campaign_name} ${c.release_title} ${c.sound_title ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }

  const all = campaigns ?? [];
  const counts = {
    all: all.length,
    live: all.filter((c) => c.status === "live").length,
    paused: all.filter((c) => c.status === "paused").length,
    draft: all.filter((c) => c.status === "draft").length,
    closed: all.filter((c) => c.status === "closed").length,
  };

  return (
    <div>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="admin-page-eyebrow">Campaigns</p>
          <h1 className="admin-page-title">Campaign Library</h1>
          <p className="admin-page-desc">
            Manage clients, TikTok campaigns and shared reports.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <form method="get" className="relative min-w-[16rem] flex-1">
            {status !== "all" ? (
              <input type="hidden" name="status" value={status} />
            ) : null}
            {sort !== "updated" ? (
              <input type="hidden" name="sort" value={sort} />
            ) : null}
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-grey" />
            <input
              className="admin-input pl-9"
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Search artists, campaigns or clients…"
              aria-label="Search campaigns"
            />
          </form>
          <Link href="/admin/campaigns/new" className="admin-btn admin-btn--primary">
            <Plus className="size-3.5" aria-hidden="true" />
            New Campaign
          </Link>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", "All"],
              ["live", "Live"],
              ["paused", "Paused"],
              ["draft", "Draft"],
              ["closed", "Closed"],
            ] as const
          ).map(([key, label]) => (
            <Link
              key={key}
              href={`/admin?status=${key}${q ? `&q=${encodeURIComponent(q)}` : ""}${sort !== "updated" ? `&sort=${sort}` : ""}`}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                status === key
                  ? "border-acid-lime text-acid-lime"
                  : "border-white/10 text-soft-grey hover:border-white/20"
              }`}
            >
              {label} ({counts[key]})
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {[
            ["updated", "Last updated"],
            ["newest", "Newest"],
            ["oldest", "Oldest"],
          ].map(([key, label]) => (
            <Link
              key={key}
              href={`/admin?sort=${key}${status !== "all" ? `&status=${status}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={
                sort === key
                  ? "text-acid-lime"
                  : "text-muted-grey hover:text-off-white"
              }
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <div className="admin-empty mt-8">
          <p className="font-display text-lg font-semibold">
            {q || status !== "all" ? "No campaigns found" : "No campaigns yet"}
          </p>
          <p className="mt-2 text-sm text-soft-grey">
            {q || status !== "all"
              ? "Try another search or clear filters."
              : "Create a client, paste a TikTok sound URL, then add posts."}
          </p>
          {q || status !== "all" ? (
            <Link href="/admin" className="admin-btn admin-btn--ghost mt-4">
              Clear Filters
            </Link>
          ) : (
            <Link href="/admin/campaigns/new" className="admin-btn admin-btn--primary mt-4">
              + New Campaign
            </Link>
          )}
        </div>
      ) : (
        <div className="admin-campaign-grid mt-6">
          {list.map((campaign) => {
            const client = Array.isArray(campaign.clients)
              ? campaign.clients[0]
              : campaign.clients;
            const posts = Array.isArray(campaign.tiktok_posts)
              ? campaign.tiktok_posts
              : [];
            const metrics = calculateMetrics(posts);
            const art = campaignArtwork(campaign);
            return (
              <div
                key={campaign.id}
                className="admin-panel admin-campaign-card"
              >
                <Link
                  href={`/admin/campaigns/${campaign.id}`}
                  className="admin-campaign-card__thumb"
                >
                  {art ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={art} alt="" className="size-full object-cover" />
                  ) : (
                    <div className="grid size-full place-items-center text-[0.65rem] text-muted-grey">
                      TikTok
                    </div>
                  )}
                </Link>
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <StatusBadge status={campaign.status as CampaignStatus} />
                    <CampaignActionsMenu
                      campaign={campaign}
                      clientId={client?.id}
                    />
                  </div>
                  <Link
                    href={`/admin/campaigns/${campaign.id}`}
                    className="mt-2 block truncate font-display text-[1.05rem] font-semibold tracking-[-0.03em] hover:text-acid-lime"
                  >
                    {client?.name ?? campaign.sound_artist ?? "Client"}
                  </Link>
                  <p className="truncate text-sm text-soft-grey">
                    {campaign.sound_title || campaign.release_title}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[0.72rem] text-soft-grey">
                    <span>{formatCompactNumber(metrics.views)} Views</span>
                    <span>{formatCompactNumber(metrics.likes)} Likes</span>
                    <span>
                      {formatEngagementRate(metrics.engagementRate)} Eng.
                    </span>
                    <span>{metrics.posts} Posts</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/5 pt-2 text-[0.7rem] text-muted-grey">
                    <span>{formatGbp(Number(campaign.budget))} Budget</span>
                    <span>
                      {campaign.last_synced_at
                        ? `Synced ${formatRelativeUpdated(campaign.last_synced_at)}`
                        : `Updated ${formatRelativeUpdated(campaign.updated_at)}`}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
