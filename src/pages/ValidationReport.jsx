import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, FlaskConical, ShieldAlert, Wrench } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/shared/PageHeader';
import ValidationIssueCard from '@/components/validation/ValidationIssueCard';
import { cn } from '@/lib/utils';
import {
  FIX_PLAN,
  ISSUES,
  NOT_EXECUTED,
  REPORT_META,
  SEVERITIES,
  VERDICT,
  countBySeverity,
} from '@/lib/validationReportData';

/**
 * Relatório de validação funcional e de segurança (Core NIS2).
 *
 * Página TEMPORÁRIA, de leitura: conteúdo estático local, sem leituras nem
 * escritas sobre dados de tenants, e sem entrada no Sidebar. Deve ser retirada
 * quando as correções do plano forem aplicadas.
 */
export default function ValidationReport() {
  const [severity, setSeverity] = useState('todas');
  const [openIds, setOpenIds] = useState(() => new Set(['F1']));

  const counts = useMemo(() => countBySeverity(), []);
  const visible = useMemo(
    () => (severity === 'todas' ? ISSUES : ISSUES.filter((i) => i.severity === severity)),
    [severity]
  );

  const toggle = (id) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const groups = SEVERITIES
    .map((s) => ({ ...s, items: visible.filter((i) => i.severity === s.id) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div className="space-y-1">
          <p className="text-sm font-semibold">Página temporária — documento de validação, não é produção</p>
          <p className="text-sm">
            Resultado de uma ronda de validação em modo de inspeção, sem alterações de implementação.
            Deve ser retirada quando as correções do plano forem aplicadas.
          </p>
        </div>
      </div>

      <PageHeader
        title="Relatório de validação — Core NIS2"
        description="Validação funcional e de segurança: papéis, isolamento entre tenants, onboarding, delegações e licenciamento."
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
            <ul className="space-y-1 text-sm">
              {VERDICT.positives.map((p) => (
                <li key={p} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-foreground">
            Problemas por prioridade
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {visible.length} de {ISSUES.length}
            </span>
          </h2>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={severity === 'todas' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSeverity('todas')}
            >
              Todas ({ISSUES.length})
            </Button>
            {SEVERITIES.map((s) => (
              <Button
                key={s.id}
                variant={severity === s.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSeverity(s.id)}
              >
                {s.label} ({counts[s.id]})
              </Button>
            ))}
          </div>
        </div>

        {groups.map((g) => (
          <div key={g.id} className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={cn('text-sm', g.classes)}>
                {g.label}
              </Badge>
              <span className="text-xs text-muted-foreground">{g.items.length} problema(s)</span>
            </div>
            <div className="space-y-3">
              {g.items.map((issue) => (
                <ValidationIssueCard
                  key={issue.id}
                  issue={issue}
                  open={openIds.has(issue.id)}
                  onToggle={() => toggle(issue.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wrench className="h-4 w-4 text-muted-foreground" />
            Plano de correções (não executado)
          </CardTitle>
        </CardHeader>
        <CardContent>
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
    </div>
  );
}
