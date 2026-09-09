import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { StatusBadge } from "@/components/admin/AdminSidebar";
import { ClientForm } from "@/components/admin/ClientForm";
import { CampaignActionsMenu } from "@/components/admin/CampaignActions";
import {
  calculateMetrics,
  campaignArtwork,
  formatCompactNumber,
  formatEngagementRate,
  formatGbp,
  isActiveCampaignStatus,
  isPastCampaignStatus,
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
    .select("*, tiktok_posts(views, likes, comments, shares)")
    .eq("client_id", clientId)
    .order("updated_at", { ascending: false });

  const list = campaigns ?? [];
  const current = list.filter((c) =>
    isActiveCampaignStatus(c.status as CampaignStatus) ||
    (c.status as CampaignStatus) === "draft",
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
      <Link href="/admin/clients" className="text-sm text-soft-grey hover:text-off-white">
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
            </p>
          </div>
        </div>
        <Link
          href={`/admin/campaigns/new?clientId=${client.id}`}
          className="admin-btn admin-btn--primary"
        >
          <Plus className="size-3.5" />
          New Campaign
        </Link>
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
            Current Campaigns
          </h2>
          <span className="text-sm text-muted-grey">{current.length}</span>
        </div>
        {current.length === 0 ? (
          <div className="admin-empty mt-4">
            <p className="font-display text-base font-semibold">
              No campaigns for {client.name} yet
            </p>
            <p className="mt-2 text-sm text-soft-grey">
              Create a campaign from a TikTok sound URL.
            </p>
            <Link
              href={`/admin/campaigns/new?clientId=${client.id}`}
              className="admin-btn admin-btn--primary mt-4"
            >
              + New Campaign
            </Link>
          </div>
        ) : (
          <div className="admin-campaign-grid mt-4">
            {current.map((campaign) => {
              const metrics = calculateMetrics(
                Array.isArray(campaign.tiktok_posts) ? campaign.tiktok_posts : [],
              );
              const art = campaignArtwork(campaign);
              return (
                <div key={campaign.id} className="admin-panel admin-campaign-card relative">
                  <Link
                    href={`/admin/campaigns/${campaign.id}`}
                    className="admin-campaign-card__thumb"
                  >
                    {art ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={art} alt="" className="size-full object-cover" />
                    ) : null}
                  </Link>
                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <StatusBadge status={campaign.status as CampaignStatus} />
                      <CampaignActionsMenu
                        campaign={campaign}
                        clientId={client.id}
                      />
                    </div>
                    <Link
                      href={`/admin/campaigns/${campaign.id}`}
                      className="mt-2 block font-semibold hover:text-acid-lime"
                    >
                      {campaign.sound_title || campaign.release_title}
                    </Link>
                    <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-soft-grey">
                      <span>{formatCompactNumber(metrics.views)} views</span>
                      <span>{formatCompactNumber(metrics.likes)} likes</span>
                      <span>{formatEngagementRate(metrics.engagementRate)}</span>
                      <span>{metrics.posts} posts</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-muted-grey">
                      <span>{formatGbp(Number(campaign.budget))}</span>
                      <Link
                        href={`/admin/campaigns/${campaign.id}`}
                        className="font-semibold text-acid-lime"
                      >
                        Open →
                      </Link>
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
            Closed / Previous
          </h2>
          <span className="text-sm text-muted-grey">{past.length}</span>
        </div>
        {past.length === 0 ? (
          <p className="mt-3 text-sm text-muted-grey">No closed campaigns yet.</p>
        ) : (
          <div className="admin-campaign-grid mt-4">
            {past.map((campaign) => {
              const metrics = calculateMetrics(
                Array.isArray(campaign.tiktok_posts) ? campaign.tiktok_posts : [],
              );
              const art = campaignArtwork(campaign);
              return (
                <div key={campaign.id} className="admin-panel admin-campaign-card">
                  <Link
                    href={`/admin/campaigns/${campaign.id}`}
                    className="admin-campaign-card__thumb opacity-80"
                  >
                    {art ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={art} alt="" className="size-full object-cover" />
                    ) : null}
                  </Link>
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <StatusBadge status={campaign.status as CampaignStatus} />
                      <CampaignActionsMenu campaign={campaign} clientId={client.id} />
                    </div>
                    <p className="mt-2 font-semibold">
                      {campaign.sound_title || campaign.release_title}
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-soft-grey">
                      <span>{formatCompactNumber(metrics.views)} views</span>
                      <span>{formatEngagementRate(metrics.engagementRate)}</span>
                    </div>
                    {campaign.share_enabled && campaign.share_token ? (
                      <Link
                        href={`/report/${campaign.share_token}`}
                        target="_blank"
                        className="mt-3 inline-flex text-xs text-acid-lime"
                      >
                        Open Report ↗
                      </Link>
                    ) : null}
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
