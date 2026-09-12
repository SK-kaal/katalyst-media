import { revalidatePath } from "next/cache";
import { createScheduledClient } from "@/lib/admin-auth/client";
import { verifySecret } from "@/lib/admin-auth/session";
import { refreshCampaignDataWithClient } from "@/lib/portal/refresh";

export const dynamic = "force-dynamic";

/** Hobby plans allow up to 300s with fluid compute. */
export const maxDuration = 300;

/**
 * Stop starting new campaigns with 60s left so the run always returns a
 * summary instead of being killed mid-campaign. Campaigns are refreshed
 * least-recently-synced first, so anything skipped leads the next run.
 */
const TIME_BUDGET_MS = 240_000;

type CampaignOutcome = {
  campaignId: string;
  posts?: { total: number; updated: number; failed: number };
  soundOk?: boolean;
  creations?: number | null;
  error?: string;
};

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json(
      { ok: false, error: "CRON_SECRET is not configured" },
      { status: 503 },
    );
  }

  const authorization = request.headers.get("authorization") ?? "";
  const presented = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
  if (!presented || !(await verifySecret(presented, secret))) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const supabase = await createScheduledClient();

  const { data: campaigns, error } = await supabase
    .from("campaigns")
    .select("id, share_token, client_id")
    .eq("status", "active")
    .is("trashed_at", null)
    .order("last_synced_at", { ascending: true, nullsFirst: true });
  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  const queue = campaigns ?? [];
  const results: CampaignOutcome[] = [];
  let skipped = 0;

  for (const campaign of queue) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) {
      skipped += 1;
      continue;
    }

    try {
      const outcome = await refreshCampaignDataWithClient(
        supabase,
        campaign.id,
      );
      results.push({
        campaignId: campaign.id,
        posts: {
          total: outcome.posts.total,
          updated: outcome.posts.updated,
          failed: outcome.posts.failed,
        },
        soundOk: outcome.sound.ok,
        creations: outcome.sound.after,
      });
      revalidatePath(`/report/${campaign.share_token}`);
      revalidatePath(`/admin/campaigns/${campaign.id}`);
      revalidatePath(`/admin/clients/${campaign.client_id}`);
    } catch (cause) {
      results.push({
        campaignId: campaign.id,
        error: cause instanceof Error ? cause.message : "Refresh failed",
      });
    }
  }

  if (results.length > 0) {
    revalidatePath("/admin");
    revalidatePath("/admin/clients");
  }

  const summary = {
    ok: true,
    durationMs: Date.now() - startedAt,
    scanned: queue.length,
    refreshed: results.filter((result) => !result.error).length,
    errored: results.filter((result) => result.error).length,
    skipped,
    campaigns: results,
  };

  console.log("[cron] refresh-campaigns", JSON.stringify(summary));

  return Response.json(summary);
}
