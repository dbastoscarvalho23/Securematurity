import React, { useState } from 'react';
import { ChevronDown, Lightbulb } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * Subsecção «Optimizações possíveis» de uma área do relatório de validação.
 *
 * Lê as oportunidades já normalizadas pelo modelo (`validationReportModel.js`):
 * cada uma traz a categoria, o impacto, o esforço e a faixa (quick win / projeto /
 * candidato) resolvidos por `optimizationBand()`. Este componente não classifica
 * nada nem escreve etiquetas, listas ou contagens — só desenha o que o modelo
 * devolve. Só leitura.
 *
 * Uma área sem oportunidades não desenha a subsecção.
 */
export default function AreaOptimizations({ optimizations }) {
  const [open, setOpen] = useState(true);

  if (!optimizations || optimizations.length === 0) return null;

  return (
    <div className="rounded-lg border bg-muted/30">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 p-3 text-left"
      >
        <Lightbulb className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="text-sm font-semibold text-foreground">Optimizações possíveis</span>
        <Badge variant="secondary" className="font-normal">{optimizations.length}</Badge>
        <ChevronDown
          className={cn(
            'ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180'
          )}
        />
      </button>

      {open && (
        <div className="space-y-3 border-t p-3">
          {optimizations.map((item) => (
            <div key={item.id} className="space-y-1.5 border-b pb-3 last:border-b-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">{item.id}</span>
                <span className="text-sm font-medium text-foreground">{item.title}</span>
                <Badge variant="outline" className={cn('shrink-0 text-xs', item.band.classes)}>
                  {item.band.label}
                </Badge>
                <Badge variant="outline" className={cn('shrink-0 text-xs', item.impactMeta.classes)}>
                  {item.impactMeta.label}
                </Badge>
                <Badge variant="outline" className={cn('shrink-0 text-xs', item.effortMeta.classes)}>
                  {item.effortMeta.label}
                </Badge>
                {item.ref && (
                  <Badge variant="outline" className="shrink-0 font-mono text-xs">{item.ref}</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{item.opportunity}</p>
              <p className="text-xs text-muted-foreground">
                {item.categoryMeta.label}
                {item.ref ? ' · passo seguinte de trabalho já registado (referência ao lado)' : ''}
              </p>
              <ul className="list-disc space-y-0.5 pl-4">
                {item.evidence.map((line) => (
                  <li key={line} className="font-mono text-xs leading-relaxed text-muted-foreground">
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
