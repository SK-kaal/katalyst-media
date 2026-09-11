import {
  ExternalLink,
  ImageOff,
  Music2,
} from "lucide-react";
import { Wordmark } from "@/components/ui/Wordmark";
import { AllContentGrid } from "@/components/report/AllContentGrid";
import { ViewsCharts } from "@/components/report/ViewsCharts";
import {
  buildChartFromSnapshots,
  buildSeriesFromCumulativeSnapshots,
  calculateMetrics,
  campaignArtwork,
  campaignSoundArtist,
  campaignSoundTitle,
  formatCompactNumber,
  formatEngagementRate,
  formatFullNumber,
  formatGbpExact,
  formatPostsVsTargetLabel,
  formatShortDate,
  sortReportPosts,
  type ReportChartPoint,
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

function FeaturedViewsChart({ series }: { series: ReportChartPoint[] }) {
  const width = 640;
  const height = 150;
  const values = series.map((point) => Math.max(0, point.cumulative));
  const max = Math.max(...values, 1);
  const points = series.map((point, index) => {
    const x =
      series.length === 1 ? width - 10 : (index / (series.length - 1)) * width;
    const y = height - 10 - (Math.max(0, point.cumulative) / max) * (height - 24);
    return `${x},${y}`;
  });
  const line = points.join(" ");
  const area = line ? `0,${height} ${line} ${width},${height}` : "";

  return (
    <div className="report-results__featured-chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Cumulative campaign views trend"
      >
        <defs>
          <linearGradient
            id="report-featured-views-fill"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0%" stopColor="rgba(198,255,0,0.32)" />
            <stop offset="100%" stopColor="rgba(198,255,0,0)" />
          </linearGradient>
        </defs>
        {series.length >= 2 ? (
          <>
            <polygon points={area} fill="url(#report-featured-views-fill)" />
            <polyline
              points={line}
              fill="none"
              stroke="#c6ff00"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </>
        ) : (
          <line
            x1="0"
            x2={width}
            y1={height - 10}
            y2={height - 10}
            stroke="rgba(198,255,0,0.28)"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
    </div>
  );
}

function MetricSparkline({ variant }: { variant: 1 | 2 | 3 | 4 }) {
  const paths = {
    1: "M2 27 C14 25 19 18 31 21 S48 25 59 17 S77 18 94 10",
    2: "M2 27 C13 24 18 25 28 20 S45 16 57 19 S72 22 94 12",
    3: "M2 27 C14 26 25 22 36 23 S49 12 62 20 S76 14 94 13",
    4: "M2 28 C16 27 24 24 34 25 S48 13 60 20 S72 22 94 11",
  };

  return (
    <span className="report-metric-card__sparkline" aria-hidden="true">
      <svg viewBox="0 0 96 34" preserveAspectRatio="none">
        <path d={paths[variant]} />
      </svg>
    </span>
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

  const topPosts = sortReportPosts(postList, "views").slice(0, 3);
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
        <section className="report-overview" aria-label="Campaign overview">
          <article
            className="report-overview-card report-summary"
            aria-label="Campaign information"
          >
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
                {formatGbpExact(Number(campaign.budget))}
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
              <p className="report-metric-card__label">Campaign Views</p>
              <p className="report-results__featured-value">
                {formatFullNumber(metrics.views)}
              </p>
              <FeaturedViewsChart series={viewsSeries} />
            </div>
            <div className="report-results__grid">
              <div className="report-metric-card">
                <div>
                  <p className="report-metric-card__label">Likes</p>
                  <p className="report-metric-card__value">
                    {formatFullNumber(metrics.likes)}
                  </p>
                </div>
                <MetricSparkline variant={1} />
              </div>
              <div className="report-metric-card">
                <div>
                  <p className="report-metric-card__label">Comments</p>
                  <p className="report-metric-card__value">
                    {formatFullNumber(metrics.comments)}
                  </p>
                </div>
                <MetricSparkline variant={2} />
              </div>
              <div className="report-metric-card">
                <div>
                  <p className="report-metric-card__label">Shares</p>
                  <p className="report-metric-card__value">
                    {formatFullNumber(metrics.shares)}
                  </p>
                </div>
                <MetricSparkline variant={3} />
              </div>
              <div className="report-metric-card">
                <div>
                  <p className="report-metric-card__label">Engagement Rate</p>
                  <p className="report-metric-card__value">
                    {formatEngagementRate(metrics.engagementRate)}
                  </p>
                </div>
                <MetricSparkline variant={4} />
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
  );
}
