import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Search, AlertTriangle } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { loadLegal, LEVELS } from '@/lib/legal';
import { LevelBadge, RefChips, Loading, SourceLink, useLegalData } from './shared';

function ControlCard({ control }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border p-3 space-y-2 bg-card">
      <div className="flex items-start gap-2 flex-wrap">
        <span className="font-mono text-xs font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary">{control.id}</span>
        <p className="text-sm font-medium flex-1 min-w-[12rem]">{control.statement}</p>
        {control.min_level
          ? <span className="flex items-center gap-1 text-[11px] text-muted-foreground">{t('legal_min_level')} <LevelBadge level={control.min_level} /></span>
          : <Badge variant="outline" className="text-[11px] text-muted-foreground">{t('legal_not_mandatory')}</Badge>}
      </div>
      <button type="button" onClick={() => setOpen((v) => !v)} className="text-xs text-primary hover:underline">
        {open ? '−' : '+'} {t('legal_description')} · {t('legal_references')}{Object.keys(control.measures || {}).length ? ` · ${t('legal_measure')}` : ''}
      </button>
      {open && (
        <div className="space-y-3 pt-1">
          <p className="text-sm text-muted-foreground leading-relaxed">{control.description}</p>
          <div>
            <p className="text-xs font-semibold mb-1">{t('legal_references')}</p>
            <RefChips references={control.references} />
          </div>
          {LEVELS.filter((lv) => control.measures?.[lv]).map((lv) => (
            <div key={lv} className="rounded-md border bg-muted/30 p-2.5 space-y-1.5">
              <div className="flex items-center gap-2"><LevelBadge level={lv} /><span className="text-[11px] text-muted-foreground">Reg. 756/2026, Anexo III · {t('legal_page')} {control.measures[lv].page}</span></div>
              <p className="text-sm"><span className="font-medium">{t('legal_measure')}:</span> {control.measures[lv].measure}</p>
              <p className="text-sm text-muted-foreground"><span className="font-medium text-foreground">{t('legal_verification')}:</span> {control.measures[lv].verification}</p>
            </div>
          ))}
          <p className="text-[11px] text-muted-foreground">Reg. 756/2026, Anexo I · {t('legal_page')} {control.page}</p>
        </div>
      )}
    </div>
  );
}

export default function QnrcsTab() {
  const { t } = useLanguage();
  const { data, loading } = useLegalData(loadLegal, 'qnrcs');
  const [search, setSearch] = useState('');
  const [objective, setObjective] = useState('all');
  const [level, setLevel] = useState('all');

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.objectives
      .filter((o) => objective === 'all' || o.code === objective)
      .map((o) => ({
        ...o,
        categories: o.categories.map((c) => ({
          ...c,
          controls: c.controls.filter((k) => {
            if (level === 'recommended' && k.min_level) return false;
            if (LEVELS.includes(level) && k.min_level !== level) return false;
            if (!q) return true;
            return k.id.toLowerCase().includes(q) || k.statement.toLowerCase().includes(q) || k.description.toLowerCase().includes(q);
          }),
        })).filter((c) => c.controls.length),
      })).filter((o) => o.categories.length);
  }, [data, search, objective, level]);

  if (loading) return <Loading />;
  if (!data) return null;
  const total = filtered.reduce((n, o) => n + o.categories.reduce((m, c) => m + c.controls.length, 0), 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="font-semibold">{data.source.title}</p>
              <p className="text-xs text-muted-foreground">{data.source.ref}</p>
            </div>
            <SourceLink url={data.source.url} />
          </div>
          <p className="text-xs text-muted-foreground">{t('legal_cumulative_note')} — {data.cumulative_rule.ref}: «{data.cumulative_rule.text}»</p>
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('legal_search_controls')} className="pl-9" />
        </div>
        <Select value={objective} onValueChange={setObjective}>
          <SelectTrigger className="sm:w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('legal_all_objectives')}</SelectItem>
            {data.objectives.map((o) => <SelectItem key={o.code} value={o.code}>{o.code} — {o.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={level} onValueChange={setLevel}>
          <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('legal_all_levels')}</SelectItem>
            {LEVELS.map((lv) => <SelectItem key={lv} value={lv}>{t('legal_min_level')}: {t(`legal_level_${lv}`)}</SelectItem>)}
            <SelectItem value="recommended">{t('legal_level_recommended')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <p className="text-xs text-muted-foreground">{t('legal_controls_count', { count: total })}</p>

      <Accordion type="multiple" className="space-y-2">
        {filtered.map((o) => (
          <AccordionItem key={o.code} value={o.code} className="border rounded-lg px-3">
            <AccordionTrigger className="hover:no-underline">
              <div className="text-left">
                <span className="font-semibold">{o.number} — {o.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">({o.code})</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{o.description}</p>
              {o.categories.map((c) => (
                <div key={c.id} className="space-y-2">
                  <div>
                    <p className="text-sm font-semibold">{c.number} — {c.id} — {c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.description}</p>
                  </div>
                  {c.controls.map((k) => <ControlCard key={k.id} control={k} />)}
                </div>
              ))}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {data.reference_corrections?.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-sm font-semibold flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-chart-3" /> {t('legal_corrections')}</p>
            <p className="text-xs text-muted-foreground">{t('legal_corrections_note')}</p>
            <div className="text-xs space-y-1">
              {data.reference_corrections.map((c, i) => (
                <div key={i} className="flex flex-wrap gap-2">
                  <span className="font-mono">{c.control}</span>
                  <span className="text-muted-foreground">{t('legal_as_printed')}: «{c.official_text}»</span>
                  <span>→ {t('legal_corrected_to')}: <span className="font-mono">{c.corrected_to.join(', ')}</span></span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
