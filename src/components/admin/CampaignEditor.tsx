"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  addTikTokPostByUrl,
  createTikTokPostManual,
  deleteTikTokPost,
  disableCampaignShare,
  importTikTokPostsByUrls,
  publishCampaignReport,
  refreshCampaignPosts,
  refreshCampaignSound,
  refreshFailedCampaignPosts,
  refreshTikTokPost,
  regenerateCampaignShare,
  setCampaignStatus,
  updateCampaignBudget,
  updateTikTokPostManual,
  type AddPostResult,
} from "@/lib/portal/actions";
import { toUserError } from "@/lib/portal/errors";
import {
  buildChartFromSnapshots,
  calculateMetrics,
  campaignArtwork,
  campaignHeadline,
  formatCompactNumber,
  formatDateTime,
  formatEngagementRate,
  formatFullNumber,
  formatGbp,
  formatRelativeUpdated,
  formatShortDate,
} from "@/lib/portal/metrics";
import type {
  Campaign,
  Client,
  PostMetricSnapshot,
  TikTokPost,
} from "@/lib/supabase/database.types";
import { company } from "@/content/company";
import { StatusBadge } from "@/components/admin/AdminSidebar";
import { ViewsCharts } from "@/components/report/ViewsCharts";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { useAdminToast } from "@/components/admin/AdminToast";
import { CampaignActionsMenu } from "@/components/admin/CampaignActions";

const tabs = ["overview", "content", "sharing"] as const;
type Tab = (typeof tabs)[number];

