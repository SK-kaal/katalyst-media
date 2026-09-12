import {
  ExternalLink,
  ImageOff,
  Music2,
} from "lucide-react";
import { Wordmark } from "@/components/ui/Wordmark";
import { AllContentGrid } from "@/components/report/AllContentGrid";
import { ReportMetricChart } from "@/components/report/ReportMetricCharts";
import {
  AnimatedValue,
  ReportMotion,
} from "@/components/report/ReportMotion";
import { ViewsCharts } from "@/components/report/ViewsCharts";
import {
  buildChartFromSnapshots,
  buildSeriesFromCumulativeSnapshots,
  calculateMetrics,
  campaignArtwork,
  campaignSoundArtist,
  campaignSoundTitle,
  formatCompactNumber,
  formatFullNumber,
  formatPostsVsTargetLabel,
  formatShortDate,
  sortReportPosts,
} from "@/lib/portal/metrics";
import type {
  ReportCampaign,
  ReportCampaignSnapshot,
  ReportClient,
  ReportMetricHistoryPoint,
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
  const release = campaignSoundTitle(campaign) || "";
  const display = campaign.display_title?.trim() || "";
  const title = display || release || client?.name?.trim() || "Campaign";
  const soundArtist = campaignSoundArtist(campaign) || "";
  const artist =
    soundArtist && soundArtist.toLowerCase() !== title.toLowerCase()
      ? soundArtist
      : client?.name?.trim() || "";
  const artistLine = artist.toLowerCase() !== title.toLowerCase() ? artist : null;

  return { title, artist: artistLine };
}

type SnapshotMetric =
  | "views"
  | "likes"
  | "comments"
  | "shares"
  | "engagement_rate";

function buildMetricHistory(
  snapshots: ReportCampaignSnapshot[],
  metric: SnapshotMetric,
  currentValue: number,
): ReportMetricHistoryPoint[] {
  const points = snapshots
    .map((snapshot) => ({
      capturedAt: snapshot.captured_at,
      value: Number(snapshot[metric]),
    }))
    .filter(
      (point) =>
        Number.isFinite(new Date(point.capturedAt).getTime()) &&
        Number.isFinite(point.value) &&
        point.value >= 0,
    )
    .sort(
      (a, b) =>
        new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime(),
    );

  const current = Math.max(0, Number(currentValue) || 0);
  const latest = points[points.length - 1];
  if (!latest || latest.value !== current) {
    points.push({ capturedAt: new Date().toISOString(), value: current });
  }

  return points;
}

