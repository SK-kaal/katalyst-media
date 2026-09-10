import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { StatusBadge } from "@/components/admin/AdminSidebar";
import { ClientForm } from "@/components/admin/ClientForm";
import { ClientArchiveActions } from "@/components/admin/ClientArchiveActions";
import { CampaignActionsMenu } from "@/components/admin/CampaignActions";
import {
  calculateMetrics,
  campaignArtwork,
  campaignHeadline,
  campaignSyncLabel,
  formatCompactNumber,
  formatEngagementRate,
  formatGbp,
  formatPostsVsTarget,
  isActiveCampaignStatus,
  isPastCampaignStatus,
  isPostFailed,
} from "@/lib/portal/metrics";
import { updateClientRecord } from "@/lib/portal/actions";
import { createAdminClient } from "@/lib/admin-auth/client";
import type { CampaignStatus } from "@/lib/supabase/database.types";

export default async function ClientProfilePage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const supabase = await createAdminClient();
  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .maybeSingle();

  if (!client) notFound();

  const { data: campaigns } = await supabase
    .from("campaigns")
    .select(
      "*, tiktok_posts(views, likes, comments, shares, last_sync_status, last_sync_error)",
    )
    .eq("client_id", clientId)
    .is("trashed_at", null)
    .order("updated_at", { ascending: false });

  const { count: totalCampaignCount } = await supabase
    .from("campaigns")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId);

  const list = campaigns ?? [];
  const current = list.filter((c) =>
    isActiveCampaignStatus(c.status as CampaignStatus),
  );
  const past = list.filter((c) =>
    isPastCampaignStatus(c.status as CampaignStatus),
  );
  const allPosts = list.flatMap((c) =>
    Array.isArray(c.tiktok_posts) ? c.tiktok_posts : [],
  );
  const life = calculateMetrics(allPosts);

  return (
    <div>
      <Link
        href="/admin/clients"
        className="text-sm text-soft-grey hover:text-off-white"
      >
        ← Clients
      </Link>

      <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="size-20 overflow-hidden rounded-[12px] bg-graphite">
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
            <h1 className="admin-page-title !mt-0">{client.name}</h1>
            <p className="text-soft-grey">{client.handle || "No handle"}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.12em] text-muted-grey">
              {client.client_type}
              {client.archived_at ? " · Archived" : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <ClientArchiveActions
            clientId={client.id}
            archived={Boolean(client.archived_at)}
            campaignCount={totalCampaignCount ?? list.length}
          />
          {!client.archived_at ? (
            <Link
              href={`/admin/campaigns/new?clientId=${client.id}`}
              className="admin-btn admin-btn--primary"
            >
              <Plus className="size-3.5" />
              New Campaign
            </Link>
          ) : null}
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          ["Campaigns", String(list.length)],
          ["Tracked Views", formatCompactNumber(life.views)],
          ["Tracked Likes", formatCompactNumber(life.likes)],
        ].map(([label, value]) => (
          <div key={label} className="admin-panel admin-metric">
            <p className="admin-metric__label">{label}</p>
            <p className="admin-metric__value">{value}</p>
          </div>
        ))}
      </div>

      <section className="mt-8">
        <div className="flex items-end justify-between gap-3">
          <h2 className="font-display text-xl font-semibold tracking-[-0.03em]">
            Active Campaigns
          </h2>
          <span className="text-sm text-muted-grey">{current.length}</span>
        </div>
        {current.length === 0 ? (
          <div className="admin-empty mt-4">
            <p className="font-display text-base font-semibold">
              No active campaigns
            </p>
            <p className="mt-2 text-sm text-soft-grey">
              Create a campaign from a TikTok sound URL to start tracking.
            </p>
            <Link
              href={`/admin/campaigns/new?clientId=${client.id}`}
              className="admin-btn admin-btn--primary mt-4"
            >
              Create First Campaign
            </Link>
          </div>
        ) : (
          <div className="admin-campaign-grid mt-4">
            {current.map((campaign) => {
              const posts = Array.isArray(campaign.tiktok_posts)
                ? campaign.tiktok_posts
                : [];
              const metrics = calculateMetrics(posts);
              const art = campaignArtwork(campaign);
              const sync = campaignSyncLabel(
                campaign,
                posts.filter(isPostFailed).length,
              );
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
                  <div className="admin-campaign-card__thumb pointer-events-none">
                    {art ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={art}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <StatusBadge status={campaign.status as CampaignStatus} />
                      <div className="pointer-events-auto relative z-[2]">
                        <CampaignActionsMenu
                          campaign={campaign}
                          clientId={client.id}
                        />
                      </div>
                    </div>
                    <p className="mt-2 font-semibold">
                      {campaign.display_title ||
                        campaign.sound_title ||
                        "Untitled campaign"}
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-soft-grey">
                      <span>{formatCompactNumber(metrics.views)} views</span>
                      <span>
                        {formatPostsVsTarget(
                          metrics.posts,
                          campaign.target_posts,
                        )}{" "}
                        posts
                      </span>
                      {campaign.sound_usage_count != null ? (
                        <span>
                          {formatCompactNumber(
                            Number(campaign.sound_usage_count),
                          )}{" "}
                          TikTok Creations
                        </span>
                      ) : (
                        <span>
                          {formatEngagementRate(metrics.engagementRate)}
                        </span>
                      )}
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
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="text-muted-grey">
                        {formatGbp(Number(campaign.budget))}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-10">
        <div className="flex items-end justify-between gap-3">
          <h2 className="font-display text-xl font-semibold tracking-[-0.03em]">
            Ended Campaigns
          </h2>
          <span className="text-sm text-muted-grey">{past.length}</span>
        </div>
        {past.length === 0 ? (
          <p className="mt-3 text-sm text-muted-grey">No ended campaigns yet.</p>
        ) : (
          <div className="admin-campaign-grid mt-4">
            {past.map((campaign) => {
              const posts = Array.isArray(campaign.tiktok_posts)
                ? campaign.tiktok_posts
                : [];
              const metrics = calculateMetrics(posts);
              const art = campaignArtwork(campaign);
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
                  <div className="admin-campaign-card__thumb pointer-events-none opacity-80">
                    {art ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={art}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <StatusBadge status={campaign.status as CampaignStatus} />
                      <div className="pointer-events-auto relative z-[2]">
                        <CampaignActionsMenu
                          campaign={campaign}
                          clientId={client.id}
                        />
                      </div>
                    </div>
                    <p className="mt-2 font-semibold">
                      {campaign.display_title ||
                        campaign.sound_title ||
                        "Untitled campaign"}
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-soft-grey">
                      <span>{formatCompactNumber(metrics.views)} views</span>
                      <span>
                        {formatEngagementRate(metrics.engagementRate)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-lg font-semibold tracking-[-0.03em]">
          Client details
        </h2>
        <div className="mt-3">
          <ClientForm
            mode="edit"
            client={client}
            onSubmit={updateClientRecord.bind(null, client.id)}
          />
        </div>
      </section>
    </div>
  );
}
