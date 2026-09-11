"use client";

import { useMemo, useState } from "react";
import {
  ImageOff,
  Download,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  formatCompactNumber,
  formatDateTime,
  formatFullNumber,
  formatShortDate,
  getReportPagination,
  sortReportPosts,
  type ReportPostSortKey,
} from "@/lib/portal/metrics";
import type { ReportPost } from "@/lib/portal/report";

type ViewMode = "grid" | "list";

const PAGE_SIZE = 10;

function exportCsv(posts: ReportPost[]) {
  const header = [
    "creator_handle",
    "posted_at",
    "views",
    "likes",
    "comments",
    "shares",
    "post_url",
  ];
  const rows = posts.map((post) =>
    [
      post.creator_handle,
      post.posted_at || "",
      post.views,
      post.likes,
      post.comments,
      post.shares,
      post.post_url,
    ]
      .map((value) => `"${String(value).replaceAll('"', '""')}"`)
      .join(","),
  );
  const blob = new Blob([[header.join(","), ...rows].join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "katalyst-campaign-content.csv";
  a.hidden = true;
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function AllContentGrid({ posts }: { posts: ReportPost[] }) {
  const [sort, setSort] = useState<ReportPostSortKey>("views");
  const [view, setView] = useState<ViewMode>("grid");
  const [page, setPage] = useState(1);

  const sorted = useMemo(() => {
    return sortReportPosts(posts, sort);
  }, [posts, sort]);

  const {
    totalPages,
    currentPage,
    start,
    showingFrom,
    showingTo,
    visiblePages,
  } = getReportPagination(sorted.length, page, PAGE_SIZE);
  const pageItems = sorted.slice(start, start + PAGE_SIZE);

  return (
    <section className="report-section">
      <div className="report-section__head">
        <div className="report-section__title-wrap">
          <h2 className="report-section__title">All Content</h2>
          <p className="report-section__sub">
            Track every post from this campaign.
          </p>
        </div>
        <div className="report-section__controls">
          <select
            className="report-select"
            value={sort}
            aria-label="Sort content"
            onChange={(e) => {
              setSort(e.target.value as ReportPostSortKey);
              setPage(1);
            }}
          >
            <option value="views">Most Views</option>
            <option value="likes">Most Likes</option>
            <option value="comments">Most Comments</option>
            <option value="shares">Most Shares</option>
            <option value="newest">Newest</option>
          </select>
          <button
            type="button"
            className="report-tool-btn"
            onClick={() => exportCsv(sorted)}
          >
            <Download className="size-3.5" aria-hidden="true" />
            Export to CSV
          </button>
          <button
            type="button"
            className={`report-tool-btn ${view === "grid" ? "is-active" : ""}`}
            aria-label="Grid view"
            aria-pressed={view === "grid"}
            onClick={() => setView("grid")}
          >
            <LayoutGrid className="size-3.5" />
          </button>
          <button
            type="button"
            className={`report-tool-btn ${view === "list" ? "is-active" : ""}`}
            aria-label="List view"
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
          >
            <List className="size-3.5" />
          </button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="report-panel report-empty">
          No tracked posts in this campaign yet.
        </div>
      ) : view === "grid" ? (
        <div className="report-content-grid">
          {pageItems.map((post) => (
            <a
              key={post.id}
              href={post.post_url}
              target="_blank"
              rel="noopener noreferrer"
              className="report-vcard report-vcard--compact"
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
                <div className="report-vcard__fade" aria-hidden="true" />
              </div>
              <div className="report-vcard__body">
                <p className="report-vcard__date">
                  {post.posted_at
                    ? formatDateTime(post.posted_at)
                    : formatShortDate(post.created_at)}
                </p>
                <p className="report-vcard__handle">{post.creator_handle}</p>
                <div className="report-vcard__metrics">
                  <span
                    className="report-vcard__metric"
                    title={`${formatFullNumber(post.views)} views`}
                  >
                    <span className="report-vcard__metric-label">Views</span>
                    {formatCompactNumber(post.views)}
                  </span>
                  <span
                    className="report-vcard__metric"
                    title={`${formatFullNumber(post.likes)} likes`}
                  >
                    <span className="report-vcard__metric-label">Likes</span>
                    {formatCompactNumber(post.likes)}
                  </span>
                  <span
                    className="report-vcard__metric"
                    title={`${formatFullNumber(post.comments)} comments`}
                  >
                    <span className="report-vcard__metric-label">Comments</span>
                    {formatCompactNumber(post.comments)}
                  </span>
                  <span
                    className="report-vcard__metric"
                    title={`${formatFullNumber(post.shares)} shares`}
                  >
                    <span className="report-vcard__metric-label">Shares</span>
                    {formatCompactNumber(post.shares)}
                  </span>
                </div>
              </div>
            </a>
          ))}
        </div>
      ) : (
        <div className="report-content-list">
          {pageItems.map((post) => (
            <a
              key={post.id}
              href={post.post_url}
              target="_blank"
              rel="noopener noreferrer"
              className="report-vcard report-vcard--list"
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
                    <span className="sr-only">Preview unavailable</span>
                  </span>
                )}
              </div>
              <div className="report-vcard__body">
                <div className="report-vcard__row">
                  <p className="report-vcard__handle">{post.creator_handle}</p>
                  <p className="report-vcard__date">
                    {formatShortDate(post.posted_at || post.created_at)}
                  </p>
                </div>
                <div className="report-vcard__metrics">
                  <span
                    className="report-vcard__metric"
                    title={`${formatFullNumber(post.views)} views`}
                  >
                    <span className="report-vcard__metric-label">Views</span>
                    {formatCompactNumber(post.views)}
                  </span>
                  <span
                    className="report-vcard__metric"
                    title={`${formatFullNumber(post.likes)} likes`}
                  >
                    <span className="report-vcard__metric-label">Likes</span>
                    {formatCompactNumber(post.likes)}
                  </span>
                  <span
                    className="report-vcard__metric"
                    title={`${formatFullNumber(post.comments)} comments`}
                  >
                    <span className="report-vcard__metric-label">Comments</span>
                    {formatCompactNumber(post.comments)}
                  </span>
                  <span
                    className="report-vcard__metric"
                    title={`${formatFullNumber(post.shares)} shares`}
                  >
                    <span className="report-vcard__metric-label">Shares</span>
                    {formatCompactNumber(post.shares)}
                  </span>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}

      {sorted.length > 0 ? (
        <div className="report-footer-bar">
          <p>
            Showing {showingFrom}–{showingTo} items
          </p>
          <div className="report-pagination">
            <button
              type="button"
              className="report-page-btn"
              aria-label="Previous page"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="size-3.5" />
            </button>
            {visiblePages.map((n) => (
              <button
                key={n}
                type="button"
                className={`report-page-btn ${
                  n === currentPage ? "is-active" : ""
                }`}
                aria-label={`Page ${n} of ${totalPages}`}
                aria-current={n === currentPage ? "page" : undefined}
                onClick={() => setPage(n)}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              className="report-page-btn"
              aria-label="Next page"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
