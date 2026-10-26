import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import LegalSyncCard from '@/components/legal/LegalSyncCard';
import { Shield, Loader2, Trash2, Plus, ToggleLeft, ToggleRight, Link, Upload, FileText, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { writeAuditLog } from '@/lib/auditLog';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';

/**
 * Framework management panel — admin-focused (bulk actions, status toggles,
 * reference links and documents). Rendered inside Settings and the Backoffice.
 */
export default function FrameworksPanel() {
  const { user: currentUser } = useAuth();
  const { t } = useLanguage();
  const isAdmin = currentUser?.role === 'admin';
  const isReadOnly = currentUser?.role === 'user';
  const queryClient = useQueryClient();

  const [newFwDialog, setNewFwDialog] = useState(false);
  const [newFwForm, setNewFwForm] = useState({ code: '', name: '', version: '', description: '', reference_url: '' });
  const [isSavingFw, setIsSavingFw] = useState(false);
  const [fwRefEdit, setFwRefEdit] = useState({}); // { [fw.id]: { url: '', uploading: false } }
  const [fwStatusConfirm, setFwStatusConfirm] = useState(null);
  const [fwUrlConfirm, setFwUrlConfirm] = useState(null);
  const [fwDocConfirm, setFwDocConfirm] = useState(null);
  const [fwCreateConfirm, setFwCreateConfirm] = useState(false);
  const [selectedFwIds, setSelectedFwIds] = useState([]);
  const [fwBulkConfirm, setFwBulkConfirm] = useState(null);
  const [isBulkFwAction, setIsBulkFwAction] = useState(false);

  const handleFwRefUrlSave = async (fw, url) => {
    await base44.entities.Framework.update(fw.id, { reference_url: url });
    queryClient.invalidateQueries({ queryKey: ['frameworks'] });
    setFwRefEdit(prev => ({ ...prev, [fw.id]: { ...prev[fw.id], editingUrl: false } }));
    toast.success(t('settings_ref_link'));
  };

  const handleFwDocUpload = async (fw, file) => {
    setFwRefEdit(prev => ({ ...prev, [fw.id]: { ...prev[fw.id], uploading: true } }));
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    await base44.entities.Framework.update(fw.id, { document_url: file_url, document_name: file.name });
    queryClient.invalidateQueries({ queryKey: ['frameworks'] });
    setFwRefEdit(prev => ({ ...prev, [fw.id]: { ...prev[fw.id], uploading: false } }));
    toast.success(t('settings_doc_uploaded'));
  };

  const handleCreateFramework = async () => {
    if (!newFwForm.code || !newFwForm.name) return;
    setIsSavingFw(true);
    const result = await base44.entities.Framework.create({ ...newFwForm, status: 'active' });
    await writeAuditLog({ action: 'framework_created', entity_type: 'Framework', entity_id: result?.id, details: `Created framework: ${newFwForm.name} (${newFwForm.code})` });
    queryClient.invalidateQueries({ queryKey: ['frameworks'] });
    setIsSavingFw(false);
    setNewFwDialog(false);
    setNewFwForm({ code: '', name: '', version: '', description: '', reference_url: '', document_url: '', document_name: '' });
    toast.success(t('settings_fw_created'));
  };

  const handleToggleFrameworkStatus = async (fw) => {
    const newStatus = fw.status === 'active' ? 'deprecated' : 'active';
    await base44.entities.Framework.update(fw.id, { status: newStatus });
    await writeAuditLog({ action: 'framework_status_changed', entity_type: 'Framework', entity_id: fw.id, details: `Framework ${fw.code} (${fw.name}) set to ${newStatus}` });
    queryClient.invalidateQueries({ queryKey: ['frameworks'] });
    toast.success(`${t('settings_fw_framework')} ${newStatus === 'active' ? t('settings_fw_activated') : t('settings_fw_deactivated')}`);
  };

  const handleBulkFwAction = async () => {
    if (!fwBulkConfirm) return;
    setIsBulkFwAction(true);
    try {
      const { action, ids } = fwBulkConfirm;
      if (action === 'delete') {
        for (const id of ids) {
          await base44.entities.Framework.delete(id);
        }
        await writeAuditLog({ action: 'framework_status_changed', entity_type: 'Framework', details: `Bulk deleted ${ids.length} frameworks` });
        toast.success(`${ids.length} ${t('settings_fw_bulk_deleted')}`);
      } else {
        const newStatus = action === 'activate' ? 'active' : 'deprecated';
        for (const id of ids) {
          await base44.entities.Framework.update(id, { status: newStatus });
        }
        await writeAuditLog({ action: 'framework_status_changed', entity_type: 'Framework', details: `Bulk set ${ids.length} frameworks to ${newStatus}` });
        toast.success(`${ids.length} ${newStatus === 'active' ? t('settings_fw_activated') : t('settings_fw_deactivated')}`);
      }
      setSelectedFwIds([]);
      queryClient.invalidateQueries({ queryKey: ['frameworks'] });
    } catch {
      toast.error(t('settings_fw_bulk_error'));
    }
    setIsBulkFwAction(false);
    setFwBulkConfirm(null);
  };

  const { data: frameworks = [] } = useQuery({
    queryKey: ['frameworks'],
    queryFn: () => base44.entities.Framework.list(),
  });

  const { data: questions = [] } = useQuery({
    queryKey: ['questions'],
    queryFn: () => base44.entities.Question.list('-created_date', 500),
  });

  const { data: responses = [] } = useQuery({
    queryKey: ['all-responses'],
    queryFn: () => base44.entities.AssessmentResponse.list('-created_date', 2000),
  });

  // Compute weighted risk score per framework (0–5 scale)
  // Score = sum(maturity_level * weight) / sum(weight) for all answered questions
  const frameworkScores = {};
  questions.forEach(q => {
    const answered = responses.filter(r => r.question_id === q.id && r.maturity_level != null);
    if (answered.length === 0) return;
    const fw = q.framework_code;
    if (!frameworkScores[fw]) frameworkScores[fw] = { weightedSum: 0, totalWeight: 0, answeredCount: 0 };
    const w = q.weight || 1;
    // Average maturity across all responses for this question
    const avgLevel = answered.reduce((s, r) => s + r.maturity_level, 0) / answered.length;
    frameworkScores[fw].weightedSum += avgLevel * w;
    frameworkScores[fw].totalWeight += w;
    frameworkScores[fw].answeredCount += answered.length;
  });

  const getRiskScore = (code) => {
    const s = frameworkScores[code];
    if (!s || s.totalWeight === 0) return null;
    return s.weightedSum / s.totalWeight;
  };

  const getRiskLabel = (score) => {
    if (score === null) return { label: t('settings_fw_no_data'), color: 'text-muted-foreground' };
    if (score >= 4) return { label: t('settings_fw_low_risk'), color: 'text-accent' };
    if (score >= 3) return { label: t('settings_fw_moderate'), color: 'text-chart-3' };
    if (score >= 2) return { label: t('settings_fw_elevated'), color: 'text-chart-4' };
    return { label: t('settings_fw_high_risk'), color: 'text-destructive' };
  };

  return (
    <>

          {isAdmin && <LegalSyncCard />}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    {t('settings_frameworks')}
                  </CardTitle>
                  <CardDescription>{t('settings_frameworks_desc')}</CardDescription>
                </div>
                {!isReadOnly && (
                  <div className="flex gap-2">
                    <Button onClick={() => setNewFwDialog(true)} className="gap-2">
                      <Plus className="w-4 h-4" /> {t('settings_new_framework')}
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {frameworks.length === 0 ? (
                <div className="text-center py-8 space-y-3">
                  <p className="text-sm text-muted-foreground">{t('settings_no_frameworks')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Bulk action bar — admin only */}
                  {isAdmin && (
                    <div className="flex items-center gap-3 pb-3 border-b flex-wrap">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={frameworks.length > 0 && selectedFwIds.length === frameworks.length}
                          onCheckedChange={(checked) => setSelectedFwIds(checked ? frameworks.map(f => f.id) : [])}
                        />
                        <span className="text-xs text-muted-foreground">{t('settings_fw_select_all')}</span>
                      </div>
                      {selectedFwIds.length > 0 && (
                        <>
                          <span className="text-xs font-medium">{selectedFwIds.length} {t('settings_fw_selected')}</span>
                          <div className="flex gap-2 ml-auto">
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => setFwBulkConfirm({ action: 'activate', ids: [...selectedFwIds] })}>
                              <ToggleRight className="w-3.5 h-3.5" /> {t('settings_fw_bulk_activate')}
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => setFwBulkConfirm({ action: 'deactivate', ids: [...selectedFwIds] })}>
                              <ToggleLeft className="w-3.5 h-3.5" /> {t('settings_fw_bulk_deactivate')}
                            </Button>
                            <Button size="sm" variant="destructive" className="h-7 text-xs gap-1.5" onClick={() => setFwBulkConfirm({ action: 'delete', ids: [...selectedFwIds] })}>
                              <Trash2 className="w-3.5 h-3.5" /> {t('settings_fw_bulk_delete')}
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  {frameworks.map(fw => {
                    const fwQuestions = questions.filter(q => q.framework_code === fw.code);
                    const domains = [...new Set(fwQuestions.map(q => q.domain))];
                    const score = getRiskScore(fw.code);
                    const { label: riskLabel, color: riskColor } = getRiskLabel(score);
                    const isActive = fw.status === 'active';
                    return (
                      <div key={fw.id} className={`p-4 rounded-lg border transition-opacity ${isActive ? '' : 'opacity-60'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {isAdmin && (
                              <Checkbox
                                checked={selectedFwIds.includes(fw.id)}
                                onCheckedChange={(checked) => setSelectedFwIds(prev => checked ? [...prev, fw.id] : prev.filter(id => id !== fw.id))}
                              />
                            )}
                            <p className="font-medium">{fw.name}</p>
                            <Badge variant="outline" className="text-xs font-mono">{fw.code}</Badge>
                            {fw.version && <span className="text-xs text-muted-foreground">v{fw.version}</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            {isReadOnly ? (
                              <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${
                                isActive
                                  ? 'bg-accent/10 text-accent border-accent/20'
                                  : 'bg-muted text-muted-foreground border-border'
                              }`}>
                                {isActive
                                  ? <><ToggleRight className="w-3.5 h-3.5" /> {t('settings_fw_active')}</>
                                  : <><ToggleLeft className="w-3.5 h-3.5" /> {t('settings_fw_inactive')}</>
                                }
                              </span>
                            ) : (
                              <button
                                onClick={() => setFwStatusConfirm(fw)}
                                className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                                  isActive
                                    ? 'bg-accent/10 text-accent border-accent/20 hover:bg-accent/20'
                                    : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
                                }`}
                                title={isActive ? t('settings_fw_click_deactivate') : t('settings_fw_click_activate')}
                              >
                                {isActive
                                  ? <><ToggleRight className="w-3.5 h-3.5" /> {t('settings_fw_active')}</>
                                  : <><ToggleLeft className="w-3.5 h-3.5" /> {t('settings_fw_inactive')}</>
                                }
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">{fw.description}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {fwQuestions.length} {t('settings_fw_questions')} · {domains.length} {t('settings_fw_domains')}
                        </p>
                        {fw.created_date && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {t('settings_fw_created_on')} {new Date(fw.created_date).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })}
                            {fw.updated_date && fw.updated_date !== fw.created_date && (
                              <> · {t('settings_fw_modified_on')} {new Date(fw.updated_date).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })}</>
                            )}
                          </p>
                        )}
                        {/* Risk Score */}
                        {isActive && (
                          <div className="mt-3 pt-3 border-t">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-medium text-muted-foreground">{t('settings_fw_overall_score')}</span>
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-semibold ${riskColor}`}>{riskLabel}</span>
                                {score !== null && (
                                  <span className="text-xs font-mono font-bold">{score.toFixed(2)} / 5.00</span>
                                )}
                              </div>
                            </div>
                            {score !== null ? (
                              <Progress value={(score / 5) * 100} className="h-2" />
                            ) : (
                              <p className="text-xs text-muted-foreground italic">{t('settings_fw_no_responses')}</p>
                            )}
                          </div>
                        )}

                        {/* Reference Link & Document — visible to all, editable by admin */}
                        <div className="mt-3 pt-3 border-t space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('settings_fw_docs_section')}</p>
                          {/* Reference URL */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                            {isAdmin && fwRefEdit[fw.id]?.editingUrl ? (
                              <form className="flex gap-2 flex-1" onSubmit={e => { e.preventDefault(); setFwUrlConfirm({ fw, url: fwRefEdit[fw.id]?.url ?? fw.reference_url ?? '' }); }}>
                                <Input
                                  autoFocus
                                  className="h-7 text-xs flex-1"
                                  placeholder="https://..."
                                  value={fwRefEdit[fw.id]?.url ?? fw.reference_url ?? ''}
                                  onChange={e => setFwRefEdit(prev => ({ ...prev, [fw.id]: { ...prev[fw.id], url: e.target.value } }))}
                                />
                                <Button type="submit" size="sm" className="h-7 text-xs px-3">{t('common_save')}</Button>
                                 <Button type="button" variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => setFwRefEdit(prev => ({ ...prev, [fw.id]: { ...prev[fw.id], editingUrl: false } }))}>{t('common_cancel')}</Button>
                              </form>
                            ) : fw.reference_url ? (
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <a href={fw.reference_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate flex items-center gap-1">
                                  <ExternalLink className="w-3 h-3 flex-shrink-0" />{fw.reference_url}
                                </a>
                                {!isReadOnly && (
                                  <Button variant="ghost" size="sm" className="h-6 px-2 text-xs flex-shrink-0" onClick={() => setFwRefEdit(prev => ({ ...prev, [fw.id]: { ...prev[fw.id], editingUrl: true, url: fw.reference_url } }))}>{t('common_edit')}</Button>
                                )}
                              </div>
                            ) : isAdmin ? (
                              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground" onClick={() => setFwRefEdit(prev => ({ ...prev, [fw.id]: { ...prev[fw.id], editingUrl: true, url: '' } }))}>
                                {t('docs_add_ref_link')}
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">{t('settings_fw_no_link')}</span>
                            )}
                          </div>

                          {/* Document upload */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                            {fw.document_url ? (
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <a href={fw.document_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate flex items-center gap-1">
                                  <ExternalLink className="w-3 h-3 flex-shrink-0" />{fw.document_name || t('settings_fw_ref_doc_fallback')}
                                </a>
                                {isAdmin && (
                                  <label className="cursor-pointer">
                                    <span className="text-xs text-muted-foreground hover:text-foreground border rounded px-2 py-0.5">{t('docs_replace')}</span>
                                    <input type="file" className="hidden" onChange={e => { if (e.target.files[0]) setFwDocConfirm({ fw, file: e.target.files[0] }); e.target.value = ''; }} />
                                  </label>
                                )}
                              </div>
                            ) : isAdmin ? (
                              <label className="cursor-pointer flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                                {fwRefEdit[fw.id]?.uploading
                                  ? <><Loader2 className="w-3 h-3 animate-spin" /> {t('common_uploading')}</>
                                  : <><Upload className="w-3 h-3" /> {t('docs_upload_doc')}</>
                                }
                                <input type="file" className="hidden" disabled={fwRefEdit[fw.id]?.uploading} onChange={e => { if (e.target.files[0]) setFwDocConfirm({ fw, file: e.target.files[0] }); e.target.value = ''; }} />
                              </label>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">{t('settings_fw_no_doc')}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Framework Status Toggle Confirmation */}
          <ConfirmDialog
            open={!!fwStatusConfirm}
            onOpenChange={() => setFwStatusConfirm(null)}
            title={t('settings_fw_confirm_status')}
            description={<>{t('settings_fw_confirm_status_desc')} <strong>{fwStatusConfirm?.status === 'active' ? t('settings_fw_deactivate') : t('settings_fw_activate')}</strong> {t('settings_fw_framework').toLowerCase()} <strong>{fwStatusConfirm?.name}</strong>?</>}
            confirmLabel={t('common_confirm')}
            cancelLabel={t('common_cancel')}
            onConfirm={() => { handleToggleFrameworkStatus(fwStatusConfirm); setFwStatusConfirm(null); }}
            destructive={false}
          />

          {/* Framework URL Save Confirmation */}
          <ConfirmDialog
            open={!!fwUrlConfirm}
            onOpenChange={() => setFwUrlConfirm(null)}
            title={t('settings_fw_confirm_url')}
            description={<>{t('settings_fw_confirm_url_desc')} <strong>{fwUrlConfirm?.fw?.name}</strong>?</>}
            confirmLabel={t('common_confirm')}
            cancelLabel={t('common_cancel')}
            onConfirm={() => { handleFwRefUrlSave(fwUrlConfirm.fw, fwUrlConfirm.url); setFwUrlConfirm(null); }}
            destructive={false}
          />

          {/* Framework Document Upload Confirmation */}
          <ConfirmDialog
            open={!!fwDocConfirm}
            onOpenChange={() => setFwDocConfirm(null)}
            title={t('settings_fw_confirm_doc')}
            description={<>{t('settings_fw_confirm_doc_desc')} <strong>{fwDocConfirm?.fw?.name}</strong>?{fwDocConfirm?.fw?.document_url && <><br />{t('settings_fw_confirm_doc_replace')}</>}</>}
            confirmLabel={t('common_confirm')}
            cancelLabel={t('common_cancel')}
            onConfirm={() => { handleFwDocUpload(fwDocConfirm.fw, fwDocConfirm.file); setFwDocConfirm(null); }}
            destructive={false}
          />

          {/* Framework Create Confirmation */}
          <ConfirmDialog
            open={fwCreateConfirm}
            onOpenChange={setFwCreateConfirm}
            title={t('settings_fw_confirm_create')}
            description={<>{t('settings_fw_confirm_create_desc')} <strong>{newFwForm.name}</strong> (<strong>{newFwForm.code}</strong>)?</>}
            confirmLabel={t('common_confirm')}
            cancelLabel={t('common_cancel')}
            onConfirm={() => { setFwCreateConfirm(false); handleCreateFramework(); }}
            destructive={false}
          />

          {/* Bulk Framework Action Confirmation */}
          <ConfirmDialog
            open={!!fwBulkConfirm}
            onOpenChange={(open) => !isBulkFwAction && !open && setFwBulkConfirm(null)}
            title={fwBulkConfirm?.action === 'delete' ? t('settings_fw_bulk_confirm_delete_title') : t('settings_fw_bulk_confirm_toggle_title')}
            description={fwBulkConfirm?.action === 'delete'
              ? `${t('settings_fw_bulk_confirm_delete_desc')} ${fwBulkConfirm?.ids.length}? ${t('settings_fw_bulk_cannot_undo')}`
              : `${t('settings_fw_bulk_confirm_toggle_desc')} ${fwBulkConfirm?.ids.length}?`}
            confirmLabel={t('common_confirm')}
            cancelLabel={t('common_cancel')}
            onConfirm={handleBulkFwAction}
            loading={isBulkFwAction}
            destructive={fwBulkConfirm?.action === 'delete'}
          />

          {/* New Framework Dialog */}
          <Dialog open={newFwDialog} onOpenChange={setNewFwDialog}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{t('settings_fw_new_dialog_title')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>{t('settings_fw_code')}</Label>
                    <Input
                      value={newFwForm.code}
                      onChange={e => setNewFwForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                      placeholder="e.g. ISO27001"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t('settings_fw_version')}</Label>
                    <Input
                      value={newFwForm.version}
                      onChange={e => setNewFwForm(p => ({ ...p, version: e.target.value }))}
                      placeholder="e.g. 2022"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>{t('settings_fw_name')}</Label>
                  <Input
                    value={newFwForm.name}
                    onChange={e => setNewFwForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. ISO/IEC 27001:2022"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('settings_fw_description')}</Label>
                  <Textarea
                    value={newFwForm.description}
                    onChange={e => setNewFwForm(p => ({ ...p, description: e.target.value }))}
                    placeholder={t('settings_fw_desc_placeholder')}
                    rows={3}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('settings_fw_ref_url')}</Label>
                  <Input
                    value={newFwForm.reference_url}
                    onChange={e => setNewFwForm(p => ({ ...p, reference_url: e.target.value }))}
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('settings_fw_ref_doc')}</Label>
                  {newFwForm.document_name ? (
                    <div className="flex items-center gap-2 p-2 rounded-md border bg-muted/40 text-sm">
                      <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="truncate flex-1 text-xs">{newFwForm.document_name}</span>
                      <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setNewFwForm(p => ({ ...p, document_url: '', document_name: '' }))}>{t('settings_fw_remove')}</Button>
                    </div>
                  ) : (
                    <label className="flex items-center gap-2 cursor-pointer border border-dashed rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:border-primary transition-colors">
                      {newFwForm.uploadingDoc
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('common_uploading')}</>
                        : <><Upload className="w-4 h-4" /> {t('docs_upload_doc')}</>
                      }
                      <input type="file" className="hidden" disabled={newFwForm.uploadingDoc} onChange={async e => {
                        const file = e.target.files[0];
                        if (!file) return;
                        setNewFwForm(p => ({ ...p, uploadingDoc: true }));
                        const { file_url } = await base44.integrations.Core.UploadFile({ file });
                        setNewFwForm(p => ({ ...p, document_url: file_url, document_name: file.name, uploadingDoc: false }));
                      }} />
                    </label>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setNewFwDialog(false)}>{t('common_cancel')}</Button>
                <Button onClick={() => setFwCreateConfirm(true)} disabled={isSavingFw || !newFwForm.code || !newFwForm.name}>
                  {isSavingFw ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {t('settings_fw_create')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
    </>
  );
}
