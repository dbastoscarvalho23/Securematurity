import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { X, ClipboardList } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

const CELL_BG = (score) => {
  if (score >= 20) return '#dc2626';
  if (score >= 16) return '#ef4444';
  if (score >= 12) return '#f97316';
  if (score >= 9)  return '#fb923c';
  if (score >= 6)  return '#facc15';
  if (score >= 4)  return '#fde047';
  if (score >= 2)  return '#bbf7d0';
  return '#dcfce7';
};

const CELL_TEXT = (score) => {
  if (score >= 9) return '#fff';
  if (score >= 6) return '#713f12';
  return '#166534';
};

const LEVEL_LABEL = (score) => {
  if (score >= 16) return 'Critical';
  if (score >= 9)  return 'High';
  if (score >= 4)  return 'Medium';
  return 'Low';
};

const TASK_STATUS_STYLES = {
  todo:        'bg-muted text-muted-foreground border-border',
  in_progress: 'bg-chart-4/10 text-chart-4 border-chart-4/20',
  blocked:     'bg-destructive/10 text-destructive border-destructive/20',
  done:        'bg-chart-2/10 text-chart-2 border-chart-2/20',
};
const TASK_STATUS_LABELS = { todo: 'To-Do', in_progress: 'In Progress', blocked: 'Blocked', done: 'Done' };

const PRIORITY_STYLES = {
  low:      'bg-chart-2/10 text-chart-2 border-chart-2/20',
  medium:   'bg-chart-3/10 text-chart-3 border-chart-3/20',
  high:     'bg-chart-4/10 text-chart-4 border-chart-4/20',
  critical: 'bg-destructive/10 text-destructive border-destructive/20',
};

function ScoreZoneLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      {[
        { color: '#dcfce7', text: '#166534', label: 'Low (1–3)' },
        { color: '#fde047', text: '#713f12', label: 'Medium (4–8)' },
        { color: '#fb923c', text: '#fff',    label: 'High (9–15)' },
        { color: '#ef4444', text: '#fff',    label: 'Critical (16–25)' },
      ].map(({ color, text, label }) => (
        <span key={label} className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded flex items-center justify-center text-[9px] font-bold" style={{ background: color, color: text }}>●</span>
          {label}
        </span>
      ))}
    </div>
  );
}

