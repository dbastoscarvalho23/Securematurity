/**
 * ContextualHelpDrawer — floating help button + Sheet drawer that shows
 * KB articles relevant to the current route.
 * Rendered in AppLayout (outside <Outlet/>).
 */
import React, { useState, useMemo } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { HelpCircle, Search, BookMarked, FileText, BookOpen, LayoutTemplate, GraduationCap, ArrowRight, ExternalLink } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { getRouteContext, getContextualArticles } from '@/lib/kbContextMatcher';
import { KB_FRAMEWORKS, getArticleFrameworkColor } from '@/lib/kbFrameworks';
import { useKnowledgeArticles } from '@/lib/useKnowledgeArticles';

const CATEGORY_ICONS = {
  article: FileText,
  guide: BookOpen,
  faq: HelpCircle,
  template: LayoutTemplate,
  training: GraduationCap,
};

function SectionHeader({ icon: Icon, label }) {
  return (
    <div className="flex items-center gap-2 px-1 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
      <Icon className="w-3.5 h-3.5" />
      {label}
    </div>
  );
}

function ArticleRow({ article }) {
  const { t } = useLanguage();
  const Icon = CATEGORY_ICONS[article.category] || FileText;
  const fwColor = getArticleFrameworkColor(article);
  const fw = KB_FRAMEWORKS[article.framework];

  return (
    <Link
      to={`/knowledge-base/${article.slug || article.id}`}
      className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors group"
    >
      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          {fw && (
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded"
              style={{ backgroundColor: `${fwColor}20`, color: fwColor }}
            >
              {article.framework}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground capitalize">{article.category}</span>
        </div>
        <p className="text-sm font-medium group-hover:text-primary transition-colors line-clamp-1">{article.title}</p>
        <p className="text-xs text-muted-foreground line-clamp-2">{article.summary}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
    </Link>
  );
}

export default function ContextualHelpDrawer() {
  const { t } = useLanguage();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const { articles } = useKnowledgeArticles();
  const routeContext = useMemo(() => getRouteContext(location.pathname), [location.pathname]);
  const matchedArticles = useMemo(
    () => getContextualArticles(articles, routeContext),
    [articles, routeContext],
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return matchedArticles;
    const q = search.toLowerCase();
    return matchedArticles.filter(a =>
      (a.title || '').toLowerCase().includes(q) ||
      (a.summary || '').toLowerCase().includes(q)
    );
  }, [matchedArticles, search]);

  // Don't render on /knowledge-base pages (after all hooks have been called)
  if (location.pathname.startsWith('/knowledge-base')) return null;

  const platformArticles = filtered.filter(a => a.section === 'platform');
  const complianceArticles = filtered.filter(a => a.section === 'compliance');

  const pageLabel = routeContext.page ? t(routeContext.page) : null;

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center group-hover:scale-105 transition-transform"
        title={t('kb_help_tooltip')}
        aria-label={t('kb_help_tooltip')}
      >
        <HelpCircle className="w-5 h-5" />
      </button>

      {/* Drawer */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-[420px] sm:max-w-[420px] p-0 flex flex-col">
          {/* Header */}
          <SheetHeader className="px-5 pt-5 pb-3 border-b">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-primary" />
              <SheetTitle>{t('kb_help_title')}</SheetTitle>
            </div>
            <SheetDescription>{t('kb_help_subtitle')}</SheetDescription>
          </SheetHeader>

          {/* Context badge */}
          {pageLabel && (
            <div className="px-5 py-2">
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
                {t('kb_help_relevant_for').replace('{page}', pageLabel)}
              </span>
            </div>
          )}

          {/* Search */}
          <div className="px-5 py-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('kb_help_search')}
                className="w-full pl-9 pr-3 py-2 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {/* Article list */}
          <div className="flex-1 overflow-y-auto px-3 pb-3">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <HelpCircle className="w-10 h-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground mb-3">{t('kb_help_no_results')}</p>
                <Link
                  to="/knowledge-base"
                  onClick={() => setOpen(false)}
                  className="text-sm text-primary hover:underline"
                >
                  {t('kb_help_browse_kb')}
                </Link>
              </div>
            ) : (
              <>
                {platformArticles.length > 0 && (
                  <div>
                    <SectionHeader icon={BookMarked} label={t('kb_help_section_platform')} />
                    {platformArticles.map(a => (
                      <ArticleRow key={a.id} article={a} />
                    ))}
                  </div>
                )}
                {complianceArticles.length > 0 && (
                  <div className="mt-2">
                    <SectionHeader icon={FileText} label={t('kb_help_section_compliance')} />
                    {complianceArticles.map(a => (
                      <ArticleRow key={a.id} article={a} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t">
            <Link
              to="/knowledge-base"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {t('kb_help_browse_kb')}
            </Link>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
