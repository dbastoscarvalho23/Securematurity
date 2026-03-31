import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Lightbulb, Filter, ListTodo, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  const queryClient = useQueryClient();

  const { data: recommendations = [] } = useQuery({
    queryKey: ['recommendations'],
    queryFn: () => base44.entities.Recommendation.list('-created_date', 200),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
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

  const frameworks = [...new Set(recommendations.map(r => r.framework_code).filter(Boolean))].sort();

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
        <Button onClick={() => setAiDialogOpen(true)} variant="outline" className="gap-2">
          <Sparkles className="w-4 h-4" />
          AI Generate
        </Button>
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
          <h2 className="text-lg font-semibold mb-3">{fw.replace('_', ' ')}</h2>
          <div className="space-y-3">
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
          </div>
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