/**
 * Grelha do repositório legal — um cartão por framework do catálogo único.
 *
 * O cartão responde ao que o repositório tem de responder de relance: nome,
 * entidade competente, versão em vigor, data da última verificação e aviso
 * quando a revisão está vencida. Todos esses valores vêm do modelo
 * (`buildRepositoryCards`), não são calculados aqui.
 */
import React from 'react';
import { ArrowRight, Landmark } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { formatLegalDate } from '@/lib/legalRepository';
import { frameworkColor, frameworkTintColor } from '@/lib/palette';
import RepositoryFreshnessBadge from './RepositoryFreshnessBadge';
import { cn } from '@/lib/utils';

export default function FrameworkGrid({ cards = [], onOpen, className }) {
  const { t } = useLanguage();

  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4', className)}>
      {cards.map(card => {
        const colour = frameworkColor(card.code);
        const tint = frameworkTintColor(card.code);
        const authorityNames = card.authorities.map(a => a.name).join(' · ');

        return (
          <button
            key={card.code}
            onClick={() => onOpen(card.code)}
            className="kb-card-hover kb-bg-surface kb-border-c border rounded-xl p-4 text-left cursor-pointer flex flex-col gap-3"
          >
            <div className="flex items-start gap-3">
              <span
                className="px-2 py-0.5 rounded-md text-[11px] font-semibold flex-shrink-0"
                style={{ backgroundColor: tint, color: colour }}
              >
                {card.acronym}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="kb-card-title text-sm">{card.name}</h3>
                <p className="kb-text-muted text-[11px] mt-0.5 line-clamp-1">
                  {card.catalogueEntry.full_name.pt}
                </p>
              </div>
            </div>

            <dl className="space-y-1.5 text-xs">
              <div className="flex items-start gap-2">
                <dt className="kb-text-muted flex items-center gap-1 flex-shrink-0">
                  <Landmark className="w-3 h-3" />
                  {t('repo_card_authority')}
                </dt>
                <dd className="kb-text-light text-right ml-auto line-clamp-1">
                  {authorityNames || '—'}
                </dd>
              </div>
              <div className="flex items-start gap-2">
                <dt className="kb-text-muted flex-shrink-0">{t('repo_card_version')}</dt>
                <dd className="text-right ml-auto kb-font-mono text-[11px]">
                  {card.version ? (
                    <span style={{ color: colour }}>{card.version.version_label}</span>
                  ) : (
                    <span className="kb-text-muted">{t('repo_card_no_version')}</span>
                  )}
                </dd>
              </div>
              {card.version?.effective_from && (
                <div className="flex items-start gap-2">
                  <dt className="kb-text-muted flex-shrink-0">{t('repo_card_since')}</dt>
                  <dd className="text-right ml-auto kb-font-mono text-[11px]">
                    {formatLegalDate(card.version.effective_from)}
                  </dd>
                </div>
              )}
            </dl>

            <div className="mt-auto space-y-2">
              <RepositoryFreshnessBadge record={card.version} />
              <div className="flex items-center justify-between text-[11px] kb-text-muted">
                <span>
                  {t('repo_card_versions_count', { count: card.versions.length })}
                </span>
                <span className="inline-flex items-center gap-1 kb-text-accent">
                  {t('repo_card_open')}
                  <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
