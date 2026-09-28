import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * Indicador sóbrio da nota de maturidade 0–5 de uma área: nota + rótulo do nível,
 * com a cor da faixa vinda dos tokens do design system. A justificação completa
 * vive no `title` (a matriz de maturidade mostra-a sempre à vista, ao lado da nota).
 */
const BAND_CLASSES = [
  'bg-status-danger/10 text-status-danger border-status-danger/20',
  'bg-status-danger/10 text-status-danger border-status-danger/20',
  'bg-status-warning/10 text-status-warning border-status-warning/20',
  'bg-chart-3/10 text-chart-3 border-chart-3/20',
  'bg-status-info/10 text-status-info border-status-info/20',
  'bg-status-success/10 text-status-success border-status-success/20',
];

export default function MaturityBadge({ maturity, className }) {
  if (!maturity) return null;

  return (
    <Badge
      variant="outline"
      className={cn('gap-1.5 text-xs', BAND_CLASSES[maturity.level], className)}
      title={`${maturity.level}/5 · ${maturity.label} — ${maturity.description} ${maturity.rationale}`}
    >
      <span className="font-mono font-semibold">{maturity.level}/5</span>
      <span>{maturity.label}</span>
    </Badge>
  );
}
