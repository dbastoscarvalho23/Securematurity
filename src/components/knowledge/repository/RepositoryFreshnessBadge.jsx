/**
 * Frescura de uma ficha ou versão do repositório legal (Layer 1).
 *
 * O estado é derivado — `verified_at` e `review_due_at` são os dados —, nunca
 * escrito à mão: verificar uma versão muda a insígnia no mesmo instante.
 */
import React from 'react';
import { ShieldCheck, Clock, CircleAlert } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { freshnessOf, formatVerifiedAt } from '@/lib/legalRepository';
import { cn } from '@/lib/utils';

const STATE_STYLES = {
  fresh: { className: 'kb-text-emerald', Icon: ShieldCheck, labelKey: 'repo_fresh_fresh' },
  due: { className: 'kb-text-amber', Icon: Clock, labelKey: 'repo_fresh_due' },
  unverified: { className: 'kb-text-muted', Icon: CircleAlert, labelKey: 'repo_fresh_unverified' },
};

export default function RepositoryFreshnessBadge({ record, showDate = true, className }) {
  const { t } = useLanguage();
  const state = freshnessOf(record);
  const meta = STATE_STYLES[state];
  const { Icon } = meta;

  return (
    <div className={cn('flex flex-wrap items-center gap-x-2 gap-y-1 text-xs', className)}>
      <span className={cn('inline-flex items-center gap-1 font-medium', meta.className)}>
        <Icon className="w-3.5 h-3.5" />
        {t(meta.labelKey)}
      </span>
      {showDate && record?.verified_at && (
        <span className="kb-text-muted">
          {t('repo_verified_line', { date: formatVerifiedAt(record.verified_at) })}
        </span>
      )}
      {record?.review_due_at ? (
        <span className={state === 'due' ? 'kb-text-amber' : 'kb-text-muted'}>
          {t('repo_review_due_line', { date: formatVerifiedAt(record.review_due_at) })}
        </span>
      ) : (
        <span className="kb-text-muted">{t('repo_review_not_scheduled')}</span>
      )}
      {record?.verification_method && (
        <span className="kb-text-muted">· {t(`repo_method_${record.verification_method}`)}</span>
      )}
    </div>
  );
}
