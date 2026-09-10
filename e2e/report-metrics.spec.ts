import { expect, test } from "@playwright/test";
import {
  buildChartFromSnapshots,
  buildSeriesFromCumulativeSnapshots,
  formatPostsVsTargetLabel,
  getReportPagination,
  reportSnapshotDate,
  sortReportPosts,
} from "../src/lib/portal/metrics";

test.describe("client report calculations", () => {
  test("derives cumulative and daily sound changes without inventing data", () => {
    const series = buildSeriesFromCumulativeSnapshots([
      { captured_at: "2026-09-01T12:00:00Z", value: 180_000 },
      { captured_at: "2026-09-02T12:00:00Z", value: 180_050 },
      { captured_at: "2026-09-03T12:00:00Z", value: 180_090 },
    ]);

    expect(series).toEqual([
      { date: "2026-09-01", cumulative: 180_000, daily: 0 },
      { date: "2026-09-02", cumulative: 180_050, daily: 50 },
      { date: "2026-09-03", cumulative: 180_090, daily: 40 },
    ]);
    expect(buildSeriesFromCumulativeSnapshots([])).toEqual([]);
    expect(
      buildSeriesFromCumulativeSnapshots([
        { captured_at: "2026-09-01T12:00:00Z", value: 180_000 },
      ]),
    ).toHaveLength(1);
  });

  test("uses the final same-day snapshot and preserves provider corrections", () => {
    const series = buildSeriesFromCumulativeSnapshots([
      { captured_at: "2026-09-01T08:00:00Z", value: 200 },
      { captured_at: "2026-09-01T20:00:00Z", value: 225 },
      { captured_at: "2026-09-03T08:00:00Z", value: 220 },
    ]);

    expect(series).toEqual([
      { date: "2026-09-01", cumulative: 225, daily: 0 },
      { date: "2026-09-03", cumulative: 220, daily: -5 },
    ]);
  });

  test("groups snapshots by UK calendar date around midnight", () => {
    expect(reportSnapshotDate("2026-09-01T22:30:00Z")).toBe("2026-09-01");
    expect(reportSnapshotDate("2026-09-01T23:30:00Z")).toBe("2026-09-02");
    expect(reportSnapshotDate("not-a-date")).toBeNull();
  });

  test("calculates combined campaign-view totals and true period deltas", () => {
    const posts = [{ id: "a" }, { id: "b" }];
    const series = buildChartFromSnapshots(posts, [
      { post_id: "a", captured_at: "2026-09-01T12:00:00Z", views: 600_000 },
      { post_id: "b", captured_at: "2026-09-01T12:00:00Z", views: 400_000 },
      { post_id: "a", captured_at: "2026-09-02T12:00:00Z", views: 700_000 },
      { post_id: "b", captured_at: "2026-09-02T12:00:00Z", views: 500_000 },
      { post_id: "a", captured_at: "2026-09-03T12:00:00Z", views: 775_000 },
      { post_id: "b", captured_at: "2026-09-03T12:00:00Z", views: 575_000 },
    ]);

    expect(series).toEqual([
      { date: "2026-09-01", cumulative: 1_000_000, views: 0 },
      { date: "2026-09-02", cumulative: 1_200_000, views: 200_000 },
      { date: "2026-09-03", cumulative: 1_350_000, views: 150_000 },
    ]);
  });

  test("does not turn a corrected campaign total into fake zero growth", () => {
    const series = buildChartFromSnapshots([{ id: "a" }], [
      { post_id: "a", captured_at: "2026-09-01T12:00:00Z", views: 1_000 },
      { post_id: "a", captured_at: "2026-09-02T12:00:00Z", views: 950 },
    ]);

    expect(series[1]).toEqual({
      date: "2026-09-02",
      cumulative: 950,
      views: -50,
    });
  });

  test("handles long irregular and unchanged histories without fake growth", () => {
    const snapshots = Array.from({ length: 12 }, (_, index) => ({
      captured_at: new Date(
        Date.UTC(2026, 7, 1 + index * 2, index % 2 ? 22 : 8),
      ).toISOString(),
      value: 5_000 + Math.floor(index / 3) * 25,
    }));
    const series = buildSeriesFromCumulativeSnapshots(snapshots);

    expect(series).toHaveLength(12);
    expect(series.some((point, index) => index > 0 && point.daily === 0)).toBe(
      true,
    );
    expect(series.at(-1)?.cumulative).toBe(snapshots.at(-1)?.value);
  });

  test("reconciles the latest chart point to the canonical current total", () => {
    const historicalDate = new Date(Date.now() - 48 * 60 * 60 * 1_000);
    const series = buildSeriesFromCumulativeSnapshots(
      [{ captured_at: historicalDate.toISOString(), value: 1_000 }],
      950,
    );

    expect(series.at(-1)?.cumulative).toBe(950);
    expect(series.at(-1)?.daily).toBe(-50);
    expect(series.at(-1)?.date).toBe(
      reportSnapshotDate(new Date().toISOString()),
    );
  });

  test("reports delivery above target without widening the data", () => {
    expect(formatPostsVsTargetLabel(38, 30)).toEqual({
      value: "38 / 30",
      progress: 38 / 30,
    });
  });

  test("ranks top posts deterministically when views tie", () => {
    const posts = [
      {
        id: "lower-engagement",
        views: 100,
        likes: 10,
        comments: 2,
        shares: 1,
        posted_at: "2026-09-03T12:00:00Z",
        created_at: "2026-09-03T12:00:00Z",
      },
      {
        id: "higher-engagement",
        views: 100,
        likes: 20,
        comments: 1,
        shares: 1,
        posted_at: "2026-09-01T12:00:00Z",
        created_at: "2026-09-01T12:00:00Z",
      },
      {
        id: "highest-views",
        views: 200,
        likes: 0,
        comments: 0,
        shares: 0,
        posted_at: null,
        created_at: "2026-09-01T12:00:00Z",
      },
    ];

    expect(sortReportPosts(posts, "views").map((post) => post.id)).toEqual([
      "highest-views",
      "higher-engagement",
      "lower-engagement",
    ]);
  });

  test("sorts each media-library mode with stable fallbacks", () => {
    const posts = [
      {
        id: "a",
        views: 10,
        likes: 30,
        comments: 5,
        shares: 2,
        posted_at: "2026-09-01T12:00:00Z",
        created_at: "2026-09-01T12:00:00Z",
      },
      {
        id: "b",
        views: 20,
        likes: 10,
        comments: 8,
        shares: 4,
        posted_at: "2026-09-02T12:00:00Z",
        created_at: "2026-09-02T12:00:00Z",
      },
    ];

    expect(sortReportPosts(posts, "views")[0].id).toBe("b");
    expect(sortReportPosts(posts, "likes")[0].id).toBe("a");
    expect(sortReportPosts(posts, "comments")[0].id).toBe("b");
    expect(sortReportPosts(posts, "shares")[0].id).toBe("b");
    expect(sortReportPosts(posts, "newest")[0].id).toBe("b");
  });

  test("keeps pagination valid from page one through page seven and beyond", () => {
    expect(getReportPagination(75, 1).visiblePages).toEqual([1, 2, 3, 4, 5, 6]);
    expect(getReportPagination(75, 2).currentPage).toBe(2);
    expect(getReportPagination(75, 6).visiblePages).toEqual([3, 4, 5, 6, 7, 8]);
    expect(getReportPagination(75, 7).visiblePages).toEqual([3, 4, 5, 6, 7, 8]);
    expect(getReportPagination(75, 99)).toMatchObject({
      currentPage: 8,
      showingFrom: 71,
      showingTo: 75,
    });
    expect(getReportPagination(60, 7)).toMatchObject({
      currentPage: 6,
      showingFrom: 51,
      showingTo: 60,
    });
  });
});
