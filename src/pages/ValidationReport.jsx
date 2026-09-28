import React, { useMemo, useState } from 'react';
import { AlertTriangle, ClipboardList, FlaskConical, ShieldAlert, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import AreaNav from '@/components/validation/AreaNav';
import AreaSection from '@/components/validation/AreaSection';
import SeveritySummary from '@/components/validation/SeveritySummary';
import { cn } from '@/lib/utils';
import {
  AREAS,
  FIX_PLAN,
  FINDINGS,
  FOLLOW_UPS,
  NOT_EXECUTED,
  REPORT_META,
  ROUND_META,
  SEVERITIES,
  VERDICT,
  buildReportModel,
  openFindings,
  openSeverityCounts,
  totalSeverityCounts,
  totalStatusCounts,
} from '@/lib/validationReportModel';

/**
 * Relatório de validação — achados agrupados por área.
 *
 * Página TEMPORÁRIA, de leitura: todo o conteúdo vem do modelo
 * (`src/lib/validationReportModel.js`, sobre `validationReportData.js` e
 * `platformAssessmentData.js`), sem leituras nem escritas sobre dados de tenants.
 * Deve ser retirada quando os achados estiverem tratados.
 */
export default function ValidationReport() {
  const [severity, setSeverity] = useState('todas');
  const [scope, setScope] = useState('abertos');
  const [openIds, setOpenIds] = useState(() => new Set(['FB1']));

  const areas = useMemo(() => buildReportModel(), []);
  const severityCounts = useMemo(() => totalSeverityCounts(), []);
  const openCounts = useMemo(() => openSeverityCounts(), []);
  const statusCounts = useMemo(() => totalStatusCounts(), []);
  const openTotal = useMemo(() => openFindings().length, []);

  // As contagens e a lista mostram por omissão só os achados abertos (parcial ou
  // pendente); «Mostrar corrigidos» alarga ambas ao relatório completo.
  const scopedCounts = scope === 'abertos' ? openCounts : severityCounts;
  const scopeTotal = scope === 'abertos' ? openTotal : FINDINGS.length;

  const visibleAreas = useMemo(
    () =>
      areas.map((area) => {
        const scoped = scope === 'abertos' ? area.openFindings : area.findings;
        return {
          ...area,
          scopedTotal: scoped.length,
          severityCounts: scope === 'abertos' ? area.openSeverityCounts : area.severityCounts,
          visible: severity === 'todas' ? scoped : scoped.filter((f) => f.severity === severity),
        };
      }),
    [areas, severity, scope]
  );

  const visibleCount = visibleAreas.reduce((acc, area) => acc + area.visible.length, 0);

  const toggle = (id) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!areas.length) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Sem dados de avaliação"
        description="O modelo do relatório não devolveu nenhuma área nem achado."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div className="space-y-1">
          <p className="text-sm font-semibold">Página temporária — documento de validação, não é produção</p>
          <p className="text-sm">
            Ronda 1: inspeção de código e configuração. Ronda 2: correções de F1–F15 aplicadas no
            código, registadas como aplicadas e revistas por inspeção — não como verificadas. Ronda 3:
            avaliação funcional, de administração e de UX/UI, com o plano de correção em fases a ser
            executado — a Fase 1 (quick wins de apresentação, FC1/FC2/FC3/FC5/FC6) está aplicada e o
            estado de cada achado, com o que falta, está no próprio cartão. A página deve ser retirada
            quando a validação por identidade real estiver concluída.
          </p>
        </div>
      </div>

      <PageHeader
        title="Relatório de validação — Core NIS2"
        description="Achados por área: funcionalidades e fluxos, administração da plataforma, UX/UI e a validação de segurança (papéis, isolamento entre tenants, onboarding, delegações e licenciamento)."
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="h-4 w-4 text-muted-foreground" />
            Ambiente inspecionado
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Aplicação / App ID</p>
            <p className="text-sm">{REPORT_META.app} / <span className="font-mono text-xs">{REPORT_META.appId}</span></p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Branch</p>
            <p className="font-mono text-xs">{REPORT_META.branch}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Commit</p>
            <p className="font-mono text-xs">{REPORT_META.commit}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Backend</p>
            <p className="text-sm">{REPORT_META.backend}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Persistência</p>
            <p className="text-sm">{REPORT_META.persistence}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Autenticação</p>
            <p className="text-sm">{REPORT_META.auth}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Identidades disponíveis</p>
            <p className="text-sm">{REPORT_META.identities}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ambiente isolado</p>
            <p className="text-sm">{REPORT_META.isolation}</p>
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-2">{REPORT_META.scope}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{ROUND_META.round}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm">{ROUND_META.scope}</p>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Método</p>
            <p className="text-sm text-muted-foreground">{ROUND_META.method}</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            {ROUND_META.limitation}
          </div>
          <p className="text-xs text-muted-foreground">Registada em {ROUND_META.date}.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            <FlaskConical className="h-4 w-4 text-muted-foreground" />
            Parecer de prontidão do Core
            <Badge variant="outline" className="border-amber-200 bg-amber-100 text-amber-700">
              {VERDICT.classification}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">{VERDICT.summary}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Bloqueadores que impedem o parecer
              </p>
              <ul className="list-disc space-y-1 pl-4 text-sm">
                {VERDICT.blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Pontos positivos verificados por inspeção
              </p>
              <ul className="list-disc space-y-1 pl-4 text-sm">
                {VERDICT.positives.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <SeveritySummary
        severityCounts={openCounts}
        statusCounts={statusCounts}
        total={openTotal}
        correctedCount={statusCounts.corrigido || 0}
      />

      <AreaNav areas={areas} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">
          Achados por área
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            {visibleCount} de {scopeTotal}
            {scope === 'abertos' ? ' abertos' : ''}
          </span>
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={severity === 'todas' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSeverity('todas')}
          >
            Todas {scopeTotal}
          </Button>
          {SEVERITIES.map((s) => (
            <Button
              key={s.id}
              variant={severity === s.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSeverity(s.id)}
            >
              {s.label} {scopedCounts[s.id] || 0}
            </Button>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setScope(scope === 'abertos' ? 'todos' : 'abertos')}
          >
            {scope === 'abertos'
              ? `Mostrar corrigidos (${statusCounts.corrigido || 0})`
              : 'Mostrar só abertos'}
          </Button>
        </div>
      </div>

      {visibleCount === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Sem achados com esta severidade"
          description="Nenhuma área tem achados com a severidade selecionada. Escolha outra severidade ou «Todas»."
        />
      ) : (
        <div className="space-y-5">
          {visibleAreas.map((area) => (
            <AreaSection
              key={area.id}
              area={area}
              findings={area.visible}
              openIds={openIds}
              onToggle={toggle}
            />
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wrench className="h-4 w-4 text-muted-foreground" />
            Plano de correções da ronda de segurança (executado em código)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            Aplicado no código e revisto por inspeção. A confirmação por identidade real corre num
            backend com várias identidades (ver «Testes não executados» e «Seguimento»).
          </p>
          <ol className="space-y-3">
            {FIX_PLAN.map((step) => (
              <li key={step.id} className="flex items-start gap-3 text-sm">
                <Badge variant="secondary" className="mt-0.5 shrink-0 font-mono">{step.id}</Badge>
                <span>
                  <span className="font-mono text-xs text-muted-foreground">{step.ref}</span>
                  {step.refNote && <span className="text-xs text-muted-foreground"> ({step.refNote})</span>}
                  {' — '}
                  {step.text}
                </span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Seguimento (residuais)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {FOLLOW_UPS.map((f) => (
            <div key={f.ref} className="border-b pb-3 last:border-b-0 last:pb-0">
              <p className="text-sm font-medium text-foreground">
                <span className="font-mono text-xs text-muted-foreground">{f.ref}</span> — {f.title}
              </p>
              <p className="text-sm text-muted-foreground">{f.note}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Testes não executados e motivo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {NOT_EXECUTED.map((row) => (
            <div key={row.block} className="border-b pb-3 last:border-b-0 last:pb-0">
              <p className="text-sm font-medium text-foreground">{row.block}</p>
              <p className="text-sm text-muted-foreground">{row.reason}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <p className={cn('text-xs text-muted-foreground')}>
        Áreas cobertas: {AREAS.map((a) => a.label).join(' · ')}.
      </p>
    </div>
  );
}
