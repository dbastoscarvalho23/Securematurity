import React from 'react';
import { Badge } from '@/components/ui/badge';
import { rgba } from '@/lib/docsModel';

/**
 * Navegação por área do relatório: cartão por área que salta para a secção
 * correspondente (`#area-<id>`). Mostra o total de achados e as severidades
 * que exigem decisão (crítica e alta), a partir das contagens do modelo.
 */
export default function AreaNav({ areas }) {
  const jump = (id) => {
    document.getElementById(`area-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const attention = (area) =>
    (area.severityCounts.critica || 0) + (area.severityCounts.alta || 0);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {areas.map((area) => {
        const urgent = attention(area);
        return (
          <button
            key={area.id}
            type="button"
            onClick={() => jump(area.id)}
            className="rounded-xl border p-3 text-left transition-colors hover:bg-muted/50"
            style={{ borderColor: rgba(area.accent, 0.35), backgroundColor: rgba(area.accent, 0.04) }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold" style={{ color: rgba(area.accent) }}>
                {area.label}
              </span>
              <Badge variant="outline" className="text-xs">
                {area.findings.length}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {urgent > 0 ? `${urgent} crítica(s)/alta(s)` : 'Sem achados críticos'}
            </p>
          </button>
        );
      })}
    </div>
  );
}
