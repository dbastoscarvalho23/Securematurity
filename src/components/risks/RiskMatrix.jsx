import React from 'react';

const CELL_COLOR = (impact, likelihood) => {
  const score = impact * likelihood;
  if (score >= 16) return 'bg-destructive/80 text-white';
  if (score >= 9) return 'bg-chart-4/70 text-white';
  if (score >= 4) return 'bg-chart-3/60 text-foreground';
  return 'bg-chart-2/30 text-foreground';
};

const LABELS = { 1: '1', 2: '2', 3: '3', 4: '4', 5: '5' };

export default function RiskMatrix({ risks }) {
  // Build a 5x5 grid, impact on Y (5 top), likelihood on X (1 left)
  const getCell = (impact, likelihood) =>
    risks.filter(r => r.impact === impact && r.likelihood === likelihood);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[360px]">
        <div className="flex items-center mb-1">
          <div className="w-16 text-xs text-muted-foreground text-right pr-2">Impact ↑</div>
          <div className="flex-1 text-center text-xs text-muted-foreground">Likelihood →</div>
        </div>
        <div className="flex">
          {/* Y axis labels */}
          <div className="w-16 flex flex-col-reverse justify-between pr-2 py-0.5">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-10 flex items-center justify-end text-xs text-muted-foreground font-medium">{i}</div>
            ))}
          </div>
          {/* Grid */}
          <div className="flex-1">
            {/* X axis labels */}
            <div className="flex mb-1">
              {[1, 2, 3, 4, 5].map(l => (
                <div key={l} className="flex-1 text-center text-xs text-muted-foreground font-medium">{l}</div>
              ))}
            </div>
            {[5, 4, 3, 2, 1].map(impact => (
              <div key={impact} className="flex gap-0.5 mb-0.5">
                {[1, 2, 3, 4, 5].map(likelihood => {
                  const cell = getCell(impact, likelihood);
                  return (
                    <div
                      key={likelihood}
                      className={`flex-1 h-10 rounded flex items-center justify-center text-xs font-semibold ${CELL_COLOR(impact, likelihood)}`}
                      title={`Impact ${impact} × Likelihood ${likelihood} = ${impact * likelihood}`}
                    >
                      {cell.length > 0 ? cell.length : ''}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-chart-2/30 inline-block" /> Low (1–3)</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-chart-3/60 inline-block" /> Medium (4–8)</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-chart-4/70 inline-block" /> High (9–15)</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-destructive/80 inline-block" /> Critical (16–25)</span>
        </div>
      </div>
    </div>
  );
}