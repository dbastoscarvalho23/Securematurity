import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Loader2, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/LanguageContext';

export const LEVEL_STYLES = {
  basico: 'bg-chart-2/10 text-chart-2 border-chart-2/30',
  substancial: 'bg-chart-3/10 text-chart-3 border-chart-3/30',
  elevado: 'bg-destructive/10 text-destructive border-destructive/30',
};

export function LevelBadge({ level, className }) {
  const { t } = useLanguage();
  if (!level) return null;
  return (
    <Badge variant="outline" className={cn('text-[11px] font-medium', LEVEL_STYLES[level], className)}>
      {t(`legal_level_${level}`)}
    </Badge>
  );
}

export const REF_LABELS = {
  iso27001: 'ISO/IEC 27001:2022',
  iso27002: 'ISO/IEC 27002:2022',
  nist_csf2: 'NIST CSF 2.0',
  nist80053: 'NIST SP 800-53 Rev. 5',
  cis81: 'CIS CSC v8.1',
  cyfun2025: 'CyFun 2025',
};

export function RefChips({ references }) {
  if (!references) return null;
  return (
    <div className="space-y-1">
      {Object.entries(REF_LABELS).map(([key, label]) => {
        const ids = references[key];
        if (!ids?.length) return null;
        return (
          <div key={key} className="flex flex-wrap items-center gap-1 text-xs">
            <span className="text-muted-foreground w-36 flex-shrink-0">{label}</span>
            {ids.map((id) => (
              <span key={id} className="font-mono px-1.5 py-0.5 rounded bg-muted text-foreground/80">{key === 'cis81' ? `CIS ${id}` : id}</span>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export function Loading() {
  const { t } = useLanguage();
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
      <Loader2 className="w-4 h-4 animate-spin" /> {t('legal_loading')}
    </div>
  );
}

export function SourceLink({ url, label }) {
  const { t } = useLanguage();
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
      <ExternalLink className="w-3 h-3" /> {label || t('legal_open_official')}
    </a>
  );
}

/** Hook simples para carregar um conjunto de dados da biblioteca. */
export function useLegalData(loader, key) {
  const [state, setState] = React.useState({ data: null, error: null, loading: true });
  React.useEffect(() => {
    let alive = true;
    loader(key)
      .then((data) => alive && setState({ data, error: null, loading: false }))
      .catch((error) => alive && setState({ data: null, error, loading: false }));
    return () => { alive = false; };
  }, [loader, key]);
  return state;
}

/** Exporta linhas para CSV (separador ;) com BOM para o Excel em português. */
export function downloadCsv(filename, header, rows) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = '﻿' + [header, ...rows].map((r) => r.map(esc).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
