export default function ReportLoading() {
  return (
    <div
      className="grid min-h-svh place-items-center bg-[#080809] px-5 text-center"
      aria-busy="true"
      aria-label="Loading report"
    >
      <div>
        <p className="text-[0.68rem] uppercase tracking-[0.14em] text-[#c6ff00]">
          Katalyst Media
        </p>
        <p className="mt-3 text-sm text-[#77777f]">Loading campaign report…</p>
      </div>
    </div>
  );
}
