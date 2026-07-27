import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useLanguage } from '@/lib/LanguageContext';
import { cn } from '@/lib/utils';
import TaskCard from './TaskCard';

const COLUMN_CONFIG = [
  { id: 'todo',        i18nKey: 'tasks_status_todo',       color: 'text-muted-foreground', dot: 'bg-muted-foreground', bg: 'bg-muted/30', bar: 'bg-muted-foreground' },
  { id: 'in_progress', i18nKey: 'tasks_status_in_progress', color: 'text-chart-4',          dot: 'bg-chart-4',          bg: 'bg-chart-4/5', bar: 'bg-chart-4' },
  { id: 'blocked',     i18nKey: 'tasks_status_blocked',     color: 'text-destructive',      dot: 'bg-destructive',      bg: 'bg-destructive/5', bar: 'bg-destructive' },
  { id: 'done',        i18nKey: 'tasks_status_done',        color: 'text-chart-2',          dot: 'bg-chart-2',          bg: 'bg-chart-2/5', bar: 'bg-chart-2' },
];

export default function TaskBoard({ tasks, onStatusChange, onEdit, onDelete }) {
  const { t } = useLanguage();
  const [draggingOver, setDraggingOver] = useState(null);
  const total = tasks.length;

  const handleDragEnd = (result) => {
    setDraggingOver(null);
    if (!result.destination) return;
    const newStatus = result.destination.droppableId;
    const taskId = result.draggableId;
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.status === newStatus) return;
    onStatusChange(taskId, newStatus, task.title);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd} onDragUpdate={(u) => setDraggingOver(u.destination?.droppableId || null)}>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {COLUMN_CONFIG.map(col => {
          const colTasks = tasks.filter(t => t.status === col.id);
          const isOver = draggingOver === col.id;
          const pct = total > 0 ? Math.round((colTasks.length / total) * 100) : 0;
          return (
            <div key={col.id} className="flex flex-col gap-3">
              {/* Column header */}
              <div className="flex flex-col gap-1.5 px-1">
                <div className="flex items-center gap-2">
                  <span className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', col.dot)} />
                  <h3 className={cn('text-sm font-semibold', col.color)}>{t(col.i18nKey)}</h3>
                  <Badge variant="secondary" className="ml-auto text-xs">{colTasks.length}</Badge>
                </div>
                {/* Progress bar */}
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div className={cn('h-full rounded-full transition-all', col.bar)} style={{ width: `${pct}%` }} />
                </div>
              </div>

              {/* Drop zone */}
              <Droppable droppableId={col.id}>
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      'flex flex-col gap-3 min-h-[200px] rounded-xl p-2 border-2 transition-colors flex-1',
                      isOver
                        ? 'border-primary/40 bg-primary/5'
                        : `border-transparent ${col.bg}`
                    )}
                  >
                    {colTasks.map((task, index) => (
                      <Draggable key={task.id} draggableId={task.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={cn('transition-shadow', snapshot.isDragging && 'shadow-lg rotate-1 opacity-90')}
                          >
                            <TaskCard
                              task={task}
                              onStatusChange={onStatusChange}
                              onEdit={onEdit}
                              onDelete={onDelete}
                            />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    {colTasks.length === 0 && !isOver && (
                      <div className="flex-1 flex items-center justify-center h-20">
                        <p className="text-xs text-muted-foreground">{t('tasks_drop_here')}</p>
                      </div>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
}