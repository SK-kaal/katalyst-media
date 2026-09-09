export default function ClientProfileLoading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading client">
      <div className="flex items-center gap-4">
        <div className="size-20 animate-pulse rounded-[12px] bg-white/5" />
        <div className="space-y-2">
          <div className="h-8 w-48 animate-pulse rounded bg-white/5" />
          <div className="h-4 w-28 animate-pulse rounded bg-white/[0.04]" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="admin-panel h-20 animate-pulse bg-white/[0.03]" />
        ))}
      </div>
    </div>
  );
}
