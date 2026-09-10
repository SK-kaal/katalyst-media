import {
  BarChart3,
  Eye,
  Heart,
  MessageCircle,
  Share2,
} from "lucide-react";
import { Wordmark } from "@/components/ui/Wordmark";
import { AllContentGrid } from "@/components/report/AllContentGrid";
import { ViewsCharts } from "@/components/report/ViewsCharts";
import {
  buildChartFromSnapshots,
  buildSeriesFromCumulativeSnapshots,
  calculateMetrics,
  campaignArtwork,
  formatCompactNumber,
  formatEngagementRate,
  formatFullNumber,
  formatGbpExact,
  formatPostsVsTargetLabel,
  formatShortDate,
} from "@/lib/portal/metrics";
import type {
  ReportCampaign,
  ReportCampaignSnapshot,
  ReportClient,
  ReportPost,
  ReportPostSnapshot,
  ReportSoundSnapshot,
} from "@/lib/portal/report";
import "@/components/report/report.css";

function statusClass(status: ReportCampaign["status"]) {
  if (status === "active") return "report-status";
  return "report-status report-status--ended";
}

function statusLabelUi(status: ReportCampaign["status"]) {
  if (status === "active") return "Active";
  return "Ended";
}

function resolveTitles(
  campaign: ReportCampaign,
  client: ReportClient | null,
): { title: string; artist: string | null } {
  const release = campaign.sound_title?.trim() || "";
  const display = campaign.display_title?.trim() || "";
  const title = display || release || client?.name?.trim() || "Campaign";
  const soundArtist = campaign.sound_artist?.trim() || "";
  const artist =
    soundArtist && soundArtist.toLowerCase() !== title.toLowerCase()
      ? soundArtist
      : client?.name?.trim() || "";
  const artistLine = artist.toLowerCase() !== title.toLowerCase() ? artist : null;

  return { title, artist: artistLine };
}

