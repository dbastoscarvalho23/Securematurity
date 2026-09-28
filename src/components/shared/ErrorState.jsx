import React from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/lib/LanguageContext';
import { cn } from '@/lib/utils';

/**
 * Estado de erro único da aplicação (FA4).
 *
 * Distingue explicitamente «falhou a carregar» de «não há dados»: as listas
 * passam a mostrar este painel com uma ação de repetição (`refetch`) em vez de
 * caírem no EmptyState, e a fronteira de erro do layout usa-o como fallback da
 * página, para que uma exceção de renderização mantenha navegação e cabeçalho.
 *
 * Props:
 *  - title / description: texto próprio; por omissão, o estado de página.
 *  - onRetry / retryLabel: ação de repetição (omitida se não houver).
 *  - variant: 'page' (centrado, com ícone grande) | 'inline' (dentro de um cartão/lista).
 */
export default function ErrorState({
  title,
  description,
  onRetry,
  retryLabel,
  variant = 'page',
  className,
}) {
  const { t } = useLanguage();
  const isInline = variant === 'inline';

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center gap-3',
        isInline ? 'py-12 px-4' : 'py-16 px-6',
        className,
      )}
      role="alert"
    >
      <div className={cn('rounded-full bg-destructive/10 text-destructive flex items-center justify-center', isInline ? 'w-10 h-10' : 'w-12 h-12')}>
        <AlertTriangle className={isInline ? 'w-5 h-5' : 'w-6 h-6'} />
      </div>
      <div className="space-y-1 max-w-md">
        <p className="font-medium text-foreground">{title || t('error_data_title')}</p>
        <p className="text-sm text-muted-foreground">{description || t('error_data_desc')}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" className="gap-2" onClick={onRetry}>
          <RotateCw className="w-3.5 h-3.5" />
          {retryLabel || t('error_retry')}
        </Button>
      )}
    </div>
  );
}
