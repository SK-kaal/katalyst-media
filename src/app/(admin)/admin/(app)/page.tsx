import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { StatusBadge } from "@/components/admin/AdminSidebar";
import { CampaignActionsMenu } from "@/components/admin/CampaignActions";
import {
  calculateMetrics,
  campaignArtwork,
  campaignHeadline,
  campaignSoundArtist,
  campaignSoundTitle,
  campaignSyncLabel,
  formatCompactNumber,
  formatEngagementRate,
  formatGbp,
  formatPostsVsTarget,
  isPostFailed,
} from "@/lib/portal/metrics";
import { createAdminClient } from "@/lib/admin-auth/client";
import type { CampaignStatus } from "@/lib/supabase/database.types";

type SearchParams = Promise<{
  q?: string;
  status?: string;
  sort?: string;
  view?: string;
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
  const viewTrash = params.view === "trash";

  let query = supabase
    .from("campaigns")
    .select(
      "*, clients(id, name, handle, profile_image_url, archived_at), tiktok_posts(views, likes, comments, shares, last_sync_status, last_sync_error)",
    )
    .order("updated_at", { ascending: sort === "oldest" });

  if (viewTrash) {
    query = query.not("trashed_at", "is", null);
  } else {
    query = query.is("trashed_at", null);
  }

  const { data: campaigns } = await query;

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

  if (!viewTrash && status !== "all") {
    list = list.filter((c) => c.status === status);
  }

  if (q) {
    list = list.filter((c) => {
      const client = Array.isArray(c.clients) ? c.clients[0] : c.clients;
      const hay =
        `${client?.name ?? ""} ${campaignSoundArtist(c) ?? ""} ${campaignSoundTitle(c) ?? ""} ${c.display_title ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }

  const all = (campaigns ?? []).filter((c) =>
    viewTrash ? Boolean(c.trashed_at) : !c.trashed_at,
  );
  const counts = {
    all: all.length,
    active: all.filter((c) => c.status === "active").length,
    ended: all.filter((c) => c.status === "ended").length,
  };

  const attentionCampaigns = !viewTrash
    ? all.filter((c) => {
        const posts = Array.isArray(c.tiktok_posts) ? c.tiktok_posts : [];
        const sync = campaignSyncLabel(c, posts.filter(isPostFailed).length);
        return sync.tone === "bad" || sync.tone === "warn";
      })
    : [];

  const filterQs = (extra: Record<string, string>) => {
    const sp = new URLSearchParams();
    if (viewTrash) sp.set("view", "trash");
    if (status !== "all" && !viewTrash) sp.set("status", status);
    if (sort !== "updated") sp.set("sort", sort);
    if (q) sp.set("q", q);
    for (const [k, v] of Object.entries(extra)) {
      if (k === "sort" && v === "updated") sp.delete(k);
      else if (v) sp.set(k, v);
      else sp.delete(k);
    }
    const s = sp.toString();
    return s ? `/admin?${s}` : "/admin";
  };

  return (
    <div>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="admin-page-eyebrow">Campaigns</p>
          <h1 className="admin-page-title">
            {viewTrash ? "Trash" : "Campaign Library"}
          </h1>
          <p className="admin-page-desc">
            {viewTrash
              ? "Restore mistakes or permanently delete accidental campaigns."
              : "Manage clients, TikTok campaigns and shared reports."}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <form method="get" className="relative min-w-[16rem] flex-1">
            {viewTrash ? <input type="hidden" name="view" value="trash" /> : null}
            {!viewTrash && status !== "all" ? (
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
          {q ? (
            <Link
              href={filterQs({ q: "" })}
              className="admin-btn admin-btn--ghost"
            >
              Clear Search
            </Link>
          ) : null}
          {!viewTrash ? (
            <Link
              href="/admin/campaigns/new"
              className="admin-btn admin-btn--primary"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              New Campaign
            </Link>
          ) : null}
        </div>
      </div>

      {!viewTrash && attentionCampaigns.length > 0 ? (
        <div className="mt-5 rounded-[8px] border border-[#ffd27a]/30 bg-[#ffd27a]/5 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#ffd27a]">
            Needs Attention · {attentionCampaigns.length}
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {attentionCampaigns.slice(0, 6).map((c) => {
              const client = Array.isArray(c.clients) ? c.clients[0] : c.clients;
              const posts = Array.isArray(c.tiktok_posts) ? c.tiktok_posts : [];
              const sync = campaignSyncLabel(
                c,
                posts.filter(isPostFailed).length,
              );
              return (
                <li key={c.id}>
                  <Link
                    href={`/admin/campaigns/${c.id}${sync.tone === "bad" ? "?tab=content" : ""}`}
                    className="inline-flex max-w-[18rem] flex-col rounded-md border border-[color:var(--admin-border)] bg-black/20 px-3 py-2 hover:border-[#ffd27a]/40"
                  >
                    <span className="truncate text-sm font-semibold">
                      {campaignHeadline(c, client)}
                    </span>
                    <span className="truncate text-xs text-[#ffd27a]">
                      {sync.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {!viewTrash
            ? (
                [
                  ["all", "All"],
                  ["active", "Active"],
                  ["ended", "Ended"],
                ] as const
              ).map(([key, label]) => (
                <Link
                  key={key}
                  href={filterQs({ status: key === "all" ? "" : key, view: "" })}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    status === key
                      ? "border-acid-lime text-acid-lime"
                      : "border-[color:var(--admin-border)] text-soft-grey hover:border-[color:var(--admin-border-strong)]"
                  }`}
                >
                  {label} ({counts[key]})
                </Link>
              ))
            : null}
          <Link
            href={viewTrash ? "/admin" : "/admin?view=trash"}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              viewTrash
                ? "border-acid-lime text-acid-lime"
                : "border-[color:var(--admin-border)] text-soft-grey hover:border-[color:var(--admin-border-strong)]"
            }`}
          >
            Trash
          </Link>
        </div>
        {!viewTrash ? (
          <div className="flex flex-wrap gap-2 text-xs">
            {[
              ["updated", "Last updated"],
              ["newest", "Newest"],
              ["oldest", "Oldest"],
            ].map(([key, label]) => (
              <Link
                key={key}
                href={filterQs({ sort: key })}
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
        ) : null}
      </div>

      {list.length === 0 ? (
        <div className="admin-empty mt-8">
          <p className="font-display text-lg font-semibold">
            {viewTrash
              ? "Trash is empty"
              : q || status !== "all"
                ? "No campaigns found"
                : "No campaigns yet"}
          </p>
          <p className="mt-2 text-sm text-soft-grey">
            {viewTrash
              ? "Trashed campaigns appear here until restored or permanently deleted."
              : q || status !== "all"
                ? "Try another search or clear filters."
                : "Create a client, paste a TikTok sound URL, then add posts."}
          </p>
          {viewTrash ? (
            <Link href="/admin" className="admin-btn admin-btn--ghost mt-4">
              Back to Campaigns
            </Link>
          ) : q || status !== "all" ? (
            <Link href="/admin" className="admin-btn admin-btn--ghost mt-4">
              Clear Filters
            </Link>
          ) : (
            <Link
              href="/admin/campaigns/new"
              className="admin-btn admin-btn--primary mt-4"
            >
              Create First Campaign
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
            const failed = posts.filter(isPostFailed).length;
            const sync = campaignSyncLabel(campaign, failed);
            const title = campaignHeadline(campaign, client);
            return (
              <div
                key={campaign.id}
                className="admin-panel admin-campaign-card admin-campaign-card--clickable relative"
              >
                <Link
                  href={`/admin/campaigns/${campaign.id}`}
                  className="absolute inset-0 z-0 rounded-[inherit]"
                  aria-label={`Open ${title}`}
                />
                <div className="admin-campaign-card__thumb pointer-events-none relative z-[1]">
                  {art ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={art} alt="" className="size-full object-cover" />
                  ) : (
                    <div className="grid size-full place-items-center text-[0.65rem] text-muted-grey">
                      TikTok
                    </div>
                  )}
                </div>
                <div className="pointer-events-none relative z-[1] min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <StatusBadge status={campaign.status as CampaignStatus} />
                    <div className="pointer-events-auto relative z-[2]">
                      <CampaignActionsMenu
                        campaign={campaign}
                        clientId={client?.id}
                        trashed={viewTrash}
                      />
                    </div>
                  </div>
                  <p className="mt-2 truncate font-display text-[1.05rem] font-semibold tracking-[-0.03em]">
                    {client?.name ?? campaignSoundArtist(campaign) ?? "Client"}
                  </p>
                  <p className="truncate text-sm text-soft-grey">
                    {campaign.display_title ||
                      campaignSoundTitle(campaign) ||
                      "Untitled campaign"}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[0.72rem] text-soft-grey">
                    <span>{formatCompactNumber(metrics.views)} Views</span>
                    <span>
                      {formatPostsVsTarget(metrics.posts, campaign.target_posts)}{" "}
                      Posts
                    </span>
                    <span>
                      {formatEngagementRate(metrics.engagementRate)} Eng.
                    </span>
                    {campaign.sound_usage_count != null ? (
                      <span>
                        {formatCompactNumber(Number(campaign.sound_usage_count))}{" "}
                        Creations
                      </span>
                    ) : (
                      <span className="text-muted-grey">Creations n/a</span>
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-[color:var(--admin-border-soft)] pt-2 text-[0.7rem]">
                    <span className="text-muted-grey">
                      {formatGbp(Number(campaign.budget))} Budget
                    </span>
                    <span
                      className={
                        sync.tone === "bad"
                          ? "text-[#ff8f8f]"
                          : sync.tone === "warn"
                            ? "text-[#ffd27a]"
                            : "text-muted-grey"
                      }
                    >
                      {sync.label}
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
