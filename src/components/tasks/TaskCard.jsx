import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Pencil, Trash2, ArrowRight, CalendarDays, User, Paperclip } from 'lucide-react';
import { format, isPast, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/LanguageContext';

const PRIORITY_STYLES = {
  critical: 'bg-destructive/10 text-destructive border-destructive/20',
  high: 'bg-chart-4/10 text-chart-4 border-chart-4/20',
  medium: 'bg-chart-3/10 text-chart-3 border-chart-3/20',
  low: 'bg-muted text-muted-foreground',
};

const STATUS_TRANSITIONS = {
  todo:        { next: 'in_progress', labelKey: 'tasks_move_to_in_progress' },
  in_progress: { next: 'done',        labelKey: 'tasks_mark_done' },
  blocked:     { next: 'in_progress', labelKey: 'tasks_unblock' },
  done:        { next: 'todo',        labelKey: 'tasks_reopen' },
};

export default function TaskCard({ task, onStatusChange, onEdit, onDelete }) {
  const { t } = useLanguage();
  const transition = STATUS_TRANSITIONS[task.status];
  const isOverdue = task.due_date && task.status !== 'done' && isPast(parseISO(task.due_date));

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className="text-sm font-medium leading-snug flex-1">{task.title}</p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onStatusChange(task.id, transition.next, task.title)}>
                <ArrowRight className="w-4 h-4 mr-2" />
                {t(transition.labelKey)}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onEdit(task)}>
                <Pencil className="w-4 h-4 mr-2" />
                {t('common_edit')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDelete(task)} className="text-destructive">
                <Trash2 className="w-4 h-4 mr-2" />
                {t('common_delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-3">
          <Badge variant="outline" className={cn('text-xs', PRIORITY_STYLES[task.priority])}>
            {task.priority}
          </Badge>
          {task.framework_code && (
            <Badge variant="outline" className="text-xs font-mono">{task.framework_code}</Badge>
          )}
        </div>

        {task.description && (
          <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{task.description}</p>
        )}

        <div className="space-y-1">
          {task.assigned_to && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <User className="w-3 h-3" />
              <span className="truncate">{task.assigned_to}</span>
            </div>
          )}
          {task.due_date && (
            <div className={cn('flex items-center gap-1.5 text-xs', isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground')}>
              <CalendarDays className="w-3 h-3" />
              <span>{isOverdue ? `${t('tasks_overdue')} · ` : ''}{format(parseISO(task.due_date), 'MMM d, yyyy')}</span>
            </div>
          )}
        </div>

        {(task.customer_name || task.attachments?.length > 0) && (
          <div className="flex items-center justify-between mt-2 pt-2 border-t gap-2">
            {task.customer_name && <p className="text-xs text-muted-foreground truncate">{task.customer_name}</p>}
            {task.attachments?.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground ml-auto flex-shrink-0">
                <Paperclip className="w-3 h-3" />
                <span>{task.attachments.length}</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}