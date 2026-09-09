export default function CampaignLoading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading campaign">
      <div className="h-4 w-32 animate-pulse rounded bg-white/5" />
      <div className="flex gap-4">
        <div className="size-20 animate-pulse rounded-[8px] bg-white/5" />
        <div className="flex-1 space-y-2">
          <div className="h-8 w-2/3 animate-pulse rounded bg-white/5" />
          <div className="h-4 w-40 animate-pulse rounded bg-white/[0.04]" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="admin-panel h-24 animate-pulse bg-white/[0.03]" />
        ))}
      </div>
    </div>
  );
}
