/**
 * Ficha de framework do repositório legal (Layer 1 da base de conhecimento).
 *
 * Rota `/knowledge-base/framework/:code`. Não calcula nada por si: a ficha, a
 * linha temporal, a frescura e as entidades competentes vêm do modelo
 * (`src/lib/legalRepository.js`), e os blocos são os componentes do repositório.
 * O modo de edição só aparece a quem escreve (`master_admin`) ou verifica
 * (equipa de conteúdo) e escreve exclusivamente por `manageLegalRepository`.
 *
 * O título da página vem do TopBar (`page_framework_profile`), pelo que aqui não
 * há `h1`: o nome do framework é um `h2` de conteúdo.
 */
import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Landmark, Pencil, X } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { useEffectiveRole } from '@/lib/RoleSimulationContext';
import { hasRole, isPlatformOwner } from '@/lib/rbac';
import {
  authoritiesFor,
  catalogueEntryFor,
  displayNameFor,
  primaryVersion,
  profileFor,
  useLegalRepository,
  versionsFor,
} from '@/lib/legalRepository';
import { frameworkColor, frameworkTintColor } from '@/lib/palette';
import FrameworkSummary from '@/components/knowledge/repository/FrameworkSummary';
import FrameworkEditor from '@/components/knowledge/repository/FrameworkEditor';
import VersionTimeline from '@/components/knowledge/repository/VersionTimeline';
import AuthorityPanel from '@/components/knowledge/repository/AuthorityPanel';
import RelatedContent from '@/components/knowledge/repository/RelatedContent';
import RepositoryFreshnessBadge from '@/components/knowledge/repository/RepositoryFreshnessBadge';
import { Button } from '@/components/ui/button';

function Section({ title, children }) {
  return (
    <section className="kb-bg-surface kb-border-c border rounded-xl p-4">
      <h3 className="kb-meta-label text-[11px] uppercase tracking-widest mb-3">{title}</h3>
      {children}
    </section>
  );
}

export default function FrameworkProfile() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const lang = language === 'en' ? 'en' : 'pt';
  const role = useEffectiveRole();
  const [editing, setEditing] = useState(false);

  const entry = catalogueEntryFor(code);
  const { profiles, versions, authorities, isLoading, isError } = useLegalRepository();

  const profile = profileFor(profiles, code);
  const frameworkVersions = versionsFor(versions, code);
  const current = primaryVersion(frameworkVersions);
  const authorityCodes = profile?.competent_authority_codes?.length
    ? profile.competent_authority_codes
    : entry?.authority_codes;
  const frameworkAuthorities = authoritiesFor(authorities, authorityCodes);

  const canManage = isPlatformOwner(role);
  const canVerify = hasRole(role, 'master_admin', 'grc_analyst');

  const back = (
    <button
      onClick={() => navigate('/knowledge-base')}
      className="kb-text-muted hover:kb-text-light flex items-center gap-2 text-sm mb-6 transition-colors"
    >
      <ArrowLeft className="w-4 h-4" />
      {t('repo_back')}
    </button>
  );

  if (!entry) {
    return (
      <div className="kb-scope kb-bg-canvas rounded-xl p-6 min-h-[60vh]">
        {back}
        <p className="kb-text-muted text-sm">{t('repo_not_found')}</p>
      </div>
    );
  }

  const colour = frameworkColor(entry.code);
  const tint = frameworkTintColor(entry.code);

  return (
    <div className="kb-scope kb-bg-canvas rounded-xl p-6 min-h-[60vh]">
      {back}

      <header className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span
              className="px-2 py-0.5 rounded-md text-[11px] font-semibold"
              style={{ backgroundColor: tint, color: colour }}
            >
              {profile?.acronym || entry.acronym}
            </span>
            <span className="kb-text-muted text-[11px] kb-font-mono">{entry.code}</span>
          </div>
          <h2 className="kb-title text-xl mb-1">{displayNameFor(profile, entry.code, lang)}</h2>
          <p className="kb-text-muted text-sm">{entry.full_name?.[lang] || entry.full_name?.pt}</p>
          {frameworkAuthorities.length > 0 && (
            <p className="kb-text-muted text-xs mt-2 flex items-center gap-1.5">
              <Landmark className="w-3 h-3" />
              {frameworkAuthorities.map(a => a.name).join(' · ')}
            </p>
          )}
          <RepositoryFreshnessBadge record={current} className="mt-2" />
        </div>

        {(canManage || canVerify) && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => setEditing(value => !value)}
          >
            {editing ? <X className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
            {editing ? t('repo_cancel') : t('repo_manage')}
          </Button>
        )}
      </header>

      {editing ? (
        <section className="kb-bg-surface kb-border-c border rounded-xl p-4">
          <p className="kb-text-muted text-xs mb-3">{t('repo_manage_hint')}</p>
          <FrameworkEditor
            framework={entry}
            profile={profile}
            versions={frameworkVersions}
            canManage={canManage}
            canVerify={canVerify}
          />
        </section>
      ) : isLoading ? (
        <p className="kb-text-muted text-sm">{t('repo_loading')}</p>
      ) : isError ? (
        <p className="kb-text-muted text-sm">{t('repo_profile_missing')}</p>
      ) : (
        <div className="space-y-4">
          <Section title={t('repo_summary')}>
            {profile ? (
              <FrameworkSummary profile={profile} />
            ) : (
              <p className="kb-text-muted text-sm">{t('repo_profile_missing')}</p>
            )}
          </Section>

          <Section title={t('repo_timeline')}>
            <VersionTimeline versions={frameworkVersions} frameworkCode={entry.code} />
          </Section>

          <Section title={t('repo_authority_title')}>
            <AuthorityPanel authorities={frameworkAuthorities} />
          </Section>

          <Section title={t('repo_related')}>
            <RelatedContent frameworkCode={entry.code} versions={frameworkVersions} />
          </Section>
        </div>
      )}
    </div>
  );
}
