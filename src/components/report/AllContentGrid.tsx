"use client";

import { useMemo, useState } from "react";
import {
  formatCompactNumber,
  formatShortDate,
} from "@/lib/portal/metrics";
import type { TikTokPost } from "@/lib/supabase/database.types";

type SortKey = "views" | "likes" | "shares" | "newest";

export function AllContentGrid({ posts }: { posts: TikTokPost[] }) {
  const [sort, setSort] = useState<SortKey>("views");

  const sorted = useMemo(() => {
    const next = [...posts];
    switch (sort) {
      case "likes":
        return next.sort((a, b) => b.likes - a.likes);
      case "shares":
        return next.sort((a, b) => b.shares - a.shares);
      case "newest":
        return next.sort(
          (a, b) =>
            +new Date(b.posted_at || b.created_at) -
            +new Date(a.posted_at || a.created_at),
        );
      default:
        return next.sort((a, b) => b.views - a.views);
    }
  }, [posts, sort]);

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-display text-xl font-semibold tracking-[-0.03em]">
          All Content
        </h2>
        <label className="text-sm text-soft-grey">
          Sort by{" "}
          <select
            className="admin-select ml-2 w-auto"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
          >
            <option value="views">Most Views</option>
            <option value="likes">Most Likes</option>
            <option value="shares">Most Shares</option>
            <option value="newest">Newest</option>
          </select>
        </label>
      </div>

      <div className="report-content-grid">
        {sorted.map((post) => (
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
              <span className="absolute left-2 top-2 rounded bg-black/55 px-1.5 py-0.5 text-[0.6rem] text-off-white">
                TikTok
              </span>
            </div>
            <div className="report-post-card__meta space-y-1">
              <p>{formatCompactNumber(post.views)} views</p>
              <p>
                {formatCompactNumber(post.likes)} likes ·{" "}
                {formatCompactNumber(post.comments)} comments
              </p>
              <p>{formatCompactNumber(post.shares)} shares</p>
              <p className="text-muted-grey">{formatShortDate(post.posted_at)}</p>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
