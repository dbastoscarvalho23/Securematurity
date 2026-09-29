import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { SEVERITIES, STATUSES } from '@/lib/validationReportModel';

/**
 * Sumário do relatório: contagem dos achados ABERTOS por severidade (cartões) e
 * o estado da recomendação de todos os achados (faixa de badges). As contagens
 * por severidade vêm do modelo (`openSeverityCounts()`); os achados confirmados
 * e corrigidos saíram para o registo de arquivo e são referidos à parte, no fim
 * do cartão.
 */
export default function SeveritySummary({ severityCounts, statusCounts, total, archivedCount = 0 }) {
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
          {STATUSES.filter((s) => (statusCounts[s.id] || 0) > 0).map((s) => (
            <Badge key={s.id} variant="outline" className={cn('text-sm', s.classes)}>
              {s.label}: {statusCounts[s.id]}
            </Badge>
          ))}
        </div>
        {archivedCount > 0 && (
          <p className="text-xs text-muted-foreground">
            {archivedCount} achado(s) confirmado(s) e corrigido(s) saíram do relatório para o
            registo de arquivo (<code>src/lib/validationArchive.js</code>) — ficam fora das
            contagens por severidade e da listagem, com a correção e o que a confirmou.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
