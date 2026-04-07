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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import TaskFormDialog from '@/components/tasks/TaskFormDialog';
import AIRecommendationDialog from '@/components/recommendations/AIRecommendationDialog';
import { toast } from 'sonner';

const priorityColors = {
  critical: 'bg-destructive/10 text-destructive border-destructive/20',
  high: 'bg-chart-4/10 text-chart-4 border-chart-4/20',
  medium: 'bg-chart-3/10 text-chart-3 border-chart-3/20',
  low: 'bg-muted text-muted-foreground',
};

const statusOptions = ['pending', 'in_progress', 'completed', 'dismissed'];

export default function Recommendations() {
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterFramework, setFilterFramework] = useState('all');
  const [taskDialog, setTaskDialog] = useState(false);
  const [prefillTask, setPrefillTask] = useState(null);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [newRecDialog, setNewRecDialog] = useState(false);
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

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Recommendation.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recommendations'] }),
  });

  const createTaskMutation = useMutation({
    mutationFn: (taskData) => base44.entities.Task.create(taskData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task created from recommendation');
    },
  });

  const createRecMutation = useMutation({
    mutationFn: (data) => base44.entities.Recommendation.create({
      ...data,
      customer_id: customerId || data.customer_id,
      status: 'pending',
    }),
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
      toast.success('Recommendation created');
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
      toast.success('No duplicates found — your recommendations are clean!');
    } else {
      toast.info(`Found ${duplicates.length} potential duplicate${duplicates.length !== 1 ? 's' : ''}`);
    }
  };

  const frameworks = [...new Set(recommendations.map(r => r.framework_code).filter(Boolean))].sort();
  const [collapsedFrameworks, setCollapsedFrameworks] = useState({});
  const toggleFramework = (fw) => setCollapsedFrameworks(prev => ({ ...prev, [fw]: !prev[fw] }));

  const filtered = recommendations.filter(r => {
    if (filterPriority !== 'all' && r.priority !== filterPriority) return false;
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    if (filterFramework !== 'all' && r.framework_code !== filterFramework) return false;
    return true;
  });

  const groupedByFramework = {};
  filtered.forEach(r => {
    const key = r.framework_code || 'General';
    if (!groupedByFramework[key]) groupedByFramework[key] = [];
    groupedByFramework[key].push(r);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">AI-generated improvement recommendations · <span className="text-foreground font-medium">{recommendations.length}</span> total</p>
        <div className="flex gap-2 items-center">
          <Button onClick={handleCheckDuplicates} variant="outline" disabled={isCheckingDuplicates} className="gap-2">
            {isCheckingDuplicates ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            Check Duplicates
          </Button>
          <Button onClick={() => setAiDialogOpen(true)} variant="outline" className="gap-2">
            <Sparkles className="w-4 h-4" />
            AI Generate
          </Button>
          <Button onClick={() => setNewRecDialog(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            New Recommendation
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {statusOptions.map(s => (
              <SelectItem key={s} value={s} className="capitalize">{s.replace('_', ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterFramework} onValueChange={setFilterFramework}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All Frameworks" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Frameworks</SelectItem>
            {frameworks.map(fw => (
              <SelectItem key={fw} value={fw}>{fw.replace(/_/g, ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground ml-auto">{filtered.length} recommendations</span>
      </div>

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
              <Card key={rec.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Badge variant="outline" className={cn("text-xs border", priorityColors[rec.priority])}>
                          {rec.priority}
                        </Badge>
                        {rec.domain && <span className="text-xs text-muted-foreground">{rec.domain}</span>}
                        {rec.effort && (
                          <span className="text-xs text-muted-foreground">Effort: {rec.effort}</span>
                        )}
                      </div>
                      <p className="text-sm font-medium">{rec.title}</p>
                      <p className="text-sm text-muted-foreground mt-1">{rec.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs"
                        onClick={() => handleConvertToTask(rec)}
                      >
                        <ListTodo className="w-3.5 h-3.5" />
                        Create Task
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
                            <SelectItem key={s} value={s} className="capitalize text-xs">{s.replace('_', ' ')}</SelectItem>
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
          toast.success(`${recs.length} recommendation${recs.length !== 1 ? 's' : ''} added`);
        }}
      />

      <Dialog open={newRecDialog} onOpenChange={setNewRecDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Recommendation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input
                value={newRecForm.title}
                onChange={e => setNewRecForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Recommendation title"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label>Description *</Label>
              <Textarea
                value={newRecForm.description}
                onChange={e => setNewRecForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Detailed description"
                rows={3}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={newRecForm.priority} onValueChange={v => setNewRecForm(prev => ({ ...prev, priority: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Framework</Label>
                <Select value={newRecForm.framework_code} onValueChange={v => setNewRecForm(prev => ({ ...prev, framework_code: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
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
                <Label>Effort</Label>
                <Select value={newRecForm.effort} onValueChange={v => setNewRecForm(prev => ({ ...prev, effort: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Timeline</Label>
                <Select value={newRecForm.timeline} onValueChange={v => setNewRecForm(prev => ({ ...prev, timeline: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="immediate">Immediate</SelectItem>
                    <SelectItem value="short_term">Short Term</SelectItem>
                    <SelectItem value="medium_term">Medium Term</SelectItem>
                    <SelectItem value="long_term">Long Term</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Domain</Label>
                <Input
                  value={newRecForm.domain}
                  onChange={e => setNewRecForm(prev => ({ ...prev, domain: e.target.value }))}
                  placeholder="e.g. Access Control"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Control ID</Label>
                <Input
                  value={newRecForm.control_id}
                  onChange={e => setNewRecForm(prev => ({ ...prev, control_id: e.target.value }))}
                  placeholder="e.g. A.5.1"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNewRecDialog(false)}>Cancel</Button>
            <Button onClick={() => createRecMutation.mutate(newRecForm)} disabled={createRecMutation.isPending || !newRecForm.title || !newRecForm.description}>
              {createRecMutation.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {filtered.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Lightbulb className="w-8 h-8 mb-3 opacity-50" />
            <p className="text-sm">No recommendations yet. Complete an assessment to generate recommendations.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}