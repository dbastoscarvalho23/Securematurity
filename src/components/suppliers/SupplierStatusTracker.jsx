import React from 'react';
import { ShieldCheck, AlertTriangle, Clock, Circle, Archive } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

const TIER_FILL = { tier_1: 3, tier_2: 2, tier_3: 1 };
const TIER_COLOR = { tier_1: 'bg-accent', tier_2: 'bg-primary', tier_3: 'bg-chart-3' };

const COMPLIANCE = {
  not_assessed: { icon: Circle, bg: 'bg-muted/60', text: 'text-muted-foreground', border: 'border-muted-foreground/20', label: 'sst_not_assessed' },
  pending: { icon: Clock, bg: 'bg-chart-3/10', text: 'text-chart-3', border: 'border-chart-3/30', label: 'sst_pending' },
  in_progress: { icon: Clock, bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/30', label: 'sst_in_progress' },
  compliant: { icon: ShieldCheck, bg: 'bg-chart-2/10', text: 'text-chart-2', border: 'border-chart-2/30', label: 'sst_compliant' },
  overdue: { icon: AlertTriangle, bg: 'bg-destructive/10', text: 'text-destructive', border: 'border-destructive/30', label: 'sst_overdue' },
  archived: { icon: Archive, bg: 'bg-muted/60', text: 'text-muted-foreground', border: 'border-muted-foreground/20', label: 'sst_archived' },
};

export function deriveCompliance(questionnaire) {
  if (!questionnaire) return 'not_assessed';
  const s = questionnaire.status;
  if (s === 'completed') return 'compliant';
  if (s === 'archived') return 'archived';
  if (s === 'in_progress') return 'in_progress';
  if (s === 'draft' || s === 'sent') {
    if (questionnaire.due_date) {
      const due = new Date(questionnaire.due_date);
      if (!isNaN(due) && due < new Date()) return 'overdue';
    }
    return 'pending';
  }
  return 'not_assessed';
}

export default function SupplierStatusTracker({ supplier, questionnaire }) {
  const { t } = useLanguage();
  const tier = supplier?.tier || 'tier_3';
  const fill = TIER_FILL[tier] ?? 0;
  const tierColor = TIER_COLOR[tier] || 'bg-primary';
  const statusKey = deriveCompliance(questionnaire);
  const cfg = COMPLIANCE[statusKey];
  const Icon = cfg.icon;

  return (
    <div className="mt-3 pt-3 border-t space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-muted-foreground">{t('sst_maturity')}</span>
        <div className="flex items-center gap-1">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className={`h-1.5 w-7 rounded-full transition-colors ${i <= fill ? tierColor : 'bg-muted-foreground/20'}`}
            />
          ))}
          <span className="text-[11px] font-semibold ml-1.5">{t(`suppliers_${tier}`)}</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-muted-foreground">{t('sst_tracker_title')}</span>
        <div className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${cfg.bg} ${cfg.text} ${cfg.border}`}>
          <Icon className="w-3 h-3" />
          {t(cfg.label)}
        </div>
      </div>
    </div>
  );
}