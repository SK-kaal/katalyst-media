import Link from "next/link";
import { NewCampaignForm } from "@/components/admin/NewCampaignForm";
import { createAdminClient } from "@/lib/admin-auth/client";

export default async function NewCampaignPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const { clientId } = await searchParams;
  const supabase = await createAdminClient();
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, handle")
    .order("name");

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/admin" className="text-sm text-soft-grey hover:text-off-white">
        ← Back to Campaign Library
      </Link>
      <p className="admin-page-eyebrow mt-5">Create New Campaign</p>
      <h1 className="admin-page-title">Create New Campaign</h1>
      <p className="admin-page-desc">
        Paste a TikTok sound URL, set the budget, then add posts.
      </p>

      <NewCampaignForm
        clients={clients ?? []}
        defaultClientId={clientId}
      />
    </div>
  );
}
