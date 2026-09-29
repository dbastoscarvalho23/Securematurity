/**
 * Modo de edição do repositório legal.
 *
 * Nenhuma escrita sai daqui para as entidades: tudo passa por
 * `manageLegalRepository` (o browser nunca escreve `FrameworkProfile` nem
 * `LegalDocumentVersion`), e o modo inclui a pré-visualização da linha temporal
 * antes de acrescentar uma versão. Ações de decisão de plataforma (ficha,
 * versões, retirada, arquivo) exigem `canManage`; a verificação periódica exige
 * apenas `canVerify` — é a equipa de conteúdo, com o analista de GRC como
 * revisor.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Plus, Save, ShieldCheck, Trash2, Archive, XCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { VERSION_TYPE_LABELS, VERSION_STATUS_LABELS } from '@/lib/legalRepositoryLabels';
import VersionTimeline from './VersionTimeline';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const today = () => new Date().toISOString().slice(0, 10);
const linesToArray = value => (value || '').split('\n').map(line => line.trim()).filter(Boolean);
const arrayToLines = value => (value || []).join('\n');

function emptyVersion() {
  return {
    version_label: '',
    version_type: 'norma_tecnica',
    status: 'current',
    effective_from: today(),
    effective_to: '',
    document_title: '',
    legal_reference: '',
    issuing_authority: '',
    official_source: '',
    official_url: '',
    language: 'pt-PT',
    summary: '',
    summary_en: '',
    change_note: '',
    mirror_url: '',
    content_hash: '',
  };
}

function profileToForm(profile, entry, lang) {
  return {
    display_name: profile?.display_name || entry?.name?.pt || '',
    display_name_en: profile?.display_name_en || entry?.name?.en || '',
    acronym: profile?.acronym || entry?.acronym || '',
    mission: profile?.mission || '',
    mission_en: profile?.mission_en || '',
    scope_areas: arrayToLines(profile?.scope_areas),
    scope_areas_en: arrayToLines(profile?.scope_areas_en),
    objectives: arrayToLines(profile?.objectives),
    objectives_en: arrayToLines(profile?.objectives_en),
    applicability: profile?.applicability || '',
    applicability_en: profile?.applicability_en || '',
    penalties: profile?.penalties || '',
    penalties_en: profile?.penalties_en || '',
    certifiability: profile?.certifiability || '',
    certifiability_en: profile?.certifiability_en || '',
    related_frameworks: (profile?.related_frameworks || []).join(', '),
    review_cycle_months: profile?.review_cycle_months || 12,
    copyright_notice: profile?.copyright_notice || '',
    obligations: profile?.obligations?.length ? profile.obligations : [{ label_pt: '', label_en: '', deadline: '' }],
  };
}

export default function FrameworkEditor({ framework, profile, versions = [], canManage, canVerify }) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('profile');
  const [profileForm, setProfileForm] = useState(() => profileToForm(profile, framework));
  const [versionForm, setVersionForm] = useState(emptyVersion);
  const [supersedesId, setSupersedesId] = useState('none');

  useEffect(() => {
    setProfileForm(profileToForm(profile, framework));
  }, [profile?.id, framework?.code]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['legal-framework-profiles'] });
    queryClient.invalidateQueries({ queryKey: ['legal-document-versions'] });
    queryClient.invalidateQueries({ queryKey: ['legal-competent-authorities'] });
  };

  const onError = error => {
    const code = error?.response?.data?.code || error?.data?.code;
    toast.error(code === 'version_exists' ? t('repo_version_exists') : (error?.response?.data?.error || error?.data?.error || t('repo_save_error')));
  };

  const profileMutation = useMutation({
    mutationFn: payload => base44.functions.invoke('manageLegalRepository', { action: 'upsert_profile', profile: payload }),
    onSuccess: () => { toast.success(t('repo_saved')); invalidate(); },
    onError,
  });

  const versionMutation = useMutation({
    mutationFn: payload => base44.functions.invoke('manageLegalRepository', payload),
    onSuccess: () => {
      toast.success(t('repo_saved'));
      setVersionForm(emptyVersion());
      setSupersedesId('none');
      invalidate();
    },
    onError,
  });

  const verifyMutation = useMutation({
    mutationFn: () => base44.functions.invoke('manageLegalRepository', {
      action: 'verify',
      target: 'framework',
      framework_code: framework.code,
      method: 'manual',
    }),
    onSuccess: () => { toast.success(t('repo_verify_done')); invalidate(); },
    onError: error => toast.error(error?.response?.data?.error || error?.data?.error || t('repo_verify_error')),
  });

  const setProfileField = (field, value) => setProfileForm(form => ({ ...form, [field]: value }));
  const setVersionField = (field, value) => setVersionForm(form => ({ ...form, [field]: value }));

  const setObligation = (index, field, value) => setProfileForm(form => ({
    ...form,
    obligations: form.obligations.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
  }));

  const addObligation = () => setProfileForm(form => ({
    ...form,
    obligations: [...form.obligations, { label_pt: '', label_en: '', deadline: '' }],
  }));

  const removeObligation = index => setProfileForm(form => ({
    ...form,
    obligations: form.obligations.filter((_, i) => i !== index),
  }));

  const submitProfile = () => {
    const payload = {
      framework_code: framework.code,
      display_name: profileForm.display_name,
      display_name_en: profileForm.display_name_en,
      acronym: profileForm.acronym,
      mission: profileForm.mission,
      mission_en: profileForm.mission_en,
      scope_areas: linesToArray(profileForm.scope_areas),
      scope_areas_en: linesToArray(profileForm.scope_areas_en),
      objectives: linesToArray(profileForm.objectives),
      objectives_en: linesToArray(profileForm.objectives_en),
      applicability: profileForm.applicability,
      applicability_en: profileForm.applicability_en,
      obligations: (profileForm.obligations || [])
        .filter(row => row.label_pt || row.label_en)
        .map(row => ({ label_pt: row.label_pt, label_en: row.label_en, deadline: row.deadline || null })),
      penalties: profileForm.penalties,
      penalties_en: profileForm.penalties_en,
      certifiability: profileForm.certifiability,
      certifiability_en: profileForm.certifiability_en,
      related_frameworks: (profileForm.related_frameworks || '').split(',').map(s => s.trim()).filter(Boolean),
      review_cycle_months: Number(profileForm.review_cycle_months) || 12,
      copyright_notice: profileForm.copyright_notice || null,
    };
    if (!payload.display_name || !payload.mission || !payload.mission_en || !payload.applicability) {
      toast.error(t('repo_required_fields'));
      return;
    }
    profileMutation.mutate(payload);
  };

  const submitVersion = () => {
    const payload = {
      framework_code: framework.code,
      ...versionForm,
      effective_to: versionForm.status === 'superseded' ? versionForm.effective_to || null : null,
      mirror_url: versionForm.mirror_url || null,
      content_hash: versionForm.content_hash || null,
      change_note: versionForm.change_note || null,
      official_url: versionForm.official_url || null,
    };
    if (!payload.version_label || !payload.document_title || !payload.effective_from) {
      toast.error(t('repo_required_fields'));
      return;
    }
    versionMutation.mutate({
      action: 'add_version',
      version: payload,
      supersedes_id: supersedesId === 'none' ? null : supersedesId,
    });
  };

  const supersedeVersion = version => {
    const effectiveTo = window.prompt(t('repo_field_effective_to'), today());
    if (effectiveTo === null) return;
    versionMutation.mutate({ action: 'supersede_version', version_id: version.id, effective_to: effectiveTo || null });
  };

  const withdrawVersion = version => {
    const reason = window.prompt(t('repo_version_withdraw_reason'));
    if (!reason?.trim()) return;
    versionMutation.mutate({ action: 'withdraw', version_id: version.id, reason: reason.trim() });
  };

  const archiveProfile = () => {
    versionMutation.mutate({ action: 'archive', framework_code: framework.code });
  };

  /** Linha temporal projectada: as versões atuais + a que está a ser composta. */
  const preview = useMemo(() => {
    const projectable = versions.map(version => ({ ...version }));
    const draft = { ...versionForm, id: 'preview', status: versionForm.status || 'draft' };
    if (versionForm.version_label && supersedesId !== 'none' && draft.status === 'current') {
      const previous = projectable.find(v => v.id === supersedesId);
      if (previous) {
        previous.status = 'superseded';
        previous.effective_to = versionForm.effective_from;
      }
    }
    if (versionForm.version_label) projectable.push(draft);
    return projectable;
  }, [versions, versionForm, supersedesId]);

  const metadataOnly = framework?.copyright === 'metadata_only';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 kb-bg-surface kb-border-c border rounded-lg p-1">
          {['profile', 'version'].map(key => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                tab === key ? 'kb-bg-accent text-white' : 'kb-text-muted hover:kb-text-light',
              )}
            >
              {t(key === 'profile' ? 'repo_edit_profile' : 'repo_new_version')}
            </button>
          ))}
        </div>
        {canVerify && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 h-8 text-xs"
            disabled={verifyMutation.isPending}
            onClick={() => verifyMutation.mutate()}
          >
            {verifyMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
            {t('repo_verify')}
          </Button>
        )}
        {canManage && profile && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 h-8 text-xs ml-auto"
            disabled={versionMutation.isPending}
            onClick={archiveProfile}
          >
            <Archive className="w-3.5 h-3.5" />
            {t('repo_field_status')}: {t('repo_status_withdrawn')}
          </Button>
        )}
      </div>
      <p className="kb-text-muted text-[11px]">{t('repo_manage_hint')}</p>

      {tab === 'profile' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label={t('repo_field_display_name')}>
              <Input value={profileForm.display_name} onChange={e => setProfileField('display_name', e.target.value)} className="kb-input" />
            </Field>
            <Field label={t('repo_field_display_name_en')}>
              <Input value={profileForm.display_name_en} onChange={e => setProfileField('display_name_en', e.target.value)} className="kb-input" />
            </Field>
            <Field label={t('repo_field_acronym')}>
              <Input value={profileForm.acronym} onChange={e => setProfileField('acronym', e.target.value)} className="kb-input" />
            </Field>
          </div>

          <Field label={t('repo_field_mission')}>
            <Textarea rows={2} value={profileForm.mission} onChange={e => setProfileField('mission', e.target.value)} className="kb-input" />
          </Field>
          <Field label={t('repo_field_mission_en')}>
            <Textarea rows={2} value={profileForm.mission_en} onChange={e => setProfileField('mission_en', e.target.value)} className="kb-input" />
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label={t('repo_field_scope_areas')} hint={t('repo_field_lines_hint')}>
              <Textarea rows={5} value={profileForm.scope_areas} onChange={e => setProfileField('scope_areas', e.target.value)} className="kb-input" />
            </Field>
            <Field label={t('repo_field_scope_areas_en')} hint={t('repo_field_lines_hint')}>
              <Textarea rows={5} value={profileForm.scope_areas_en} onChange={e => setProfileField('scope_areas_en', e.target.value)} className="kb-input" />
            </Field>
            <Field label={t('repo_field_objectives')} hint={t('repo_field_lines_hint')}>
              <Textarea rows={4} value={profileForm.objectives} onChange={e => setProfileField('objectives', e.target.value)} className="kb-input" />
            </Field>
            <Field label={t('repo_field_objectives_en')} hint={t('repo_field_lines_hint')}>
              <Textarea rows={4} value={profileForm.objectives_en} onChange={e => setProfileField('objectives_en', e.target.value)} className="kb-input" />
            </Field>
          </div>

          <Field label={t('repo_field_applicability')}>
            <Textarea rows={3} value={profileForm.applicability} onChange={e => setProfileField('applicability', e.target.value)} className="kb-input" />
          </Field>
          <Field label={t('repo_field_applicability_en')}>
            <Textarea rows={3} value={profileForm.applicability_en} onChange={e => setProfileField('applicability_en', e.target.value)} className="kb-input" />
          </Field>

          <div>
            <Label className="kb-meta-label text-[11px] uppercase tracking-widest">{t('repo_field_obligations')}</Label>
            <div className="space-y-2 mt-2">
              {profileForm.obligations.map((row, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_8rem_auto] gap-2 items-center">
                  <Input
                    value={row.label_pt}
                    placeholder={t('repo_field_obligation_label')}
                    onChange={e => setObligation(index, 'label_pt', e.target.value)}
                    className="kb-input"
                  />
                  <Input
                    value={row.label_en}
                    placeholder={t('repo_field_obligation_label_en')}
                    onChange={e => setObligation(index, 'label_en', e.target.value)}
                    className="kb-input"
                  />
                  <Input
                    value={row.deadline || ''}
                    placeholder={t('repo_field_obligation_deadline')}
                    onChange={e => setObligation(index, 'deadline', e.target.value)}
                    className="kb-input"
                  />
                  <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => removeObligation(index)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            <Button size="sm" variant="outline" className="mt-2 h-8 text-xs gap-1.5" onClick={addObligation}>
              <Plus className="w-3.5 h-3.5" />
              {t('repo_add_obligation')}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label={t('repo_field_penalties')}>
              <Textarea rows={3} value={profileForm.penalties} onChange={e => setProfileField('penalties', e.target.value)} className="kb-input" />
            </Field>
            <Field label={t('repo_field_penalties_en')}>
              <Textarea rows={3} value={profileForm.penalties_en} onChange={e => setProfileField('penalties_en', e.target.value)} className="kb-input" />
            </Field>
            <Field label={t('repo_field_certifiability')}>
              <Textarea rows={2} value={profileForm.certifiability} onChange={e => setProfileField('certifiability', e.target.value)} className="kb-input" />
            </Field>
            <Field label={t('repo_field_certifiability_en')}>
              <Textarea rows={2} value={profileForm.certifiability_en} onChange={e => setProfileField('certifiability_en', e.target.value)} className="kb-input" />
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label={t('repo_field_related')}>
              <Input value={profileForm.related_frameworks} onChange={e => setProfileField('related_frameworks', e.target.value)} className="kb-input" />
            </Field>
            <Field label={t('repo_field_review_cycle')}>
              <Input
                type="number"
                min="1"
                value={profileForm.review_cycle_months}
                onChange={e => setProfileField('review_cycle_months', e.target.value)}
                className="kb-input"
              />
            </Field>
          </div>

          {metadataOnly && (
            <Field label={t('repo_copyright_notice')}>
              <Textarea rows={2} value={profileForm.copyright_notice} onChange={e => setProfileField('copyright_notice', e.target.value)} className="kb-input" />
            </Field>
          )}

          <Button size="sm" className="gap-1.5" disabled={profileMutation.isPending} onClick={submitProfile}>
            {profileMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {t('repo_save_profile')}
          </Button>
        </div>
      )}

      {tab === 'version' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label={t('repo_field_version_label')}>
              <Input value={versionForm.version_label} onChange={e => setVersionField('version_label', e.target.value)} className="kb-input" />
            </Field>
            <Field label={t('repo_field_version_type')}>
              <Select value={versionForm.version_type} onValueChange={value => setVersionField('version_type', value)}>
                <SelectTrigger className="kb-input"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(VERSION_TYPE_LABELS).map(([value, labelKey]) => (
                    <SelectItem key={value} value={value}>{t(labelKey)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t('repo_field_status')}>
              <Select value={versionForm.status} onValueChange={value => setVersionField('status', value)}>
                <SelectTrigger className="kb-input"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(VERSION_STATUS_LABELS).map(([value, labelKey]) => (
                    <SelectItem key={value} value={value}>{t(labelKey)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label={t('repo_field_supersedes')}>
              <Select value={supersedesId} onValueChange={setSupersedesId}>
                <SelectTrigger className="kb-input"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('repo_field_supersedes_none')}</SelectItem>
                  {versions.filter(v => v.status === 'current').map(version => (
                    <SelectItem key={version.id} value={version.id}>{version.version_label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t('repo_field_effective_from')}>
              <Input value={versionForm.effective_from} onChange={e => setVersionField('effective_from', e.target.value)} className="kb-input" />
            </Field>
            {versionForm.status === 'superseded' && (
              <Field label={t('repo_field_effective_to')}>
                <Input value={versionForm.effective_to} onChange={e => setVersionField('effective_to', e.target.value)} className="kb-input" />
              </Field>
            )}
          </div>

          <Field label={t('repo_field_document_title')}>
            <Input value={versionForm.document_title} onChange={e => setVersionField('document_title', e.target.value)} className="kb-input" />
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label={t('repo_field_legal_reference')}>
              <Input value={versionForm.legal_reference} onChange={e => setVersionField('legal_reference', e.target.value)} className="kb-input" />
            </Field>
            <Field label={t('repo_field_issuing_authority')}>
              <Input value={versionForm.issuing_authority} onChange={e => setVersionField('issuing_authority', e.target.value)} className="kb-input" />
            </Field>
            <Field label={t('repo_field_language')}>
              <Input value={versionForm.language} onChange={e => setVersionField('language', e.target.value)} className="kb-input" />
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label={t('repo_field_official_source')}>
              <Input value={versionForm.official_source} onChange={e => setVersionField('official_source', e.target.value)} className="kb-input" />
            </Field>
            <Field label={t('repo_field_official_url')}>
              <Input value={versionForm.official_url} onChange={e => setVersionField('official_url', e.target.value)} className="kb-input" />
            </Field>
          </div>

          <Field label={t('repo_field_summary')}>
            <Textarea rows={3} value={versionForm.summary} onChange={e => setVersionField('summary', e.target.value)} className="kb-input" />
          </Field>
          <Field label={t('repo_field_summary_en')}>
            <Textarea rows={3} value={versionForm.summary_en} onChange={e => setVersionField('summary_en', e.target.value)} className="kb-input" />
          </Field>

          {!metadataOnly && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label={t('repo_field_mirror_url')}>
                <Input value={versionForm.mirror_url} onChange={e => setVersionField('mirror_url', e.target.value)} className="kb-input" />
              </Field>
              <Field label={t('repo_field_content_hash')}>
                <Input value={versionForm.content_hash} onChange={e => setVersionField('content_hash', e.target.value)} className="kb-input kb-font-mono" />
              </Field>
            </div>
          )}
          {metadataOnly && <p className="kb-text-amber text-[11px]">{t('repo_metadata_only_notice')}</p>}

          <Field label={t('repo_field_change_note')}>
            <Input value={versionForm.change_note} onChange={e => setVersionField('change_note', e.target.value)} className="kb-input" />
          </Field>

          <div>
            <h3 className="kb-meta-label text-[11px] uppercase tracking-widest">{t('repo_preview')}</h3>
            <p className="kb-text-muted text-[11px] mb-2">{t('repo_preview_hint')}</p>
            <div className="kb-state-surface kb-bg-canvas rounded-lg p-3 max-h-72 overflow-auto">
              <VersionTimeline versions={preview} frameworkCode={framework.code} />
            </div>
          </div>

          <Button size="sm" className="gap-1.5" disabled={versionMutation.isPending} onClick={submitVersion}>
            {versionMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            {t('repo_save_version')}
          </Button>

          {canManage && (
            <div>
              <h3 className="kb-meta-label text-[11px] uppercase tracking-widest mb-2">{t('repo_timeline')}</h3>
              <ul className="space-y-1.5">
                {versions.map(version => (
                  <li key={version.id} className="kb-bg-surface kb-border-c border rounded-lg px-3 py-2 flex flex-wrap items-center gap-2">
                    <span className="kb-font-mono text-xs">{version.version_label}</span>
                    <span className="kb-text-muted text-[11px]">{t(`repo_status_${version.status}`)}</span>
                    <div className="flex items-center gap-1 ml-auto">
                      {version.status === 'current' && (
                        <Button size="sm" variant="ghost" className="h-7 text-[11px] gap-1" onClick={() => supersedeVersion(version)}>
                          <XCircle className="w-3 h-3" />
                          {t('repo_status_superseded')}
                        </Button>
                      )}
                      {version.status !== 'withdrawn' && (
                        <Button size="sm" variant="ghost" className="h-7 text-[11px] gap-1" onClick={() => withdrawVersion(version)}>
                          <Trash2 className="w-3 h-3" />
                          {t('repo_status_withdrawn')}
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Campo do formulário: rótulo, nota opcional e controlo. */
function Field({ label, hint, children }) {
  return (
    <div>
      <Label className="kb-meta-label text-[11px] uppercase tracking-widest">{label}</Label>
      {hint && <p className="kb-text-muted text-[10px] mt-0.5">{hint}</p>}
      <div className="mt-1">{children}</div>
    </div>
  );
}
