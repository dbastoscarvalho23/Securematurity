import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import TaskCard from './TaskCard';

const COLUMNS = [
  { id: 'todo',        label: 'To-Do',       color: 'text-muted-foreground', dot: 'bg-muted-foreground', bg: 'bg-muted/30' },
  { id: 'in_progress', label: 'In Progress',  color: 'text-chart-4',          dot: 'bg-chart-4',          bg: 'bg-chart-4/5' },
  { id: 'blocked',     label: 'Blocked',      color: 'text-destructive',      dot: 'bg-destructive',      bg: 'bg-destructive/5' },
  { id: 'done',        label: 'Done',         color: 'text-chart-2',          dot: 'bg-chart-2',          bg: 'bg-chart-2/5' },
];

export default function TaskBoard({ tasks, onStatusChange, onEdit, onDelete }) {
  const [draggingOver, setDraggingOver] = useState(null);

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
        {COLUMNS.map(col => {
          const colTasks = tasks.filter(t => t.status === col.id);
          const isOver = draggingOver === col.id;
          return (
            <div key={col.id} className="flex flex-col gap-3">
              {/* Column header */}
              <div className="flex items-center gap-2 px-1">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${col.dot}`} />
                <h3 className={`text-sm font-semibold ${col.color}`}>{col.label}</h3>
                <Badge variant="secondary" className="ml-auto text-xs">{colTasks.length}</Badge>
              </div>

              {/* Drop zone */}
              <Droppable droppableId={col.id}>
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex flex-col gap-3 min-h-[160px] rounded-xl p-2 border-2 transition-colors ${
                      isOver
                        ? 'border-primary/40 bg-primary/5'
                        : `border-transparent ${col.bg}`
                    }`}
                  >
                    {colTasks.map((task, index) => (
                      <Draggable key={task.id} draggableId={task.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`transition-shadow ${snapshot.isDragging ? 'shadow-lg rotate-1 opacity-90' : ''}`}
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
                        <p className="text-xs text-muted-foreground">Drop tasks here</p>
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