export function CampaignEditor({
  campaign,
  client,
  posts,
  snapshots,
  initialTab = "overview",
}: {
  campaign: Campaign;
  client: Client;
  posts: TikTokPost[];
  snapshots: PostMetricSnapshot[];
  initialTab?: Tab;
}) {
  const router = useRouter();
  const { toast } = useAdminToast();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"pause" | "close" | null>(null);
  const [deletePostId, setDeletePostId] = useState<string | null>(null);
  const [refreshProgress, setRefreshProgress] = useState<string | null>(null);
  const [failedPostIds, setFailedPostIds] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [postUrl, setPostUrl] = useState("");
  const [bulkPaste, setBulkPaste] = useState("");
  const [importResults, setImportResults] = useState<AddPostResult[] | null>(
    null,
  );
  const [previewPost, setPreviewPost] = useState<Extract<
    AddPostResult,
    { status: "added" }
  > | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [editingPost, setEditingPost] = useState<TikTokPost | null>(null);
  const [sort, setSort] = useState<"views" | "likes" | "shares" | "newest">(
    "views",
  );
  const [query, setQuery] = useState("");

  const metrics = useMemo(() => calculateMetrics(posts), [posts]);
  const chartData = useMemo(
    () => buildChartFromSnapshots(posts, snapshots),
    [posts, snapshots],
  );
  const artwork = campaignArtwork(campaign);
  const headline = campaignHeadline(campaign, client);
  const reportUrl = campaign.share_token
    ? `${company.url}/report/${campaign.share_token}`
    : null;

  const sortedPosts = useMemo(() => {
    let list = [...posts];
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((p) =>
        `${p.creator_handle} ${p.title ?? ""} ${p.post_url}`
          .toLowerCase()
          .includes(q),
      );
    }
    switch (sort) {
      case "likes":
        return list.sort((a, b) => b.likes - a.likes);
      case "shares":
        return list.sort((a, b) => b.shares - a.shares);
      case "newest":
        return list.sort(
          (a, b) =>
            +new Date(b.posted_at || b.created_at) -
            +new Date(a.posted_at || a.created_at),
        );
      default:
        return list.sort((a, b) => b.views - a.views);
    }
  }, [posts, query, sort]);

  const run = (fn: () => Promise<unknown>, ok = "Saved.") => {
    startTransition(async () => {
      try {
        await fn();
        if (ok) {
          setMessage(ok);
          toast(ok.startsWith("✓") ? ok : `✓ ${ok}`);
        }
        router.refresh();
      } catch (error) {
        const text = toUserError(error);
        setMessage(text);
        toast(text, "error");
      } finally {
        setBusyLabel(null);
      }
    });
  };

  const copyLink = async () => {
    if (!reportUrl) return;
    await navigator.clipboard.writeText(reportUrl);
    setCopied(true);
    toast("✓ Client link copied");
    setMessage("Client link copied.");
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div>
      <Link href="/admin" className="text-sm text-soft-grey hover:text-off-white">
        ← Campaign Library
      </Link>

      <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-4">
          <div className="hidden size-20 overflow-hidden rounded-[8px] bg-graphite sm:block">
            {artwork ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={artwork} alt="" className="size-full object-cover" />
            ) : null}
          </div>
          <div>
            <h1 className="admin-page-title !mt-0">{headline}</h1>
            <p className="mt-1 text-sm text-soft-grey">TikTok Campaign</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusBadge status={campaign.status} />
              <CampaignActionsMenu campaign={campaign} clientId={client.id} />
              {campaign.status === "live" ? (
                <button
                  type="button"
                  className="admin-btn admin-btn--ghost"
                  disabled={pending}
                  onClick={() => setConfirm("pause")}
                >
                  Pause
                </button>
              ) : null}
              {campaign.status === "paused" ? (
                <button
                  type="button"
                  className="admin-btn admin-btn--primary"
                  disabled={pending}
                  onClick={() =>
                    run(
                      () => setCampaignStatus(campaign.id, "live"),
                      "Campaign resumed",
                    )
                  }
                >
                  Resume
                </button>
              ) : null}
              {campaign.status !== "closed" && campaign.status !== "draft" ? (
                <button
                  type="button"
                  className="admin-btn admin-btn--ghost"
                  disabled={pending}
                  onClick={() => setConfirm("close")}
                >
                  Close
                </button>
              ) : null}
              {campaign.status === "closed" ? (
                <button
                  type="button"
                  className="admin-btn admin-btn--primary"
                  disabled={pending}
                  onClick={() =>
                    run(
                      () => setCampaignStatus(campaign.id, "live"),
                      "Campaign reopened",
                    )
                  }
                >
                  Reopen
                </button>
              ) : null}
              {campaign.tiktok_sound_url ? (
                <a
                  href={campaign.tiktok_sound_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-acid-lime"
                >
                  View Sound on TikTok ↗
                </a>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {campaign.share_enabled && campaign.share_token ? (
            <>
              <Link
                href={`/report/${campaign.share_token}`}
                target="_blank"
                className="admin-btn admin-btn--ghost"
              >
                Preview Report
              </Link>
              <button
                type="button"
                className="admin-btn admin-btn--primary"
                onClick={copyLink}
              >
                {copied ? "Copied ✓" : "Copy Client Link"}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="admin-btn admin-btn--primary"
              disabled={pending}
              onClick={() => {
                setBusyLabel("Publishing…");
                run(
                  () => publishCampaignReport(campaign.id),
                  "Report published",
                );
              }}
            >
              {busyLabel === "Publishing…" ? "Publishing…" : "Publish Report"}
            </button>
          )}
        </div>
      </div>

      {message ? (
        <p className="mt-4 text-sm text-acid-lime" role="status">
          {message}
        </p>
      ) : null}

      <div className="admin-tabs mt-6" role="tablist">
        {tabs.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            className="admin-tab"
            aria-selected={tab === item}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <div className="mt-6 space-y-6">
          <div className="admin-panel grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="admin-metric__label">Budget</p>
              <p className="admin-metric__value text-[1.4rem]">
                {formatGbp(Number(campaign.budget))}
              </p>
            </div>
            <div>
              <p className="admin-metric__label">Sound Usage</p>
              <p className="admin-metric__value text-[1.4rem]">
                {campaign.sound_usage_count != null
                  ? formatCompactNumber(Number(campaign.sound_usage_count))
                  : "—"}
              </p>
              <p className="mt-1 text-[0.68rem] text-muted-grey">
                TikTok posts using this sound
              </p>
            </div>
            <div>
              <p className="admin-metric__label">Tracked Campaign Posts</p>
              <p className="admin-metric__value text-[1.4rem]">
                {metrics.posts}
              </p>
              <p className="mt-1 text-[0.68rem] text-muted-grey">
                Katalyst placements only
              </p>
            </div>
            <div>
              <p className="admin-metric__label">Last Synced</p>
              <p className="mt-2 text-sm text-off-white">
                {campaign.last_synced_at
                  ? formatDateTime(campaign.last_synced_at)
                  : "Not synced yet"}
              </p>
              <button
                type="button"
                className="admin-btn admin-btn--primary mt-3"
                disabled={pending || posts.length === 0}
                title={
                  posts.length === 0
                    ? "Add TikTok posts before refreshing"
                    : "Refresh all tracked post metrics"
                }
                onClick={() =>
                  run(async () => {
                    setFailedPostIds([]);
                    setRefreshProgress(
                      `Refreshing campaign data… 0 / ${posts.length}`,
                    );
                    const result = await refreshCampaignPosts(campaign.id);
                    setRefreshProgress(null);
                    setFailedPostIds(result.failedPostIds);
                    const msg = `Campaign updated · ${result.updated}/${result.total} posts refreshed · Views ${formatCompactNumber(result.before.views)} → ${formatCompactNumber(result.after.views)}${result.failed ? ` · ${result.failed} failed` : ""}`;
                    setMessage(msg);
                    toast(
                      result.failed
                        ? `${result.updated}/${result.total} updated`
                        : "✓ Campaign refreshed",
                      result.failed ? "warn" : "ok",
                    );
                  }, "")
                }
              >
                {refreshProgress ? "Refreshing…" : "Refresh Data"}
              </button>
              {refreshProgress ? (
                <p className="mt-2 text-xs text-acid-lime">{refreshProgress}</p>
              ) : null}
              {failedPostIds.length > 0 ? (
                <button
                  type="button"
                  className="admin-btn admin-btn--ghost mt-2"
                  disabled={pending}
                  onClick={() =>
                    run(async () => {
                      setRefreshProgress(
                        `Retrying failed posts… 0 / ${failedPostIds.length}`,
                      );
                      const result = await refreshFailedCampaignPosts(
                        campaign.id,
                        failedPostIds,
                      );
                      setRefreshProgress(null);
                      setFailedPostIds(result.failedPostIds);
                      setMessage(
                        `Retry complete · ${result.updated}/${result.total} updated${result.failed ? ` · ${result.failed} still failing` : ""}`,
                      );
                      toast(
                        result.failed
                          ? `${result.failed} still failing`
                          : "✓ Failed posts refreshed",
                        result.failed ? "warn" : "ok",
                      );
                    }, "")
                  }
                >
                  Retry Failed ({failedPostIds.length})
                </button>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {[
              ["Views", formatCompactNumber(metrics.views)],
              ["Likes", formatCompactNumber(metrics.likes)],
              ["Comments", formatCompactNumber(metrics.comments)],
              ["Shares", formatCompactNumber(metrics.shares)],
              ["Eng. Rate", formatEngagementRate(metrics.engagementRate)],
              ["Posts", String(metrics.posts)],
            ].map(([label, value]) => (
              <div key={label} className="admin-panel admin-metric">
                <p className="admin-metric__label">{label}</p>
                <p className="admin-metric__value">{value}</p>
              </div>
            ))}
          </div>

          <ViewsCharts daily={chartData} />

          <form
            className="admin-panel space-y-3 p-5"
            action={(formData) =>
              run(() => updateCampaignBudget(campaign.id, formData))
            }
          >
            <h2 className="font-display text-lg font-semibold tracking-[-0.03em]">
              Campaign settings
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="admin-label">Budget (GBP)</label>
                <input
                  name="budget"
                  type="number"
                  min="0"
                  step="0.01"
                  className="admin-input"
                  defaultValue={campaign.budget}
                  required
                />
              </div>
              <div>
                <label className="admin-label">Sound usage (optional)</label>
                <input
                  name="sound_usage_count"
                  type="number"
                  min="0"
                  className="admin-input"
                  defaultValue={campaign.sound_usage_count ?? ""}
                  placeholder="TikTok creations using this sound"
                />
              </div>
            </div>
            <div>
              <label className="admin-label">Artwork override URL</label>
              <input
                name="artwork_url"
                className="admin-input"
                defaultValue={campaign.artwork_url ?? ""}
                placeholder="Optional — overrides sound artwork"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="submit" className="admin-btn admin-btn--primary" disabled={pending}>
                Save settings
              </button>
              <button
                type="button"
                className="admin-btn admin-btn--ghost"
                disabled={pending || !campaign.tiktok_sound_url}
                onClick={() =>
                  run(() => refreshCampaignSound(campaign.id), "Sound data refreshed.")
                }
              >
                Refresh Sound Data
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {tab === "content" ? (
        <div className="mt-6 space-y-5">
          <div className="admin-panel space-y-4 p-5">
            <h2 className="font-display text-lg font-semibold tracking-[-0.03em]">
              Add TikTok Post
            </h2>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                className="admin-input flex-1"
                placeholder="https://www.tiktok.com/@creator/video/…"
                value={postUrl}
                onChange={(e) => setPostUrl(e.target.value)}
              />
              <button
                type="button"
                className="admin-btn admin-btn--primary"
                disabled={pending || !postUrl.trim()}
                onClick={() => {
                  setBusyLabel("Fetching TikTok…");
                  run(async () => {
                    setPreviewPost(null);
                    setMessage("Fetching TikTok post…");
                    const result = await addTikTokPostByUrl(
                      campaign.id,
                      postUrl,
                    );
                    if (result.status === "added") {
                      setPreviewPost(result);
                      setPostUrl("");
                      setMessage(
                        result.metricsComplete
                          ? "✓ TikTok post added"
                          : "Post added — metrics incomplete, edit if needed.",
                      );
                      toast(
                        result.metricsComplete
                          ? "✓ TikTok post added"
                          : "Post added — check metrics",
                        result.metricsComplete ? "ok" : "warn",
                      );
                    } else if (result.status === "duplicate") {
                      setMessage("This TikTok post is already in the campaign.");
                      toast("Duplicate post skipped", "warn");
                    } else {
                      setShowManual(true);
                      const msg = toUserError(
                        result.error,
                        "We couldn't retrieve this TikTok post.",
                      );
                      setMessage(msg);
                      toast(msg, "error");
                    }
                  }, "");
                }}
              >
                {busyLabel === "Fetching TikTok…" ? "Fetching TikTok…" : "Add Post"}
              </button>
            </div>

            {previewPost ? (
              <div className="flex gap-3 rounded-[8px] border border-white/10 p-3">
                <div className="h-24 w-16 overflow-hidden rounded bg-graphite">
                  {previewPost.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewPost.thumbnailUrl}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="text-sm">
                  <p className="font-semibold">{previewPost.creatorHandle}</p>
                  <p className="mt-1 text-soft-grey">
                    {formatFullNumber(previewPost.views)} views ·{" "}
                    {formatFullNumber(previewPost.likes)} likes ·{" "}
                    {formatFullNumber(previewPost.comments)} comments ·{" "}
                    {formatFullNumber(previewPost.shares)} shares
                  </p>
                  {previewPost.postedAt ? (
                    <p className="mt-1 text-xs text-muted-grey">
                      Posted {formatShortDate(previewPost.postedAt)}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div>
              <label className="admin-label">Bulk add posts</label>
              <textarea
                className="admin-input min-h-[7rem]"
                placeholder={"Paste multiple TikTok URLs, one per line"}
                value={bulkPaste}
                onChange={(e) => setBulkPaste(e.target.value)}
              />
              <button
                type="button"
                className="admin-btn admin-btn--ghost mt-2"
                disabled={pending || !bulkPaste.trim()}
                onClick={() => {
                  setBusyLabel("Importing…");
                  run(async () => {
                    setMessage("Importing posts…");
                    const results = await importTikTokPostsByUrls(
                      campaign.id,
                      bulkPaste,
                    );
                    setImportResults(results);
                    setBulkPaste("");
                    const added = results.filter((r) => r.status === "added").length;
                    const duplicates = results.filter(
                      (r) => r.status === "duplicate",
                    ).length;
                    const failed = results.filter(
                      (r) => r.status === "failed" || r.status === "invalid",
                    ).length;
                    const summary = `✓ ${added} Added · ${duplicates} Duplicates · ${failed} Failed`;
                    setMessage(summary);
                    toast(summary, failed ? "warn" : "ok");
                  }, "");
                }}
              >
                {busyLabel === "Importing…" ? "Importing…" : "Import Posts"}
              </button>
              {importResults ? (
                <div className="mt-3 space-y-2">
                  <ul className="space-y-1 text-sm">
                    {importResults.map((result, index) => (
                      <li key={`${result.url}-${index}`} className="text-soft-grey">
                        {result.status === "added"
                          ? `✓ Added ${result.creatorHandle}`
                          : result.status === "duplicate"
                            ? `• Duplicate skipped`
                            : `⚠ ${toUserError(result.error, "Could not import")}`}
                      </li>
                    ))}
                  </ul>
                  {importResults.some(
                    (r) => r.status === "failed" || r.status === "invalid",
                  ) ? (
                    <button
                      type="button"
                      className="admin-btn admin-btn--ghost"
                      disabled={pending}
                      onClick={() => {
                        const failedUrls = importResults
                          .filter(
                            (r) =>
                              r.status === "failed" || r.status === "invalid",
                          )
                          .map((r) => r.url)
                          .join("\n");
                        setBulkPaste(failedUrls);
                        setMessage("Failed URLs ready to retry — Import Posts again.");
                      }}
                    >
                      Retry Failed
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>

            <button
              type="button"
              className="text-sm text-muted-grey underline"
              onClick={() => setShowManual((v) => !v)}
            >
              {showManual ? "Hide manual entry" : "Enter details manually"}
            </button>

            {showManual ? (
              <form
                className="grid gap-3 border-t border-white/8 pt-4 sm:grid-cols-2"
                action={(formData) =>
                  run(() => createTikTokPostManual(campaign.id, formData), "Post saved.")
                }
              >
                <div className="sm:col-span-2">
                  <label className="admin-label">TikTok URL *</label>
                  <input name="post_url" className="admin-input" required defaultValue={postUrl} />
                </div>
                <div>
                  <label className="admin-label">Creator *</label>
                  <input name="creator_handle" className="admin-input" required placeholder="@handle" />
                </div>
                <div>
                  <label className="admin-label">Posted at</label>
                  <input name="posted_at" type="datetime-local" className="admin-input" />
                </div>
                <div>
                  <label className="admin-label">Views</label>
                  <input name="views" type="number" min="0" className="admin-input" defaultValue={0} />
                </div>
                <div>
                  <label className="admin-label">Likes</label>
                  <input name="likes" type="number" min="0" className="admin-input" defaultValue={0} />
                </div>
                <div>
                  <label className="admin-label">Comments</label>
                  <input name="comments" type="number" min="0" className="admin-input" defaultValue={0} />
                </div>
                <div>
                  <label className="admin-label">Shares</label>
                  <input name="shares" type="number" min="0" className="admin-input" defaultValue={0} />
                </div>
                <div className="sm:col-span-2">
                  <label className="admin-label">Thumbnail URL</label>
                  <input name="thumbnail_url" className="admin-input" />
                </div>
                <div className="sm:col-span-2">
                  <button type="submit" className="admin-btn admin-btn--primary" disabled={pending}>
                    Save manual post
                  </button>
                </div>
              </form>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-display text-lg font-semibold tracking-[-0.03em]">
              TikTok Posts ({posts.length})
            </h2>
            <div className="flex flex-wrap gap-2">
              <input
                className="admin-input min-w-[12rem]"
                placeholder="Search…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <select
                className="admin-select w-auto"
                value={sort}
                onChange={(e) =>
                  setSort(e.target.value as typeof sort)
                }
              >
                <option value="views">Most Views</option>
                <option value="likes">Most Likes</option>
                <option value="shares">Most Shares</option>
                <option value="newest">Newest</option>
              </select>
            </div>
          </div>

          <div className="admin-panel overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Post</th>
                  <th>Creator</th>
                  <th>Views</th>
                  <th>Likes</th>
                  <th>Comments</th>
                  <th>Shares</th>
                  <th>Posted</th>
                  <th>Synced</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedPosts.map((post) => (
                  <tr key={post.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="h-14 w-10 overflow-hidden rounded bg-graphite">
                          {post.thumbnail_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={post.thumbnail_url}
                              alt=""
                              className="size-full object-cover"
                            />
                          ) : null}
                        </div>
                        <div className="max-w-[12rem] truncate text-xs text-muted-grey">
                          {post.title || post.post_url}
                        </div>
                      </div>
                    </td>
                    <td>{post.creator_handle}</td>
                    <td>{formatCompactNumber(post.views)}</td>
                    <td>{formatCompactNumber(post.likes)}</td>
                    <td>{formatCompactNumber(post.comments)}</td>
                    <td>{formatCompactNumber(post.shares)}</td>
                    <td>
                      {post.posted_at
                        ? formatShortDate(post.posted_at)
                        : "—"}
                    </td>
                    <td className="text-xs text-muted-grey">
                      {post.last_synced_at
                        ? formatRelativeUpdated(post.last_synced_at)
                        : "—"}
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <a
                          href={post.post_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-acid-lime"
                        >
                          Open
                        </a>
                        <button
                          type="button"
                          className="text-xs text-soft-grey"
                          disabled={pending}
                          onClick={() =>
                            run(
                              () => refreshTikTokPost(post.id, campaign.id),
                              "Post refreshed.",
                            )
                          }
                        >
                          Refresh
                        </button>
                        <button
                          type="button"
                          className="text-xs text-soft-grey"
                          onClick={() => setEditingPost(post)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="text-xs text-[#ff8f8f]"
                          disabled={pending}
                          onClick={() => setDeletePostId(post.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sortedPosts.length === 0 ? (
              <div className="admin-empty border-0">
                <p className="font-display text-base font-semibold">
                  No TikTok posts tracked yet
                </p>
                <p className="mt-2 text-sm text-soft-grey">
                  Paste TikTok URLs above to begin tracking campaign performance.
                </p>
              </div>
            ) : null}
          </div>

          {editingPost ? (
            <form
              className="admin-panel grid gap-3 p-5 sm:grid-cols-2"
              action={(formData) =>
                run(async () => {
                  await updateTikTokPostManual(
                    editingPost.id,
                    campaign.id,
                    formData,
                  );
                  setEditingPost(null);
                }, "Post updated.")
              }
            >
              <h3 className="sm:col-span-2 font-display text-base font-semibold">
                Edit / correct data
              </h3>
              <div className="sm:col-span-2">
                <label className="admin-label">URL</label>
                <input
                  name="post_url"
                  className="admin-input"
                  defaultValue={editingPost.post_url}
                  required
                />
              </div>
              <div>
                <label className="admin-label">Creator</label>
                <input
                  name="creator_handle"
                  className="admin-input"
                  defaultValue={editingPost.creator_handle}
                  required
                />
              </div>
              <div>
                <label className="admin-label">Posted at</label>
                <input
                  name="posted_at"
                  className="admin-input"
                  defaultValue={editingPost.posted_at ?? ""}
                  placeholder="ISO date"
                />
              </div>
              <div>
                <label className="admin-label">Views</label>
                <input
                  name="views"
                  type="number"
                  className="admin-input"
                  defaultValue={editingPost.views}
                />
              </div>
              <div>
                <label className="admin-label">Likes</label>
                <input
                  name="likes"
                  type="number"
                  className="admin-input"
                  defaultValue={editingPost.likes}
                />
              </div>
              <div>
                <label className="admin-label">Comments</label>
                <input
                  name="comments"
                  type="number"
                  className="admin-input"
                  defaultValue={editingPost.comments}
                />
              </div>
              <div>
                <label className="admin-label">Shares</label>
                <input
                  name="shares"
                  type="number"
                  className="admin-input"
                  defaultValue={editingPost.shares}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="admin-label">Thumbnail URL</label>
                <input
                  name="thumbnail_url"
                  className="admin-input"
                  defaultValue={editingPost.thumbnail_url ?? ""}
                />
              </div>
              <div className="flex gap-2 sm:col-span-2">
                <button type="submit" className="admin-btn admin-btn--primary">
                  Save corrections
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn--ghost"
                  onClick={() => setEditingPost(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : null}
        </div>
      ) : null}

      {tab === "sharing" ? (
        <div className="admin-panel mt-6 max-w-2xl space-y-4 p-5">
          <h2 className="font-display text-lg font-semibold tracking-[-0.03em]">
            Client Report
          </h2>
          {!campaign.share_enabled || !campaign.share_token ? (
            <>
              <p className="text-sm text-soft-grey">Not published yet.</p>
              <button
                type="button"
                className="admin-btn admin-btn--primary"
                disabled={pending}
                onClick={() =>
                  run(
                    () => publishCampaignReport(campaign.id),
                    "Report published.",
                  )
                }
              >
                Publish Report
              </button>
            </>
          ) : (
            <>
              <p className="text-sm">
                Status: <span className="text-acid-lime">Active</span>
              </p>
              <div>
                <p className="admin-label">Secure Client Link</p>
                <p className="break-all rounded-[8px] border border-white/10 bg-black/30 px-3 py-2 text-sm">
                  {reportUrl}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="admin-btn admin-btn--primary"
                  onClick={copyLink}
                >
                  {copied ? "Copied ✓" : "Copy Link"}
                </button>
                <Link
                  href={`/report/${campaign.share_token}`}
                  target="_blank"
                  className="admin-btn admin-btn--ghost"
                >
                  Preview
                </Link>
                <button
                  type="button"
                  className="admin-btn admin-btn--ghost"
                  disabled={pending}
                  onClick={() =>
                    run(
                      () => disableCampaignShare(campaign.id),
                      "Link disabled.",
                    )
                  }
                >
                  Disable Link
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn--ghost"
                  disabled={pending}
                  onClick={() =>
                    run(
                      () => regenerateCampaignShare(campaign.id),
                      "Link regenerated. Old link is invalid.",
                    )
                  }
                >
                  Regenerate Link
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}

      <ConfirmDialog
        open={confirm === "pause"}
        title="Pause Campaign?"
        body="The campaign will leave Live campaigns. You can resume anytime. Data and the client report stay available."
        confirmLabel="Pause"
        pending={pending}
        onCancel={() => setConfirm(null)}
        onConfirm={() =>
          run(async () => {
            await setCampaignStatus(campaign.id, "paused");
            setConfirm(null);
          }, "Campaign paused")
        }
      />
      <ConfirmDialog
        open={confirm === "close"}
        title="Close Campaign?"
        body="This will move the campaign to Closed / Previous. Historical data and the client report remain available unless you disable the share link."
        confirmLabel="Close Campaign"
        danger
        pending={pending}
        onCancel={() => setConfirm(null)}
        onConfirm={() =>
          run(async () => {
            await setCampaignStatus(campaign.id, "closed");
            setConfirm(null);
          }, "Campaign closed")
        }
      />
      <ConfirmDialog
        open={Boolean(deletePostId)}
        title="Remove this post?"
        body="This removes the TikTok post from the campaign. Historical snapshots for this post will also be removed."
        confirmLabel="Remove"
        danger
        pending={pending}
        onCancel={() => setDeletePostId(null)}
        onConfirm={() => {
          if (!deletePostId) return;
          run(async () => {
            await deleteTikTokPost(deletePostId, campaign.id);
            setDeletePostId(null);
          }, "Post removed");
        }}
      />
    </div>
  );
}
