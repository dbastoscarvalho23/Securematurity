import React from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { LAYERS } from '@/lib/devDocsData';

/**
 * Cascata das três camadas de controlo de acesso (RBAC → licenciamento → RLS),
 * da mais permissiva para a mais restritiva. A terceira é a fronteira de segurança.
 */

const LAYER_ACCENTS = [
  [37, 99, 235],   // RBAC — experiência
  [202, 138, 4],   // licenciamento — comercial
  [13, 148, 136],  // RLS — fronteira de segurança
];

export default function ControlCascade() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <span>Mais permissiva</span>
        <span>Fronteira de segurança</span>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {LAYERS.map((layer, index) => {
          const accent = LAYER_ACCENTS[index] || LAYER_ACCENTS[0];
          const rgb = `rgb(${accent.join(', ')})`;
          const soft = `rgba(${accent.join(', ')}, 0.08)`;
          const border = `rgba(${accent.join(', ')}, 0.28)`;
          const isLast = index === LAYERS.length - 1;

          return (
            <div key={layer.order} className="relative flex">
              <div className="flex-1 rounded-xl border p-4" style={{ backgroundColor: soft, borderColor: border }}>
                <div className="flex items-center gap-2">
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-lg font-mono text-xs font-bold text-white"
                    style={{ backgroundColor: rgb }}
                  >
                    {layer.order}
                  </span>
                  <p className="text-sm font-semibold" style={{ color: rgb }}>
                    {layer.title}
                  </p>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{layer.detail}</p>
                <p className="mt-2 break-words font-mono text-[11px] text-muted-foreground">{layer.location}</p>
                {isLast && (
                  <p className="mt-3 flex items-center gap-1.5 text-[11px] font-medium" style={{ color: rgb }}>
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Não contornável pelo cliente
                  </p>
                )}
              </div>
              {!isLast && (
                <ArrowRight className="absolute -right-3 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-muted-foreground lg:block" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
