import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { rgba } from '@/lib/docsModel';

/**
 * Secção numerada da documentação técnica: faixa de cor, ícone em chip,
 * número da secção e descrição. Mantém todas as secções com a mesma linguagem.
 *
 * @param {number[]} accent - triplo RGB da paleta de docsModel
 */
export default function DocsSection({ id, index, icon: Icon, accent, title, description, children }) {
  return (
    <Card id={id} className="scroll-mt-28 overflow-hidden">
      <div className="h-1" style={{ backgroundColor: rgba(accent) }} />
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border"
            style={{ backgroundColor: rgba(accent, 0.1), borderColor: rgba(accent, 0.25) }}
          >
            <Icon className="h-5 w-5" style={{ color: rgba(accent) }} />
          </div>
          <div className="min-w-0 space-y-0.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Secção {index}
            </p>
            <CardTitle className="text-lg leading-tight">{title}</CardTitle>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">{children}</CardContent>
    </Card>
  );
}