function CampaignWaveform() {
  return (
    <div className="report-summary__waveform" aria-hidden="true">
      <svg viewBox="0 0 680 190" preserveAspectRatio="none">
        {Array.from({ length: 9 }, (_, index) => {
          const y = 50 + index * 10;
          return (
            <path
              key={y}
              d={`M-30 ${y} C80 ${18 + index * 7}, 155 ${
                132 - index * 3
              }, 270 ${72 + index * 5} S470 ${
                38 + index * 8
              }, 710 ${88 + index * 4}`}
            />
          );
        })}
      </svg>
    </div>
  );
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
  const deliveryBarPct = Math.min(100, deliveryPct);

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

  const postSnapSeries = buildChartFromSnapshots(
    postList,
    snapshots,
    metrics.views,
  ).map(
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

  const viewsHistory = buildMetricHistory(
    campaignSnapshots,
    "views",
    metrics.views,
  );
  const featuredViewsHistory =
    viewsHistory.length >= 2
      ? viewsHistory
      : viewsSeries.map((point) => ({
          capturedAt: `${point.date}T12:00:00Z`,
          value: point.cumulative,
        }));
  const likesHistory = buildMetricHistory(
    campaignSnapshots,
    "likes",
    metrics.likes,
  );
  const commentsHistory = buildMetricHistory(
    campaignSnapshots,
    "comments",
    metrics.comments,
  );
  const sharesHistory = buildMetricHistory(
    campaignSnapshots,
    "shares",
    metrics.shares,
  );
  const engagementHistory = buildMetricHistory(
    campaignSnapshots,
    "engagement_rate",
    metrics.engagementRate,
  );

  const topPosts = sortReportPosts(postList, "views").slice(0, 3);
  const soundUrl = campaign.tiktok_sound_url?.trim() || null;

  return (
    <ReportMotion>
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
        <section className="report-overview" aria-label="Campaign overview">
          <article
            className="report-overview-card report-summary"
            aria-label="Campaign information"
          >
            <CampaignWaveform />
            <div className="report-summary__art">
              {artwork ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={artwork}
                  alt=""
                  decoding="async"
                  fetchPriority="high"
                />
              ) : (
                <span className="report-summary__art-placeholder">
                  <Music2 aria-hidden="true" />
                </span>
              )}
            </div>

            <div className="report-summary__identity">
              <p className="report-summary__label">Campaign</p>
              <div className="report-summary__title-row">
                <h1 className="report-summary__title">{title}</h1>
                {soundUrl ? (
                  <a
                    href={soundUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="report-summary__sound-icon"
                    aria-label="View sound"
                  >
                    <ExternalLink aria-hidden="true" />
                    <span
                      className="report-summary__sound-tooltip"
                      aria-hidden="true"
                    >
                      View sound
                    </span>
                  </a>
                ) : null}
              </div>
              {artist ? <p className="report-summary__artist">{artist}</p> : null}
            </div>

            <span className={statusClass(campaign.status)}>
              <span className="report-status__dot" aria-hidden="true" />
              {statusLabelUi(campaign.status)}
            </span>
          </article>

          <section
            className="report-overview-card report-delivery-card"
            aria-label="Campaign budget and delivery"
          >
            <div className="report-delivery-card__budget">
              <p className="report-summary__budget-label">Campaign Budget</p>
              <p className="report-summary__budget-value">
                <AnimatedValue
                  value={Number(campaign.budget)}
                  kind="currency"
                />
              </p>
            </div>
            <div className="report-delivery-card__divider" aria-hidden="true" />
            <div className="report-delivery-card__content">
              <div className="report-card__eyebrow">Campaign Delivery</div>
              <div className="report-delivery__row">
                <div>
                  <p className="report-card__value">
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
                  aria-valuemax={Math.max(100, deliveryPct)}
                  aria-valuetext={`${metrics.posts} of ${Number(
                    campaign.target_posts,
                  )} campaign posts, ${deliveryPct}% complete`}
                >
                  <div
                    className="report-progress__fill"
                    style={{ width: `${deliveryBarPct}%` }}
                  />
                </div>
              ) : (
                <p className="report-card__hint">
                  Tracked posts delivered in this campaign.
                </p>
              )}
            </div>
          </section>
        </section>

        <section className="report-results" aria-label="Katalyst campaign results">
          <div className="report-results__head">
            <div>
              <p className="report-results__eyebrow">Campaign Results</p>
              <h2 className="report-results__title">Katalyst Campaign Results</h2>
            </div>
            <p
              className={`report-results__live${
                campaign.status === "active"
                  ? " report-results__live--active"
                  : ""
              }`}
            >
              <span className="report-results__live-dot" aria-hidden="true" />
              {campaign.status === "active" ? "Live results" : "Final results"}
            </p>
          </div>
          <div className="report-results__layout">
            <div className="report-results__featured">
              <div className="report-results__featured-head">
                <p className="report-metric-card__label">Campaign Views</p>
                <p className="report-results__featured-value">
                  <AnimatedValue value={metrics.views} />
                </p>
              </div>
              <ReportMetricChart
                label="Campaign views"
                series={featuredViewsHistory}
                featured
              />
            </div>
            <div className="report-results__grid">
              <div className="report-metric-card">
                <div className="report-metric-card__content">
                  <p className="report-metric-card__label">Likes</p>
                  <p className="report-metric-card__value">
                    <AnimatedValue value={metrics.likes} />
                  </p>
                </div>
                <ReportMetricChart
                  label="Likes"
                  series={likesHistory}
                  animationDelay={0.04}
                />
              </div>
              <div className="report-metric-card">
                <div className="report-metric-card__content">
                  <p className="report-metric-card__label">Comments</p>
                  <p className="report-metric-card__value">
                    <AnimatedValue value={metrics.comments} />
                  </p>
                </div>
                <ReportMetricChart
                  label="Comments"
                  series={commentsHistory}
                  animationDelay={0.1}
                />
              </div>
              <div className="report-metric-card">
                <div className="report-metric-card__content">
                  <p className="report-metric-card__label">Shares</p>
                  <p className="report-metric-card__value">
                    <AnimatedValue value={metrics.shares} />
                  </p>
                </div>
                <ReportMetricChart
                  label="Shares"
                  series={sharesHistory}
                  animationDelay={0.16}
                />
              </div>
              <div className="report-metric-card">
                <div className="report-metric-card__content">
                  <p className="report-metric-card__label">Engagement Rate</p>
                  <p className="report-metric-card__value">
                    <AnimatedValue
                      value={metrics.engagementRate}
                      kind="percent"
                    />
                  </p>
                </div>
                <ReportMetricChart
                  label="Engagement rate"
                  series={engagementHistory}
                  format="percent"
                  animationDelay={0.22}
                />
              </div>
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
          showCreations={Boolean(soundUrl)}
        />

        <section className="report-section report-section--featured">
          <div className="report-section__head">
            <div className="report-section__title-wrap">
              <h2 className="report-section__title">Top Performing Posts</h2>
              <p className="report-section__sub">
                The highest performing content from this campaign.
              </p>
            </div>
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
                      <img
                        src={post.thumbnail_url}
                        alt=""
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <span className="report-vcard__placeholder">
                        <ImageOff aria-hidden="true" />
                        <span>Preview unavailable</span>
                      </span>
                    )}
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
                        <p
                          className="report-vcard__metric-value"
                          title={formatFullNumber(post.views)}
                        >
                          {formatCompactNumber(post.views)}
                        </p>
                      </div>
                      <div>
                        <p className="report-vcard__metric-label">Likes</p>
                        <p
                          className="report-vcard__metric-value"
                          title={formatFullNumber(post.likes)}
                        >
                          {formatCompactNumber(post.likes)}
                        </p>
                      </div>
                      <div>
                        <p className="report-vcard__metric-label">Comments</p>
                        <p
                          className="report-vcard__metric-value"
                          title={formatFullNumber(post.comments)}
                        >
                          {formatCompactNumber(post.comments)}
                        </p>
                      </div>
                      <div>
                        <p className="report-vcard__metric-label">Shares</p>
                        <p
                          className="report-vcard__metric-value"
                          title={formatFullNumber(post.shares)}
                        >
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
    </ReportMotion>
  );
}
