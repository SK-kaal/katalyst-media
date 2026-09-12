export default function ClientProfileLoading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading client">
      <div className="flex items-center gap-4">
        <div className="size-20 animate-pulse rounded-[12px] bg-[rgba(135,165,140,0.08)]" />
        <div className="space-y-2">
          <div className="h-8 w-48 animate-pulse rounded bg-[rgba(135,165,140,0.08)]" />
          <div className="h-4 w-28 animate-pulse rounded bg-[rgba(135,165,140,0.06)]" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="admin-panel h-20 animate-pulse bg-[rgba(135,165,140,0.05)]" />
        ))}
      </div>
    </div>
  );
}
