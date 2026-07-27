import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, Pencil } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

const CELL_COLOR = (impact, likelihood) => {
  const score = impact * likelihood;
  if (score >= 16) return 'bg-destructive/80 text-white';
  if (score >= 9) return 'bg-chart-4/70 text-white';
  if (score >= 4) return 'bg-chart-3/60 text-foreground';
  return 'bg-chart-2/30 text-foreground';
};

const STATUS_STYLES = {
  open: 'bg-destructive/10 text-destructive border-destructive/20',
  in_treatment: 'bg-chart-3/10 text-chart-3 border-chart-3/20',
  accepted: 'bg-chart-4/10 text-chart-4 border-chart-4/20',
  closed: 'bg-chart-2/10 text-chart-2 border-chart-2/20',
};
export default function RiskMatrix({ risks, onEdit }) {
  const { t } = useLanguage();
  const [selected, setSelected] = useState(null); // { impact, likelihood }
  const STATUS_LABELS = {
    open: t('risk_status_open'),
    in_treatment: t('risk_status_in_treatment'),
    accepted: t('risk_status_accepted'),
    closed: t('risk_status_closed'),
  };
  const CATEGORY_LABELS = {
    access_control: t('risk_cat_access_control'),
    data_protection: t('risk_cat_data_protection'),
    network_security: t('risk_cat_network_security'),
    physical_security: t('risk_cat_physical_security'),
    third_party: t('risk_cat_third_party'),
    compliance: t('risk_cat_compliance'),
    operational: t('risk_cat_operational'),
    other: t('risk_cat_other'),
  };

  const getCell = (impact, likelihood) =>
    risks.filter(r => r.impact === impact && r.likelihood === likelihood);

  const handleCellClick = (impact, likelihood, cell) => {
    if (cell.length === 0) return;
    if (selected?.impact === impact && selected?.likelihood === likelihood) {
      setSelected(null);
    } else {
      setSelected({ impact, likelihood });
    }
  };

  const selectedRisks = selected ? getCell(selected.impact, selected.likelihood) : [];
  const selectedScore = selected ? selected.impact * selected.likelihood : 0;

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <div className="min-w-[360px]">
          <div className="flex items-center mb-1">
            <div className="w-16 text-xs text-muted-foreground text-right pr-2">{t('risk_impact')} ↑</div>
            <div className="flex-1 text-center text-xs text-muted-foreground">{t('risk_likelihood')} →</div>
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
              <div className="flex mb-1">
                {[1, 2, 3, 4, 5].map(l => (
                  <div key={l} className="flex-1 text-center text-xs text-muted-foreground font-medium">{l}</div>
                ))}
              </div>
              {[5, 4, 3, 2, 1].map(impact => (
                <div key={impact} className="flex gap-0.5 mb-0.5">
                  {[1, 2, 3, 4, 5].map(likelihood => {
                    const cell = getCell(impact, likelihood);
                    const isSelected = selected?.impact === impact && selected?.likelihood === likelihood;
                    return (
                      <div
                        key={likelihood}
                        onClick={() => handleCellClick(impact, likelihood, cell)}
                        className={`flex-1 h-10 rounded flex items-center justify-center text-xs font-semibold transition-all
                          ${CELL_COLOR(impact, likelihood)}
                          ${cell.length > 0 ? 'cursor-pointer hover:opacity-80 hover:scale-105' : ''}
                          ${isSelected ? 'ring-2 ring-offset-1 ring-foreground/60 scale-105' : ''}
                        `}
                        title={cell.length > 0 ? `${cell.length} ${cell.length !== 1 ? t('risk_plural') : t('risk_singular')} · ${t('risk_matrix_click_to_view')}` : `${t('risk_impact')} ${impact} × ${t('risk_likelihood')} ${likelihood}`}
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
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-chart-2/30 inline-block" /> {t('risk_level_low')} (1–3)</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-chart-3/60 inline-block" /> {t('risk_level_medium')} (4–8)</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-chart-4/70 inline-block" /> {t('risk_level_high')} (9–15)</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-destructive/80 inline-block" /> {t('risk_level_critical')} (16–25)</span>
          </div>
        </div>
      </div>

      {/* Expanded risk list */}
      {selected && selectedRisks.length > 0 && (
        <div className="border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 bg-muted/50 border-b">
            <div className="flex items-center gap-2 text-sm font-medium">
              <span>{t('risk_matrix_risks_at')} {t('risk_impact')} <strong>{selected.impact}</strong> × {t('risk_likelihood')} <strong>{selected.likelihood}</strong></span>
              <Badge variant="outline" className={`border text-xs ${
                selectedScore >= 16 ? 'bg-destructive/10 text-destructive border-destructive/20' :
                selectedScore >= 9  ? 'bg-chart-4/10 text-chart-4 border-chart-4/20' :
                selectedScore >= 4  ? 'bg-chart-3/10 text-chart-3 border-chart-3/20' :
                                      'bg-chart-2/10 text-chart-2 border-chart-2/20'
              }`}>
                {t('risk_score')} {selectedScore}
              </Badge>
              <span className="text-muted-foreground text-xs">· {selectedRisks.length} {selectedRisks.length !== 1 ? t('risk_plural') : t('risk_singular')}</span>
            </div>
            <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="divide-y">
            {selectedRisks.map(risk => (
              <div key={risk.id} className="px-4 py-3 hover:bg-muted/30 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {risk.risk_id && <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{risk.risk_id}</span>}
                      <p className="text-sm font-medium">{risk.title}</p>
                    </div>
                    {risk.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{risk.description}</p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-1.5 items-center text-xs text-muted-foreground">
                      {risk.category && (
                        <span className="bg-muted px-1.5 py-0.5 rounded">{CATEGORY_LABELS[risk.category] || risk.category}</span>
                      )}
                      <Badge variant="outline" className={`border text-xs ${STATUS_STYLES[risk.status]}`}>
                        {STATUS_LABELS[risk.status] || risk.status}
                      </Badge>
                      {risk.owner_email && <span>{risk.owner_email}</span>}
                      {risk.due_date && <span>{t('risk_due')}: {risk.due_date}</span>}
                      {risk.customer_name && <span>· {risk.customer_name}</span>}
                    </div>
                    {risk.treatment_notes && (
                      <p className="text-xs text-muted-foreground mt-1.5 italic border-l-2 border-muted pl-2">{risk.treatment_notes}</p>
                    )}
                  </div>
                  {onEdit && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => onEdit(risk)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}