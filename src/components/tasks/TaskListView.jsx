import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Pencil, Trash2, ArrowRight, CalendarDays, User } from 'lucide-react';
import { format, isPast, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

const PRIORITY_STYLES = {
  critical: 'bg-destructive/10 text-destructive border-destructive/20',
  high: 'bg-chart-4/10 text-chart-4 border-chart-4/20',
  medium: 'bg-chart-3/10 text-chart-3 border-chart-3/20',
  low: 'bg-muted text-muted-foreground',
};

const STATUS_STYLES = {
  todo: 'bg-muted text-muted-foreground',
  in_progress: 'bg-chart-4/10 text-chart-4 border-chart-4/20',
  done: 'bg-chart-2/10 text-chart-2 border-chart-2/20',
  blocked: 'bg-destructive/10 text-destructive border-destructive/20',
};

const STATUS_LABELS = { todo: 'To-Do', in_progress: 'In Progress', done: 'Done', blocked: 'Blocked' };

const STATUS_TRANSITIONS = {
  todo: { next: 'in_progress', label: 'Move to In Progress' },
  in_progress: { next: 'done', label: 'Mark as Done' },
  done: { next: 'todo', label: 'Reopen' },
  blocked: { next: 'in_progress', label: 'Unblock' },
};

export default function TaskListView({ tasks, onStatusChange, onEdit, onDelete, selectionEnabled, selectedIds, onToggleSelect, onToggleSelectAll }) {
  if (tasks.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground text-sm">
          No tasks found.
        </CardContent>
      </Card>
    );
  }

  const allSelected = selectionEnabled && tasks.length > 0 && tasks.every(t => selectedIds.has(t.id));
  const someSelected = selectionEnabled && tasks.some(t => selectedIds.has(t.id));

  return (
    <Card>
      <CardContent className="p-0">
        {selectionEnabled && (
          <div className="flex items-center gap-4 px-4 py-2 border-b bg-muted/30">
            <Checkbox
              checked={allSelected ? true : (someSelected ? 'indeterminate' : false)}
              onCheckedChange={() => onToggleSelectAll(tasks)}
            />
            <span className="text-xs font-medium text-muted-foreground">
              {allSelected ? 'All selected' : 'Select all'}
            </span>
          </div>
        )}
        <div className="divide-y">
          {tasks.map(task => {
            const isOverdue = task.due_date && task.status !== 'done' && isPast(parseISO(task.due_date));
            const transition = STATUS_TRANSITIONS[task.status];
            const isSelected = selectionEnabled && selectedIds.has(task.id);
            return (
              <div key={task.id} className={cn("flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors", isSelected && "bg-primary/5")}>
                {selectionEnabled && (
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onToggleSelect(task.id)}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{task.title}</p>
                  {task.description && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{task.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant="outline" className={cn('text-xs hidden sm:inline-flex', PRIORITY_STYLES[task.priority])}>
                    {task.priority}
                  </Badge>
                  <Badge variant="outline" className={cn('text-xs', STATUS_STYLES[task.status])}>
                    {STATUS_LABELS[task.status]}
                  </Badge>
                  {task.assigned_to && (
                    <div className="hidden md:flex items-center gap-1 text-xs text-muted-foreground">
                      <User className="w-3 h-3" />
                      <span className="max-w-[120px] truncate">{task.assigned_to}</span>
                    </div>
                  )}
                  {task.due_date && (
                    <div className={cn('hidden md:flex items-center gap-1 text-xs', isOverdue ? 'text-destructive' : 'text-muted-foreground')}>
                      <CalendarDays className="w-3 h-3" />
                      <span>{format(parseISO(task.due_date), 'MMM d')}</span>
                    </div>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onStatusChange(task.id, transition.next, task.title)}>
                        <ArrowRight className="w-4 h-4 mr-2" />{transition.label}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => onEdit(task)}>
                        <Pencil className="w-4 h-4 mr-2" />Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onDelete(task)} className="text-destructive">
                        <Trash2 className="w-4 h-4 mr-2" />Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}