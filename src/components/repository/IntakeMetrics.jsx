import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { BarChart3, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { intakeMetrics } from '@/lib/intake';

function Stat({ label, value, hint }) {
  return (
    <div className="rounded-md border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)} %`);

/**
 * Qualidade das propostas de classificação: quantas ligações propostas as pessoas mantêm ao indexar, quantas
 * acrescentam à mão e como isso varia com a confiança indicada pelo modelo. Só conta documentos já decididos.
 * Os números são carregados quando o painel é aberto.
 */
export default function IntakeMetrics({ customerId }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const { data: m, isLoading, error } = useQuery({
    queryKey: ['intake-metrics', customerId],
    queryFn: () => intakeMetrics(customerId),
    enabled: open && Boolean(customerId),
  });

  return (
    <div className="pt-1">
      <Button variant="ghost" size="sm" className="gap-1.5 px-2 -ml-2" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <BarChart3 className="w-4 h-4" />{t('intake_metrics_title')}
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </Button>
      {open && (
        <div className="mt-2 space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-3"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : error ? (
            <p className="text-sm text-destructive">{error.message}</p>
          ) : !m || m.reviewed === 0 ? (
            <p className="text-sm text-muted-foreground">{t('intake_metrics_empty', { n: m?.classified || 0 })}</p>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Stat label={t('intake_metrics_reviewed')} value={m.reviewed} hint={t('intake_metrics_of_classified', { n: m.classified })} />
                <Stat label={t('intake_metrics_kept')} value={pct(m.links.kept_rate)} hint={t('intake_metrics_kept_hint', { kept: m.links.kept, proposed: m.links.proposed })} />
                <Stat label={t('intake_metrics_added')} value={m.links.added} hint={t('intake_metrics_from_proposal', { p: pct(m.links.from_proposal_rate) })} />
                <Stat label={t('intake_metrics_wait')} value={m.median_minutes_to_decision == null ? '—' : t('intake_metrics_minutes', { n: m.median_minutes_to_decision })} hint={t('intake_metrics_rejected', { n: m.rejected_after_proposal })} />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="py-1 pr-3 font-medium">{t('intake_metrics_confidence')}</th>
                      <th className="py-1 pr-3 font-medium text-right">{t('intake_metrics_proposed')}</th>
                      <th className="py-1 pr-3 font-medium text-right">{t('intake_metrics_kept_n')}</th>
                      <th className="py-1 font-medium text-right">{t('intake_metrics_rate')}</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {m.by_confidence.map((b) => (
                      <tr key={b.band} className="border-t">
                        <td className="py-1 pr-3">{t(`intake_metrics_band_${b.band}`)}</td>
                        <td className="py-1 pr-3 text-right">{b.proposed}</td>
                        <td className="py-1 pr-3 text-right">{b.kept}</td>
                        <td className="py-1 text-right">{pct(b.kept_rate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {m.by_engine.length > 1 && (
                <ul className="text-xs text-muted-foreground space-y-0.5">
                  {m.by_engine.map((e) => (
                    <li key={e.engine}>{t('intake_metrics_engine', { engine: e.engine, n: e.documents, p: pct(e.kept_rate) })}</li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-muted-foreground">{t('intake_metrics_note')}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
