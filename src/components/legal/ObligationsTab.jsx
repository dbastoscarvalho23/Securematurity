import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Siren, CalendarClock } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { loadLegal } from '@/lib/legal';
import { Loading, useLegalData } from './shared';

const APPLIES = ['essencial', 'importante', 'publica_relevante_A', 'publica_relevante_B', 'dns_registo'];
const APPLIES_LABEL = {
  essencial: 'legal_q_essencial', importante: 'legal_q_importante',
  publica_relevante_A: 'EPR A', publica_relevante_B: 'EPR B', dns_registo: 'DNS',
};

function OfficialText({ text }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  if (!text) return null;
  return (
    <div>
      <button type="button" className="text-xs text-primary hover:underline" onClick={() => setOpen((v) => !v)}>
        {open ? t('legal_obl_hide_text') : t('legal_obl_show_text')}
      </button>
      {open && <p className="mt-1 text-xs whitespace-pre-line text-muted-foreground border-l-2 pl-2">{text}</p>}
    </div>
  );
}

const fmt = (p) => (p.value == null ? '—' : `${p.value} ${p.unit}`);

export default function ObligationsTab() {
  const { t } = useLanguage();
  const { data, loading } = useLegalData(loadLegal, 'obligations');
  const [query, setQuery] = useState('');
  const [applies, setApplies] = useState('all');

  const deadlines = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.deadlines.filter((d) => {
      if (applies !== 'all' && !(d.applies_to || []).includes(applies)) return false;
      if (!q) return true;
      return `${d.title_pt} ${d.ref} ${d.deadline?.text} ${d.text}`.toLowerCase().includes(q);
    });
  }, [data, query, applies]);

  if (loading) return <Loading />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="text-sm font-semibold flex items-center gap-2"><Siren className="w-4 h-4 text-primary" /> {t('legal_obl_incidents')}</h2>
        <div className="grid gap-3 xl:grid-cols-3">
          {data.incident_regimes.map((r) => (
            <Card key={r.id} className={r.id === 'rjc' ? 'border-primary/40' : ''}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm leading-snug">{r.name}</CardTitle>
                <p className="text-xs text-muted-foreground">{r.applies_to}</p>
                <p className="text-xs"><span className="font-medium">{t('legal_obl_recipient')}:</span> {r.recipient}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {r.phases.map((p, i) => (
                  <div key={`${p.id}-${i}`} className="rounded-md border p-2.5 space-y-1">
                    <div className="flex items-center gap-2 justify-between flex-wrap">
                      <span className="text-sm font-medium capitalize">{p.name}</span>
                      <Badge variant="outline" className="font-mono text-[11px]">{fmt(p)}</Badge>
                    </div>
                    {p.from && <p className="text-xs text-muted-foreground">{t('legal_obl_from')}: {p.from}</p>}
                    {p.alt?.length > 0 && p.alt.map((a, j) => <p key={j} className="text-xs text-muted-foreground">• {a}</p>)}
                    <p className="text-[11px] text-muted-foreground">{p.ref}</p>
                    <OfficialText text={p.text} />
                  </div>
                ))}
                {r.rules?.map((rule, i) => (
                  <div key={i} className="text-xs">
                    <span className="font-medium">{rule.ref}</span>
                    <OfficialText text={rule.text} />
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold flex items-center gap-2"><CalendarClock className="w-4 h-4 text-primary" /> {t('legal_obl_deadlines')}</h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('legal_search_articles')} className="pl-9" />
          </div>
          <Select value={applies} onValueChange={setApplies}>
            <SelectTrigger className="sm:w-64"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('legal_obl_applies_to')}: —</SelectItem>
              {APPLIES.map((a) => <SelectItem key={a} value={a}>{t(APPLIES_LABEL[a])}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('legal_obl_phase')}</TableHead>
                <TableHead className="w-72">{t('legal_obl_deadline')}</TableHead>
                <TableHead className="w-44">{t('legal_obl_applies_to')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deadlines.map((d) => (
                <TableRow key={d.id} className="align-top">
                  <TableCell className="space-y-1">
                    <p className="text-sm font-medium">{d.title_pt}</p>
                    <p className="text-[11px] text-muted-foreground">{d.ref}{d.page ? ` · ${t('legal_page')} ${d.page}` : ''}</p>
                    <OfficialText text={d.text} />
                  </TableCell>
                  <TableCell className="text-sm">
                    {d.deadline?.value != null && <Badge variant="outline" className="font-mono text-[11px] mb-1">{d.deadline.value} {d.deadline.unit}</Badge>}
                    <p className="text-xs text-muted-foreground">«{d.deadline?.text}»</p>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(d.applies_to || []).filter((a) => APPLIES_LABEL[a]).map((a) => <Badge key={a} variant="secondary" className="text-[10px]">{t(APPLIES_LABEL[a])}</Badge>)}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
