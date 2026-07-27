import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { X, Pencil, ShieldCheck, ClipboardList, ChevronRight, AlertTriangle, Plus } from 'lucide-react';
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

const LEVEL_KEY = (score) => {
  if (score >= 16) return 'risk_level_critical';
  if (score >= 9)  return 'risk_level_high';
  if (score >= 4)  return 'risk_level_medium';
  return 'risk_level_low';
};

const STATUS_STYLES = {
  open: 'bg-destructive/10 text-destructive border-destructive/20',
  in_treatment: 'bg-chart-3/10 text-chart-3 border-chart-3/20',
  accepted: 'bg-chart-4/10 text-chart-4 border-chart-4/20',
  closed: 'bg-chart-2/10 text-chart-2 border-chart-2/20',
};
const STATUS_KEYS = {
  open: 'risk_status_open',
  in_treatment: 'risk_status_in_treatment',
  accepted: 'risk_status_accepted',
  closed: 'risk_status_closed',
};

const TASK_STATUS_STYLES = {
  todo: 'bg-muted text-muted-foreground border-border',
  in_progress: 'bg-chart-4/10 text-chart-4 border-chart-4/20',
  blocked: 'bg-destructive/10 text-destructive border-destructive/20',
  done: 'bg-chart-2/10 text-chart-2 border-chart-2/20',
};
const TASK_STATUS_KEYS = {
  todo: 'tasks_status_todo',
  in_progress: 'tasks_status_in_progress',
  blocked: 'tasks_status_blocked',
  done: 'tasks_status_done',
};

const CATEGORY_KEYS = {
  access_control: 'risk_cat_access_control',
  data_protection: 'risk_cat_data_protection',
  network_security: 'risk_cat_network_security',
  physical_security: 'risk_cat_physical_security',
  third_party: 'risk_cat_third_party',
  compliance: 'risk_cat_compliance',
  operational: 'risk_cat_operational',
  other: 'risk_cat_other',
};

function ScoreZoneLegend({ t }) {
  const zones = [
    { color: '#dcfce7', text: '#166534', label: t('risk_heatmap_legend_low') },
    { color: '#fde047', text: '#713f12', label: t('risk_heatmap_legend_medium') },
    { color: '#fb923c', text: '#fff',    label: t('risk_heatmap_legend_high') },
    { color: '#ef4444', text: '#fff',    label: t('risk_heatmap_legend_critical') },
  ];
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      {zones.map(({ color, text, label }) => (
        <span key={label} className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded flex items-center justify-center text-[9px] font-bold" style={{ background: color, color: text }}>●</span>
          {label}
        </span>
      ))}
    </div>
  );
}

