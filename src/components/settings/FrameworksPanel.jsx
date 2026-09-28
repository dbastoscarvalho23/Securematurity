/**
 * FrameworksPanel — framework catalogue management.
 *
 * Minimal phase: list, create, activate/deactivate and seed the default
 * catalogue. The scoring, document and bulk sections are not built yet.
 */
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Shield, Plus, Loader2, ToggleLeft, ToggleRight } from 'lucide-react';
import { toast } from 'sonner';
import { writeAuditLog } from '@/lib/auditLog';
import { useLanguage } from '@/lib/LanguageContext';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { DEFAULT_FRAMEWORKS, SAMPLE_QUESTIONS } from '@/lib/frameworkSeed';

const EMPTY_FORM = { code: '', name: '', version: '', description: '', reference_url: '' };

export default function FrameworksPanel({ isAdmin = false, isReadOnly = false }) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const [seeding, setSeeding] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [statusConfirm, setStatusConfirm] = useState(null);

  const { data: frameworks = [], isLoading } = useQuery({
    queryKey: ['frameworks'],
    queryFn: () => base44.entities.Framework.list(),
  });

  const { data: questions = [] } = useQuery({
    queryKey: ['questions'],
    queryFn: () => base44.entities.Question.list('-created_date', 500),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['frameworks'] });
    queryClient.invalidateQueries({ queryKey: ['questions'] });
  };

  const questionCount = (code) => questions.filter(q => q.framework_code === code).length;

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await base44.entities.Framework.bulkCreate(DEFAULT_FRAMEWORKS);
      await base44.entities.Question.bulkCreate(SAMPLE_QUESTIONS);
      refresh();
      toast.success(t('settings_fw_seeded'));
    } catch (err) {
      toast.error(err?.message || t('common_error'));
    } finally {
      setSeeding(false);
    }
  };

  const handleCreate = async () => {
    if (!form.code || !form.name) return;
    setSaving(true);
    try {
      const result = await base44.entities.Framework.create({ ...form, status: 'active' });
      await writeAuditLog({
        action: 'framework_created',
        entity_type: 'Framework',
        entity_id: result?.id,
        details: `Created framework: ${form.name} (${form.code})`,
      });
      refresh();
      setDialogOpen(false);
      setForm(EMPTY_FORM);
      toast.success(t('settings_fw_created'));
    } catch (err) {
      toast.error(err?.message || t('common_save_error'));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (fw) => {
    const newStatus = fw.status === 'active' ? 'deprecated' : 'active';
    try {
      await base44.entities.Framework.update(fw.id, { status: newStatus });
      await writeAuditLog({
        action: 'framework_status_changed',
        entity_type: 'Framework',
        entity_id: fw.id,
        details: `Framework ${fw.code} (${fw.name}) set to ${newStatus}`,
      });
      refresh();
      toast.success(`${fw.name} — ${newStatus === 'active' ? t('common_active') : t('common_inactive')}`);
    } catch (err) {
      toast.error(err?.message || t('common_update_error'));
    }
  };

  return (
    <div className="space-y-4">
      <ConfirmDialog
        open={!!statusConfirm}
        onOpenChange={() => setStatusConfirm(null)}
        title={t('settings_fw_confirm_status')}
        description={<>{t('settings_fw_confirm_status_desc')} <strong>{statusConfirm?.name}</strong>?</>}
        confirmLabel={t('common_confirm')}
        cancelLabel={t('common_cancel')}
        onConfirm={() => {
          const fw = statusConfirm;
          setStatusConfirm(null);
          handleToggleStatus(fw);
        }}
      />

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="w-4 h-4" />
                {t('settings_frameworks')}
              </CardTitle>
              <CardDescription>{t('settings_frameworks_desc')}</CardDescription>
            </div>
            {!isReadOnly && (
              <div className="flex gap-2 shrink-0">
                {frameworks.length === 0 && (
                  <Button variant="outline" size="sm" className="gap-2" onClick={handleSeed} disabled={seeding}>
                    {seeding && <Loader2 className="w-4 h-4 animate-spin" />}
                    {seeding ? t('common_seeding') : t('settings_init_defaults')}
                  </Button>
                )}
                <Button size="sm" className="gap-2" onClick={() => setDialogOpen(true)}>
                  <Plus className="w-4 h-4" />
                  {t('settings_new_framework')}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && (
            <div className="py-8 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && frameworks.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">{t('settings_no_frameworks')}</p>
          )}

          {frameworks.map(fw => (
            <div
              key={fw.id}
              className={`rounded-lg border p-4 space-y-2 ${fw.status === 'active' ? '' : 'opacity-60'}`}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium truncate">{fw.name}</span>
                  <Badge variant="secondary" className="font-mono text-xs">{fw.code}</Badge>
                  {fw.version && <span className="text-xs text-muted-foreground">v{fw.version}</span>}
                </div>
                {isReadOnly ? (
                  <span className="text-xs text-muted-foreground">
                    {fw.status === 'active' ? t('settings_fw_active') : t('settings_fw_inactive')}
                  </span>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 shrink-0"
                    title={fw.status === 'active' ? t('settings_fw_click_deactivate') : t('settings_fw_click_activate')}
                    onClick={() => setStatusConfirm(fw)}
                  >
                    {fw.status === 'active'
                      ? <ToggleRight className="w-4 h-4 text-accent" />
                      : <ToggleLeft className="w-4 h-4" />}
                    {fw.status === 'active' ? t('settings_fw_active') : t('settings_fw_inactive')}
                  </Button>
                )}
              </div>
              {fw.description && <p className="text-xs text-muted-foreground">{fw.description}</p>}
              <p className="text-xs text-muted-foreground">
                {questionCount(fw.code)} {t('settings_fw_questions')}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('settings_fw_new_dialog_title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t('settings_fw_code')}</Label>
                <Input
                  value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                  placeholder="e.g. ISO27001"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('settings_fw_version')}</Label>
                <Input
                  value={form.version}
                  onChange={e => setForm(f => ({ ...f, version: e.target.value }))}
                  placeholder="2022"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t('settings_fw_name')}</Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="ISO/IEC 27001:2022"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('settings_fw_description')}</Label>
              <Textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder={t('settings_fw_desc_placeholder')}
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('settings_fw_ref_url')}</Label>
              <Input
                value={form.reference_url}
                onChange={e => setForm(f => ({ ...f, reference_url: e.target.value }))}
                placeholder="https://"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common_cancel')}</Button>
            <Button onClick={handleCreate} disabled={saving || !form.code || !form.name} className="gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {t('settings_fw_create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
