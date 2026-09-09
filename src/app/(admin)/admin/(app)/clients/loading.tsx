export default function ClientsLoading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading clients">
      <div className="h-8 w-40 animate-pulse rounded bg-white/5" />
      <div className="h-4 w-64 animate-pulse rounded bg-white/[0.04]" />
      <div className="admin-panel mt-6 space-y-3 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="size-9 animate-pulse rounded bg-white/5" />
            <div className="h-4 flex-1 animate-pulse rounded bg-white/[0.04]" />
          </div>
        ))}
      </div>
    </div>
  );
}
