import React, { useMemo, useState } from 'react';
import { AlertTriangle, ClipboardList, FlaskConical, ListChecks, ShieldAlert, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import AreaNav from '@/components/validation/AreaNav';
import AreaSection from '@/components/validation/AreaSection';
import MaturityMatrix from '@/components/validation/MaturityMatrix';
import SeveritySummary from '@/components/validation/SeveritySummary';
import { cn } from '@/lib/utils';
import {
  ACTIVE_FINDINGS,
  AREAS,
  FIX_PLAN,
  FOLLOW_UPS,
  NOT_EXECUTED,
  REPORT_ARCHIVED_FINDINGS,
  REPORT_META,
  ROUND_META,
  TODO_LIST,
  VERDICT,
  buildReportModel,
  openFindings,
  openSeverityCounts,
  statusMeta,
  totalStatusCounts,
} from '@/lib/validationReportModel';

/**
 * Relatório de validação — achados agrupados por área.
 *
 * Página TEMPORÁRIA, de leitura: todo o conteúdo vem do modelo
 * (`src/lib/validationReportModel.js`, sobre `validationReportData.js` e
 * `platformAssessmentData.js`), sem leituras nem escritas sobre dados de tenants.
 * Deve ser retirada quando os achados estiverem tratados.
 *
 * As contagens por severidade vivem num único sítio — o cartão
 * `SeveritySummary` — e a listagem «Achados por área» mostra só os achados que
 * continuam abertos, sem filtro por severidade. Os achados confirmados e
 * corrigidos saíram do relatório para o registo de arquivo
 * (`validationArchive.js`), que guarda a correção e o que a confirmou.
 */
export default function ValidationReport() {
  const [openIds, setOpenIds] = useState(() => new Set(['FB1']));

  const areas = useMemo(() => buildReportModel(), []);
  // O relatório conta só os achados que ainda estão nele: os confirmados e
  // corrigidos saíram para o registo de arquivo (`validationArchive.js`).
  const openCounts = useMemo(() => openSeverityCounts(ACTIVE_FINDINGS), []);
  const statusCounts = useMemo(() => totalStatusCounts(ACTIVE_FINDINGS), []);
  const openTotal = useMemo(() => openFindings().length, []);
  const archivedTotal = REPORT_ARCHIVED_FINDINGS.length;

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
      <div className="flex items-start gap-3 rounded-lg border border-status-warning/30 bg-status-warning/10 p-4 text-foreground">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-status-warning" />
        <div className="space-y-1">
          <p className="text-sm font-semibold">Página temporária — documento de validação, não é produção</p>
          <p className="text-sm">
            Ronda 1: inspeção de código e configuração. Ronda 2: correções de F1–F15 aplicadas no
            código, registadas como aplicadas e revistas por inspeção — não como verificadas. Ronda 3:
            avaliação funcional, de administração e de UX/UI, com o plano de correção em fases a ser
            executado — a Fase 1 (quick wins de apresentação, FC1/FC2/FC3/FC5/FC6) está aplicada e o
            estado de cada achado, com o que falta, está no próprio cartão. A área «Gestão comercial»
            (FM1–FM6) é a auditoria dos fluxos comerciais e o plano das capacidades em falta: os cinco
            achados abertos são o desenho proposto, não trabalho feito. A ronda 4 acrescenta a cada
            área a subsecção «Optimizações possíveis»: pontos de optimização, melhorias e
            funcionalidades novas identificados nos mesmos percursos, classificados por impacto ×
            esforço (quick win, projeto ou candidato) segundo uma decisão única do modelo. A ronda 5 audita a fidelidade deste relatório:
            confrontou cada afirmação com o código e com o harness e corrigiu o que estava desatualizado — o repositório legal (Layer 1), já entregue,
            as contagens do harness, os metadados de revisão e três optimizações entretanto realizadas —
            mantendo como residual apenas o que exige backend real. As contagens por severidade aparecem
            uma única vez, no cartão «Achados abertos por severidade», e a listagem de achados por área
            deixou de as repetir num filtro. A ronda 6 confirmou, por inspeção do código e pela
            execução do harness, os achados que estavam «corrigido» e retirou-os do relatório — o
            que continua aberto fica nas áreas e o resto passa a viver no registo de arquivo
            («Validation archive»), que guarda cada correção e o que a confirmou. A ronda 7 executa a
            Fase 1 do plano de fecho pós-validação (PL1.0): a limitação de ritmo por ator passou a
            viver num único sítio (<code>base44/shared/rateLimit.ts</code>), aplicada às funções de
            escrita e aos dois caminhos que chamam IA — o mesmo ator recebe 429 quando passa o balde —
            e a fase fecha com o harness verde. As contagens do relatório aparecem agora uma só vez,
            no cartão «Achados abertos por severidade», e as contagens do harness vivem no cartão
            «Parecer de prontidão do Core», deixando de se repetir neste aviso. A página
            deve ser retirada quando a validação por identidade real estiver concluída.
          </p>
        </div>
      </div>

      <PageHeader
        title="Relatório de validação — Core NIS2"
        description="Achados por área: funcionalidades e fluxos, administração da plataforma, UX/UI, gestão comercial (oferta e preços, ciclo de vida da subscrição, utilização e quotas, inteligência comercial) e a validação de segurança (papéis, isolamento entre tenants, onboarding, delegações e licenciamento)."
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
          <div className="rounded-lg border border-status-warning/30 bg-status-warning/10 p-3 text-sm text-foreground">
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
            <Badge variant="outline" className="border-status-warning/30 bg-status-warning/10 text-status-warning">
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
                  <li key={b.text}>{[b.finding, b.text].filter(Boolean).join(' — ')}</li>
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
        archivedCount={archivedTotal}
      />

      <MaturityMatrix />

      <AreaNav areas={areas} />

      {/* As contagens do relatório aparecem uma só vez, no cartão
          `SeveritySummary`: o título da secção não as repete. */}
      <h2 className="text-base font-semibold text-foreground">Achados por área</h2>

      {openTotal === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Sem achados abertos"
          description="Nenhuma área tem achados abertos: os confirmados e corrigidos estão no registo de arquivo."
        />
      ) : (
        <div className="space-y-5">
          {areas.map((area) => (
            <AreaSection
              key={area.id}
              area={area}
              findings={area.findings}
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
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            <ListChecks className="h-4 w-4 text-muted-foreground" />
            Tarefas registadas (to-do)
            <Badge variant="secondary">
              {TODO_LIST.filter((todo) => todo.status !== 'concluido').length} em aberto · {TODO_LIST.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Trabalho combinado que não é achado de validação nem residual de uma correção — fica
            registado aqui para não se perder. O estado de cada tarefa é o seu <code>status</code>:
            uma tarefa entregue fica «Concluído», com a nota a dizer o que ficou feito.
          </p>
          {TODO_LIST.map((todo) => (
            <div key={todo.id} className="border-b pb-3 last:border-b-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                <span className="font-mono text-xs text-muted-foreground">{todo.id}</span>
                {todo.title}
                <Badge variant="outline" className={statusMeta(todo.status).classes}>
                  {statusMeta(todo.status).label}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{todo.note}</p>
              {todo.next && (
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Próximo passo: </span>
                  {todo.next}
                </p>
              )}
              {todo.source && <p className="font-mono text-xs text-muted-foreground">{todo.source}</p>}
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
