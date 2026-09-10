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
      <div className="report-shell grid min-h-svh place-items-center px-5 text-center">
        <div>
          <Wordmark className="text-[1.15rem] tracking-[0.16em]" href={null} />
          <p className="mt-8 text-sm text-soft-grey">Campaign Report</p>
          <h1 className="mt-3 font-display text-2xl font-semibold tracking-[-0.04em]">
            This campaign report is no longer available.
          </h1>
        </div>
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
