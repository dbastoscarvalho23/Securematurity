import React from 'react';
import { ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { issueStatus, severityMeta, statusMeta } from '@/lib/validationReportData';

function Field({ label, children }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

/**
 * Cartão colapsável de um problema do relatório de validação.
 * Só leitura: identificador, severidade, estado da correção, persona/fluxo,
 * localização, impacto, reprodução, correção recomendada e teste de regressão.
 */
export default function ValidationIssueCard({ issue, open, onToggle }) {
  const sev = severityMeta(issue.severity);
  const st = statusMeta(issue.id);
  const { note } = issueStatus(issue.id);

  return (
    <Card>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-start gap-3 p-4 text-left"
      >
        <Badge variant="outline" className={cn('font-mono', sev.classes)}>
          {issue.id}
        </Badge>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-semibold text-foreground">{issue.title}</p>
          <p className="text-xs text-muted-foreground">
            {issue.persona} · {issue.flow}
          </p>
        </div>
        <Badge variant="outline" className={cn('shrink-0', st.classes)}>
          {st.label}
        </Badge>
        <Badge variant="outline" className={cn('shrink-0', sev.classes)}>
          {sev.label}
        </Badge>
        <ChevronDown
          className={cn('mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <CardContent className="space-y-4 border-t pt-4">
          <Field label="Estado da correção">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={cn('shrink-0', st.classes)}>
                {st.label}
              </Badge>
              {note && <span className="text-sm text-muted-foreground">{note}</span>}
            </div>
          </Field>
          <Field label="Localização no código">
            <ul className="list-disc space-y-1 pl-4">
              {issue.location.map((line) => (
                <li key={line} className="font-mono text-xs leading-relaxed">{line}</li>
              ))}
            </ul>
          </Field>
          <Field label="Impacto">{issue.impact}</Field>
          <Field label="Passos de reprodução">{issue.reproduction}</Field>
          <Field label="Correção recomendada">{issue.fix}</Field>
          <Field label="Teste de regressão">{issue.regression}</Field>
        </CardContent>
      )}
    </Card>
  );
}
