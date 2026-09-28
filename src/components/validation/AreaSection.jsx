import React from 'react';
import { CheckCircle2, Palette, Settings2, ShieldAlert, TrendingUp, Workflow, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import EmptyState from '@/components/shared/EmptyState';
import FindingCard from './FindingCard';
import { cn } from '@/lib/utils';
import { SEVERITIES, statusMeta } from '@/lib/validationReportModel';
import { rgba } from '@/lib/docsModel';

/** Ícone de cada área (a área de segurança é a herdada da ronda anterior). */
const AREA_ICONS = {
  funcional: Workflow,
  administracao: Settings2,
  ux: Palette,
  comercial: TrendingUp,
  seguranca: ShieldAlert,
};

/**
 * Secção de uma área da avaliação: cabeçalho com a cor da área, parecer em
 * parágrafo, o que está sólido vs. o que falta, e os achados agrupados por
 * severidade. Recebe os achados já filtrados pelo filtro global de severidade.
 */
export default function AreaSection({ area, findings, openIds, onToggle }) {
  const Icon = AREA_ICONS[area.id] || ShieldAlert;
  const groups = SEVERITIES
    .map((s) => ({ ...s, items: findings.filter((f) => f.severity === s.id) }))
    .filter((g) => g.items.length > 0);

  return (
    <Card id={`area-${area.id}`} className="scroll-mt-28 overflow-hidden">
      <div className="h-1" style={{ backgroundColor: rgba(area.accent) }} />
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border"
              style={{ backgroundColor: rgba(area.accent, 0.1), borderColor: rgba(area.accent, 0.25) }}
            >
              <Icon className="h-5 w-5" style={{ color: rgba(area.accent) }} />
            </div>
            <div className="min-w-0 space-y-0.5">
              <CardTitle className="text-lg leading-tight">{area.label}</CardTitle>
              <p className="text-sm text-muted-foreground">{area.description}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{area.scopedTotal} achado(s)</Badge>
            {SEVERITIES.filter((s) => (area.severityCounts[s.id] || 0) > 0).map((s) => (
              <Badge key={s.id} variant="outline" className={cn('text-xs', s.classes)}>
                {s.label}: {area.severityCounts[s.id]}
              </Badge>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <p className="text-sm text-foreground">{area.summary}</p>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              O que está sólido
            </p>
            <ul className="space-y-1.5">
              {area.solid.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-chart-2" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Lacunas identificadas
            </p>
            <ul className="space-y-2">
              {area.gaps.map((gap) => {
                const st = statusMeta(gap.status);
                return (
                  <li key={gap.text} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-chart-3" />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <span>{gap.text}</span>
                        <Badge variant="outline" className={cn('shrink-0 text-xs', st.classes)}>
                          {st.label}
                        </Badge>
                      </div>
                      {(gap.finding || gap.statusNote) && (
                        <p
                          className="line-clamp-2 text-xs text-muted-foreground/80"
                          title={gap.statusNote || undefined}
                        >
                          {gap.finding && <span className="font-mono">{gap.finding} · </span>}
                          {gap.statusNote}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {findings.length === 0 ? (
          <EmptyState
            icon={Icon}
            title="Sem achados nesta área com o filtro atual"
            description="Altere o filtro de severidade para ver os achados desta área."
          />
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <div key={group.id} className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={cn('text-sm', group.classes)}>
                    {group.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{group.items.length} achado(s)</span>
                </div>
                <div className="space-y-3">
                  {group.items.map((finding) => (
                    <FindingCard
                      key={finding.id}
                      finding={finding}
                      open={openIds.has(finding.id)}
                      onToggle={() => onToggle(finding.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
