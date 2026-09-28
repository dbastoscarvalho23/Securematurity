import React from 'react';
import { ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { severityMeta, statusMeta } from '@/lib/validationReportModel';

function Field({ label, children }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

/**
 * Cartão colapsável de um achado do relatório de validação.
 *
 * Lê o achado já normalizado pelo modelo (`validationReportModel.js`), pelo que
 * serve tanto os F1–F15 da ronda de segurança como os achados desta ronda de
 * avaliação funcional, de administração e de UX/UI. Só leitura.
 */
export default function FindingCard({ finding, open, onToggle }) {
  const sev = severityMeta(finding.severity);
  const st = statusMeta(finding.status);

  return (
    <Card>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-start gap-3 p-4 text-left"
      >
        <Badge variant="outline" className={cn('font-mono', sev.classes)}>
          {finding.id}
        </Badge>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-semibold text-foreground">{finding.title}</p>
          {(finding.persona || finding.flow) && (
            <p className="text-xs text-muted-foreground">
              {[finding.persona, finding.flow].filter(Boolean).join(' · ')}
            </p>
          )}
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
          <Field label="Estado">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={cn('shrink-0', st.classes)}>
                {st.label}
              </Badge>
              {finding.statusNote && <span className="text-sm text-muted-foreground">{finding.statusNote}</span>}
            </div>
          </Field>
          <Field label="Evidência no código">
            <ul className="list-disc space-y-1 pl-4">
              {finding.evidence.map((line) => (
                <li key={line} className="font-mono text-xs leading-relaxed">{line}</li>
              ))}
            </ul>
          </Field>
          <Field label="Impacto">{finding.impact}</Field>
          <Field label="Recomendação">{finding.recommendation}</Field>
          {finding.reproduction && <Field label="Passos de reprodução">{finding.reproduction}</Field>}
          {finding.check && <Field label="Verificação recomendada">{finding.check}</Field>}
        </CardContent>
      )}
    </Card>
  );
}
