import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { loadLegal, LEVELS, applicableMeasures, applicableEprMeasures } from '@/lib/legal';
import { LevelBadge, Loading, SourceLink, downloadCsv, useLegalData } from './shared';

export default function MeasuresTab() {
  const { t } = useLanguage();
  const { data: qnrcs, loading: l1 } = useLegalData(loadLegal, 'qnrcs');
  const { data: epr, loading: l2 } = useLegalData(loadLegal, 'epr');
  const [entityType, setEntityType] = useState('ee_ei');
  const [level, setLevel] = useState('basico');
  const [group, setGroup] = useState('B');

  const rows = useMemo(() => {
    if (entityType === 'ee_ei') return qnrcs ? applicableMeasures(qnrcs, level) : [];
    return epr ? applicableEprMeasures(epr, group) : [];
  }, [qnrcs, epr, entityType, level, group]);

  if (l1 || l2) return <Loading />;

  const exportCsv = () => {
    if (entityType === 'ee_ei') {
      downloadCsv(`medidas-minimas-${level}.csv`, [t('legal_control'), t('legal_level'), t('legal_measure'), t('legal_verification'), 'Referência'],
        rows.map((r) => [`${r.control.id} — ${r.control.statement}`, t(`legal_level_${r.level}`), r.measure, r.verification, `Reg. 756/2026, Anexo III, pág. ${r.page}`]));
    } else {
      downloadCsv(`medidas-minimas-epr-grupo-${group}.csv`, [t('legal_area'), t('legal_epr_group'), t('legal_measure'), t('legal_verification'), 'Referência'],
        rows.map((r) => [`${r.code} — ${r.area}`, r.group, r.measure, r.verification, `Reg. 756/2026, Anexo IV, pág. ${r.page}`]));
    }
  };

  const rule = entityType === 'ee_ei' ? qnrcs?.cumulative_rule : epr?.cumulative_rule;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <Select value={entityType} onValueChange={setEntityType}>
          <SelectTrigger className="sm:w-72"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ee_ei">{t('legal_entity_ee_ei')}</SelectItem>
            <SelectItem value="epr">{t('legal_entity_epr')}</SelectItem>
          </SelectContent>
        </Select>
        {entityType === 'ee_ei' ? (
          <Select value={level} onValueChange={setLevel}>
            <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              {LEVELS.map((lv) => <SelectItem key={lv} value={lv}>{t('legal_conformity_level')}: {t(`legal_level_${lv}`)}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : (
          <Select value={group} onValueChange={setGroup}>
            <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="B">{t('legal_epr_group')} B</SelectItem>
              <SelectItem value="A">{t('legal_epr_group')} A</SelectItem>
            </SelectContent>
          </Select>
        )}
        <span className="text-sm text-muted-foreground sm:ml-2">{t('legal_measures_total', { count: rows.length })}</span>
        <Button variant="outline" size="sm" className="sm:ml-auto gap-2" onClick={exportCsv}><Download className="w-4 h-4" /> {t('legal_export_csv')}</Button>
      </div>

      {rule && (
        <Card><CardContent className="p-3 text-xs text-muted-foreground flex flex-wrap items-center gap-2 justify-between">
          <span>{t('legal_cumulative_note')} — {rule.ref}: «{rule.text}»</span>
          <SourceLink url={(entityType === 'ee_ei' ? qnrcs : epr)?.source?.url} />
        </CardContent></Card>
      )}

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-64">{entityType === 'ee_ei' ? t('legal_control') : t('legal_area')}</TableHead>
              <TableHead className="w-28">{entityType === 'ee_ei' ? t('legal_level') : t('legal_epr_group')}</TableHead>
              <TableHead>{t('legal_measure')}</TableHead>
              <TableHead className="w-72">{t('legal_verification')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.key} className="align-top">
                <TableCell className="text-sm">
                  <span className="font-mono text-xs font-semibold text-primary">{entityType === 'ee_ei' ? r.control.id : r.code}</span>
                  <p className="text-xs text-muted-foreground mt-1">{entityType === 'ee_ei' ? r.control.statement : r.area}</p>
                </TableCell>
                <TableCell>{entityType === 'ee_ei' ? <LevelBadge level={r.level} /> : <span className="text-sm">{r.group}</span>}</TableCell>
                <TableCell className="text-sm">{r.measure}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{r.verification}<p className="text-[11px] mt-1">{t('legal_page')} {r.page}</p></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
