import { Wordmark } from "@/components/ui/Wordmark";
import "@/components/report/report.css";

export default function ReportLoading() {
  return (
    <div
      className="report-shell"
      aria-busy="true"
      aria-label="Loading report"
    >
      <header className="report-header">
        <p className="report-header__side report-header__side--left">
          Campaign Report
        </p>
        <div className="report-header__center">
          <Wordmark className="report-header__wordmark" href={null} />
        </div>
        <p className="report-header__side report-header__side--right">
          Preparing Report
        </p>
      </header>
      <main className="report-main report-loading">
        <div className="report-loading__overview">
          <div className="report-loading__block report-loading__summary" />
          <div className="report-loading__block report-loading__delivery" />
        </div>
        <div className="report-loading__block report-loading__results" />
        <div className="report-loading__charts">
          <div className="report-loading__block report-loading__chart" />
          <div className="report-loading__block report-loading__chart" />
        </div>
        <span className="sr-only">Loading campaign report…</span>
      </main>
    </div>
  );
}
