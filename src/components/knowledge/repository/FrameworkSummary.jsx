/**
 * «Em resumo» — a ficha caracterizadora do framework em leitura rápida.
 *
 * Renderiza o que está gravado em `FrameworkProfile` (bilingue PT/EN) e não
 * deriva nada por si: acrescentar um campo à ficha é acrescentar uma linha aqui
 * e um campo na entidade, nunca texto na página.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/lib/LanguageContext';
import { frameworkColor, frameworkTintColor } from '@/lib/palette';
import { FRAMEWORK_BY_CODE, frameworkName } from '@/lib/frameworkCatalogue';

/** Valor bilingue do campo `base` (`base` em PT, `base_en` em inglês). */
function bilingual(profile, base, lang) {
  if (!profile) return null;
  if (lang === 'en' && profile[`${base}_en`]) return profile[`${base}_en`];
  return profile[base] || profile[`${base}_en`] || null;
}

function Block({ title, children }) {
  if (!children) return null;
  return (
    <div>
      <h3 className="kb-meta-label text-[11px] uppercase tracking-widest mb-1.5">{title}</h3>
      {children}
    </div>
  );
}

function Bullets({ items }) {
  if (!items?.length) return null;
  return (
    <ul className="space-y-1">
      {items.map(item => (
        <li key={item} className="kb-text-light text-sm flex gap-2">
          <span className="kb-text-muted">·</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function FrameworkSummary({ profile }) {
  const { t, language } = useLanguage();
  const lang = language === 'en' ? 'en' : 'pt';
  if (!profile) return null;

  const obligations = profile.obligations || [];
  const related = profile.related_frameworks || [];
  const references = profile.references || [];

  return (
    <div className="space-y-5">
      <Block title={t('repo_mission')}>
        <p className="kb-text-light text-sm leading-relaxed">{bilingual(profile, 'mission', lang)}</p>
      </Block>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Block title={t('repo_scope')}>
          <Bullets items={bilingual(profile, 'scope_areas', lang)} />
        </Block>
        <Block title={t('repo_objectives')}>
          <Bullets items={bilingual(profile, 'objectives', lang)} />
        </Block>
      </div>

      <Block title={t('repo_applicability')}>
        <p className="kb-text-light text-sm leading-relaxed">{bilingual(profile, 'applicability', lang)}</p>
      </Block>

      <Block title={t('repo_obligations')}>
        <ul className="space-y-1.5">
          {obligations.map((obligation, index) => (
            <li
              key={`${obligation.label_pt}-${index}`}
              className="kb-bg-surface kb-border-c border rounded-lg px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-1"
            >
              <span className="kb-text-light text-sm flex-1 min-w-[12rem]">
                {lang === 'en' && obligation.label_en ? obligation.label_en : obligation.label_pt}
              </span>
              <span className="kb-font-mono text-[11px] kb-text-accent">
                {obligation.deadline || t('repo_no_deadline')}
              </span>
            </li>
          ))}
        </ul>
      </Block>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Block title={t('repo_penalties')}>
          <p className="kb-text-light text-sm leading-relaxed">{bilingual(profile, 'penalties', lang)}</p>
        </Block>
        <Block title={t('repo_certifiability')}>
          <p className="kb-text-light text-sm leading-relaxed">{bilingual(profile, 'certifiability', lang)}</p>
        </Block>
      </div>

      <Block title={t('repo_related_frameworks')}>
        <div className="flex flex-wrap gap-2">
          {related.map(code => (
            <Link
              key={code}
              to={`/knowledge-base/framework/${code}`}
              className="px-2 py-0.5 rounded-md text-[11px] font-medium kb-border-c border"
              style={{ backgroundColor: frameworkTintColor(code), color: frameworkColor(code) }}
            >
              {FRAMEWORK_BY_CODE[code] ? frameworkName(code, lang) : code}
            </Link>
          ))}
        </div>
      </Block>

      {references.length > 0 && (
        <Block title={t('repo_references')}>
          <ul className="space-y-1">
            {references.map(reference => (
              <li key={reference.url || reference.label} className="text-sm">
                {reference.url ? (
                  <a
                    href={reference.url}
                    target="_blank"
                    rel="noreferrer"
                    className="kb-text-accent hover:underline"
                  >
                    {reference.label}
                  </a>
                ) : (
                  <span className="kb-text-light">{reference.label}</span>
                )}
              </li>
            ))}
          </ul>
        </Block>
      )}

      {profile.copyright_notice && (
        <Block title={t('repo_copyright_notice')}>
          <p className="kb-text-muted text-xs leading-relaxed">{profile.copyright_notice}</p>
        </Block>
      )}
    </div>
  );
}
