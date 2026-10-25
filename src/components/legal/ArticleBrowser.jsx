import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { loadLegal } from '@/lib/legal';
import { Loading, SourceLink } from './shared';

/** Caminho dos artigos dentro de cada conjunto de dados. */
const ARTICLE_PATHS = {
  dl125: ['rjc', (d) => d.dl_articles],
  rjc: ['rjc', (d) => d.articles],
  reg756: ['reg756', (d) => d.articles],
  nis2: ['nis2', (d) => d.articles],
  regexec2690: ['regexec2690', (d) => d.articles],
  dora: ['dora', (d) => d.dora_articles],
  rts2024_1774: ['dora', (d) => d.rts_1774?.articles],
};

export const hasArticles = (id) => Boolean(ARTICLE_PATHS[id]);

export default function ArticleBrowser({ instrument, open, onOpenChange }) {
  const { t } = useLanguage();
  const [articles, setArticles] = useState(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open || !instrument || !ARTICLE_PATHS[instrument.id]) return;
    const [key, pick] = ARTICLE_PATHS[instrument.id];
    setArticles(null);
    loadLegal(key).then((d) => setArticles(pick(d) || []));
  }, [open, instrument]);

  const filtered = useMemo(() => {
    if (!articles) return [];
    const q = query.trim().toLowerCase();
    if (!q) return articles;
    return articles.filter((a) => `${a.number} ${a.title || ''} ${a.text || ''}`.toLowerCase().includes(q));
  }, [articles, query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base leading-snug pr-6">{instrument?.short}</DialogTitle>
          <p className="text-xs text-muted-foreground">{instrument?.title}</p>
          <SourceLink url={instrument?.official_url} />
        </DialogHeader>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('legal_search_articles')} className="pl-9" />
        </div>
        {!articles ? <Loading /> : (
          <ScrollArea className="flex-1 min-h-0 pr-3">
            <div className="space-y-4 pb-2">
              {filtered.length === 0 && <p className="text-sm text-muted-foreground">{t('legal_no_articles')}</p>}
              {filtered.map((a, i) => (
                <article key={`${a.number}-${i}`} className="space-y-1">
                  <h3 className="text-sm font-semibold">
                    {t('legal_article')} {a.number}{a.title ? ` — ${a.title}` : ''}
                    {a.page && <span className="ml-2 text-[11px] font-normal text-muted-foreground">{t('legal_page')} {a.page}</span>}
                  </h3>
                  {a.chapter && <p className="text-[11px] text-muted-foreground">{a.chapter}{a.section ? ` · ${a.section}` : ''}</p>}
                  <p className="text-sm whitespace-pre-line leading-relaxed text-foreground/90">{a.text}</p>
                </article>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
