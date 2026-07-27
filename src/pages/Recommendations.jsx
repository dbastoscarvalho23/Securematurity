import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Lightbulb, Filter, ListTodo, Sparkles, ShieldCheck, Loader2, Plus, ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import TaskFormDialog from '@/components/tasks/TaskFormDialog';
import AIRecommendationDialog from '@/components/recommendations/AIRecommendationDialog';
import BulkActionBar from '@/components/shared/BulkActionBar';
import { toast } from 'sonner';
import { writeAuditLog } from '@/lib/auditLog';
import { useLanguage } from '@/lib/LanguageContext';

const priorityColors = {
  critical: 'bg-destructive/10 text-destructive border-destructive/20',
  high: 'bg-chart-4/10 text-chart-4 border-chart-4/20',
  medium: 'bg-chart-3/10 text-chart-3 border-chart-3/20',
  low: 'bg-muted text-muted-foreground',
};

const statusOptions = ['pending', 'in_progress', 'completed', 'dismissed'];

export default function Recommendations() {
  const { t } = useLanguage();
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterFramework, setFilterFramework] = useState('all');
  const [taskDialog, setTaskDialog] = useState(false);
  const [prefillTask, setPrefillTask] = useState(null);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [newRecDialog, setNewRecDialog] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [isBulkAction, setIsBulkAction] = useState(false);
  const [newRecForm, setNewRecForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    framework_code: '',
    domain: '',
    control_id: '',
    effort: 'medium',
    timeline: 'short_term',
    current_level: 0,
    target_level: 4,
  });
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const customerId = user?.customer_id;

  const { data: recommendations = [] } = useQuery({
    queryKey: ['recommendations', customerId],
    queryFn: () => isAdmin
      ? base44.entities.Recommendation.list('-created_date', 200)
      : base44.entities.Recommendation.filter({ customer_id: customerId }, '-created_date', 200),
    enabled: isAdmin || !!customerId,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
    enabled: isAdmin,
  });

  const { data: activeFrameworks = [] } = useQuery({
    queryKey: ['frameworks-active'],
    queryFn: () => base44.entities.Framework.filter({ status: 'active' }),
  });

  const activeFrameworkCodes = new Set(activeFrameworks.map(fw => fw.code));

  const updateMutation = useMutation({
    mutationFn: async ({ id, data, title }) => {
      await base44.entities.Recommendation.update(id, data);
      await writeAuditLog({ action: 'recommendation_updated', entity_type: 'Recommendation', entity_id: id, details: `Updated recommendation${title ? `: ${title}` : ''}${data.status ? ` → status: ${data.status}` : ''}` });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recommendations'] }),
  });

  const createTaskMutation = useMutation({
    mutationFn: async (taskData) => {
      const result = await base44.entities.Task.create(taskData);
      await writeAuditLog({ action: 'task_created', entity_type: 'Task', entity_id: result?.id, details: `Task created from recommendation: ${taskData.title}` });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success(t('recs_task_created'));
    },
  });

  const createRecMutation = useMutation({
    mutationFn: async (data) => {
      const result = await base44.entities.Recommendation.create({
        ...data,
        customer_id: customerId || data.customer_id,
        status: 'pending',
      });
      await writeAuditLog({ action: 'recommendation_created', entity_type: 'Recommendation', entity_id: result?.id, details: `Created recommendation: ${data.title}` });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recommendations'] });
      setNewRecDialog(false);
      setNewRecForm({
        title: '',
        description: '',
        priority: 'medium',
        framework_code: '',
        domain: '',
        control_id: '',
        effort: 'medium',
        timeline: 'short_term',
        current_level: 0,
        target_level: 4,
      });
      toast.success(t('recs_created'));
    },
  });

  const handleConvertToTask = (rec) => {
    setPrefillTask({
      title: rec.title,
      description: rec.description,
      priority: rec.priority,
      framework_code: rec.framework_code,
      domain: rec.domain,
      recommendation_id: rec.id,
      assessment_id: rec.assessment_id,
      customer_id: rec.customer_id,
      status: 'todo',
    });
    setTaskDialog(true);
  };

  const handleCheckDuplicates = async () => {
    setIsCheckingDuplicates(true);
    const normalize = (str) => str?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
    const seen = new Set();
    const duplicates = [];

    recommendations.forEach(rec => {
      const key = normalize(rec.title);
      if (seen.has(key)) {
        duplicates.push(rec.id);
      } else {
        seen.add(key);
      }
    });

    setIsCheckingDuplicates(false);

    if (duplicates.length === 0) {
      toast.success(t('recs_no_dupes'));
    } else {
      toast.info(`${duplicates.length} ${duplicates.length !== 1 ? t('recs_dupes_found_plural') : t('recs_dupes_found')}`);
    }
  };

  const frameworks = [...new Set(recommendations.map(r => r.framework_code).filter(Boolean))]
    .filter(fw => activeFrameworkCodes.has(fw))
    .sort();
  const [collapsedFrameworks, setCollapsedFrameworks] = useState({});
  const toggleFramework = (fw) => setCollapsedFrameworks(prev => ({ ...prev, [fw]: !prev[fw] }));

  const filtered = recommendations.filter(r => {
    if (filterPriority !== 'all' && r.priority !== filterPriority) return false;
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    if (filterFramework !== 'all' && r.framework_code !== filterFramework) return false;
    // Hide recommendations for inactive frameworks (unless no framework_code set)
    if (r.framework_code && activeFrameworks.length > 0 && !activeFrameworkCodes.has(r.framework_code)) return false;
    return true;
  });

  const groupedByFramework = {};
  filtered.forEach(r => {
    const key = r.framework_code || 'General';
    if (!groupedByFramework[key]) groupedByFramework[key] = [];
    groupedByFramework[key].push(r);
  });

  const toggleSelect = (id) =>
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const allFilteredSelected = filtered.length > 0 && selectedIds.length === filtered.length;
  const toggleSelectAll = () =>
    setSelectedIds(allFilteredSelected ? [] : filtered.map(r => r.id));

  const handleBulkStatus = async (status) => {
    setIsBulkAction(true);
    try {
      await base44.entities.Recommendation.bulkUpdate(
        selectedIds.map(id => ({ id, status }))
      );
      await writeAuditLog({ action: 'recommendation_updated', entity_type: 'Recommendation', details: `Bulk updated ${selectedIds.length} recommendations → status: ${status}` });
      toast.success(`${selectedIds.length} ${t('bulk_updated')}`);
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ['recommendations'] });
    } catch {
      toast.error(t('bulk_error'));
    }
    setIsBulkAction(false);
  };

  const handleBulkConvertToTasks = async () => {
    setIsBulkAction(true);
    try {
      const selected = filtered.filter(r => selectedIds.includes(r.id));
      const tasks = selected.map(rec => ({
        title: rec.title,
        description: rec.description,
        priority: rec.priority,
        framework_code: rec.framework_code,
        domain: rec.domain,
        recommendation_id: rec.id,
        assessment_id: rec.assessment_id,
        customer_id: rec.customer_id,
        status: 'todo',
      }));
      const results = await base44.entities.Task.bulkCreate(tasks);
      await writeAuditLog({ action: 'task_created', entity_type: 'Task', details: `Bulk created ${results.length} tasks from recommendations` });
      // Mark recommendations as in_progress
      await base44.entities.Recommendation.bulkUpdate(
        selected.map(rec => ({ id: rec.id, status: 'in_progress' }))
      );
      toast.success(`${results.length} ${t('bulk_tasks_created')}`);
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['recommendations'] });
    } catch {
      toast.error(t('bulk_error'));
    }
    setIsBulkAction(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">{t('recs_subtitle')} · <span className="text-foreground font-medium">{recommendations.length}</span> {t('recs_count')}</p>
        <div className="flex gap-2 items-center">
          <Button onClick={handleCheckDuplicates} variant="outline" disabled={isCheckingDuplicates} className="gap-2">
            {isCheckingDuplicates ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            {t('recs_check_duplicates')}
          </Button>
          <Button onClick={() => setAiDialogOpen(true)} variant="outline" className="gap-2">
            <Sparkles className="w-4 h-4" />
            {t('recs_ai_generate')}
          </Button>
          <Button onClick={() => setNewRecDialog(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            {t('recs_new')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('recs_all_priorities')}</SelectItem>
            <SelectItem value="critical">{t('tasks_priority_critical')}</SelectItem>
            <SelectItem value="high">{t('tasks_priority_high')}</SelectItem>
            <SelectItem value="medium">{t('tasks_priority_medium')}</SelectItem>
            <SelectItem value="low">{t('tasks_priority_low')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('recs_all_statuses')}</SelectItem>
            {statusOptions.map(s => (
              <SelectItem key={s} value={s} className="capitalize">{t(`recs_status_${s}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterFramework} onValueChange={setFilterFramework}>
          <SelectTrigger className="w-40"><SelectValue placeholder={t('recs_all_frameworks')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('recs_all_frameworks')}</SelectItem>
            {frameworks.map(fw => (
              <SelectItem key={fw} value={fw}>{fw.replace(/_/g, ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 ml-auto">
          <Checkbox
            checked={allFilteredSelected}
            onCheckedChange={toggleSelectAll}
            aria-label={t('bulk_select_all')}
          />
          <span className="text-sm text-muted-foreground">{t('bulk_select_all')}</span>
          <span className="text-sm text-muted-foreground">{filtered.length} {t('recs_count')}</span>
        </div>
      </div>

      <BulkActionBar
        selectedCount={selectedIds.length}
        statusOptions={statusOptions.map(s => ({ value: s, labelKey: `recs_status_${s}` }))}
        statusLabelKey="bulk_set_status"
        onBulkStatus={handleBulkStatus}
        onBulkConvert={handleBulkConvertToTasks}
        onClear={() => setSelectedIds([])}
        isProcessing={isBulkAction}
      />

      {/* Recommendations by Framework */}
      {Object.entries(groupedByFramework).map(([fw, recs]) => (
        <div key={fw}>
          <button
            onClick={() => toggleFramework(fw)}
            className="flex items-center gap-2 mb-3 hover:opacity-70 transition-opacity w-full text-left"
          >
            {collapsedFrameworks[fw] ? <ChevronRight className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            <h2 className="text-lg font-semibold">{fw.replace('_', ' ')}</h2>
            <Badge variant="secondary" className="text-xs">{recs.length}</Badge>
          </button>
          {!collapsedFrameworks[fw] && <div className="space-y-3">
            {recs.map(rec => (
              <Card key={rec.id} className={cn("hover:shadow-sm transition-shadow", selectedIds.includes(rec.id) && "ring-1 ring-primary/40")}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <Checkbox
                        checked={selectedIds.includes(rec.id)}
                        onCheckedChange={() => toggleSelect(rec.id)}
                        aria-label="select"
                        className="mt-0.5"
                      />
                      <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Badge variant="outline" className={cn("text-xs border", priorityColors[rec.priority])}>
                          {rec.priority}
                        </Badge>
                        {rec.domain && <span className="text-xs text-muted-foreground">{rec.domain}</span>}
                        {rec.effort && (
                          <span className="text-xs text-muted-foreground">{t('recs_effort')}: {rec.effort}</span>
                        )}
                      </div>
                      <p className="text-sm font-medium">{rec.title}</p>
                      <p className="text-sm text-muted-foreground mt-1">{rec.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs"
                        onClick={() => handleConvertToTask(rec)}
                      >
                        <ListTodo className="w-3.5 h-3.5" />
                        {t('recs_create_task')}
                      </Button>
                      <Select
                        value={rec.status}
                        onValueChange={(v) => updateMutation.mutate({ id: rec.id, data: { status: v } })}
                      >
                        <SelectTrigger className="w-32 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statusOptions.map(s => (
                            <SelectItem key={s} value={s} className="capitalize text-xs">{t(`recs_status_${s}`)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>}
        </div>
      ))}

      <TaskFormDialog
        open={taskDialog}
        onOpenChange={setTaskDialog}
        task={prefillTask}
        onSave={(form) => createTaskMutation.mutateAsync(form)}
      />

      <AIRecommendationDialog
        open={aiDialogOpen}
        onOpenChange={setAiDialogOpen}
        customers={customers}
        onSave={async (recs) => {
          await base44.entities.Recommendation.bulkCreate(recs);
          queryClient.invalidateQueries({ queryKey: ['recommendations'] });
          toast.success(`${recs.length} ${t('recs_added')}`);
        }}
      />

      <Dialog open={newRecDialog} onOpenChange={setNewRecDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('recs_dialog_title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t('recs_title_label')} *</Label>
              <Input
                value={newRecForm.title}
                onChange={e => setNewRecForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder={t('recs_title_placeholder')}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t('recs_desc_label')} *</Label>
              <Textarea
                value={newRecForm.description}
                onChange={e => setNewRecForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder={t('recs_desc_placeholder')}
                rows={3}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t('recs_priority_label')}</Label>
                <Select value={newRecForm.priority} onValueChange={v => setNewRecForm(prev => ({ ...prev, priority: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critical">{t('tasks_priority_critical')}</SelectItem>
                    <SelectItem value="high">{t('tasks_priority_high')}</SelectItem>
                    <SelectItem value="medium">{t('tasks_priority_medium')}</SelectItem>
                    <SelectItem value="low">{t('tasks_priority_low')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>{t('recs_framework_label')}</Label>
                <Select value={newRecForm.framework_code} onValueChange={v => setNewRecForm(prev => ({ ...prev, framework_code: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('recs_select_placeholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {frameworks.map(fw => (
                      <SelectItem key={fw} value={fw}>{fw}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t('recs_effort_label')}</Label>
                <Select value={newRecForm.effort} onValueChange={v => setNewRecForm(prev => ({ ...prev, effort: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">{t('recs_effort_low')}</SelectItem>
                    <SelectItem value="medium">{t('recs_effort_medium')}</SelectItem>
                    <SelectItem value="high">{t('recs_effort_high')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>{t('recs_timeline_label')}</Label>
                <Select value={newRecForm.timeline} onValueChange={v => setNewRecForm(prev => ({ ...prev, timeline: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="immediate">{t('recs_timeline_immediate')}</SelectItem>
                    <SelectItem value="short_term">{t('recs_timeline_short')}</SelectItem>
                    <SelectItem value="medium_term">{t('recs_timeline_medium')}</SelectItem>
                    <SelectItem value="long_term">{t('recs_timeline_long')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t('recs_domain_label')}</Label>
                <Input
                  value={newRecForm.domain}
                  onChange={e => setNewRecForm(prev => ({ ...prev, domain: e.target.value }))}
                  placeholder={t('recs_domain_placeholder')}
                />
              </div>

              <div className="space-y-1.5">
                <Label>{t('recs_control_label')}</Label>
                <Input
                  value={newRecForm.control_id}
                  onChange={e => setNewRecForm(prev => ({ ...prev, control_id: e.target.value }))}
                  placeholder={t('recs_control_placeholder')}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNewRecDialog(false)}>{t('common_cancel')}</Button>
            <Button onClick={() => createRecMutation.mutate(newRecForm)} disabled={createRecMutation.isPending || !newRecForm.title || !newRecForm.description}>
              {createRecMutation.isPending ? t('recs_creating') : t('recs_create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {filtered.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Lightbulb className="w-8 h-8 mb-3 opacity-50" />
            <p className="text-sm">{t('recs_empty')}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}