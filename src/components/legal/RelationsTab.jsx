import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { GitCompare } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { loadLegal, flattenQnrcs } from '@/lib/legal';
import { REF_LABELS, Loading, LevelBadge, useLegalData } from './shared';

const FRAMEWORKS = Object.entries(REF_LABELS);

function normalise(key, id) {
  const v = String(id || '').trim().toUpperCase().replace(/^CIS\s*-?\s*/, '').replace(/^A\./, '');
  return key === 'cis81' ? v.split('.')[0] : v;
}

export default function RelationsTab() {
  const { t } = useLanguage();
  const { data: qnrcs, loading } = useLegalData(loadLegal, 'qnrcs');
  const { data: enx } = useLegalData(loadLegal, 'enxNis2Isa6');
  const [fw, setFw] = useState('iso27002');
  const [query, setQuery] = useState('');

  const controls = useMemo(() => (qnrcs ? flattenQnrcs(qnrcs) : []), [qnrcs]);

  const citing = useMemo(() => {
    const q = normalise(fw, query);
    if (!q) return [];
    return controls.filter((k) => (k.references?.[fw] || []).some((id) => normalise(fw, id) === q || (fw !== 'cis81' && normalise(fw, id).startsWith(`${q}.`))));
  }, [controls, fw, query]);

  const matrix = useMemo(() => {
    if (!qnrcs) return [];
    return qnrcs.objectives.flatMap((o) => o.categories.map((c) => {
      const counts = {};
      for (const [key] of FRAMEWORKS) {
        counts[key] = new Set(c.controls.flatMap((k) => k.references?.[key] || [])).size;
      }
      return { id: c.id, name: c.name, counts };
    }));
  }, [qnrcs]);

  if (loading) return <Loading />;

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4 text-sm text-muted-foreground flex gap-3"><GitCompare className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />{t('legal_rel_intro')}</CardContent></Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">{t('legal_rel_citing')}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <Select value={fw} onValueChange={setFw}>
              <SelectTrigger className="sm:w-64"><SelectValue /></SelectTrigger>
              <SelectContent>{FRAMEWORKS.map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}</SelectContent>
            </Select>
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('legal_rel_search_id')} className="sm:w-72" />
          </div>
          {query && citing.length === 0 && <p className="text-sm text-muted-foreground">{t('legal_rel_none')}</p>}
          <div className="space-y-2">
            {citing.map((k) => (
              <div key={k.id} className="rounded-md border p-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-semibold text-primary">{k.id}</span>
                  <span className="text-sm flex-1">{k.statement}</span>
                  {k.min_level && <LevelBadge level={k.min_level} />}
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {FRAMEWORKS.filter(([key]) => key !== fw && k.references?.[key]?.length).map(([key, label]) => (
                    <Badge key={key} variant="outline" className="text-[11px] font-normal">
                      {label}: <span className="font-mono ml-1">{k.references[key].join(', ')}</span>
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-base">{t('legal_rel_matrix')}</CardTitle>
          <p className="text-xs text-muted-foreground">{t('legal_rel_matrix_note')}</p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>QNRCS</TableHead>
                {FRAMEWORKS.map(([k, label]) => <TableHead key={k} className="text-center text-xs">{label}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {matrix.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs"><span className="font-mono font-semibold">{r.id}</span> <span className="text-muted-foreground">{r.name}</span></TableCell>
                  {FRAMEWORKS.map(([k]) => (
                    <TableCell key={k} className="text-center text-sm">
                      {r.counts[k] ? <span className="inline-block min-w-7 px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">{r.counts[k]}</span> : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {enx?.mapping?.length > 0 && (
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-base">{t('legal_rel_isa_nis2')}</CardTitle>
            <p className="text-xs text-muted-foreground">{enx.instrument?.title} · {enx.instrument?.date}</p>
            <p className="text-[11px] text-muted-foreground">{enx.notice_pt}</p>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-56">NIS2</TableHead>
                  <TableHead>VDA ISA 6</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enx.mapping.map((m, i) => (
                  <TableRow key={i} className="align-top">
                    <TableCell className="text-xs"><span className="font-mono font-semibold">{m.nis2_ref}</span>{m.nis2_text && <p className="text-muted-foreground mt-1">{m.nis2_text}</p>}</TableCell>
                    <TableCell className="text-xs font-mono">{(m.isa6_controls || []).join(', ') || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
