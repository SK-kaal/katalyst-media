import { notFound } from "next/navigation";
import { CampaignEditor } from "@/components/admin/CampaignEditor";
import { createAdminClient } from "@/lib/admin-auth/client";
import type { PostMetricSnapshot } from "@/lib/supabase/database.types";

export default async function CampaignEditorPage({
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

  if (!campaign) notFound();

  const [{ data: client }, { data: posts }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", campaign.client_id).single(),
    supabase
      .from("tiktok_posts")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("views", { ascending: false }),
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
    <CampaignEditor
      campaign={campaign}
      client={client}
      posts={posts ?? []}
      snapshots={snapshots}
    />
  );
}
