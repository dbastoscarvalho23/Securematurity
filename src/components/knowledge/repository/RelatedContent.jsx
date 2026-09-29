/**
 * Conteúdo relacionado com um framework (Layer 1 → layers 2 e 4).
 *
 * Artigos editoriais que apontam para uma versão do framework (por código ou
 * por `legal_refs`) e controlos da camada de avaliação que lhe pertencem. O que
 * liga as camadas é a versão concreta, não uma menção solta na prosa.
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { BookOpen, ListChecks } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';

/** Artigos que citam a versão, por código de framework ou por `legal_refs`. */
export function articleReferencesVersion(article, frameworkCode) {
  if (!article) return false;
  if (article.framework === frameworkCode) return true;
  return (article.legal_refs || []).some(ref => ref?.framework_code === frameworkCode);
}

export default function RelatedContent({ frameworkCode, versions = [] }) {
  const { t } = useLanguage();

  const articles = useQuery({
    queryKey: ['knowledge-articles'],
    queryFn: () => base44.entities.KnowledgeArticle.list('order_index', 500),
  });
  const controls = useQuery({
    queryKey: ['framework-controls', frameworkCode],
    queryFn: () => base44.entities.FrameworkControl.list('control_id', 500),
  });

  const relatedArticles = (articles.data || []).filter(
    article => article.status === 'published' && article.is_active !== false && articleReferencesVersion(article, frameworkCode),
  );
  const relatedControls = (controls.data || []).filter(control => control.framework_code === frameworkCode);
  const versionLabelById = Object.fromEntries(versions.map(v => [v.id, v.version_label]));

  return (
    <div className="space-y-5">
      <div>
        <h3 className="kb-meta-label text-[11px] uppercase tracking-widest mb-1 flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5" />
          {t('repo_related_articles')}
        </h3>
        <p className="kb-text-muted text-[11px] mb-2">{t('repo_related_articles_hint')}</p>
        {relatedArticles.length === 0 ? (
          <p className="kb-text-muted text-sm">{t('repo_related_none')}</p>
        ) : (
          <ul className="space-y-1.5">
            {relatedArticles.map(article => {
              const refs = (article.legal_refs || []).filter(ref => ref?.framework_code === frameworkCode);
              return (
                <li key={article.id} className="kb-bg-surface kb-border-c border rounded-lg px-3 py-2">
                  <Link
                    to={`/knowledge-base/${article.slug || article.id}`}
                    className="kb-card-title text-sm hover:underline"
                  >
                    {article.title}
                  </Link>
                  {refs.length > 0 && (
                    <span className="kb-font-mono text-[10px] kb-text-muted ml-2">
                      {refs.map(ref => ref.version_label || versionLabelById[ref.version_id] || ref.version_id).filter(Boolean).join(' · ')}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div>
        <h3 className="kb-meta-label text-[11px] uppercase tracking-widest mb-1 flex items-center gap-1.5">
          <ListChecks className="w-3.5 h-3.5" />
          {t('repo_related_controls')} · {relatedControls.length}
        </h3>
        <p className="kb-text-muted text-[11px] mb-2">{t('repo_related_controls_hint')}</p>
        {relatedControls.length === 0 ? (
          <p className="kb-text-muted text-sm">{t('repo_related_none')}</p>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
            {relatedControls.slice(0, 24).map(control => (
              <li key={control.id} className="kb-bg-surface kb-border-c border rounded-lg px-3 py-1.5">
                <span className="kb-font-mono text-[10px] kb-text-accent">{control.control_id}</span>
                <span className="kb-text-light text-xs ml-2">{control.title}</span>
                <span className="kb-text-muted text-[10px] block">{control.domain}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
