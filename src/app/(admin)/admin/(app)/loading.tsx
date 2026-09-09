export default function AdminLoading() {
  return (
    <div className="admin-loading" aria-busy="true" aria-label="Loading portal">
      <p className="label-caps text-[0.68rem] tracking-[0.14em] text-acid-lime">
        Katalyst Media
      </p>
      <p className="mt-2 font-display text-lg font-semibold tracking-[-0.03em]">
        Private Portal
      </p>
      <div className="admin-loading__line" />
      <p className="mt-4 text-xs uppercase tracking-[0.12em] text-muted-grey">
        Loading…
      </p>
    </div>
  );
}
