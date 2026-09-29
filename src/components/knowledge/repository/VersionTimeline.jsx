/**
 * Linha temporal das versões do documento oficial.
 *
 * Grupos: em vigor / substituídas / futuras / rascunhos — a classificação vem de
 * `buildTimeline`, não é decidida aqui. Cada linha leva o que o repositório
 * promete: ligação oficial, tipo, vigência e nota de alteração.
 */
import React from 'react';
import { ExternalLink, Link2Off } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { buildTimeline, formatLegalDate } from '@/lib/legalRepository';
import RepositoryFreshnessBadge from './RepositoryFreshnessBadge';

const GROUP_KEYS = [
  ['current', 'repo_group_current'],
  ['future', 'repo_group_future'],
  ['superseded', 'repo_group_superseded'],
  ['drafts', 'repo_group_drafts'],
];

function VersionRow({ version, frameworkCode }) {
  const { t, language } = useLanguage();
  const lang = language === 'en' ? 'en' : 'pt';
  const summary = lang === 'en' && version.summary_en ? version.summary_en : version.summary;

  return (
    <li className="kb-bg-surface kb-border-c border rounded-xl p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="kb-font-mono text-xs px-2 py-0.5 rounded kb-bg-hover">
          {version.version_label}
        </span>
        <span className="kb-text-muted text-[11px]">{t(`repo_type_${version.version_type}`)}</span>
        <span className="kb-text-muted text-[11px]">· {t(`repo_status_${version.status}`)}</span>
        {version.copyright_regime === 'metadata_only' && (
          <span className="kb-text-amber text-[11px]">· {t('repo_metadata_only_notice')}</span>
        )}
        <span className="ml-auto kb-font-mono text-[11px] kb-text-muted">
          {formatLegalDate(version.effective_from)} → {version.effective_to ? formatLegalDate(version.effective_to) : '—'}
        </span>
      </div>

      <p className="kb-card-title text-sm mt-2">{version.document_title}</p>
      {version.legal_reference && (
        <p className="kb-text-muted text-[11px]">{version.legal_reference}</p>
      )}

      {summary && (
        <div className="mt-2">
          <p className="kb-meta-label text-[10px] uppercase tracking-widest">{t('repo_version_own_summary')}</p>
          <p className="kb-text-light text-xs leading-relaxed">{summary}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[11px]">
        {version.official_url ? (
          <a
            href={version.official_url}
            target="_blank"
            rel="noreferrer"
            className="kb-text-accent hover:underline inline-flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" />
            {t('repo_version_official')}
          </a>
        ) : (
          <span className="kb-text-amber inline-flex items-center gap-1">
            <Link2Off className="w-3 h-3" />
            {t('repo_version_no_link')}
          </span>
        )}
        {version.official_source && (
          <span className="kb-text-muted">{t('repo_version_source')}: {version.official_source}</span>
        )}
        {version.issuing_authority && <span className="kb-text-muted">{version.issuing_authority}</span>}
        {version.language && <span className="kb-text-muted">{t('repo_version_language')}: {version.language}</span>}
        {version.content_hash && (
          <span className="kb-font-mono kb-text-muted" title={version.content_hash}>
            {t('repo_version_hash')}: {String(version.content_hash).slice(0, 12)}…
          </span>
        )}
      </div>

      {version.change_note && (
        <p className="kb-text-muted text-[11px] mt-2">
          <span className="kb-meta-label uppercase tracking-widest">{t('repo_version_change')}: </span>
          {version.change_note}
        </p>
      )}
      {version.withdrawn_reason && (
        <p className="kb-text-amber text-[11px] mt-1">
          {t('repo_version_withdraw_reason')}: {version.withdrawn_reason}
        </p>
      )}

      <RepositoryFreshnessBadge record={version} className="mt-2" />
    </li>
  );
}

export default function VersionTimeline({ versions = [], frameworkCode }) {
  const { t } = useLanguage();
  const groups = buildTimeline(versions);

  if (!versions.length) {
    return <p className="kb-text-muted text-sm">{t('repo_no_versions')}</p>;
  }

  return (
    <div className="space-y-5">
      <p className="kb-text-muted text-xs">{t('repo_timeline_hint')}</p>
      {GROUP_KEYS.map(([key, labelKey]) => {
        const rows = groups[key] || [];
        if (!rows.length) return null;
        return (
          <div key={key}>
            <h3 className="kb-meta-label text-[11px] uppercase tracking-widest mb-2">
              {t(labelKey)} · {rows.length}
            </h3>
            <ul className="space-y-2">
              {rows.map(version => (
                <VersionRow key={version.id} version={version} frameworkCode={frameworkCode} />
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
