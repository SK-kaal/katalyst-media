import type { Metadata } from "next";
import { Wordmark } from "@/components/ui/Wordmark";
import { AllContentGrid } from "@/components/report/AllContentGrid";
import { ViewsCharts } from "@/components/report/ViewsCharts";
import { StatusBadge } from "@/components/admin/AdminSidebar";
import {
  buildChartFromSnapshots,
  buildCumulative,
  calculateMetrics,
  campaignArtwork,
  campaignHeadline,
  formatCompactNumber,
  formatDateRange,
  formatDateTime,
  formatEngagementRate,
  formatFullNumber,
  formatGbpExact,
  formatShortDate,
} from "@/lib/portal/metrics";
import { createClient } from "@/lib/supabase/server";
import type {
  Campaign,
  Client,
  DailyPerformance,
  PostMetricSnapshot,
  TikTokPost,
} from "@/lib/supabase/database.types";
import "@/components/admin/admin.css";
import "@/components/report/report.css";

export const metadata: Metadata = {
  title: "Campaign Report | Katalyst Media",
  robots: { index: false, follow: false, nocache: true },
};

type SharedReport = {
  campaign: Campaign;
  client: Client;
  posts: TikTokPost[];
  snapshots?: PostMetricSnapshot[];
  daily?: DailyPerformance[];
};

export default async function ReportPage({
  params,
}: {
  params: Promise<{ shareToken: string }>;
}) {
  const { shareToken } = await params;
  const supabase = await createClient();

  const { data } = await supabase.rpc("fetch_shared_report", {
    p_token: shareToken,
  });

  const report = data as SharedReport | null;

  if (!report?.campaign) {
    return (
      <div className="report-shell grid min-h-svh place-items-center px-5 text-center">
        <div>
          <Wordmark className="text-[1rem] tracking-[0.14em]" />
          <h1 className="mt-8 font-display text-2xl font-semibold tracking-[-0.04em]">
            Campaign report unavailable.
          </h1>
          <p className="mt-3 text-soft-grey">
            This report link is invalid or no longer active.
          </p>
        </div>
      </div>
    );
  }

  const { campaign, client } = report;
  const postList = report.posts ?? [];
  const metrics = calculateMetrics(postList);
  const snapshotChart = buildChartFromSnapshots(
    postList,
    report.snapshots ?? [],
  );
  const legacyDaily = buildCumulative(
    (report.daily ?? []).map((row) => ({ date: row.date, views: row.views })),
  );
  const chartData = snapshotChart.length > 0 ? snapshotChart : legacyDaily;
  const topPosts = [...postList].sort((a, b) => b.views - a.views).slice(0, 3);
  const artwork = campaignArtwork(campaign);
  const headline = campaignHeadline(campaign, client);
  const dateRange = formatDateRange(campaign.start_date, campaign.end_date);

  return (
    <div className="report-shell">
      <header className="report-header">
        <div className="flex items-center gap-5">
          <Wordmark className="text-[0.88rem] tracking-[0.12em]" />
          <span className="hidden text-sm text-soft-grey sm:inline">
            Campaign Report
          </span>
        </div>
        <p className="text-[0.72rem] text-muted-grey">Shared Report · View Only</p>
      </header>

      <main className="report-main">
        <section className="report-hero">
          <div className="report-hero__art">
            {artwork ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={artwork} alt="" className="size-full object-cover" />
            ) : null}
          </div>
          <div>
            <p className="label-caps text-[0.68rem] tracking-[0.14em] text-acid-lime">
              TikTok Campaign
            </p>
            <h1 className="mt-2 font-display text-[clamp(1.7rem,1.3rem+1.5vw,2.5rem)] font-semibold tracking-[-0.04em] leading-[1.05]">
              {headline}
            </h1>
            {campaign.tiktok_sound_url ? (
              <a
                href={campaign.tiktok_sound_url}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex text-sm text-acid-lime"
              >
                View Sound on TikTok ↗
              </a>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-soft-grey">
              <span>Budget {formatGbpExact(Number(campaign.budget))}</span>
              {campaign.sound_usage_count != null ? (
                <span>
                  Sound usage {formatFullNumber(Number(campaign.sound_usage_count))}{" "}
                  TikTok posts
                </span>
              ) : null}
              <span>Tracked posts {metrics.posts}</span>
              {dateRange ? <span>{dateRange}</span> : null}
            </div>
          </div>
          <div className="sm:text-right">
            <StatusBadge status={campaign.status} />
            <p className="mt-2 text-xs text-muted-grey">
              Last updated{" "}
              {formatDateTime(
                campaign.last_synced_at || campaign.updated_at,
              )}
            </p>
            {campaign.status === "paused" ? (
              <p className="mt-2 text-xs text-[#ffba49]">Campaign Paused</p>
            ) : null}
            {campaign.status === "closed" ? (
              <p className="mt-2 text-xs text-muted-grey">Campaign Closed</p>
            ) : null}
          </div>
        </section>

        <section className="report-metrics" aria-label="Campaign metrics">
          {[
            ["Total Views", formatFullNumber(metrics.views)],
            ["Total Likes", formatFullNumber(metrics.likes)],
            ["Comments", formatFullNumber(metrics.comments)],
            ["Shares", formatFullNumber(metrics.shares)],
            ["Engagement Rate", formatEngagementRate(metrics.engagementRate)],
            ["Tracked Posts", String(metrics.posts)],
          ].map(([label, value]) => (
            <div key={label} className="report-metric">
              <p className="report-metric__label">{label}</p>
              <p className="report-metric__value">{value}</p>
            </div>
          ))}
        </section>

        <ViewsCharts daily={chartData} />

        <section className="mt-10">
          <h2 className="font-display text-xl font-semibold tracking-[-0.03em]">
            Top Performing Posts
          </h2>
          <div className="report-top-grid">
            {topPosts.map((post, index) => (
              <a
                key={post.id}
                href={post.post_url}
                target="_blank"
                rel="noreferrer"
                className="report-post-card"
              >
                <div className="report-post-card__thumb">
                  {post.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={post.thumbnail_url}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : null}
                  <span className="absolute left-2 top-2 rounded bg-acid-lime px-1.5 py-0.5 text-[0.65rem] font-semibold text-black">
                    #{index + 1}
                  </span>
                </div>
                <div className="report-post-card__meta space-y-1">
                  <p className="text-off-white">
                    {formatCompactNumber(post.views)} views
                  </p>
                  <p>
                    {formatCompactNumber(post.likes)} likes ·{" "}
                    {formatCompactNumber(post.comments)} comments ·{" "}
                    {formatCompactNumber(post.shares)} shares
                  </p>
                  <p className="text-muted-grey">
                    {formatShortDate(post.posted_at)}
                  </p>
                </div>
              </a>
            ))}
          </div>
          {topPosts.length === 0 ? (
            <p className="mt-3 text-soft-grey">No posts added yet.</p>
          ) : null}
        </section>

        <AllContentGrid posts={postList} />
      </main>
    </div>
  );
}
