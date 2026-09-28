import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Estado de carregamento único da aplicação (FC5).
 *
 * `variant="skeleton"` reserva o espaço da lista com linhas pulsantes — é o
 * indicador das listas e tabelas, para que a página não salte quando os dados
 * chegam. `variant="spinner"` (por omissão) serve os carregamentos pontuais
 * dentro de um cartão ou de um diálogo.
 *
 * Props:
 *  - label: string (opcional; no esqueleto fica só para leitores de ecrã)
 *  - className: string
 *  - fullHeight: boolean (opcional, centra no espaço disponível)
 *  - variant: 'spinner' | 'skeleton'
 *  - rows: número de linhas do esqueleto
 */
export default function LoadingState({
  label,
  className,
  fullHeight = false,
  variant = 'spinner',
  rows = 4,
}) {
  if (variant === 'skeleton') {
    return (
      <div className={cn('space-y-2 py-2', className)} role="status" aria-busy="true">
        {label && <span className="sr-only">{label}</span>}
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className={cn(
      'flex items-center justify-center gap-2 text-sm text-muted-foreground',
      fullHeight && 'h-full min-h-[200px]',
      className
    )}>
      <Loader2 className="w-4 h-4 animate-spin" />
      {label && <span>{label}</span>}
    </div>
  );
}
