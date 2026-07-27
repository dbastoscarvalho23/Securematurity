import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  isSameDay, isSameMonth, isToday, addMonths, addWeeks, addDays, format, parseISO, isPast,
} from 'date-fns';
import { pt, enUS } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/LanguageContext';

const PRIORITY_DOT = {
  critical: 'bg-destructive',
  high: 'bg-chart-4',
  medium: 'bg-chart-3',
  low: 'bg-chart-2',
};
const PRIORITY_TEXT = {
  critical: 'text-destructive',
  high: 'text-chart-4',
  medium: 'text-chart-3',
  low: 'text-chart-2',
};

export default function TaskCalendar({ tasks, onEdit }) {
  const { t, language } = useLanguage();
  const locale = language === 'pt' ? pt : enUS;
  const [mode, setMode] = useState('month'); // 'month' | 'week'
  const [cursor, setCursor] = useState(new Date());

  const tasksWithDates = useMemo(
    () => tasks.filter(t => t.due_date).map(t => ({ ...t, _date: parseISO(t.due_date) })),
    [tasks]
  );

  const days = useMemo(() => {
    if (mode === 'month') {
      const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
      const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
      return eachDayOfInterval({ start, end });
    }
    const start = startOfWeek(cursor, { weekStartsOn: 1 });
    const end = endOfWeek(cursor, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [cursor, mode]);

  const weekdayLabels = useMemo(() => {
    const base = startOfWeek(new Date(), { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => format(addDays(base, i), 'EEE', { locale }));
  }, [locale]);

  const tasksForDay = (day) => tasksWithDates.filter(t => isSameDay(t._date, day));

  const navigate = (dir) => setCursor(c => mode === 'month' ? addMonths(c, dir) : addWeeks(c, dir));

  const title = mode === 'month'
    ? format(cursor, 'MMMM yyyy', { locale })
    : `${format(days[0], 'd MMM', { locale })} – ${format(days[6], 'd MMM', { locale })}`;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCursor(new Date())}>
            {t('tasks_calendar_today')}
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate(1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <h3 className="text-sm font-semibold ml-2 capitalize">{title}</h3>
        </div>
        <div className="flex items-center rounded-md border border-border overflow-hidden">
          <button
            onClick={() => setMode('month')}
            className={cn('px-3 py-1.5 text-xs font-medium transition-colors',
              mode === 'month' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}
          >
            {t('tasks_calendar_month')}
          </button>
          <button
            onClick={() => setMode('week')}
            className={cn('px-3 py-1.5 text-xs font-medium transition-colors',
              mode === 'week' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}
          >
            {t('tasks_calendar_week')}
          </button>
        </div>
      </div>

      {/* Calendar grid */}
      <Card>
        <CardContent className="p-0">
          {/* Weekday header */}
          <div className="grid grid-cols-7 border-b">
            {weekdayLabels.map((label, i) => (
              <div key={i} className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground capitalize border-r last:border-r-0">
                {label}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className={cn('grid grid-cols-7', mode === 'week' && 'min-h-[400px]')}>
            {days.map((day, i) => {
              const dayTasks = tasksForDay(day);
              const inMonth = mode === 'month' ? isSameMonth(day, cursor) : true;
              const today = isToday(day);
              const col = i % 7;

              return (
                <div
                  key={i}
                  className={cn(
                    'border-r border-b last:border-r-0 p-1.5 flex flex-col gap-1 overflow-hidden',
                    mode === 'month' ? 'min-h-[100px]' : 'min-h-[350px]',
                    !inMonth && 'bg-muted/20',
                    col === 6 && 'border-r-0',
                  )}
                >
                  <div className={cn(
                    'flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium flex-shrink-0',
                    today ? 'bg-primary text-primary-foreground' : inMonth ? 'text-foreground' : 'text-muted-foreground/50'
                  )}>
                    {format(day, 'd')}
                  </div>

                  <div className="flex flex-col gap-1 overflow-hidden">
                    {dayTasks.slice(0, mode === 'week' ? 10 : 3).map(task => {
                      const overdue = task.status !== 'done' && isPast(task._date) && !isToday(task._date);
                      return (
                        <button
                          key={task.id}
                          onClick={() => onEdit(task)}
                          className={cn(
                            'flex items-center gap-1.5 rounded px-1.5 py-1 text-left text-xs transition-colors hover:bg-muted',
                            overdue && 'bg-destructive/5'
                          )}
                        >
                          <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', PRIORITY_DOT[task.priority] || 'bg-muted-foreground')} />
                          <span className={cn(
                            'truncate',
                            task.status === 'done' && 'line-through text-muted-foreground',
                            overdue && 'text-destructive font-medium',
                            !overdue && task.status !== 'done' && 'text-foreground',
                          )}>
                            {task.title}
                          </span>
                        </button>
                      );
                    })}
                    {dayTasks.length > (mode === 'week' ? 10 : 3) && (
                      <span className="text-[10px] text-muted-foreground px-1.5">
                        +{dayTasks.length - (mode === 'week' ? 10 : 3)} {t('tasks_calendar_more')}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Tasks without due dates */}
      {tasks.filter(t => !t.due_date).length > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CalendarDays className="w-3.5 h-3.5" />
          <span>{tasks.filter(t => !t.due_date).length} {t('tasks_calendar_no_due_date')}</span>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
        {Object.entries(PRIORITY_DOT).map(([p, dot]) => (
          <span key={p} className="flex items-center gap-1.5">
            <span className={cn('w-2 h-2 rounded-full', dot)} />
            {t(`tasks_priority_${p}`)}
          </span>
        ))}
      </div>
    </div>
  );
}