export function CampaignReportView({
  campaign,
  client,
  posts,
  snapshots = [],
  soundSnapshots = [],
  campaignSnapshots = [],
  adminPreview = false,
}: {
  campaign: ReportCampaign;
  client: ReportClient;
  posts: ReportPost[];
  snapshots?: ReportPostSnapshot[];
  soundSnapshots?: ReportSoundSnapshot[];
  campaignSnapshots?: ReportCampaignSnapshot[];
  adminPreview?: boolean;
}) {
  const postList = posts ?? [];
  const metrics = calculateMetrics(postList);
  const artwork = campaignArtwork(campaign);
  const { title, artist } = resolveTitles(campaign, client);

  const delivery = formatPostsVsTargetLabel(
    metrics.posts,
    campaign.target_posts,
  );
  const deliveryPct = Math.round(delivery.progress * 100);

  const creationsSeries = buildSeriesFromCumulativeSnapshots(
    soundSnapshots.map((s) => ({
      captured_at: s.captured_at,
      value: Number(s.creation_count),
    })),
    campaign.sound_usage_count,
  );

  const campaignSnapSeries = buildSeriesFromCumulativeSnapshots(
    campaignSnapshots.map((s) => ({
      captured_at: s.captured_at,
      value: Number(s.views),
    })),
    metrics.views,
  );

  const postSnapSeries = buildChartFromSnapshots(postList, snapshots).map(
    (row) => ({
      date: row.date,
      daily: row.views,
      cumulative: row.cumulative,
    }),
  );

  const viewsSeries =
    campaignSnapSeries.length >= 2
      ? campaignSnapSeries
      : postSnapSeries;

  const topPosts = [...postList].sort((a, b) => b.views - a.views).slice(0, 3);
  const soundUrl = campaign.tiktok_sound_url?.trim() || null;

  return (
    <div className="report-shell">
      <header className="report-header">
        <p className="report-header__side report-header__side--left">
          Campaign Report
        </p>
        <div className="report-header__center">
          <Wordmark className="report-header__wordmark" href={null} />
        </div>
        <p className="report-header__side report-header__side--right">
          {adminPreview ? "Admin Preview" : "Shared Report · View Only"}
        </p>
      </header>

      <main className="report-main">
        <section className="report-summary" aria-label="Campaign summary">
          {soundUrl ? (
            <a
              href={soundUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="report-summary__art report-summary__art--link"
              aria-label="Open TikTok sound"
            >
              {artwork ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={artwork} alt="" />
              ) : null}
            </a>
          ) : (
            <div className="report-summary__art">
              {artwork ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={artwork} alt="" />
              ) : null}
            </div>
          )}

          <div className="report-summary__identity">
            <p className="report-summary__label">Campaign</p>
            <h1 className="report-summary__title">
              {soundUrl ? (
                <a
                  href={soundUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="report-summary__title-link"
                >
                  {title}
                </a>
              ) : (
                title
              )}
            </h1>
            {artist ? <p className="report-summary__artist">{artist}</p> : null}
            {soundUrl ? (
              <a
                href={soundUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="report-summary__sound"
              >
                View Sound
                <span className="report-summary__sound-arrow" aria-hidden="true">
                  ↗
                </span>
              </a>
            ) : null}
          </div>

          <div className="report-summary__meta">
            <span className={statusClass(campaign.status)}>
              <span className="report-status__dot" aria-hidden="true" />
              {statusLabelUi(campaign.status)}
            </span>
            <div className="report-summary__budget">
              <p className="report-summary__budget-label">Campaign Budget</p>
              <p className="report-summary__budget-value">
                {formatGbpExact(Number(campaign.budget))}
              </p>
            </div>
          </div>
        </section>

        <section className="report-strip" aria-label="Campaign delivery">
          <div className="report-card">
            <div className="report-card__eyebrow">Campaign Delivery</div>
            <div className="report-delivery__row">
              <div>
                <p className="report-card__value" style={{ marginTop: 0 }}>
                  {campaign.target_posts != null
                    ? `${metrics.posts} / ${Number(campaign.target_posts)}`
                    : formatFullNumber(metrics.posts)}
                </p>
                <p className="report-delivery__label">Campaign Posts</p>
              </div>
              {campaign.target_posts != null ? (
                <p className="report-delivery__pct">{deliveryPct}% complete</p>
              ) : null}
            </div>
            {campaign.target_posts != null ? (
              <div
                className="report-progress"
                role="progressbar"
                aria-valuenow={deliveryPct}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="report-progress__fill"
                  style={{ width: `${deliveryPct}%` }}
                />
              </div>
            ) : (
              <p className="report-card__hint">
                Tracked posts delivered in this campaign.
              </p>
            )}
          </div>
        </section>

        <section className="report-results" aria-label="Katalyst campaign results">
          <div className="report-results__head">
            <div>
              <p className="report-results__eyebrow">Campaign Results</p>
              <h2 className="report-results__title">Katalyst Campaign Results</h2>
            </div>
            <p className="report-results__live">
              <span className="report-results__live-dot" aria-hidden="true" />
              {campaign.status === "active" ? "Live results" : "Final results"}
            </p>
          </div>
          <div className="report-results__grid">
            <div className="report-metric-card">
              <span className="report-metric-card__icon" aria-hidden="true">
                <Eye />
              </span>
              <p className="report-metric-card__label">Campaign Views</p>
              <p className="report-metric-card__value">
                {formatFullNumber(metrics.views)}
              </p>
            </div>
            <div className="report-metric-card">
              <span className="report-metric-card__icon" aria-hidden="true">
                <Heart />
              </span>
              <p className="report-metric-card__label">Likes</p>
              <p className="report-metric-card__value">
                {formatFullNumber(metrics.likes)}
              </p>
            </div>
            <div className="report-metric-card">
              <span className="report-metric-card__icon" aria-hidden="true">
                <MessageCircle />
              </span>
              <p className="report-metric-card__label">Comments</p>
              <p className="report-metric-card__value">
                {formatFullNumber(metrics.comments)}
              </p>
            </div>
            <div className="report-metric-card">
              <span className="report-metric-card__icon" aria-hidden="true">
                <Share2 />
              </span>
              <p className="report-metric-card__label">Shares</p>
              <p className="report-metric-card__value">
                {formatFullNumber(metrics.shares)}
              </p>
            </div>
            <div className="report-metric-card">
              <span className="report-metric-card__icon" aria-hidden="true">
                <BarChart3 />
              </span>
              <p className="report-metric-card__label">Engagement Rate</p>
              <p className="report-metric-card__value">
                {formatEngagementRate(metrics.engagementRate)}
              </p>
            </div>
          </div>
        </section>

        <ViewsCharts
          creations={creationsSeries}
          views={viewsSeries}
          creationsTotal={
            campaign.sound_usage_count != null
              ? Number(campaign.sound_usage_count)
              : null
          }
          viewsTotal={metrics.views}
        />

        <section className="report-section report-section--featured">
          <div className="report-section__head">
            <p className="report-section__side" aria-hidden="true">
              Music / Creators /
              <br />
              Real Impact
            </p>
            <div className="report-section__title-wrap">
              <h2 className="report-section__title">Top Performing Posts</h2>
              <p className="report-section__sub">
                The highest performing content from this campaign.
              </p>
            </div>
            <p className="report-section__side" aria-hidden="true">
              Data Drives /
              <br />
              Culture
            </p>
          </div>

          {topPosts.length === 0 ? (
            <div className="report-panel report-empty">
              Top posts will appear once content is tracked.
            </div>
          ) : (
            <div className="report-top-grid">
              {topPosts.map((post, index) => (
                <a
                  key={post.id}
                  href={post.post_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="report-vcard"
                >
                  <div className="report-vcard__media">
                    {post.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={post.thumbnail_url} alt="" />
                    ) : null}
                    <span className="report-vcard__rank">#{index + 1}</span>
                    <div className="report-vcard__fade" aria-hidden="true" />
                  </div>
                  <div className="report-vcard__body">
                    <div className="report-vcard__row">
                      <p className="report-vcard__handle">
                        {post.creator_handle}
                      </p>
                      <p className="report-vcard__date">
                        {formatShortDate(post.posted_at || post.created_at)}
                      </p>
                    </div>
                    <div className="report-vcard__metrics">
                      <div>
                        <p className="report-vcard__metric-label">Views</p>
                        <p className="report-vcard__metric-value">
                          {formatCompactNumber(post.views)}
                        </p>
                      </div>
                      <div>
                        <p className="report-vcard__metric-label">Likes</p>
                        <p className="report-vcard__metric-value">
                          {formatCompactNumber(post.likes)}
                        </p>
                      </div>
                      <div>
                        <p className="report-vcard__metric-label">Comments</p>
                        <p className="report-vcard__metric-value">
                          {formatCompactNumber(post.comments)}
                        </p>
                      </div>
                      <div>
                        <p className="report-vcard__metric-label">Shares</p>
                        <p className="report-vcard__metric-value">
                          {formatCompactNumber(post.shares)}
                        </p>
                      </div>
                    </div>
                    <span className="report-vcard__cta">View Post ↗</span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </section>

        <AllContentGrid posts={postList} />
      </main>
    </div>
  );
}