export default function TaskHeatmap({ risks }) {
  const { t } = useLanguage();
  const [selected, setSelected] = useState(null); // { impact, likelihood }

  const { data: allTasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => base44.entities.Task.list('-created_date', 500),
  });

  const { data: mitigationTasks = [] } = useQuery({
    queryKey: ['mitigationTasks'],
    queryFn: () => base44.entities.MitigationTask.list('-created_date', 500),
  });

  // Build a lookup: riskId -> { impact, likelihood }
  const riskLookup = useMemo(() => {
    const map = {};
    risks.forEach(r => { map[r.id] = r; });
    return map;
  }, [risks]);

  // Map each task to a cell using its linked risk's impact/likelihood
  // General tasks: linked via notes [Risk: <id>]
  // Mitigation tasks: linked via risk_id
  const tasksByCell = useMemo(() => {
    const cells = {};

    // General tasks — extract risk ID from notes
    allTasks.forEach(task => {
      const match = task.notes?.match(/\[Risk: ([^\]]+)\]/);
      const riskId = match?.[1];
      const risk = riskId ? riskLookup[riskId] : null;
      if (!risk) return;
      const key = `${risk.impact}-${risk.likelihood}`;
      if (!cells[key]) cells[key] = { impact: risk.impact, likelihood: risk.likelihood, items: [] };
      cells[key].items.push({ ...task, _type: 'general', _risk: risk });
    });

    // Mitigation tasks — linked via risk_id
    mitigationTasks.forEach(task => {
      const risk = riskLookup[task.risk_id];
      if (!risk) return;
      const key = `${risk.impact}-${risk.likelihood}`;
      if (!cells[key]) cells[key] = { impact: risk.impact, likelihood: risk.likelihood, items: [] };
      cells[key].items.push({ ...task, _type: 'mitigation', _risk: risk });
    });

    return cells;
  }, [allTasks, mitigationTasks, riskLookup]);

  const getCell = (impact, likelihood) => tasksByCell[`${impact}-${likelihood}`]?.items || [];

  const handleCellClick = (impact, likelihood) => {
    const cell = getCell(impact, likelihood);
    if (cell.length === 0) return;
    if (selected?.impact === impact && selected?.likelihood === likelihood) {
      setSelected(null);
    } else {
      setSelected({ impact, likelihood });
    }
  };

  const selectedTasks = useMemo(() =>
    selected ? getCell(selected.impact, selected.likelihood) : [],
    [selected, tasksByCell]
  );

  const selectedScore = selected ? selected.impact * selected.likelihood : 0;

  // Zone summary counts
  const totalTaskCount = Object.values(tasksByCell).reduce((sum, c) => sum + c.items.length, 0);

  return (
    <div className="space-y-5">
      {/* Intro text */}
      <p className="text-xs text-muted-foreground">{t('risk_task_heatmap_intro')}</p>

      {/* Heatmap grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[420px]">
          <div className="flex items-start gap-2 mb-2">
            <div className="w-20 flex-shrink-0" />
            <div className="flex-1 text-center text-xs font-semibold text-muted-foreground tracking-wide uppercase">
              Likelihood →
            </div>
          </div>

          <div className="flex items-stretch gap-2">
            {/* Y axis label */}
            <div className="w-5 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-semibold text-muted-foreground tracking-wide uppercase"
                style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                Impact ↑
              </span>
            </div>

            {/* Y axis numbers */}
            <div className="w-6 flex flex-col-reverse justify-between py-1 flex-shrink-0">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-14 flex items-center justify-center text-xs font-semibold text-muted-foreground">{i}</div>
              ))}
            </div>

            {/* Grid */}
            <div className="flex-1">
              {/* X axis numbers */}
              <div className="flex gap-1 mb-1 pl-0.5">
                {[1, 2, 3, 4, 5].map(l => (
                  <div key={l} className="flex-1 text-center text-xs font-semibold text-muted-foreground">{l}</div>
                ))}
              </div>

              {/* Rows */}
              <div className="space-y-1">
                {[5, 4, 3, 2, 1].map(impact => (
                  <div key={impact} className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(likelihood => {
                      const score = impact * likelihood;
                      const cell = getCell(impact, likelihood);
                      const isSelected = selected?.impact === impact && selected?.likelihood === likelihood;
                      const bg = CELL_BG(score);
                      const fg = CELL_TEXT(score);
                      const hasTasks = cell.length > 0;

                      return (
                        <div
                          key={likelihood}
                          onClick={() => handleCellClick(impact, likelihood)}
                          title={hasTasks
                            ? `I${impact} × L${likelihood} = ${score} · ${cell.length} task${cell.length !== 1 ? 's' : ''} — click to view`
                            : `I${impact} × L${likelihood} = ${score}`
                          }
                          className={`flex-1 h-14 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all select-none
                            ${hasTasks ? 'cursor-pointer hover:opacity-85 hover:scale-[1.04] hover:shadow-md' : 'opacity-40'}
                            ${isSelected ? 'ring-2 ring-offset-2 ring-foreground/70 scale-[1.06] shadow-lg z-10 relative' : ''}
                          `}
                          style={{ background: bg, color: fg }}
                        >
                          <span className="text-[11px] font-bold opacity-60">{score}</span>
                          {hasTasks && (
                            <span className="text-base font-extrabold leading-none">{cell.length}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <ScoreZoneLegend />

      {/* Zone summary bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { label: 'Critical', min: 16, bg: 'bg-destructive/10', text: 'text-destructive', border: 'border-destructive/20' },
          { label: 'High',     min: 9,  max: 16, bg: 'bg-chart-4/10', text: 'text-chart-4', border: 'border-chart-4/20' },
          { label: 'Medium',   min: 4,  max: 9,  bg: 'bg-chart-3/10', text: 'text-chart-3', border: 'border-chart-3/20' },
          { label: 'Low',      max: 4,  bg: 'bg-chart-2/10', text: 'text-chart-2', border: 'border-chart-2/20' },
        ].map(zone => {
          const count = Object.values(tasksByCell).reduce((sum, c) => {
            const s = c.impact * c.likelihood;
            return s >= (zone.min || 0) && s < (zone.max || Infinity) ? sum + c.items.length : sum;
          }, 0);
          return (
            <div key={zone.label} className={`rounded-lg border px-3 py-2.5 ${zone.bg} ${zone.border}`}>
              <p className={`text-xl font-bold ${zone.text}`}>{count}</p>
              <p className={`text-xs font-medium ${zone.text}`}>{zone.label} {t('risk_task_heatmap_zone_tasks')}</p>
            </div>
          );
        })}
      </div>

      {/* Drill-down panel */}
      {selected && selectedTasks.length > 0 && (
        <div className="border rounded-xl overflow-hidden shadow-sm">
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/40">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold">
                Impact <strong>{selected.impact}</strong> × Likelihood <strong>{selected.likelihood}</strong>
              </span>
              <Badge
                className={`border text-xs ${
                  selectedScore >= 16 ? 'bg-destructive/10 text-destructive border-destructive/20' :
                  selectedScore >= 9  ? 'bg-chart-4/10 text-chart-4 border-chart-4/20' :
                  selectedScore >= 4  ? 'bg-chart-3/10 text-chart-3 border-chart-3/20' :
                                        'bg-chart-2/10 text-chart-2 border-chart-2/20'
                }`}
                variant="outline"
              >
                {LEVEL_LABEL(selectedScore)} · Score {selectedScore}
              </Badge>
              <span className="text-xs text-muted-foreground">{selectedTasks.length} task{selectedTasks.length !== 1 ? 's' : ''}</span>
            </div>
            <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Task list */}
          <div className="divide-y max-h-80 overflow-y-auto">
            {selectedTasks.map((task, i) => (
              <div key={task.id || i} className="px-4 py-3 hover:bg-muted/30 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{task.title}</p>
                      <Badge variant="outline" className={`text-xs border ${TASK_STATUS_STYLES[task.status]}`}>
                        {TASK_STATUS_LABELS[task.status]}
                      </Badge>
                      {task.priority && (
                        <Badge variant="outline" className={`text-xs border ${PRIORITY_STYLES[task.priority]}`}>
                          {task.priority}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs border bg-muted text-muted-foreground border-border capitalize">
                        {task._type === 'mitigation' ? t('risk_tasks_type_mitigation') : t('risk_tasks_type_general')}
                      </Badge>
                    </div>
                    {task.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{task.description}</p>
                    )}
                    <div className="flex gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                      {task._risk?.title && <span>Risk: <strong>{task._risk.title}</strong></span>}
                      {task.assigned_to && <span>· Assigned: {task.assigned_to}</span>}
                      {task.due_date && <span>· Due: {task.due_date}</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {totalTaskCount === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">{t('risk_tasks_no_linked_any')}</p>
        </div>
      )}
    </div>
  );
}