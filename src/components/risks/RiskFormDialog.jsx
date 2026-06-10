import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import RiskHistoryTimeline from './RiskHistoryTimeline';
import MitigationTasksPanel from './MitigationTasksPanel';
import CreateTaskFromRiskPanel from './CreateTaskFromRiskPanel';
import { ShieldCheck, ClipboardList } from 'lucide-react';
import ResidualRiskGauge from './ResidualRiskGauge';
import { useCustomerUsers } from '@/hooks/useCustomerUsers';
import UserSelect from '@/components/shared/UserSelect';

const CATEGORY_KEYS = [
  { value: 'access_control', key: 'risk_cat_access_control' },
  { value: 'data_protection', key: 'risk_cat_data_protection' },
  { value: 'network_security', key: 'risk_cat_network_security' },
  { value: 'physical_security', key: 'risk_cat_physical_security' },
  { value: 'third_party', key: 'risk_cat_third_party' },
  { value: 'compliance', key: 'risk_cat_compliance' },
  { value: 'operational', key: 'risk_cat_operational' },
  { value: 'other', key: 'risk_cat_other' },
];

const PREDEFINED_VALUES = CATEGORY_KEYS.map(c => c.value);

function ScoreSelector({ label, value, onChange, scoreLabels }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`flex-1 h-9 rounded-md text-sm font-medium border transition-colors ${
              value === n
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-input hover:bg-muted'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      {value && <p className="text-xs text-muted-foreground">{scoreLabels[value]}</p>}
    </div>
  );
}

const DEFAULT = {
  risk_id: '', title: '', description: '', category: '', impact: 3, likelihood: 3,
  status: 'open', owner_email: '', treatment_notes: '', due_date: '',
  linked_document_ids: [], customer_id: '', customer_name: '',
};

export default function RiskFormDialog({ open, onOpenChange, risk, documents, customers, isAdmin, customerId, customerName, onSave, currentUser, initialTab = 'edit' }) {
  const { t } = useLanguage();
  const [form, setForm] = useState(DEFAULT);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('edit');

  const isEdit = !!risk?.id;

  useEffect(() => {
    if (risk) setForm({ ...DEFAULT, ...risk });
    else setForm(DEFAULT);
    // Map legacy tab names to new unified tabs
    const tabMap = { mitigation: 'tasks', create_task: 'tasks' };
    const resolvedTab = tabMap[initialTab] || initialTab;
    setActiveTab(risk?.id ? resolvedTab : 'edit');
  }, [risk, open, initialTab]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const toggleDoc = (id) => {
    setForm(f => ({
      ...f,
      linked_document_ids: f.linked_document_ids?.includes(id)
        ? f.linked_document_ids.filter(d => d !== id)
        : [...(f.linked_document_ids || []), id],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const data = { ...form };
    if (!isAdmin) {
      data.customer_id = customerId;
      data.customer_name = customerName;
    } else if (form.customer_id) {
      const c = customers?.find(c => c.id === form.customer_id);
      data.customer_name = c?.name || '';
    }
    const savedRisk = await onSave(data);

    // Compute field-level diff and record history
    const riskId = savedRisk?.id || risk?.id;
    if (riskId) {
      const TRACKED_FIELDS = [
        { key: 'title',           label: 'Title' },
        { key: 'category',        label: 'Category' },
        { key: 'impact',          label: 'Impact' },
        { key: 'likelihood',      label: 'Likelihood' },
        { key: 'status',          label: 'Status' },
        { key: 'owner_email',     label: 'Owner Email' },
        { key: 'due_date',        label: 'Due Date' },
        { key: 'treatment_notes', label: 'Treatment Notes' },
      ];

      const changed_fields = isEdit
        ? TRACKED_FIELDS
            .filter(f => String(risk?.[f.key] ?? '') !== String(data[f.key] ?? ''))
            .map(f => ({
              field: f.key,
              label: f.label,
              from: String(risk?.[f.key] ?? ''),
              to:   String(data[f.key] ?? ''),
            }))
        : [];

      await base44.entities.RiskHistory.create({
        risk_id: riskId,
        changed_by: currentUser?.email || 'unknown',
        action: isEdit ? 'updated' : 'created',
        changed_fields,
        snapshot: {
          title: data.title,
          impact: data.impact,
          likelihood: data.likelihood,
          status: data.status,
          category: data.category,
          owner_email: data.owner_email,
          due_date: data.due_date,
          treatment_notes: data.treatment_notes,
        },
      });
    }

    setSaving(false);
  };

  const availableDocs = documents?.filter(d =>
    !form.customer_id || d.customer_id === form.customer_id || !d.customer_id
  ) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('risk_form_edit') : t('risk_form_new')}</DialogTitle>
        </DialogHeader>

        {isEdit ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
            <TabsList className="w-full flex-shrink-0">
              <TabsTrigger value="edit" className="flex-1">{t('risk_form_tab_edit')}</TabsTrigger>
              <TabsTrigger value="tasks" className="flex-1">Tasks</TabsTrigger>
              <TabsTrigger value="history" className="flex-1">{t('risk_form_tab_history')}</TabsTrigger>
            </TabsList>

            <TabsContent value="edit" className="flex-1 overflow-y-auto mt-0 pt-4">
              <RiskEditFormWithUsers
                form={form} set={set} toggleDoc={toggleDoc}
                isAdmin={isAdmin} customers={customers} availableDocs={availableDocs}
                saving={saving} onSubmit={handleSubmit} onCancel={() => onOpenChange(false)}
                isEdit={isEdit}
              />
            </TabsContent>

            <TabsContent value="tasks" className="flex-1 overflow-y-auto mt-0 pt-4">
              <RiskTasksPanel risk={risk} initialSubTab={initialTab === 'mitigation' ? 'mitigation' : 'general'} />
            </TabsContent>

            <TabsContent value="history" className="flex-1 overflow-y-auto mt-0 pt-4">
              <RiskHistoryTimeline riskId={risk.id} />
            </TabsContent>
          </Tabs>
        ) : (
          <div className="overflow-y-auto flex-1">
            <RiskEditFormWithUsers
              form={form} set={set} toggleDoc={toggleDoc}
              isAdmin={isAdmin} customers={customers} availableDocs={availableDocs}
              saving={saving} onSubmit={handleSubmit} onCancel={() => onOpenChange(false)}
              isEdit={isEdit}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RiskTasksPanel({ risk, initialSubTab = 'general' }) {
  const [subTab, setSubTab] = useState(initialSubTab);

  return (
    <div className="space-y-4">
      {/* Sub-toggle */}
      <div className="flex items-center rounded-lg border border-border bg-muted p-0.5 gap-0.5 w-fit">
        <button
          onClick={() => setSubTab('general')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
            subTab === 'general' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <ClipboardList className="w-3.5 h-3.5" /> Create Task
        </button>
        <button
          onClick={() => setSubTab('mitigation')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
            subTab === 'mitigation' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" /> Mitigation Tasks
        </button>
      </div>

      {subTab === 'general' && <CreateTaskFromRiskPanel risk={risk} />}
      {subTab === 'mitigation' && <MitigationTasksPanel riskId={risk.id} customerId={risk.customer_id} />}
    </div>
  );
}

function RiskEditFormWithUsers(props) {
  const customerUsers = useCustomerUsers(props.form.customer_id);
  return <RiskEditForm {...props} customerUsers={customerUsers} />;
}

function RiskEditForm({ form, set, toggleDoc, isAdmin, customers, availableDocs, saving, onSubmit, onCancel, isEdit, customerUsers = [] }) {
  const { t } = useLanguage();
  const CATEGORIES = CATEGORY_KEYS.map(c => ({ value: c.value, label: t(c.key) }));
  const SCORE_LABELS = {
    1: t('risk_score_very_low'),
    2: t('risk_score_low'),
    3: t('risk_score_medium'),
    4: t('risk_score_high'),
    5: t('risk_score_very_high'),
  };
  const isCustomCategory = form.category && !PREDEFINED_VALUES.includes(form.category);
  const [showCustom, setShowCustom] = useState(isCustomCategory);

  useEffect(() => {
    setShowCustom(form.category && !PREDEFINED_VALUES.includes(form.category));
  }, [form.category]);

  const handleCategoryChange = (v) => {
    if (v === '__custom__') {
      setShowCustom(true);
      set('category', '');
    } else {
      setShowCustom(false);
      set('category', v);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4 pb-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label>{t('risk_form_risk_id')}</Label>
          <Input value={form.risk_id} onChange={e => set('risk_id', e.target.value)} placeholder={t('risk_form_risk_id_placeholder')} />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>{t('risk_form_title')}</Label>
          <Input value={form.title} onChange={e => set('title', e.target.value)} required placeholder={t('risk_form_title_placeholder')} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>{t('risk_form_description')}</Label>
        <Textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} placeholder={t('risk_form_description_placeholder')} />
      </div>

      <div className="grid grid-cols-2 gap-4">
      <div className="space-y-1.5">
        <Label>{t('risk_form_category')}</Label>
        <Select
          value={showCustom ? '__custom__' : (form.category || '')}
          onValueChange={handleCategoryChange}
        >
          <SelectTrigger><SelectValue placeholder={t('risk_form_category_placeholder')} /></SelectTrigger>
          <SelectContent>
            {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            <SelectItem value="__custom__">{t('risk_form_category_custom')}</SelectItem>
          </SelectContent>
        </Select>
        {showCustom && (
          <Input
            autoFocus
            value={form.category || ''}
            onChange={e => set('category', e.target.value)}
            placeholder={t('risk_form_category_custom_placeholder')}
            className="mt-1.5"
          />
        )}
      </div>
        <div className="space-y-1.5">
          <Label>{t('risk_form_status')}</Label>
          <Select value={form.status} onValueChange={v => set('status', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="open">{t('risk_status_open')}</SelectItem>
              <SelectItem value="in_treatment">{t('risk_status_in_treatment')}</SelectItem>
              <SelectItem value="accepted">{t('risk_status_accepted')}</SelectItem>
              <SelectItem value="closed">{t('risk_status_closed')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <ScoreSelector label={t('risk_form_impact')} value={form.impact} onChange={v => set('impact', v)} scoreLabels={SCORE_LABELS} />
      <ScoreSelector label={t('risk_form_likelihood')} value={form.likelihood} onChange={v => set('likelihood', v)} scoreLabels={SCORE_LABELS} />

      <ResidualRiskGauge impact={form.impact} likelihood={form.likelihood} />

      {isAdmin && customers?.length > 0 && (
        <div className="space-y-1.5">
          <Label>{t('risk_form_customer')}</Label>
          <Select value={form.customer_id || ''} onValueChange={v => set('customer_id', v)}>
            <SelectTrigger><SelectValue placeholder={t('risk_form_customer_global')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>{t('risk_form_customer_global')}</SelectItem>
              {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>{t('risk_form_owner_email')}</Label>
          <UserSelect
            value={form.owner_email}
            onChange={v => set('owner_email', v)}
            users={customerUsers}
            placeholder={t('risk_form_owner_email_placeholder')}
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t('risk_form_due_date')}</Label>
          <Input value={form.due_date} onChange={e => set('due_date', e.target.value)} type="date" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>{t('risk_form_treatment_notes')}</Label>
        <Textarea value={form.treatment_notes} onChange={e => set('treatment_notes', e.target.value)} rows={2} placeholder={t('risk_form_treatment_notes_placeholder')} />
      </div>

      {availableDocs.length > 0 && (
        <div className="space-y-1.5">
          <Label>{t('risk_form_linked_docs')}</Label>
          <div className="border rounded-lg p-2 max-h-36 overflow-y-auto space-y-1">
            {availableDocs.map(doc => {
              const linked = form.linked_document_ids?.includes(doc.id);
              return (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => toggleDoc(doc.id)}
                  className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center gap-2 transition-colors ${
                    linked ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${linked ? 'bg-primary' : 'bg-muted-foreground'}`} />
                  {doc.title}
                  <Badge variant="secondary" className="ml-auto text-xs capitalize">{doc.level}</Badge>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>{t('risk_form_cancel')}</Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          {isEdit ? t('risk_form_save') : t('risk_form_create')}
        </Button>
      </DialogFooter>
    </form>
  );
}