"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function AdminError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("Portal page failed", error);
  }, [error]);

  return (
    <section className="admin-card mx-auto max-w-xl p-8 text-center" role="alert">
      <p className="admin-kicker">Unable to load</p>
      <h1 className="mt-2 text-2xl font-semibold text-off-white">
        Something went wrong
      </h1>
      <p className="mt-3 text-sm leading-6 text-soft-grey">
        The portal could not load this page. Try again, or return to the
        campaign library.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          className="admin-btn admin-btn--primary"
          onClick={unstable_retry}
        >
          Try Again
        </button>
        <Link href="/admin" className="admin-btn admin-btn--ghost">
          Campaign Library
        </Link>
      </div>
    </section>
  );
}
