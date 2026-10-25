import React, { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Scale } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { loadLegal, LEVELS } from '@/lib/legal';

const QUALIFICATIONS = ['por_determinar', 'essencial', 'importante', 'publica_relevante', 'nao_abrangida'];
const NONE = '__none__';

/**
 * Enquadramento regulamentar do cliente (RJC / Reg. 756/2026 / DORA / TISAX).
 * Setores e tipos de entidade lidos dos Anexos I e II do Regime Jurídico da Cibersegurança.
 */
export default function RegulatoryProfileFields({ form, set }) {
  const { t } = useLanguage();
  const [annexes, setAnnexes] = useState(null);

  useEffect(() => {
    loadLegal('rjc').then((d) => setAnnexes(d.annexes.filter((a) => a.rows?.length)));
  }, []);

  const rows = useMemo(() => annexes?.find((a) => a.id === form.rjc_annex)?.rows || [], [annexes, form.rjc_annex]);
  const sectors = useMemo(() => [...new Set(rows.map((r) => r.setor))], [rows]);
  const subsectors = useMemo(() => [...new Set(rows.filter((r) => r.setor === form.rjc_sector && r.subsetor).map((r) => r.subsetor))], [rows, form.rjc_sector]);
  const entityTypes = useMemo(() => rows.filter((r) => r.setor === form.rjc_sector && (!subsectors.length || r.subsetor === form.rjc_subsector)).map((r) => r.tipo_entidade), [rows, form.rjc_sector, form.rjc_subsector, subsectors.length]);

  const isEeEi = form.rjc_qualification === 'essencial' || form.rjc_qualification === 'importante';
  const isEpr = form.rjc_qualification === 'publica_relevante';
  const sel = (field, value) => set(field, value === NONE ? '' : value);

  return (
    <fieldset className="space-y-4 rounded-lg border p-4">
      <legend className="px-1 text-sm font-semibold flex items-center gap-2"><Scale className="w-4 h-4 text-primary" /> {t('legal_profile_title')}</legend>
      <p className="text-xs text-muted-foreground -mt-2">{t('legal_profile_help')}</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label>{t('legal_profile_qualification')}</Label>
          <Select value={form.rjc_qualification || 'por_determinar'} onValueChange={(v) => set('rjc_qualification', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{QUALIFICATIONS.map((q) => <SelectItem key={q} value={q}>{t(`legal_q_${q}`)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {isEeEi && (
          <div className="space-y-1.5">
            <Label>{t('legal_conformity_level')}</Label>
            <Select value={form.conformity_level || NONE} onValueChange={(v) => sel('conformity_level', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t('legal_q_por_determinar')}</SelectItem>
                {LEVELS.map((lv) => <SelectItem key={lv} value={lv}>{t(`legal_level_${lv}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        {isEpr && (
          <div className="space-y-1.5">
            <Label>{t('legal_epr_group')}</Label>
            <Select value={form.epr_group || NONE} onValueChange={(v) => sel('epr_group', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t('legal_q_por_determinar')}</SelectItem>
                <SelectItem value="A">{t('legal_epr_group')} A</SelectItem>
                <SelectItem value="B">{t('legal_epr_group')} B</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-1.5">
          <Label>{t('legal_profile_size')}</Label>
          <Select value={form.entity_size || NONE} onValueChange={(v) => sel('entity_size', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>—</SelectItem>
              <SelectItem value="grande">{t('legal_profile_size_grande')}</SelectItem>
              <SelectItem value="media">{t('legal_profile_size_media')}</SelectItem>
              <SelectItem value="pequena">{t('legal_profile_size_pequena')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label>{t('legal_profile_annex')}</Label>
          <Select value={form.rjc_annex || NONE} onValueChange={(v) => { sel('rjc_annex', v); set('rjc_sector', ''); set('rjc_subsector', ''); set('rjc_entity_type', ''); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>—</SelectItem>
              {(annexes || []).map((a) => <SelectItem key={a.id} value={a.id}>Anexo {a.id} — {a.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>{t('legal_profile_sector')}</Label>
          <Select value={form.rjc_sector || NONE} onValueChange={(v) => { sel('rjc_sector', v); set('rjc_subsector', ''); set('rjc_entity_type', ''); }} disabled={!sectors.length}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>—</SelectItem>
              {sectors.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {subsectors.length > 0 && (
          <div className="space-y-1.5">
            <Label>{t('legal_profile_subsector')}</Label>
            <Select value={form.rjc_subsector || NONE} onValueChange={(v) => { sel('rjc_subsector', v); set('rjc_entity_type', ''); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {subsectors.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      {entityTypes.length > 0 && (
        <div className="space-y-1.5">
          <Label>{t('legal_profile_entity_type')}</Label>
          <Select value={form.rjc_entity_type || NONE} onValueChange={(v) => sel('rjc_entity_type', v)}>
            <SelectTrigger className="h-auto min-h-9 text-left whitespace-normal"><SelectValue /></SelectTrigger>
            <SelectContent className="max-w-[min(48rem,90vw)]">
              <SelectItem value={NONE}>—</SelectItem>
              {entityTypes.map((e) => <SelectItem key={e} value={e} className="whitespace-normal">{e}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label>{t('legal_profile_self_id_date')}</Label>
          <Input type="date" value={form.cncs_self_identification_date || ''} onChange={(e) => set('cncs_self_identification_date', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>{t('legal_profile_qualification_date')}</Label>
          <Input type="date" value={form.cncs_qualification_date || ''} onChange={(e) => set('cncs_qualification_date', e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label>{t('legal_profile_contact_point')}</Label>
          <Input value={form.permanent_contact_name || ''} onChange={(e) => set('permanent_contact_name', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input type="email" value={form.permanent_contact_email || ''} onChange={(e) => set('permanent_contact_email', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>{t('legal_profile_phone')}</Label>
          <Input value={form.permanent_contact_phone || ''} onChange={(e) => set('permanent_contact_phone', e.target.value)} placeholder="+351 …" />
        </div>
      </div>

      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm"><Switch checked={Boolean(form.dora_applicable)} onCheckedChange={(v) => set('dora_applicable', v)} /> {t('legal_profile_dora')}</label>
        <label className="flex items-center gap-2 text-sm"><Switch checked={Boolean(form.tisax_applicable)} onCheckedChange={(v) => set('tisax_applicable', v)} /> {t('legal_profile_tisax')}</label>
      </div>
    </fieldset>
  );
}

export const REGULATORY_FIELDS = [
  'rjc_qualification', 'epr_group', 'conformity_level', 'rjc_annex', 'rjc_sector', 'rjc_subsector', 'rjc_entity_type',
  'entity_size', 'cncs_self_identification_date', 'cncs_qualification_date',
  'permanent_contact_name', 'permanent_contact_email', 'permanent_contact_phone', 'dora_applicable', 'tisax_applicable',
];
