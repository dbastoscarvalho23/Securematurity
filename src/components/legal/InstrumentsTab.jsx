import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BookOpenText, Scale, Landmark, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/LanguageContext';
import { catalog, instrumentStatus } from '@/lib/legal';
import ArticleBrowser, { hasArticles } from './ArticleBrowser';
import { SourceLink } from './shared';

const GROUPS = [
  { id: 'national', labelKey: 'legal_group_national', icon: Landmark },
  { id: 'eu', labelKey: 'legal_group_eu', icon: Scale },
  { id: 'framework', labelKey: 'legal_group_frameworks', icon: Layers },
];

const STATUS_STYLE = {
  em_vigor: 'bg-chart-2/10 text-chart-2 border-chart-2/30',
  aplicavel: 'bg-chart-2/10 text-chart-2 border-chart-2/30',
  futuro: 'bg-chart-3/10 text-chart-3 border-chart-3/30',
  revogado: 'bg-muted text-muted-foreground',
};

const REL_KEYS = { transposes: 'legal_rel_transposes', regulates: 'legal_rel_regulates', revokes: 'legal_rel_revokes', lex_specialis: 'legal_rel_lex_specialis' };

function InstrumentCard({ inst, onOpen }) {
  const { t } = useLanguage();
  const status = instrumentStatus(inst);
  return (
    <Card className="h-full">
      <CardContent className="p-4 space-y-3 h-full flex flex-col">
        <div className="flex items-start gap-2 justify-between">
          <div className="min-w-0">
            <p className="font-semibold leading-snug">{inst.short}</p>
            <p className="text-xs text-muted-foreground line-clamp-3 mt-0.5">{inst.title}</p>
          </div>
          <Badge variant="outline" className={cn('text-[11px] flex-shrink-0', STATUS_STYLE[status])}>{t(`legal_status_${status}`)}</Badge>
        </div>
        <dl className="text-xs grid grid-cols-[auto,1fr] gap-x-3 gap-y-1">
          {inst.publication && (<><dt className="text-muted-foreground">{t('legal_published')}</dt><dd>{inst.publication}</dd></>)}
          {inst.entry_into_force_short && (<><dt className="text-muted-foreground">{t('legal_entry_into_force')}</dt><dd>{inst.entry_into_force_short}</dd></>)}
          {inst.effects_short && (<><dt className="text-muted-foreground">{t('legal_effects')}</dt><dd>{inst.effects_short}</dd></>)}
          {inst.license && (<><dt className="text-muted-foreground">{t('legal_license')}</dt><dd>{inst.license}</dd></>)}
          {inst.language && (<><dt className="text-muted-foreground">{t('legal_language')}</dt><dd className="uppercase">{inst.language}</dd></>)}
        </dl>
        {inst.relations?.length > 0 && (
          <ul className="text-xs space-y-1">
            {inst.relations.map((r, i) => (
              <li key={i}><span className="font-medium">{t(REL_KEYS[r.type] || r.type)}:</span> <span className="text-muted-foreground">{r.target}</span>{r.ref && <span className="text-muted-foreground"> ({r.ref})</span>}</li>
            ))}
          </ul>
        )}
        {inst.note && <p className="text-xs text-muted-foreground border-l-2 border-chart-3/50 pl-2">{inst.note}</p>}
        <div className="mt-auto flex items-center gap-3 flex-wrap pt-1">
          {hasArticles(inst.id) && (
            <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs" onClick={() => onOpen(inst)}>
              <BookOpenText className="w-3.5 h-3.5" /> {t('legal_view_text')}
            </Button>
          )}
          <SourceLink url={inst.official_url} />
        </div>
      </CardContent>
    </Card>
  );
}

export default function InstrumentsTab() {
  const { t } = useLanguage();
  const [current, setCurrent] = useState(null);
  return (
    <div className="space-y-6">
      {GROUPS.map((g) => {
        const items = catalog.instruments.filter((i) => i.group === g.id);
        if (!items.length) return null;
        const Icon = g.icon;
        return (
          <section key={g.id} className="space-y-3">
            <h2 className="text-sm font-semibold flex items-center gap-2"><Icon className="w-4 h-4 text-primary" />{t(g.labelKey)}</h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {items.map((inst) => <InstrumentCard key={inst.id} inst={inst} onOpen={setCurrent} />)}
            </div>
          </section>
        );
      })}
      <ArticleBrowser instrument={current} open={Boolean(current)} onOpenChange={(v) => !v && setCurrent(null)} />
    </div>
  );
}
