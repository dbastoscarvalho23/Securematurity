import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X, AlertTriangle, FileText, Users, ClipboardList, CheckSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/LanguageContext';

const ENTITY_CONFIG = [
  {
    key: 'risks',
    labelKey: 'gs_label_risk',
    icon: AlertTriangle,
    color: 'text-orange-500',
    bg: 'bg-orange-50',
    fetch: () => base44.entities.RiskItem.list('-updated_date', 200),
    getTitle: (r) => r.title,
    getSubtitle: (r) => r.customer_name ? `${r.customer_name}${r.category ? ` · ${r.category}` : ''}` : r.category || '',
    navigate: () => '/risk-assessment',
  },
  {
    key: 'documents',
    labelKey: 'gs_label_document',
    icon: FileText,
    color: 'text-blue-500',
    bg: 'bg-blue-50',
    fetch: () => base44.entities.SecurityDocument.list('-updated_date', 200),
    getTitle: (d) => d.title,
    getSubtitle: (d) => d.customer_name ? `${d.customer_name}${d.level ? ` · ${d.level}` : ''}` : d.level || '',
    navigate: () => '/security-documents',
  },
  {
    key: 'customers',
    labelKey: 'gs_label_customer',
    icon: Users,
    color: 'text-green-500',
    bg: 'bg-green-50',
    fetch: () => base44.entities.Customer.list('-updated_date', 200),
    getTitle: (c) => c.name,
    getSubtitle: (c) => c.sector ? c.sector.replace(/_/g, ' ') : '',
    navigate: () => '/customers',
  },
  {
    key: 'tasks',
    labelKey: 'gs_label_task',
    icon: CheckSquare,
    color: 'text-purple-500',
    bg: 'bg-purple-50',
    fetch: () => base44.entities.Task.list('-updated_date', 200),
    getTitle: (t) => t.title,
    getSubtitle: (t) => t.customer_name ? `${t.customer_name}${t.status ? ` · ${t.status.replace(/_/g, ' ')}` : ''}` : t.status?.replace(/_/g, ' ') || '',
    navigate: () => '/tasks',
  },
  {
    key: 'assessments',
    labelKey: 'gs_label_assessment',
    icon: ClipboardList,
    color: 'text-teal-500',
    bg: 'bg-teal-50',
    fetch: () => base44.entities.Assessment.list('-updated_date', 200),
    getTitle: (a) => a.title,
    getSubtitle: (a) => a.customer_name ? `${a.customer_name}${a.period ? ` · ${a.period}` : ''}` : a.period || '',
    navigate: (a) => `/assessments/${a.id}`,
  },
];

export default function GlobalSearch() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [allData, setAllData] = useState({});
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  // Load all data once when search opens
  useEffect(() => {
    if (!open || Object.keys(allData).length > 0) return;
    setLoading(true);
    Promise.allSettled(ENTITY_CONFIG.map(cfg => cfg.fetch().then(res => ({ key: cfg.key, data: res }))))
      .then(results => {
        const map = {};
        results.forEach(r => { if (r.status === 'fulfilled') map[r.value.key] = r.value.data; });
        setAllData(map);
      })
      .finally(() => setLoading(false));
  }, [open]);

  const results = useMemo(() => {
    if (!query.trim() || query.length < 2) return [];
    const q = query.toLowerCase();
    const matches = [];
    ENTITY_CONFIG.forEach(cfg => {
      const items = allData[cfg.key] || [];
      items.forEach(item => {
        const title = cfg.getTitle(item) || '';
        const subtitle = cfg.getSubtitle(item) || '';
        if (title.toLowerCase().includes(q) || subtitle.toLowerCase().includes(q)) {
          matches.push({ item, cfg });
        }
      });
    });
    return matches.slice(0, 12);
  }, [query, allData]);

  useEffect(() => { setActiveIndex(0); }, [results]);

  // Keyboard shortcut: Cmd/Ctrl+K
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (!containerRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSelect = (result) => {
    navigate(result.cfg.navigate(result.item));
    setOpen(false);
    setQuery('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && results[activeIndex]) handleSelect(results[activeIndex]);
    else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 h-8 pl-3 pr-4 rounded-lg border border-border bg-muted/50 hover:bg-muted text-muted-foreground text-sm transition-colors min-w-[180px]"
      >
        <Search className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="flex-1 text-left text-xs">{t('gs_search_placeholder')}</span>
        <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border border-border bg-background px-1 text-[10px] font-mono text-muted-foreground">
          <span>⌘K</span>
        </kbd>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute top-10 right-0 z-50 w-[480px] rounded-xl border border-border bg-card shadow-xl overflow-hidden">
          {/* Input */}
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
            <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('gs_input_ph')}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground text-foreground"
            />
            {query && (
              <button onClick={() => setQuery('')} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Results */}
          <div className="max-h-[360px] overflow-y-auto">
            {loading && (
              <div className="py-8 text-center text-sm text-muted-foreground">{t('gs_loading')}</div>
            )}

            {!loading && query.length < 2 && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {t('gs_min_chars')}
              </div>
            )}

            {!loading && query.length >= 2 && results.length === 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {t('gs_no_results', { query })}
              </div>
            )}

            {!loading && results.length > 0 && (
              <ul className="py-1">
                {results.map((result, idx) => {
                  const Icon = result.cfg.icon;
                  return (
                    <li key={`${result.cfg.key}-${result.item.id}`}>
                      <button
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/60 transition-colors',
                          idx === activeIndex && 'bg-muted/60'
                        )}
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={() => handleSelect(result)}
                      >
                        <div className={cn('w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0', result.cfg.bg)}>
                          <Icon className={cn('w-3.5 h-3.5', result.cfg.color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{result.cfg.getTitle(result.item)}</p>
                          {result.cfg.getSubtitle(result.item) && (
                            <p className="text-xs text-muted-foreground truncate capitalize">{result.cfg.getSubtitle(result.item)}</p>
                          )}
                        </div>
                        <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full border flex-shrink-0', result.cfg.bg, result.cfg.color, 'border-current/20')}>
                          {t(result.cfg.labelKey)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Footer hint */}
          {results.length > 0 && (
            <div className="px-3 py-1.5 border-t border-border flex items-center gap-3 text-[10px] text-muted-foreground">
              <span>↑↓ {t('gs_nav')}</span>
              <span>↵ {t('gs_select')}</span>
              <span>{t('gs_esc')}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}