import React from 'react';
import { CheckCircle2, Palette, Settings2, ShieldAlert, TrendingUp, Workflow, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import EmptyState from '@/components/shared/EmptyState';
import AreaOptimizations from './AreaOptimizations';
import FindingCard from './FindingCard';
import MaturityBadge from './MaturityBadge';
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
 * parágrafo, o que está sólido vs. o que falta, e os achados abertos agrupados
 * por severidade. Recebe só os achados que continuam no relatório — os
 * confirmados e corrigidos estão no registo de arquivo e aparecem apenas na
 * contagem de arquivados.
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
            {/* Nota 0–5 da área, calculada no modelo a partir dos seus achados. */}
            <MaturityBadge maturity={area.maturity} />
            <Badge variant="secondary">{findings.length} aberto(s)</Badge>
            {area.archivedCount > 0 && (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                {area.archivedCount} arquivado(s)
              </Badge>
            )}
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
            {area.gaps.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Sem lacunas abertas: as identificadas nesta área estão fechadas.
              </p>
            )}
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
            {area.closedGapsCount > 0 && (
              <p className="text-xs text-muted-foreground">
                {area.closedGapsCount} lacuna(s) identificada(s) já fechada(s), com o achado que as
                fechou — ficam no registo de arquivo.
              </p>
            )}
          </div>
        </div>

        {findings.length === 0 ? (
          <EmptyState
            icon={Icon}
            title="Sem achados abertos nesta área"
            description={
              area.archivedCount > 0
                ? `Os ${area.archivedCount} achados desta área estão confirmados e corrigidos, no registo de arquivo.`
                : 'Esta área não tem achados em aberto.'
            }
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

        {/* Subsecção «Optimizações possíveis» da área. Não passa pelo filtro de
            severidade (uma oportunidade não tem severidade): vem do modelo, já
            classificada por impacto × esforço. */}
        <AreaOptimizations optimizations={area.optimizations} />
      </CardContent>
    </Card>
  );
}
