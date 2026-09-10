"use client";

import { useEffect } from "react";

export default function ReportError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("Client report failed", error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#050505] px-6 text-center text-white">
      <section className="w-full max-w-md rounded-xl border border-white/10 bg-white/[0.03] p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">
          Katalyst Media
        </p>
        <h1 className="mt-3 text-2xl font-semibold">Report unavailable</h1>
        <p className="mt-3 text-sm leading-6 text-white/60">
          The report could not be loaded. Please try again.
        </p>
        <button
          type="button"
          className="mt-6 rounded-lg bg-[#d9ff43] px-5 py-2.5 text-sm font-semibold text-black hover:bg-[#e5ff76] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d9ff43]"
          onClick={unstable_retry}
        >
          Try Again
        </button>
      </section>
    </main>
  );
}
