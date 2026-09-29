/**
 * Entidade competente do framework — quem regula, supervisiona ou acredita, com
 * ligação ao sítio oficial e ao registo público de sanções.
 */
import React from 'react';
import { ExternalLink, Mail, Scale } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

export default function AuthorityPanel({ authorities = [] }) {
  const { t, language } = useLanguage();
  const lang = language === 'en' ? 'en' : 'pt';

  if (!authorities.length) {
    return <p className="kb-text-muted text-sm">{t('repo_authority_none')}</p>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {authorities.map(authority => (
        <div key={authority.code} className="kb-bg-surface kb-border-c border rounded-xl p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="kb-card-title text-sm">
              {lang === 'en' && authority.name_en ? authority.name_en : authority.name}
            </span>
            <span className="kb-text-muted text-[11px] kb-font-mono">{authority.code}</span>
            <span className="kb-text-muted text-[11px] ml-auto">
              {authority.country} · {t(`repo_authority_role_${authority.role}`)}
            </span>
          </div>

          {authority.legal_basis && (
            <p className="kb-text-muted text-[11px] mt-1 flex items-start gap-1">
              <Scale className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>
                {t('repo_authority_legal_basis')}:{' '}
                {lang === 'en' && authority.legal_basis_en ? authority.legal_basis_en : authority.legal_basis}
              </span>
            </p>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[11px]">
            {authority.website_url && (
              <a
                href={authority.website_url}
                target="_blank"
                rel="noreferrer"
                className="kb-text-accent hover:underline inline-flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" />
                {t('repo_authority_site')}
              </a>
            )}
            {authority.enforcement_register_url ? (
              <a
                href={authority.enforcement_register_url}
                target="_blank"
                rel="noreferrer"
                className="kb-text-accent hover:underline inline-flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" />
                {t('repo_authority_sanctions')}
              </a>
            ) : (
              <span className="kb-text-muted">{t('repo_authority_sanctions_none')}</span>
            )}
            {authority.contact && (
              <span className="kb-text-muted inline-flex items-center gap-1">
                <Mail className="w-3 h-3" />
                {authority.contact}
              </span>
            )}
          </div>

          {(lang === 'en' && authority.notes_en ? authority.notes_en : authority.notes) && (
            <p className="kb-text-muted text-[11px] mt-2 leading-relaxed">
              {lang === 'en' && authority.notes_en ? authority.notes_en : authority.notes}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
