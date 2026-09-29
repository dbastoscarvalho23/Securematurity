/**
 * KnowledgeBase — a base de conhecimento com dois modos, no tema escopo
 * `.kb-scope` (Plus Jakarta Sans nos títulos, Inter no corpo, JetBrains Mono no
 * código):
 *
 *  - **Repositório legal** (Layer 1, por omissão) — a grelha dos frameworks do
 *    catálogo único, lida de `FrameworkProfile` / `LegalDocumentVersion` /
 *    `CompetentAuthority` pelo modelo `src/lib/legalRepository.js`; cada cartão
 *    abre a ficha em `/knowledge-base/framework/:code`. Nada aqui escreve
 *    entidades: a carga inicial passa por `seedLegalRepository`, restrita à
 *    administração da plataforma.
 *  - **Artigos** (Layer 4) — o catálogo editorial persistido (`KnowledgeArticle`),
 *    com as abas Catálogo/Editorial; só os artigos publicados aparecem e a
 *    edição passa pelo fluxo editorial.
 */
import React, { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Search, BookOpen, ArrowLeft, Tag, Landmark, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { useEffectiveRole } from '@/lib/RoleSimulationContext';
import { can, isPlatformOwner } from '@/lib/rbac';
import { useKnowledgeArticles } from '@/lib/useKnowledgeArticles';
import { buildRepositoryCards, useLegalRepository } from '@/lib/legalRepository';
import { KB_FRAMEWORKS, getArticleFrameworkColor, getArticleFrameworkTint } from '@/lib/kbFrameworks';
import { FRAMEWORK_BY_CODE, frameworkName } from '@/lib/frameworkCatalogue';
import ArticleEditorialPanel from '@/components/knowledge/ArticleEditorialPanel';
import FrameworkGrid from '@/components/knowledge/repository/FrameworkGrid';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const SECTION_LABELS = {
  platform: 'Platform Guide',
  compliance: 'Compliance & Frameworks',
};

const CATEGORY_ICONS = {
  guide: BookOpen,
  article: BookOpen,
  faq: BookOpen,
};

/**
 * Corpo do artigo desenhado pelo `react-markdown` que a aplicação já traz (o
 * mesmo do chat), em vez do tratamento à mão de «# »/«- » que deixava títulos,
 * listas, ligações e ênfase como texto cru (OP-C6). O `react-markdown` v9 já
 * não aceita `className`, pelo que o estilo vive no elemento que o envolve —
 * o projeto não traz o plugin de tipografia, por isso os elementos são
 * estilizados por seletor descendente.
 */
const BODY_CLASSES =
  'text-sm leading-relaxed [&_h1]:mb-2 [&_h1]:text-base [&_h1]:font-semibold ' +
  '[&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mb-1.5 [&_h3]:font-semibold ' +
  '[&_p]:mb-2 [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 ' +
  '[&_li]:mb-1 [&_a]:text-primary [&_a]:underline [&_strong]:font-semibold [&_code]:font-mono [&_code]:text-xs';

function renderBody(body) {
  return (
    <div className={BODY_CLASSES}>
      <ReactMarkdown>{body || ''}</ReactMarkdown>
    </div>
  );
}

export default function KnowledgeBase() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const { slug } = useParams();
  const role = useEffectiveRole();
  const canEdit = can(role, 'edit', 'knowledge_base');

  const [mode, setMode] = useState('repository');
  const [tab, setTab] = useState('catalogue');
  const [search, setSearch] = useState('');
  const [activeSection, setActiveSection] = useState('all');
  const [activeFramework, setActiveFramework] = useState('all');

  const { articles, allArticles, isLoading } = useKnowledgeArticles({ includeUnpublished: canEdit });

  // ─── Repositório legal (Layer 1) ─────────────────────────────
  // A vista por omissão. Os cartões, a versão em vigor e a frescura vêm do
  // modelo — aqui só se filtra a pesquisa e se decide o que mostrar quando o
  // repositório ainda não foi carregado.
  const {
    profiles,
    versions,
    authorities,
    isLoading: isRepositoryLoading,
    isError: isRepositoryError,
    refetch: refetchRepository,
  } = useLegalRepository();

  const canLoadRepository = isPlatformOwner(role);

  const repositoryCards = useMemo(
    () => buildRepositoryCards({ profiles, versions, authorities }, language === 'en' ? 'en' : 'pt'),
    [profiles, versions, authorities, language],
  );

  const repositoryLoaded = profiles.length > 0 || versions.length > 0;

  const visibleCards = useMemo(() => {
    if (!search) return repositoryCards;
    const query = search.toLowerCase();
    return repositoryCards.filter((card) =>
      [
        card.name,
        card.acronym,
        card.code,
        card.catalogueEntry?.full_name?.pt,
        card.catalogueEntry?.full_name?.en,
        card.version?.version_label,
        card.version?.document_title,
      ]
        .concat(card.authorities.map((authority) => authority.name))
        .some((value) => (value || '').toLowerCase().includes(query)),
    );
  }, [repositoryCards, search]);

  const seedRepository = useMutation({
    mutationFn: () => base44.functions.invoke('seedLegalRepository', {}),
    onSuccess: async () => {
      toast.success(t('repo_seed_done'));
      await refetchRepository();
    },
    onError: (error) =>
      toast.error(error?.response?.data?.error || error?.data?.error || t('repo_seed_error')),
  });

  const filtered = useMemo(() => {
    return articles.filter(a => {
      if (activeSection !== 'all' && a.section !== activeSection) return false;
      if (activeFramework !== 'all' && a.framework !== activeFramework) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          (a.title || '').toLowerCase().includes(q) ||
          (a.summary || '').toLowerCase().includes(q) ||
          (a.tags || []).some(tag => (tag || '').toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [articles, search, activeSection, activeFramework]);

  const grouped = useMemo(() => {
    const sections = {};
    filtered.forEach(a => {
      if (!sections[a.section]) sections[a.section] = [];
      sections[a.section].push(a);
    });
    return sections;
  }, [filtered]);

  const selectedArticle = slug
    ? allArticles.find(a => a.slug === slug || a.id === slug)
    : null;

  // ─── Article detail ─────────────────────────────────────────
  if (slug) {
    if (isLoading) {
      return <div className="kb-scope kb-bg-canvas rounded-xl p-6 min-h-[60vh]">{t('kb_loading')}</div>;
    }
    if (!selectedArticle) {
      return (
        <div className="kb-scope kb-bg-canvas rounded-xl p-6 min-h-[60vh]">
          <button
            onClick={() => navigate('/knowledge-base')}
            className="kb-text-muted hover:kb-text-light flex items-center gap-2 text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('kb_back_to_articles')}
          </button>
          <p className="kb-text-muted text-sm mt-6">{t('kb_no_results')}</p>
        </div>
      );
    }

    const fw = selectedArticle.framework ? KB_FRAMEWORKS[selectedArticle.framework] : null;
    return (
      <div className="kb-scope kb-bg-canvas rounded-xl p-6 min-h-[60vh]">
        <button
          onClick={() => navigate('/knowledge-base')}
          className="kb-text-muted hover:kb-text-light flex items-center gap-2 text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('kb_back_to_articles')}
        </button>

        <div className="max-w-3xl">
          <div className="flex items-center gap-2 mb-3">
            {fw && (
              <span
                className="px-2 py-0.5 rounded-md text-xs font-medium"
                style={{ backgroundColor: getArticleFrameworkTint(selectedArticle), color: getArticleFrameworkColor(selectedArticle) }}
              >
                {fw.name}
              </span>
            )}
            <span className="kb-text-muted text-xs capitalize">{selectedArticle.category}</span>
          </div>

          <h1 className="kb-title text-2xl mb-3">{selectedArticle.title}</h1>
          <p className="kb-text-muted text-base mb-6">{selectedArticle.summary}</p>

          <div className="kb-prose">
            {selectedArticle.body
              ? renderBody(selectedArticle.body)
              : <p>{t('kb_article_detail_desc')}</p>}
            <h2>{t('kb_tags')}</h2>
            <div className="flex flex-wrap gap-2 mt-2">
              {(selectedArticle.tags || []).map(tag => (
                <span key={tag} className="kb-font-mono text-xs px-2 py-1 rounded kb-bg-surface kb-border-c border">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Seletor de modo e caixa de pesquisa (comuns) ───────────
  const modeTabs = (
    <div className="flex items-center gap-1 kb-bg-surface kb-border-c border rounded-lg p-1">
      {['repository', 'articles'].map(key => (
        <button
          key={key}
          onClick={() => setMode(key)}
          className={cn(
            'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
            mode === key ? 'kb-bg-accent text-white' : 'kb-text-muted hover:kb-text-light',
          )}
        >
          {t(key === 'repository' ? 'repo_mode_repository' : 'repo_mode_articles')}
        </button>
      ))}
    </div>
  );

  const searchBox = (placeholder) => (
    <div className="relative mb-4">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 kb-text-muted" />
      <Input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder={placeholder}
        className="kb-input pl-10"
      />
    </div>
  );

  // ─── Repositório legal (Layer 1) ────────────────────────────
  const repositoryView = (
    <>
      {searchBox(t('repo_search_placeholder'))}

      {isRepositoryLoading ? (
        <div className="py-16 text-center kb-text-muted text-sm">{t('repo_loading')}</div>
      ) : isRepositoryError ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Landmark className="w-10 h-10 kb-text-muted mb-3" />
          <p className="kb-text-muted text-sm">{t('repo_seed_error')}</p>
        </div>
      ) : !repositoryLoaded ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Landmark className="w-10 h-10 kb-text-muted mb-3" />
          <p className="kb-text-muted text-sm">{t('repo_empty')}</p>
          {canLoadRepository && (
            <Button
              size="sm"
              className="mt-4 gap-1.5"
              disabled={seedRepository.isPending}
              onClick={() => seedRepository.mutate()}
            >
              {seedRepository.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {seedRepository.isPending ? t('repo_seeding') : t('repo_seed')}
            </Button>
          )}
        </div>
      ) : visibleCards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Landmark className="w-10 h-10 kb-text-muted mb-3" />
          <p className="kb-text-muted text-sm">{t('repo_no_match')}</p>
        </div>
      ) : (
        <FrameworkGrid
          cards={visibleCards}
          onOpen={code => navigate(`/knowledge-base/framework/${code}`)}
        />
      )}
    </>
  );

  // ─── Vistas: repositório legal (por omissão) / artigos ──────
  return (
    <div className="kb-scope kb-bg-canvas rounded-xl p-6 min-h-[60vh]">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="kb-title text-2xl mb-1">{t('nav_knowledge_base')}</h1>
          <p className="kb-text-muted text-sm">
            {mode === 'repository' ? t('repo_subtitle') : t('kb_subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {modeTabs}
          {canEdit && mode === 'articles' && (
            <div className="flex items-center gap-1 kb-bg-surface kb-border-c border rounded-lg p-1">
              {['catalogue', 'editorial'].map(key => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                    tab === key ? 'kb-bg-accent text-white' : 'kb-text-muted hover:kb-text-light',
                  )}
                >
                  {t(key === 'catalogue' ? 'kb_tab_catalogue' : 'kb_tab_editorial')}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {mode === 'repository' ? repositoryView : tab === 'editorial' && canEdit ? (
        <ArticleEditorialPanel articles={allArticles} />
      ) : (
        <>
          {searchBox(t('kb_search_placeholder'))}

          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => setActiveSection('all')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                activeSection === 'all'
                  ? 'kb-bg-accent text-white border-transparent'
                  : 'kb-bg-surface kb-text-muted kb-border-c hover:kb-bg-hover'
              )}
            >
              {t('common_all')}
            </button>
            {Object.entries(SECTION_LABELS).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setActiveSection(key)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                  activeSection === key
                    ? 'kb-bg-accent text-white border-transparent'
                    : 'kb-bg-surface kb-text-muted kb-border-c hover:kb-bg-hover'
                )}
              >
                {label}
              </button>
            ))}
            <div className="w-px kb-bg-border self-stretch mx-1" />
            <button
              onClick={() => setActiveFramework('all')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                activeFramework === 'all'
                  ? 'kb-bg-accent text-white border-transparent'
                  : 'kb-bg-surface kb-text-muted kb-border-c hover:kb-bg-hover'
              )}
            >
              {t('kb_all_frameworks')}
            </button>
            {Object.values(KB_FRAMEWORKS).map(fw => (
              <button
                key={fw.code}
                onClick={() => setActiveFramework(fw.code)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                  activeFramework === fw.code
                    ? 'text-white border-transparent'
                    : 'kb-bg-surface kb-text-muted kb-border-c hover:kb-bg-hover'
                )}
                style={activeFramework === fw.code ? { backgroundColor: fw.color } : {}}
              >
                {fw.code}
              </button>
            ))}
          </div>

          {/* Articles grouped by section */}
          {isLoading ? (
            <div className="py-16 text-center kb-text-muted text-sm">{t('kb_loading')}</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <BookOpen className="w-10 h-10 kb-text-muted mb-3" />
              <p className="kb-text-muted text-sm">{t('kb_no_results')}</p>
            </div>
          ) : (
            <div className="space-y-8">
              {Object.entries(grouped).map(([section, sectionArticles]) => (
                <div key={section}>
                  <h2 className="kb-meta-label text-xs uppercase tracking-widest mb-3">
                    {SECTION_LABELS[section] || section}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {sectionArticles.map(article => {
                      const Icon = CATEGORY_ICONS[article.category] || BookOpen;
                      const fwColor = getArticleFrameworkColor(article);
                      return (
                        <button
                          key={article.id}
                          onClick={() => navigate(`/knowledge-base/${article.slug || article.id}`)}
                          className="kb-card-hover kb-bg-surface kb-border-c border rounded-xl p-4 text-left cursor-pointer"
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className="p-2 rounded-lg flex-shrink-0"
                              style={{ backgroundColor: getArticleFrameworkTint(article) }}
                            >
                              <Icon className="w-4 h-4" style={{ color: fwColor }} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h3 className="kb-card-title text-sm mb-1">{article.title}</h3>
                              <p className="kb-text-muted text-xs line-clamp-2">{article.summary}</p>
                              <div className="flex flex-wrap gap-1 mt-2">
                                {article.framework && (
                                  <span
                                    className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                                    style={{ backgroundColor: getArticleFrameworkTint(article), color: fwColor }}
                                  >
                                    {article.framework}
                                  </span>
                                )}
                                {(article.tags || []).slice(0, 2).map(tag => (
                                  <span key={tag} className="kb-text-muted text-[10px] flex items-center gap-0.5">
                                    <Tag className="w-2.5 h-2.5" />{tag}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
