"use client";

export function ViewsCharts({
  daily,
}: {
  daily: { date: string; views: number; cumulative: number }[];
}) {
  if (daily.length === 0) {
    return (
      <div className="report-charts">
        <div className="report-panel text-sm text-soft-grey">
          No performance data yet.
        </div>
      </div>
    );
  }

  const maxDaily = Math.max(...daily.map((d) => d.views), 1);
  const maxCum = Math.max(...daily.map((d) => d.cumulative), 1);
  const w = 560;
  const h = 220;
  const pad = 28;

  const points = daily.map((row, index) => {
    const x =
      pad + (index / Math.max(daily.length - 1, 1)) * (w - pad * 2);
    const y = h - pad - (row.cumulative / maxCum) * (h - pad * 2);
    return `${x},${y}`;
  });

  const area = `${pad},${h - pad} ${points.join(" ")} ${w - pad},${h - pad}`;

  return (
    <div className="report-charts">
      <div className="report-panel">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-display text-base font-semibold tracking-[-0.02em]">
            Views Over Time
          </h2>
          <span className="text-[0.68rem] text-muted-grey">Daily</span>
        </div>
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="Daily views">
          {[0.25, 0.5, 0.75, 1].map((t) => (
            <line
              key={t}
              x1={pad}
              x2={w - pad}
              y1={h - pad - t * (h - pad * 2)}
              y2={h - pad - t * (h - pad * 2)}
              stroke="rgba(255,255,255,0.06)"
            />
          ))}
          {daily.map((row, index) => {
            const barW = Math.max(4, (w - pad * 2) / daily.length - 4);
            const x =
              pad +
              (index / Math.max(daily.length, 1)) * (w - pad * 2) +
              2;
            const barH = (row.views / maxDaily) * (h - pad * 2);
            return (
              <rect
                key={row.date}
                x={x}
                y={h - pad - barH}
                width={barW}
                height={barH}
                rx={2}
                fill="rgba(198,255,0,0.75)"
              />
            );
          })}
        </svg>
      </div>

      <div className="report-panel">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-display text-base font-semibold tracking-[-0.02em]">
            Cumulative Views
          </h2>
          <span className="text-[0.68rem] text-muted-grey">Cumulative</span>
        </div>
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="Cumulative views">
          {[0.25, 0.5, 0.75, 1].map((t) => (
            <line
              key={t}
              x1={pad}
              x2={w - pad}
              y1={h - pad - t * (h - pad * 2)}
              y2={h - pad - t * (h - pad * 2)}
              stroke="rgba(255,255,255,0.06)"
            />
          ))}
          <polygon points={area} fill="rgba(198,255,0,0.12)" />
          <polyline
            points={points.join(" ")}
            fill="none"
            stroke="#c6ff00"
            strokeWidth="2.2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
}
