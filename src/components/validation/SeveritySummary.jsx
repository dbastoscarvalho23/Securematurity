import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { SEVERITIES, STATUSES } from '@/lib/validationReportModel';

/**
 * Sumário do relatório: contagem dos achados ABERTOS por severidade (cartões) e
 * o estado da recomendação de todos os achados (faixa de badges). As contagens
 * por severidade vêm do modelo (`openSeverityCounts()`); os achados já
 * corrigidos ficam fora delas e são referidos à parte, na faixa de estados.
 */
export default function SeveritySummary({ severityCounts, statusCounts, total, correctedCount = 0 }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          Achados abertos por severidade
          <span className="ml-2 text-sm font-normal text-muted-foreground">{total} no total</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {SEVERITIES.map((s) => (
            <div key={s.id} className={cn('rounded-lg border p-3', s.classes)}>
              <p className="text-2xl font-bold leading-none">{severityCounts[s.id] || 0}</p>
              <p className="mt-1 text-xs font-medium">{s.label}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {STATUSES.map((s) => (
            <Badge key={s.id} variant="outline" className={cn('text-sm', s.classes)}>
              {s.label}: {statusCounts[s.id] || 0}
            </Badge>
          ))}
        </div>
        {correctedCount > 0 && (
          <p className="text-xs text-muted-foreground">
            {correctedCount} achado(s) já corrigido(s) ficam fora das contagens por severidade —
            o estado de cada um está na faixa acima e o detalhe abre com «Mostrar corrigidos».
          </p>
        )}
      </CardContent>
    </Card>
  );
}
