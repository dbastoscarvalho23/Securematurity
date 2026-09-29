import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { Button } from '@/components/ui/button';

/**
 * Rodapé de uma lista cortada (OP-F4): diz quantas linhas estão à vista do
 * total e dá o «ver mais» / «ver menos». Sem isto, uma lista cortada não dizia
 * a quem lê se estava a ver tudo ou só as primeiras linhas.
 *
 * Só aparece quando há algo escondido — ou quando a lista está expandida, para
 * se poder voltar a fechar.
 */
export default function ListMoreToggle({ shown, total, expanded, onToggle }) {
  const { t } = useLanguage();
  if (!expanded && total <= shown) return null;

  return (
    <div className="flex items-center justify-between gap-2 pt-2 text-xs text-muted-foreground">
      <span>{t('list_showing_of').replace('{shown}', String(shown)).replace('{total}', String(total))}</span>
      <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={onToggle}>
        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        {expanded ? t('list_show_less') : t('list_show_all')}
      </Button>
    </div>
  );
}
