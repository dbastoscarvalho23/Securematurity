/**
 * KnowledgeBase — searchable article library with dark scoped theme.
 * Uses the .kb-scope CSS classes from index.css (Plus Jakarta Sans titles,
 * Inter body, JetBrains Mono code). Articles come from knowledgeBaseMockData.
 */
import React, { useState, useMemo } from 'react';
import { Search, BookOpen, ArrowLeft, Tag } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { KB_ARTICLES, KB_FRAMEWORKS, getArticleFrameworkColor } from '@/lib/knowledgeBaseMockData';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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

export default function KnowledgeBase() {
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const [activeSection, setActiveSection] = useState('all');
  const [activeFramework, setActiveFramework] = useState('all');
  const [selectedArticle, setSelectedArticle] = useState(null);

  const filtered = useMemo(() => {
    return KB_ARTICLES.filter(a => {
      if (activeSection !== 'all' && a.section !== activeSection) return false;
      if (activeFramework !== 'all' && a.framework !== activeFramework) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          a.title.toLowerCase().includes(q) ||
          a.summary.toLowerCase().includes(q) ||
          a.tags.some(tag => tag.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [search, activeSection, activeFramework]);

  // Group by section
  const grouped = useMemo(() => {
    const sections = {};
    filtered.forEach(a => {
      if (!sections[a.section]) sections[a.section] = [];
      sections[a.section].push(a);
    });
    return sections;
  }, [filtered]);

  if (selectedArticle) {
    const article = KB_ARTICLES.find(a => a.id === selectedArticle);
    if (!article) {
      setSelectedArticle(null);
      return null;
    }
    const fw = article.framework ? KB_FRAMEWORKS[article.framework] : null;
    return (
      <div className="kb-scope kb-bg-canvas rounded-xl p-6 min-h-[60vh]">
        <button
          onClick={() => setSelectedArticle(null)}
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
                style={{ backgroundColor: getArticleFrameworkColor(article) + '20', color: getArticleFrameworkColor(article) }}
              >
                {fw.name}
              </span>
            )}
            <span className="kb-text-muted text-xs capitalize">{article.category}</span>
          </div>

          <h1 className="kb-title text-2xl mb-3">{article.title}</h1>
          <p className="kb-text-muted text-base mb-6">{article.summary}</p>

          <div className="kb-prose">
            <h2>{t('kb_overview')}</h2>
            <p>{article.summary}</p>
            <h2>{t('kb_details')}</h2>
            <p>
              {t('kb_article_detail_desc')}
            </p>
            <h2>{t('kb_tags')}</h2>
            <div className="flex flex-wrap gap-2 mt-2">
              {article.tags.map(tag => (
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

  return (
    <div className="kb-scope kb-bg-canvas rounded-xl p-6 min-h-[60vh]">
      {/* Header */}
      <div className="mb-6">
        <h1 className="kb-title text-2xl mb-1">{t('nav_knowledge_base')}</h1>
        <p className="kb-text-muted text-sm">{t('kb_subtitle')}</p>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 kb-text-muted" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('kb_search_placeholder')}
          className="kb-input pl-10"
        />
      </div>

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
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <BookOpen className="w-10 h-10 kb-text-muted mb-3" />
          <p className="kb-text-muted text-sm">{t('kb_no_results')}</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([section, articles]) => (
            <div key={section}>
              <h2 className="kb-meta-label text-xs uppercase tracking-widest mb-3">
                {SECTION_LABELS[section] || section}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {articles.map(article => {
                  const Icon = CATEGORY_ICONS[article.category] || BookOpen;
                  const fwColor = getArticleFrameworkColor(article);
                  return (
                    <button
                      key={article.id}
                      onClick={() => setSelectedArticle(article.id)}
                      className="kb-card-hover kb-bg-surface kb-border-c border rounded-xl p-4 text-left cursor-pointer"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="p-2 rounded-lg flex-shrink-0"
                          style={{ backgroundColor: fwColor + '20' }}
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
                                style={{ backgroundColor: fwColor + '20', color: fwColor }}
                              >
                                {article.framework}
                              </span>
                            )}
                            {article.tags.slice(0, 2).map(tag => (
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
    </div>
  );
}
