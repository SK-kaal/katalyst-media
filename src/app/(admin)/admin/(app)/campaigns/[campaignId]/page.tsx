import { notFound } from "next/navigation";
import { CampaignEditor } from "@/components/admin/CampaignEditor";
import { createAdminClient } from "@/lib/admin-auth/client";
import type {
  CampaignMetricSnapshot,
  PostMetricSnapshot,
  SoundMetricSnapshot,
} from "@/lib/supabase/database.types";

export default async function CampaignEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ campaignId: string }>;
  searchParams: Promise<{ tab?: string; move?: string }>;
}) {
  const { campaignId } = await params;
  const sp = await searchParams;
  const supabase = await createAdminClient();

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .maybeSingle();

  if (!campaign) notFound();

  const [
    { data: client },
    { data: posts },
    { data: clients },
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
      .from("clients")
      .select("id, name, handle, archived_at")
      .is("archived_at", null)
      .order("name"),
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

  const tab =
    sp.tab === "content" || sp.tab === "sharing" || sp.tab === "overview"
      ? sp.tab
      : posts && posts.length === 0
        ? "content"
        : "overview";

  return (
    <CampaignEditor
      key={`${campaign.id}-${sp.move === "1" ? "move" : "closed"}`}
      campaign={campaign}
      client={client}
      posts={posts ?? []}
      snapshots={snapshots}
      soundSnapshots={
        (soundSnapshots ?? []).filter(
          (snapshot) =>
            campaign.tiktok_sound_id != null &&
            snapshot.sound_id === campaign.tiktok_sound_id,
        ) as SoundMetricSnapshot[]
      }
      campaignSnapshots={(campaignSnapshots ?? []) as CampaignMetricSnapshot[]}
      clients={clients ?? []}
      initialTab={tab}
      openMove={sp.move === "1"}
    />
  );
}