export default function RiskHeatmap({ risks, onEdit }) {
  const { t } = useLanguage();
  const [selected, setSelected] = useState(null);
  const [activeTab, setActiveTab] = useState('risks');
  const [taskSubTab, setTaskSubTab] = useState('general');

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => base44.entities.Task.list('-created_date', 500),
  });

  const getCell = (impact, likelihood) =>
    risks.filter(r => r.impact === impact && r.likelihood === likelihood);

  const handleCellClick = (impact, likelihood) => {
    const cell = getCell(impact, likelihood);
    if (cell.length === 0) return;
    if (selected?.impact === impact && selected?.likelihood === likelihood) {
      setSelected(null);
    } else {
      setSelected({ impact, likelihood });
      setActiveTab('risks');
    }
  };

  const selectedRisks = useMemo(() =>
    selected ? getCell(selected.impact, selected.likelihood) : [],
    [selected, risks]
  );

  const selectedScore = selected ? selected.impact * selected.likelihood : 0;

  const linkedTasks = useMemo(() => {
    if (!selectedRisks.length) return [];
    const customerIds = new Set(selectedRisks.map(r => r.customer_id).filter(Boolean));
    return tasks.filter(t =>
      (t.customer_id && customerIds.has(t.customer_id)) ||
      selectedRisks.some(r => t.title?.toLowerCase().includes(r.title?.toLowerCase()?.split(' ')[0]))
    );
  }, [selectedRisks, tasks]);

  const mitigationItems = useMemo(() =>
    selectedRisks.filter(r => r.treatment_notes),
    [selectedRisks]
  );

  return (
    <div className="space-y-5">
      {/* Heatmap grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[420px]">
          {/* Axis title */}
          <div className="flex items-start gap-2 mb-2">
            <div className="w-20 flex-shrink-0" />
            <div className="flex-1 text-center text-xs font-semibold text-muted-foreground tracking-wide uppercase">
              {t('risk_heatmap_likelihood_axis')}
            </div>
          </div>

          <div className="flex items-stretch gap-2">
            {/* Y axis label */}
            <div className="w-5 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-semibold text-muted-foreground tracking-wide uppercase"
                style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                {t('risk_heatmap_impact_axis')}
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
                      const hasRisks = cell.length > 0;

                      return (
                        <div
                          key={likelihood}
                          onClick={() => handleCellClick(impact, likelihood)}
                          title={hasRisks
                            ? `I${impact} × L${likelihood} = ${score} · ${cell.length} ${cell.length !== 1 ? t('risk_mit_task_plural') : t('risk_mit_task_singular')}`
                            : `I${impact} × L${likelihood} = ${score}`
                          }
                          className={`flex-1 h-14 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all select-none
                            ${hasRisks ? 'cursor-pointer hover:opacity-85 hover:scale-[1.04] hover:shadow-md' : 'opacity-40'}
                            ${isSelected ? 'ring-2 ring-offset-2 ring-foreground/70 scale-[1.06] shadow-lg z-10 relative' : ''}
                          `}
                          style={{ background: bg, color: fg }}
                        >
                          <span className="text-[11px] font-bold opacity-60">{score}</span>
                          {hasRisks && (
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

      <ScoreZoneLegend t={t} />

      {/* Zone summary bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { labelKey: 'risk_level_critical', min: 16, bg: 'bg-destructive/10', text: 'text-destructive', border: 'border-destructive/20' },
          { labelKey: 'risk_level_high',     min: 9,  max: 16, bg: 'bg-chart-4/10', text: 'text-chart-4', border: 'border-chart-4/20' },
          { labelKey: 'risk_level_medium',   min: 4,  max: 9,  bg: 'bg-chart-3/10', text: 'text-chart-3', border: 'border-chart-3/20' },
          { labelKey: 'risk_level_low',      max: 4,  bg: 'bg-chart-2/10', text: 'text-chart-2', border: 'border-chart-2/20' },
        ].map(zone => {
          const count = risks.filter(r => {
            const s = (r.impact || 0) * (r.likelihood || 0);
            return s >= (zone.min || 0) && s < (zone.max || Infinity);
          }).length;
          return (
            <button
              key={zone.labelKey}
              onClick={() => {
                if (count === 0) return;
                const firstRisk = risks.find(r => {
                  const s = (r.impact || 0) * (r.likelihood || 0);
                  return s >= (zone.min || 0) && s < (zone.max || Infinity);
                });
                if (firstRisk) {
                  const isSameZone = selectedRisks.some(r => {
                    const s = (r.impact || 0) * (r.likelihood || 0);
                    return s >= (zone.min || 0) && s < (zone.max || Infinity);
                  }) && selectedRisks.length === risks.filter(r => {
                    const s = (r.impact || 0) * (r.likelihood || 0);
                    return s >= (zone.min || 0) && s < (zone.max || Infinity);
                  }).length;

                  if (!isSameZone) {
                    const zoneRisks = risks.filter(r => {
                      const s = (r.impact || 0) * (r.likelihood || 0);
                      return s >= (zone.min || 0) && s < (zone.max || Infinity);
                    });
                    const best = zoneRisks.reduce((acc, r) => {
                      const key = `${r.impact}-${r.likelihood}`;
                      acc[key] = (acc[key] || 0) + 1;
                      return acc;
                    }, {});
                    const topKey = Object.entries(best).sort((a, b) => b[1] - a[1])[0]?.[0];
                    if (topKey) {
                      const [imp, lik] = topKey.split('-').map(Number);
                      setSelected({ impact: imp, likelihood: lik });
                      setActiveTab('risks');
                    }
                  }
                }
              }}
              className={`rounded-lg border px-3 py-2.5 text-left transition-colors hover:opacity-80 ${zone.bg} ${zone.border} ${count === 0 ? 'opacity-40 cursor-default' : 'cursor-pointer'}`}
            >
              <p className={`text-xl font-bold ${zone.text}`}>{count}</p>
              <p className={`text-xs font-medium ${zone.text}`}>{t(zone.labelKey)}</p>
            </button>
          );
        })}
      </div>

      {/* Drill-down panel */}
      {selected && selectedRisks.length > 0 && (
        <div className="border rounded-xl overflow-hidden shadow-sm">
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/40">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold">
                {t('risk_impact')} <strong>{selected.impact}</strong> × {t('risk_likelihood')} <strong>{selected.likelihood}</strong>
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
                {t(LEVEL_KEY(selectedScore))} · {t('risk_score')} {selectedScore}
              </Badge>
              <span className="text-xs text-muted-foreground">{selectedRisks.length} {selectedRisks.length !== 1 ? t('risk_mit_task_plural') : t('risk_mit_task_singular')}</span>
            </div>
            <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b">
            {[
              { id: 'risks', labelKey: 'risk_heatmap_risks_tab', Icon: AlertTriangle },
              { id: 'tasks', labelKey: 'risk_heatmap_tasks_tab', Icon: ClipboardList },
            ].map(({ id, labelKey, Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                  activeTab === id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t(labelKey)}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="divide-y max-h-80 overflow-y-auto">

            {/* Risks tab */}
            {activeTab === 'risks' && selectedRisks.map(risk => (
              <div key={risk.id} className="px-4 py-3 hover:bg-muted/30 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {risk.risk_id && (
                        <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{risk.risk_id}</span>
                      )}
                      <p className="text-sm font-medium">{risk.title}</p>
                      <Badge variant="outline" className={`text-xs border ${STATUS_STYLES[risk.status]}`}>
                        {t(STATUS_KEYS[risk.status])}
                      </Badge>
                    </div>
                    {risk.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{risk.description}</p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-1.5 text-xs text-muted-foreground">
                      {risk.category && <span className="bg-muted px-1.5 py-0.5 rounded">{t(CATEGORY_KEYS[risk.category]) || risk.category}</span>}
                      {risk.owner_email && <span>{t('risk_owner')}: {risk.owner_email}</span>}
                      {risk.due_date && <span>{t('risk_due')}: {risk.due_date}</span>}
                      {risk.customer_name && <span>· {risk.customer_name}</span>}
                    </div>
                  </div>
                  {onEdit && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => onEdit(risk)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}

            {/* Tasks tab */}
            {activeTab === 'tasks' && (
              <div>
                {/* Sub-toggle + Create Task button */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/20">
                  <div className="flex items-center rounded-md border border-border bg-background p-0.5 gap-0.5">
                    <button
                      onClick={() => setTaskSubTab('general')}
                      className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded transition-all ${
                        taskSubTab === 'general' ? 'bg-muted text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <ClipboardList className="w-3 h-3" /> {t('risk_tasks_general')}
                    </button>
                    <button
                      onClick={() => setTaskSubTab('mitigation')}
                      className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded transition-all ${
                        taskSubTab === 'mitigation' ? 'bg-muted text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <ShieldCheck className="w-3 h-3" /> {t('risk_tasks_mitigation')}
                    </button>
                  </div>
                  {onEdit && selectedRisks.length === 1 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                      onClick={() => onEdit(selectedRisks[0], taskSubTab === 'mitigation' ? 'mitigation' : 'create_task')}
                    >
                      <Plus className="w-3 h-3" /> {t('risk_tasks_create')}
                    </Button>
                  )}
                  {onEdit && selectedRisks.length > 1 && (
                    <span className="text-xs text-muted-foreground italic">{t('risk_tasks_select_single')}</span>
                  )}
                </div>

                {/* General tasks sub-tab */}
                {taskSubTab === 'general' && (
                  linkedTasks.length === 0
                    ? (
                      <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                        <ClipboardList className="w-6 h-6 mx-auto mb-2 opacity-30" />
                        {t('risk_tasks_no_linked')}
                      </div>
                    )
                    : linkedTasks.map(task => (
                      <div key={task.id} className="px-4 py-3 hover:bg-muted/30 transition-colors">
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium">{task.title}</p>
                              <Badge variant="outline" className={`text-xs border ${TASK_STATUS_STYLES[task.status]}`}>
                                {t(TASK_STATUS_KEYS[task.status])}
                              </Badge>
                            </div>
                            {task.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{task.description}</p>
                            )}
                            <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
                              {task.assigned_to && <span>{t('risk_mit_assigned')}: {task.assigned_to}</span>}
                              {task.due_date && <span>· {t('risk_due')}: {task.due_date}</span>}
                              {task.customer_name && <span>· {task.customer_name}</span>}
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                        </div>
                      </div>
                    ))
                )}

                {/* Mitigation sub-tab */}
                {taskSubTab === 'mitigation' && (
                  mitigationItems.length === 0
                    ? (
                      <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                        <ShieldCheck className="w-6 h-6 mx-auto mb-2 opacity-30" />
                        {t('risk_tasks_no_mitigation')}
                      </div>
                    )
                    : mitigationItems.map(risk => (
                      <div key={risk.id} className="px-4 py-3 hover:bg-muted/30 transition-colors">
                        <div className="flex items-start gap-3">
                          <div className="p-1.5 rounded-md bg-chart-2/10 flex-shrink-0">
                            <ShieldCheck className="w-3.5 h-3.5 text-chart-2" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {risk.risk_id && (
                                <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{risk.risk_id}</span>
                              )}
                              <p className="text-xs font-semibold">{risk.title}</p>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{risk.treatment_notes}</p>
                            <div className="flex gap-2 mt-1.5 text-xs text-muted-foreground">
                              <Badge variant="outline" className={`text-xs border ${STATUS_STYLES[risk.status]}`}>
                                {t(STATUS_KEYS[risk.status])}
                              </Badge>
                              {risk.due_date && <span className="self-center">{t('risk_heatmap_target')}: {risk.due_date}</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}