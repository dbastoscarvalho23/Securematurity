import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import TaskCard from './TaskCard';

const COLUMNS = [
  { id: 'todo', label: 'To-Do', color: 'text-muted-foreground', dot: 'bg-muted-foreground' },
  { id: 'in_progress', label: 'In Progress', color: 'text-chart-4', dot: 'bg-chart-4' },
  { id: 'done', label: 'Done', color: 'text-chart-2', dot: 'bg-chart-2' },
];

export default function TaskBoard({ tasks, onStatusChange, onEdit, onDelete }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {COLUMNS.map(col => {
        const colTasks = tasks.filter(t => t.status === col.id);
        return (
          <div key={col.id} className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <span className={`w-2 h-2 rounded-full ${col.dot}`} />
              <h3 className={`text-sm font-semibold ${col.color}`}>{col.label}</h3>
              <Badge variant="secondary" className="ml-auto text-xs">{colTasks.length}</Badge>
            </div>
            <div className="space-y-3 min-h-[120px]">
              {colTasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onStatusChange={onStatusChange}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
              {colTasks.length === 0 && (
                <div className="border-2 border-dashed border-border rounded-lg h-20 flex items-center justify-center">
                  <p className="text-xs text-muted-foreground">No tasks</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}