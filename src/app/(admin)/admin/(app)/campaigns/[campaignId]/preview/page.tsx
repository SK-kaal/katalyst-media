import { redirect, notFound } from "next/navigation";
import { createAdminClient } from "@/lib/admin-auth/client";
import { CampaignReportView } from "@/components/report/CampaignReportView";
import type {
  CampaignMetricSnapshot,
  PostMetricSnapshot,
  SoundMetricSnapshot,
} from "@/lib/supabase/database.types";

export default async function CampaignReportPreviewPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const supabase = await createAdminClient();

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .maybeSingle();

  if (!campaign || campaign.trashed_at) notFound();

  // Active campaigns use the real client URL so preview matches client view.
  if (campaign.status === "active" && campaign.share_token) {
    redirect(`/report/${campaign.share_token}`);
  }

  const [
    { data: client },
    { data: posts },
    { data: soundSnapshots },
    { data: campaignSnapshots },
  ] = await Promise.all([
    supabase.from("clients").select("*").eq("id", campaign.client_id).single(),
    supabase
      .from("tiktok_posts")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("views", { ascending: false }),
    supabase
      .from("sound_metric_snapshots")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("captured_at", { ascending: true }),
    supabase
      .from("campaign_metric_snapshots")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("captured_at", { ascending: true }),
  ]);

  if (!client) notFound();

  const postIds = (posts ?? []).map((p) => p.id);
  let snapshots: PostMetricSnapshot[] = [];
  if (postIds.length > 0) {
    const { data } = await supabase
      .from("post_metric_snapshots")
      .select("*")
      .in("post_id", postIds)
      .order("captured_at", { ascending: true });
    snapshots = data ?? [];
  }

  return (
    <div>
      <div className="border-b border-white/10 bg-black/40 px-4 py-2 text-center text-xs text-muted-grey">
        Admin preview · Client access is currently disabled for this ended campaign
      </div>
      <CampaignReportView
        campaign={campaign}
        client={client}
        posts={posts ?? []}
        snapshots={snapshots}
        soundSnapshots={(soundSnapshots ?? []) as SoundMetricSnapshot[]}
        campaignSnapshots={(campaignSnapshots ?? []) as CampaignMetricSnapshot[]}
        adminPreview
      />
    </div>
  );
}
