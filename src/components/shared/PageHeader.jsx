import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Cabeçalho de página: descrição e ações alinhadas à direita.
 *
 * O título da página tem uma única fonte visível — a barra de contexto (TopBar),
 * que o deriva de `PAGE_TITLE_KEYS`. Este componente não repete o título da
 * página (FC1).
 *
 * `title` existe apenas para o seu uso dentro de uma secção ou aba (ex.: abas da
 * Formação), onde dá contexto local; é renderizado como título de secção (h2),
 * nunca como título da página (h1).
 *
 * Props:
 *  - title: string (opcional, título de secção — h2)
 *  - description: string (opcional, muted)
 *  - actions: ReactNode (opcional, alinhado à direita)
 *  - className: string (opcional)
 */
export default function PageHeader({ title, description, actions, className }) {
  if (!title && !description && !actions) return null;

  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between', className)}>
      {title ? (
        <div className="space-y-1">
          <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      ) : description ? (
        <p className="text-sm text-muted-foreground">{description}</p>
      ) : null}
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  );
}