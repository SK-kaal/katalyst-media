"use client";

import { useEffect } from "react";
import { Wordmark } from "@/components/ui/Wordmark";
import "@/components/report/report.css";

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
    <div className="report-shell">
      <main className="report-state">
        <Wordmark className="report-state__wordmark" href={null} />
        <p className="report-state__eyebrow">Campaign Report</p>
        <h1 className="report-state__title">Report unavailable</h1>
        <p className="report-state__copy">
          The report could not be loaded. Please try again.
        </p>
        <button
          type="button"
          className="report-state__button"
          onClick={unstable_retry}
        >
          Try Again
        </button>
      </main>
    </div>
  );
}
