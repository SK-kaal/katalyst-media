"use client";

import {
  createTikTokPostManual,
  deleteSelectedTikTokPosts,
  deleteTikTokPost,
  endCampaign,
  importTikTokPostsByUrls,
  moveCampaign,
  refreshCampaignData,
  refreshFailedCampaignPosts,
  refreshSelectedCampaignPosts,
  refreshTikTokPost,
  reopenCampaign,
  updateCampaignBudget,
  updateTikTokPostManual,
  type AddPostResult,
} from "@/lib/portal/actions";
import { rethrowNextNavigation, toUserError } from "@/lib/portal/errors";
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
  formatGbp,
  formatPostsVsTarget,
  formatRelativeUpdated,
  formatShortDate,
  formatWeeklyDelta,
  isPostFailed,
  weeklyDeltaFromSnapshots,
} from "@/lib/portal/metrics";
import type {
  Campaign,
  CampaignMetricSnapshot,
  Client,
  PostMetricSnapshot,
  SoundMetricSnapshot,
  TikTokPost,
} from "@/lib/supabase/database.types";
import { company } from "@/content/company";
import { StatusBadge } from "@/components/admin/AdminSidebar";
import { ViewsCharts } from "@/components/report/ViewsCharts";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { useAdminToast } from "@/components/admin/AdminToast";
import { CampaignActionsMenu } from "@/components/admin/CampaignActions";
import { SoundManager } from "@/components/admin/SoundManager";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Music2 } from "lucide-react";

const tabs = ["overview", "content", "sharing"] as const;
type Tab = (typeof tabs)[number];
const tabLabels: Record<Tab, string> = {
  overview: "Overview",
  content: "Content",
  sharing: "Sharing",
};

function toDateTimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function CampaignEditor({
  campaign,
  client,
  posts,
  snapshots,
  soundSnapshots = [],
  campaignSnapshots = [],
  clients = [],
  initialTab = "overview",
  openMove = false,
}: {
  campaign: Campaign;
  client: Client;
  posts: TikTokPost[];
  snapshots: PostMetricSnapshot[];
  soundSnapshots?: SoundMetricSnapshot[];
  campaignSnapshots?: CampaignMetricSnapshot[];
  clients?: Pick<Client, "id" | "name" | "handle">[];
  initialTab?: Tab;
  openMove?: boolean;
}) {
  const router = useRouter();
  const { toast } = useAdminToast();
  const tab = initialTab;
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"end" | "reopen" | null>(null);
  const [deletePostId, setDeletePostId] = useState<string | null>(null);
  const [refreshProgress, setRefreshProgress] = useState<string | null>(null);
  const [failedPostIds, setFailedPostIds] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [bulkPaste, setBulkPaste] = useState("");
  const [importResults, setImportResults] = useState<AddPostResult[] | null>(
    null,
  );
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [editingPost, setEditingPost] = useState<TikTokPost | null>(null);
  const [sort, setSort] = useState<"views" | "likes" | "shares" | "newest">(
    "views",
  );
  const [query, setQuery] = useState("");
  const [postFilter, setPostFilter] = useState<"all" | "attention">("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [moveOpen, setMoveOpen] = useState(openMove);
  const [moveClientId, setMoveClientId] = useState(campaign.client_id);
  const [bulkRemoveConfirm, setBulkRemoveConfirm] = useState(false);
  const moveDialogRef = useRef<HTMLDivElement>(null);
  const moveSelectRef = useRef<HTMLSelectElement>(null);

  const metrics = useMemo(() => calculateMetrics(posts), [posts]);
  const creationsSeries = useMemo(
    () =>
      buildSeriesFromCumulativeSnapshots(
        soundSnapshots.map((s) => ({
          captured_at: s.captured_at,
          value: Number(s.creation_count),
        })),
        campaign.sound_usage_count,
      ),
    [soundSnapshots, campaign.sound_usage_count],
  );
  const viewsSeries = useMemo(() => {
    const fromCampaign = buildSeriesFromCumulativeSnapshots(
      campaignSnapshots.map((s) => ({
        captured_at: s.captured_at,
        value: Number(s.views),
      })),
      metrics.views,
    );
    if (fromCampaign.length >= 2) return fromCampaign;
    return buildChartFromSnapshots(posts, snapshots, metrics.views).map(
      (row) => ({
        date: row.date,
        daily: row.views,
        cumulative: row.cumulative,
      }),
    );
  }, [campaignSnapshots, metrics.views, posts, snapshots]);
  const artwork = campaignArtwork(campaign);
  const title =
    campaign.display_title?.trim() ||
    campaignSoundTitle(campaign) ||
    "Untitled campaign";
  const soundArtist = campaignSoundArtist(campaign) || "";
  const artist =
    soundArtist && soundArtist.toLowerCase() !== title.toLowerCase()
      ? soundArtist
      : client.name;
  const failedCount = posts.filter(isPostFailed).length;
  const reportUrl = campaign.share_token
    ? `${company.url}/report/${campaign.share_token}`
    : null;
  const postsVsTarget = formatPostsVsTarget(metrics.posts, campaign.target_posts);
  const viewsWeekly = weeklyDeltaFromSnapshots(
    campaignSnapshots.map((s) => ({
      captured_at: s.captured_at,
      value: Number(s.views),
    })),
    metrics.views,
  );
  const viewsWeeklyLabel = viewsWeekly
    ? formatWeeklyDelta(viewsWeekly.delta)
    : null;

  const sortedPosts = useMemo(() => {
    let list = [...posts];
    if (postFilter === "attention") {
      list = list.filter(isPostFailed);
    }
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
  }, [posts, query, sort, postFilter]);

  const run = (fn: () => Promise<unknown>, ok = "Saved.") => {
    setMessage(null);
    startTransition(async () => {
      try {
        await fn();
        if (ok) {
          setMessage(ok);
          toast(ok.startsWith("✓") ? ok : `✓ ${ok}`);
        }
        router.refresh();
      } catch (error) {
        rethrowNextNavigation(error);
        const text = toUserError(error);
        setMessage(text);
        toast(text, "error");
      } finally {
        setBusyLabel(null);
      }
    });
  };

  const selectTab = (next: Tab) => {
    const params = new URLSearchParams(window.location.search);
    params.set("tab", next);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const handleTabKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    current: Tab,
  ) => {
    const currentIndex = tabs.indexOf(current);
    let nextIndex: number | null = null;

    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % tabs.length;
    if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    }
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    const next = tabs[nextIndex];
    document.getElementById(`campaign-tab-${next}`)?.focus();
    selectTab(next);
  };

  const closeMove = useCallback(() => {
    setMoveOpen(false);
    const url = new URL(window.location.href);
    url.searchParams.delete("move");
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, []);

  useEffect(() => {
    if (!moveOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => moveSelectRef.current?.focus(), 20);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMove();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = moveDialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [closeMove, moveOpen]);

  const copyLink = async () => {
    if (!reportUrl) return;
    try {
      await navigator.clipboard.writeText(reportUrl);
      setCopied(true);
      toast(
        campaign.status === "ended"
          ? "Copied ✓ · Client access currently disabled"
          : "Copied ✓",
      );
      setMessage(
        campaign.status === "ended"
          ? "Client link copied. Client access currently disabled."
          : "Client link copied.",
      );
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast("Could not copy the client link.", "error");
    }
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
            ) : (
              <span className="grid size-full place-items-center">
                <Music2 className="size-5 text-white/20" aria-hidden="true" />
              </span>
            )}
          </div>
          <div>
            <p className="admin-page-eyebrow">Campaign</p>
            <h1 className="admin-page-title !mt-0">{title}</h1>
            <p className="mt-1 text-sm text-soft-grey">{artist}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusBadge status={campaign.status} />
              <CampaignActionsMenu
                campaign={campaign}
                clientId={client.id}
                context="editor"
                onMove={() => {
                  setMoveClientId(campaign.client_id);
                  setMoveOpen(true);
                }}
              />
              {campaign.status === "active" ? (
                <button
                  type="button"
                  className="admin-btn admin-btn--ghost"
                  disabled={pending}
                  onClick={() => setConfirm("end")}
                >
                  {busyLabel === "Ending…" ? "Ending…" : "End Campaign"}
                </button>
              ) : null}
              {campaign.status === "ended" ? (
                <button
                  type="button"
                  className="admin-btn admin-btn--primary"
                  disabled={pending}
                  onClick={() => setConfirm("reopen")}
                >
                  {busyLabel === "Reopening…" ? "Reopening…" : "Reopen Campaign"}
                </button>
              ) : null}
              {campaign.tiktok_sound_url ? (
                <a
                  href={campaign.tiktok_sound_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-acid-lime"
                >
                  View Sound on TikTok ↗
                </a>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-2">
            <p className="admin-label">Campaign Budget</p>
            <p className="font-display text-xl font-semibold">
              {formatGbp(Number(campaign.budget))}
            </p>
          </div>
          <Link
            href={`/admin/campaigns/${campaign.id}/preview`}
            target="_blank"
            className="admin-btn admin-btn--ghost"
          >
            Preview Report
          </Link>
          {campaign.share_token ? (
            <button
              type="button"
              className="admin-btn admin-btn--primary"
              onClick={copyLink}
            >
              {copied ? "Copied ✓" : "Copy Client Link"}
            </button>
          ) : null}
          {campaign.status === "ended" ? (
            <p className="self-center text-xs text-muted-grey">
              Client access currently disabled
            </p>
          ) : null}
        </div>
      </div>

      {message ? (
        <p className="mt-4 text-sm text-soft-grey" role="status">
          {message}
        </p>
      ) : null}

      <div className="admin-tabs mt-6" role="tablist" aria-label="Campaign sections">
        {tabs.map((item) => (
          <button
            key={item}
            id={`campaign-tab-${item}`}
            type="button"
            role="tab"
            className="admin-tab"
            aria-selected={tab === item}
            aria-controls={`campaign-panel-${item}`}
            tabIndex={tab === item ? 0 : -1}
            onClick={() => selectTab(item)}
            onKeyDown={(event) => handleTabKeyDown(event, item)}
          >
            {tabLabels[item]}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <div
          id="campaign-panel-overview"
          className="mt-6 space-y-6"
          role="tabpanel"
          aria-labelledby="campaign-tab-overview"
          tabIndex={0}
        >
          <div className="admin-panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-lg font-semibold tracking-[-0.03em]">
                Refresh campaign data
              </h2>
              <p className="mt-1 text-sm text-soft-grey">
                {campaign.tiktok_sound_url
                  ? "TikTok sound and all tracked posts"
                  : "All tracked posts"}
                {campaign.last_synced_at
                  ? ` · Last refreshed ${formatRelativeUpdated(campaign.last_synced_at)}`
                  : " · Not refreshed yet"}
              </p>
              {refreshProgress ? (
                <p className="mt-2 text-xs text-acid-lime">{refreshProgress}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="admin-btn admin-btn--primary"
                disabled={pending}
                onClick={() =>
                  run(async () => {
                    setFailedPostIds([]);
                    setRefreshProgress("Refreshing TikTok data…");
                    const result = await refreshCampaignData(campaign.id);
                    setRefreshProgress(null);
                    setFailedPostIds(result.posts.failedPostIds);
                    const parts = [
                      `${result.posts.updated}/${result.posts.total} posts refreshed`,
                      `Views ${formatCompactNumber(result.posts.before.views)} → ${formatCompactNumber(result.posts.after.views)}`,
                    ];
                    if (!result.sound.ok) parts.push("Sound refresh failed");
                    if (result.posts.failed) {
                      parts.push(`${result.posts.failed} posts failed`);
                    }
                    setMessage(parts.join(" · "));
                    toast(
                      result.posts.failed || !result.sound.ok
                        ? "Refresh completed with issues"
                        : "✓ Campaign refreshed",
                      result.posts.failed || !result.sound.ok ? "warn" : "ok",
                    );
                  }, "")
                }
              >
                {refreshProgress ? "Refreshing…" : "Refresh Data"}
              </button>
              {failedPostIds.length > 0 ? (
                <button
                  type="button"
                  className="admin-btn admin-btn--ghost"
                  disabled={pending}
                  onClick={() =>
                    run(async () => {
                      const result = await refreshFailedCampaignPosts(
                        campaign.id,
                        failedPostIds,
                      );
                      setFailedPostIds(result.failedPostIds);
                      setMessage(
                        `Retry complete · ${result.updated}/${result.total} updated${result.failed ? ` · ${result.failed} still failing` : ""}`,
                      );
                    }, "")
                  }
                >
                  Retry Failed ({failedPostIds.length})
                </button>
              ) : null}
            </div>
          </div>

          <SoundManager campaign={campaign} />

          <div>
            <h2 className="font-display text-lg font-semibold tracking-[-0.03em]">
              Katalyst Campaign
            </h2>
            <p className="mt-1 text-xs text-muted-grey">
              Calculated only from tracked TikTok post URLs
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {[
                ["Campaign Posts", postsVsTarget],
                ["Campaign Views", formatFullNumber(metrics.views)],
                ["Likes", formatFullNumber(metrics.likes)],
                ["Comments", formatFullNumber(metrics.comments)],
                ["Shares", formatFullNumber(metrics.shares)],
                ["Engagement Rate", formatEngagementRate(metrics.engagementRate)],
              ].map(([label, value]) => (
                <div key={label} className="admin-panel admin-metric">
                  <p className="admin-metric__label">{label}</p>
                  <p className="admin-metric__value">{value}</p>
                  {label === "Campaign Views" && viewsWeeklyLabel ? (
                    <p className="mt-1 text-xs text-acid-lime">
                      {viewsWeeklyLabel}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          {posts.length === 0 ? (
            <div className="admin-empty">
              <p className="font-display text-lg font-semibold">
                No TikTok posts are being tracked yet
              </p>
              <p className="mt-2 text-sm text-soft-grey">
                Paste the campaign TikTok URLs to start tracking performance.
              </p>
              <button
                type="button"
                className="admin-btn admin-btn--primary mt-4"
                onClick={() => selectTab("content")}
              >
                Add Posts
              </button>
            </div>
          ) : (
            <ViewsCharts
              creations={creationsSeries}
              views={viewsSeries}
              creationsTotal={
                campaign.sound_usage_count != null
                  ? Number(campaign.sound_usage_count)
                  : null
              }
              viewsTotal={metrics.views}
              showCreations={Boolean(campaign.tiktok_sound_id)}
            />
          )}

          <form
            className="admin-panel space-y-3 p-5"
            action={(formData) =>
              run(() => updateCampaignBudget(campaign.id, formData))
            }
          >
            <h2 className="font-display text-lg font-semibold tracking-[-0.03em]">
              Campaign settings
            </h2>
            <div>
              <label className="admin-label" htmlFor="campaign-display-title">
                Display title (optional)
              </label>
              <input
                id="campaign-display-title"
                name="display_title"
                className="admin-input"
                defaultValue={campaign.display_title ?? ""}
                placeholder={campaignSoundTitle(campaign) || "Campaign display title"}
                maxLength={160}
              />
              <p className="mt-1 text-xs text-muted-grey">
                Leave blank to use the TikTok sound title.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="admin-label" htmlFor="campaign-budget">
                  Budget (GBP)
                </label>
                <input
                  id="campaign-budget"
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
                <label className="admin-label" htmlFor="campaign-target-posts">
                  Target Posts
                </label>
                <input
                  id="campaign-target-posts"
                  name="target_posts"
                  type="number"
                  min="1"
                  step="1"
                  className="admin-input"
                  defaultValue={campaign.target_posts}
                  placeholder="e.g. 30"
                  required
                />
                <p className="mt-1 text-xs text-muted-grey">
                  Changing target does not affect tracked metrics.
                </p>
              </div>
            </div>
            <div>
              <button
                type="submit"
                className="admin-btn admin-btn--primary"
                disabled={pending}
              >
                {pending ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {tab === "content" ? (
        <div
          id="campaign-panel-content"
          className="mt-6 space-y-5"
          role="tabpanel"
          aria-labelledby="campaign-tab-content"
          tabIndex={0}
        >
          <div className="admin-panel space-y-4 p-5">
            {posts.length === 0 ? (
              <div className="rounded-[8px] border border-acid-lime/25 bg-acid-lime/5 px-4 py-3">
                <p className="font-display text-base font-semibold">
                  Campaign created.
                </p>
                <p className="mt-1 text-sm text-soft-grey">
                  Now add the TikTok posts being tracked.
                </p>
              </div>
            ) : null}
            <h2 className="font-display text-lg font-semibold tracking-[-0.03em]">
              Add TikTok Posts
            </h2>
            <p className="text-sm text-soft-grey">
              Paste one URL or a batch. Each post is added independently, so one
              failure will not block the others.
            </p>
            <div>
              <label className="admin-label" htmlFor="tiktok-post-urls">
                TikTok post URLs
              </label>
              <textarea
                id="tiktok-post-urls"
                className="admin-input min-h-[9rem]"
                placeholder={
                  "Paste TikTok post URLs — one per line. Blank lines and duplicates are cleaned automatically."
                }
                value={bulkPaste}
                onChange={(e) => setBulkPaste(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && bulkPaste.trim()) {
                    e.preventDefault();
                    document
                      .querySelector<HTMLButtonElement>("button[data-import]")
                      ?.click();
                  }
                }}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="admin-btn admin-btn--ghost"
                  disabled={pending}
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      if (text.trim()) {
                        setBulkPaste((prev) => (prev ? `${prev}\n${text}` : text));
                      }
                    } catch {
                      toast(
                        "Clipboard unavailable — paste normally into the box.",
                        "error",
                      );
                    }
                  }}
                >
                  Paste from Clipboard
                </button>
                <button
                  type="button"
                  data-import
                  className="admin-btn admin-btn--primary"
                  disabled={pending || !bulkPaste.trim()}
                  onClick={() => {
                    setBusyLabel("Importing…");
                    run(async () => {
                      setMessage("Importing posts…");
                      const outcome = await importTikTokPostsByUrls(
                        campaign.id,
                        bulkPaste,
                      );
                      setImportResults(outcome.results);
                      setBulkPaste("");
                      const summary = `Import complete · ${outcome.summary.added} added · ${outcome.summary.alreadyTracked} already tracked · ${outcome.summary.pasteDuplicates} paste duplicates · ${outcome.summary.failed} failed`;
                      setImportSummary(summary);
                      setMessage(summary);
                      toast(summary, outcome.summary.failed ? "warn" : "ok");
                    }, "");
                  }}
                >
                  {busyLabel === "Importing…" ? "Adding Posts…" : "Add Posts"}
                </button>
              </div>
              {importSummary ? (
                <p className="mt-2 text-sm text-soft-grey">{importSummary}</p>
              ) : null}
              {importResults ? (
                <div className="mt-3 space-y-2">
                  <ul className="space-y-1 text-sm">
                    {importResults.map((result, index) => (
                      <li
                        key={`${result.url}-${index}`}
                        className="text-soft-grey"
                      >
                        {result.status === "added"
                          ? `✓ Added ${result.creatorHandle}`
                          : result.status === "duplicate"
                            ? `• Already tracked`
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
                        setMessage(
                          "Failed URLs ready to retry — Import Posts again.",
                        );
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
              aria-expanded={showManual}
              aria-controls="manual-post-form"
              onClick={() => setShowManual((v) => !v)}
            >
              {showManual ? "Hide manual entry" : "Enter details manually"}
            </button>

            {showManual ? (
              <form
                id="manual-post-form"
                className="grid gap-3 border-t border-white/8 pt-4 sm:grid-cols-2"
                action={(formData) =>
                  run(() => createTikTokPostManual(campaign.id, formData), "Post saved.")
                }
              >
                <div className="sm:col-span-2">
                  <label className="admin-label" htmlFor="manual-post-url">
                    TikTok URL *
                  </label>
                  <input
                    id="manual-post-url"
                    name="post_url"
                    className="admin-input"
                    required
                    placeholder="Full TikTok post URL"
                  />
                </div>
                <div>
                  <label className="admin-label" htmlFor="manual-post-creator">
                    Creator *
                  </label>
                  <input id="manual-post-creator" name="creator_handle" className="admin-input" required placeholder="@handle" />
                </div>
                <div>
                  <label className="admin-label" htmlFor="manual-post-date">
                    Posted at
                  </label>
                  <input id="manual-post-date" name="posted_at" type="datetime-local" className="admin-input" />
                </div>
                <div>
                  <label className="admin-label" htmlFor="manual-post-views">Views</label>
                  <input id="manual-post-views" name="views" type="number" min="0" className="admin-input" defaultValue={0} />
                </div>
                <div>
                  <label className="admin-label" htmlFor="manual-post-likes">Likes</label>
                  <input id="manual-post-likes" name="likes" type="number" min="0" className="admin-input" defaultValue={0} />
                </div>
                <div>
                  <label className="admin-label" htmlFor="manual-post-comments">Comments</label>
                  <input id="manual-post-comments" name="comments" type="number" min="0" className="admin-input" defaultValue={0} />
                </div>
                <div>
                  <label className="admin-label" htmlFor="manual-post-shares">Shares</label>
                  <input id="manual-post-shares" name="shares" type="number" min="0" className="admin-input" defaultValue={0} />
                </div>
                <div className="sm:col-span-2">
                  <label className="admin-label" htmlFor="manual-post-thumbnail">Thumbnail URL</label>
                  <input id="manual-post-thumbnail" name="thumbnail_url" className="admin-input" />
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
              {failedCount > 0 ? (
                <span className="ml-2 text-sm font-normal text-[#ffd27a]">
                  · {failedCount} need attention
                </span>
              ) : null}
            </h2>
            <div className="flex flex-wrap gap-2">
              <div className="flex gap-1 rounded-full border border-white/10 p-0.5">
                {(
                  [
                    ["all", "All"],
                    ["attention", "Needs Attention"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      postFilter === key
                        ? "bg-acid-lime/15 text-acid-lime"
                        : "text-muted-grey hover:text-off-white"
                    }`}
                    onClick={() => setPostFilter(key)}
                  >
                    {label}
                    {key === "attention" ? ` (${failedCount})` : ""}
                  </button>
                ))}
              </div>
              <input
                className="admin-input min-w-[12rem]"
                placeholder="Search…"
                aria-label="Search posts"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query ? (
                <button
                  type="button"
                  className="text-xs text-muted-grey underline"
                  onClick={() => setQuery("")}
                >
                  Clear Search
                </button>
              ) : null}
              <select
                className="admin-select w-auto"
                aria-label="Sort posts"
                value={sort}
                onChange={(e) => setSort(e.target.value as typeof sort)}
              >
                <option value="views">Most Views</option>
                <option value="likes">Most Likes</option>
                <option value="shares">Most Shares</option>
                <option value="newest">Newest</option>
              </select>
            </div>
          </div>

          {selected.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 rounded-[8px] border border-acid-lime/25 bg-acid-lime/5 px-3 py-2 text-sm">
              <span className="font-semibold text-acid-lime">
                {selected.length} selected
              </span>
              <button
                type="button"
                className="admin-btn admin-btn--ghost"
                disabled={pending}
                onClick={() =>
                  run(async () => {
                    const result = await refreshSelectedCampaignPosts(
                      campaign.id,
                      selected,
                    );
                    setSelected([]);
                    setMessage(
                      `Refresh complete · ${result.updated} updated · ${result.failed} failed`,
                    );
                    toast(
                      result.failed
                        ? `${result.failed} failed`
                        : "✓ Selected posts refreshed",
                      result.failed ? "warn" : "ok",
                    );
                  }, "")
                }
              >
                Refresh Selected
              </button>
              {selected.some((id) => {
                const post = posts.find((p) => p.id === id);
                return post && isPostFailed(post);
              }) ? (
                <button
                  type="button"
                  className="admin-btn admin-btn--ghost"
                  disabled={pending}
                  onClick={() =>
                    run(async () => {
                      const failedIds = selected.filter((id) => {
                        const post = posts.find((p) => p.id === id);
                        return post && isPostFailed(post);
                      });
                      const result = await refreshSelectedCampaignPosts(
                        campaign.id,
                        failedIds,
                      );
                      setSelected([]);
                      toast(
                        result.failed
                          ? `${result.failed} still failing`
                          : "✓ Retry complete",
                        result.failed ? "warn" : "ok",
                      );
                    }, "")
                  }
                >
                  Retry Selected
                </button>
              ) : null}
              <button
                type="button"
                className="admin-btn admin-btn--ghost text-[#ff8f8f]"
                disabled={pending}
                onClick={() => setBulkRemoveConfirm(true)}
              >
                Remove Selected
              </button>
              <button
                type="button"
                className="text-xs text-muted-grey underline"
                disabled={pending}
                onClick={() => setSelected([])}
              >
                Clear
              </button>
            </div>
          ) : null}

          <div className="admin-panel overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th className="w-10">
                    <input
                      type="checkbox"
                      aria-label="Select all visible posts"
                      disabled={pending}
                      checked={
                        sortedPosts.length > 0 &&
                        sortedPosts.every((p) => selected.includes(p.id))
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelected(sortedPosts.map((p) => p.id));
                        } else {
                          setSelected([]);
                        }
                      }}
                    />
                  </th>
                  <th>Post</th>
                  <th>Creator</th>
                  <th>Views</th>
                  <th>Likes</th>
                  <th>Comments</th>
                  <th>Shares</th>
                  <th>Posted</th>
                  <th>Refreshed</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedPosts.map((post) => {
                  const failed = isPostFailed(post);
                  return (
                    <tr
                      key={post.id}
                      className={failed ? "bg-[#ff8f8f]/5" : undefined}
                    >
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Select ${post.creator_handle}`}
                          disabled={pending}
                          checked={selected.includes(post.id)}
                          onChange={(e) => {
                            setSelected((prev) =>
                              e.target.checked
                                ? [...prev, post.id]
                                : prev.filter((id) => id !== post.id),
                            );
                          }}
                        />
                      </td>
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
                          <div className="max-w-[12rem]">
                            <div className="truncate text-xs text-muted-grey">
                              {post.title || post.post_url}
                            </div>
                            {failed ? (
                              <p className="mt-1 text-[0.65rem] text-[#ff8f8f]">
                                Failed to refresh
                                {post.last_sync_error
                                  ? ` — ${post.last_sync_error}`
                                  : ""}
                              </p>
                            ) : null}
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
                            rel="noopener noreferrer"
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
                                failed ? "Retry complete." : "Post refreshed.",
                              )
                            }
                          >
                            {failed ? "Retry" : "Refresh"}
                          </button>
                          <button
                            type="button"
                            className="text-xs text-soft-grey"
                            disabled={pending}
                            onClick={() => setEditingPost(post)}
                          >
                            {failed ? "Enter manually" : "Edit"}
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
                  );
                })}
              </tbody>
            </table>
            {sortedPosts.length === 0 ? (
              <div className="admin-empty border-0">
                <p className="font-display text-base font-semibold">
                  {query.trim()
                    ? "No matching posts"
                    : postFilter === "attention"
                    ? "No posts need attention"
                    : "No TikTok posts tracked yet"}
                </p>
                <p className="mt-2 text-sm text-soft-grey">
                  {query.trim()
                    ? "Try another creator or post search."
                    : postFilter === "attention"
                    ? "All tracked posts look healthy."
                    : "Paste TikTok URLs above to begin tracking campaign performance."}
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
                <label className="admin-label" htmlFor="edit-post-url">URL</label>
                <input
                  id="edit-post-url"
                  name="post_url"
                  className="admin-input"
                  defaultValue={editingPost.post_url}
                  required
                />
              </div>
              <div>
                <label className="admin-label" htmlFor="edit-post-creator">Creator</label>
                <input
                  id="edit-post-creator"
                  name="creator_handle"
                  className="admin-input"
                  defaultValue={editingPost.creator_handle}
                  required
                />
              </div>
              <div>
                <label className="admin-label" htmlFor="edit-post-date">Posted at</label>
                <input
                  id="edit-post-date"
                  name="posted_at"
                  type="datetime-local"
                  className="admin-input"
                  defaultValue={toDateTimeLocal(editingPost.posted_at)}
                />
              </div>
              <div>
                <label className="admin-label" htmlFor="edit-post-views">Views</label>
                <input
                  id="edit-post-views"
                  name="views"
                  type="number"
                  min="0"
                  className="admin-input"
                  defaultValue={editingPost.views}
                />
              </div>
              <div>
                <label className="admin-label" htmlFor="edit-post-likes">Likes</label>
                <input
                  id="edit-post-likes"
                  name="likes"
                  type="number"
                  min="0"
                  className="admin-input"
                  defaultValue={editingPost.likes}
                />
              </div>
              <div>
                <label className="admin-label" htmlFor="edit-post-comments">Comments</label>
                <input
                  id="edit-post-comments"
                  name="comments"
                  type="number"
                  min="0"
                  className="admin-input"
                  defaultValue={editingPost.comments}
                />
              </div>
              <div>
                <label className="admin-label" htmlFor="edit-post-shares">Shares</label>
                <input
                  id="edit-post-shares"
                  name="shares"
                  type="number"
                  min="0"
                  className="admin-input"
                  defaultValue={editingPost.shares}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="admin-label" htmlFor="edit-post-thumbnail">Thumbnail URL</label>
                <input
                  id="edit-post-thumbnail"
                  name="thumbnail_url"
                  className="admin-input"
                  defaultValue={editingPost.thumbnail_url ?? ""}
                />
              </div>
              <div className="flex gap-2 sm:col-span-2">
                <button
                  type="submit"
                  className="admin-btn admin-btn--primary"
                  disabled={pending}
                >
                  Save corrections
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn--ghost"
                  disabled={pending}
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
        <div
          id="campaign-panel-sharing"
          className="admin-panel mt-6 max-w-2xl space-y-4 p-5"
          role="tabpanel"
          aria-labelledby="campaign-tab-sharing"
          tabIndex={0}
        >
          <h2 className="font-display text-lg font-semibold tracking-[-0.03em]">
            Client Report
          </h2>
          <p className="text-sm text-soft-grey">
            This campaign has one permanent client link. Saved changes appear on
            the report automatically.
          </p>
          <p className="text-sm">
            Access:{" "}
            {campaign.status === "active" ? (
              <span className="text-acid-lime">Active</span>
            ) : (
              <span className="text-muted-grey">Ended · client access disabled</span>
            )}
          </p>
          {campaign.share_token ? (
            <>
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
                  {copied ? "Copied ✓" : "Copy Client Link"}
                </button>
                <Link
                  href={`/admin/campaigns/${campaign.id}/preview`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="admin-btn admin-btn--ghost"
                >
                  Preview Report
                </Link>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-grey">
              Client link missing. Reopen or recreate the campaign if needed.
            </p>
          )}
        </div>
      ) : null}

      {moveOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              className="admin-modal-root"
              role="presentation"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="admin-modal-backdrop"
                aria-label="Close"
                onClick={closeMove}
              />
              <div
                ref={moveDialogRef}
                className="admin-modal max-w-md"
                role="dialog"
                aria-modal="true"
                aria-labelledby="move-campaign-title"
              >
                <h2
                  id="move-campaign-title"
                  className="font-display text-xl font-semibold"
                >
                  Move Campaign
                </h2>
                <p className="mt-2 text-sm text-soft-grey">
                  Move this campaign (and all posts/metrics/report data) to
                  another client.
                </p>
                <label className="admin-label mt-4" htmlFor="move-client">
                  Destination client
                </label>
                <select
                  ref={moveSelectRef}
                  id="move-client"
                  className="admin-select"
                  value={moveClientId}
                  onChange={(e) => setMoveClientId(e.target.value)}
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.handle ? ` (${c.handle})` : ""}
                    </option>
                  ))}
                </select>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    className="admin-btn admin-btn--primary"
                    disabled={pending || moveClientId === campaign.client_id}
                    onClick={() =>
                      run(async () => {
                        await moveCampaign(campaign.id, moveClientId);
                        closeMove();
                      }, "Campaign moved.")
                    }
                  >
                    Confirm Move
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn--ghost"
                    disabled={pending}
                    onClick={closeMove}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      <ConfirmDialog
        open={confirm === "end"}
        title="End Campaign?"
        body="This will mark the campaign as finished and disable access to the client report. All campaign data, TikTok posts, analytics and history will remain saved. You can reopen the campaign later."
        confirmLabel="End Campaign"
        pendingLabel="Ending…"
        danger
        pending={pending}
        onCancel={() => setConfirm(null)}
        onConfirm={() =>
          run(async () => {
            setBusyLabel("Ending…");
            await endCampaign(campaign.id);
            setConfirm(null);
          }, "Campaign Ended ✓")
        }
      />
      <ConfirmDialog
        open={confirm === "reopen"}
        title="Reopen Campaign?"
        body="The campaign will become active again and the existing client report link will become accessible."
        confirmLabel="Reopen Campaign"
        pendingLabel="Reopening…"
        pending={pending}
        onCancel={() => setConfirm(null)}
        onConfirm={() =>
          run(async () => {
            setBusyLabel("Reopening…");
            await reopenCampaign(campaign.id);
            setConfirm(null);
          }, "Campaign Active ✓")
        }
      />
      <ConfirmDialog
        open={Boolean(deletePostId)}
        title="Remove this post?"
        body="This removes the TikTok post from the campaign. Historical snapshots for this post will also be removed."
        confirmLabel="Remove"
        pendingLabel="Removing…"
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
      <ConfirmDialog
        open={bulkRemoveConfirm}
        title={`Remove ${selected.length} selected posts?`}
        body="Selected posts and their snapshots will be removed from this campaign."
        confirmLabel="Remove Selected"
        pendingLabel="Removing…"
        danger
        pending={pending}
        onCancel={() => setBulkRemoveConfirm(false)}
        onConfirm={() =>
          run(async () => {
            await deleteSelectedTikTokPosts(campaign.id, selected);
            setSelected([]);
            setBulkRemoveConfirm(false);
          }, "Selected posts removed")
        }
      />
    </div>
  );
}
