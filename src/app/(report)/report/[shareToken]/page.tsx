import type { Metadata } from "next";
import { Wordmark } from "@/components/ui/Wordmark";
import { CampaignReportView } from "@/components/report/CampaignReportView";
import { createPublicClient } from "@/lib/supabase/server";
import type { SharedReport } from "@/lib/portal/report";

export const metadata: Metadata = {
  title: "Campaign Report | Katalyst Media",
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ReportPage({
  params,
}: {
  params: Promise<{ shareToken: string }>;
}) {
  const { shareToken } = await params;
  const supabase = createPublicClient();

  const { data, error } = await supabase.rpc("fetch_shared_report", {
    p_token: shareToken,
  });

  const report = error ? null : (data as SharedReport | null);

  if (!report?.campaign) {
    return (
      <div className="report-shell">
        <main className="report-state">
          <Wordmark className="report-state__wordmark" href={null} />
          <p className="report-state__eyebrow">Campaign Report</p>
          <h1 className="report-state__title">
            This campaign report is no longer available.
          </h1>
          <p className="report-state__copy">
            Please contact your Katalyst Media representative if you need
            access.
          </p>
        </main>
      </div>
    );
  }

  return (
    <CampaignReportView
      campaign={report.campaign}
      client={report.client}
      posts={report.posts ?? []}
      snapshots={report.snapshots ?? []}
      soundSnapshots={report.sound_snapshots ?? []}
      campaignSnapshots={report.campaign_snapshots ?? []}
    />
  );
}
