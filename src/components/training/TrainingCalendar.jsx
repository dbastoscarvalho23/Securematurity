import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  isSameDay, isSameMonth, isToday, format, addMonths, parseISO,
} from 'date-fns';
import { pt, enUS } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, CalendarDays, Clock } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';

const statusClass = (s) => ({
  scheduled: 'bg-chart-4/15 text-chart-4',
  completed: 'bg-accent/15 text-accent',
  cancelled: 'bg-destructive/15 text-destructive',
}[s] || 'bg-muted text-muted-foreground');

const dotClass = (s) => ({
  scheduled: 'bg-chart-4',
  completed: 'bg-accent',
  cancelled: 'bg-destructive',
}[s] || 'bg-muted-foreground');

export default function TrainingCalendar({ customer }) {
  const { t, language } = useLanguage();
  const locale = language === 'pt' ? pt : enUS;
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState(() => new Date());

  const { data: trainings = [], isLoading } = useQuery({
    queryKey: ['trainings', customer?.id],
    queryFn: () => base44.entities.Training.filter({ customer_id: customer.id }, '-scheduled_date', 1000),
    enabled: !!customer?.id,
  });

  const byDay = useMemo(() => {
    const map = {};
    trainings.forEach(tr => {
      if (!tr.scheduled_date) return;
      const d = parseISO(tr.scheduled_date);
      if (isNaN(d)) return;
      const key = format(d, 'yyyy-MM-dd');
      (map[key] = map[key] || []).push(tr);
    });
    return map;
  }, [trainings]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const weekdays = useMemo(() => {
    const base = startOfWeek(new Date(), { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(base, i));
  }, []);

  const selectedKey = format(selected, 'yyyy-MM-dd');
  const selectedEvents = byDay[selectedKey] || [];

  return (
    <div className="space-y-4">
      <PageHeader title={t('training_tab_calendar')} description={t('training_calendar_subtitle')} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold capitalize">{format(month, 'MMMM yyyy', { locale })}</h3>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" onClick={() => setMonth(m => addMonths(m, -1))}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setMonth(startOfMonth(new Date())); setSelected(new Date()); }}>
                  {t('training_calendar_today')}
                </Button>
                <Button variant="outline" size="icon" onClick={() => setMonth(m => addMonths(m, 1))}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {weekdays.map((d, i) => (
                <div key={i} className="text-center text-xs font-medium text-muted-foreground py-1 capitalize">
                  {format(d, 'EEE', { locale })}
                </div>
              ))}
              {days.map(d => {
                const key = format(d, 'yyyy-MM-dd');
                const events = byDay[key] || [];
                const inMonth = isSameMonth(d, month);
                const isSel = isSameDay(d, selected);
                return (
                  <button
                    key={key}
                    onClick={() => setSelected(d)}
                    className={`relative min-h-[64px] rounded-lg border p-1.5 text-left transition-colors ${
                      isSel ? 'border-primary ring-1 ring-primary' : 'border-border'
                    } ${inMonth ? 'bg-card hover:bg-muted/40' : 'bg-muted/20 text-muted-foreground/60'} ${isToday(d) ? 'ring-1 ring-primary/40' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-medium ${isToday(d) ? 'text-primary' : ''}`}>{format(d, 'd')}</span>
                      {events.length > 0 && (
                        <span className="flex gap-0.5">
                          {events.slice(0, 3).map((e, i) => (
                            <span key={i} className={`w-1.5 h-1.5 rounded-full ${dotClass(e.status)}`} />
                          ))}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {events.slice(0, 2).map(e => (
                        <div key={e.id} className="text-[10px] leading-tight truncate text-foreground/80">
                          {format(parseISO(e.scheduled_date), 'HH:mm')} {e.title}
                        </div>
                      ))}
                      {events.length > 2 && (
                        <div className="text-[10px] text-muted-foreground">+{events.length - 2}</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold mb-1 capitalize">{format(selected, 'EEEE, d MMM', { locale })}</h3>
            <p className="text-xs text-muted-foreground mb-3">
              {selectedEvents.length > 0
                ? t('training_calendar_events_on', { date: format(selected, 'd MMM yyyy', { locale }) })
                : t('training_calendar_no_events')}
            </p>
            {isLoading ? (
              <LoadingState />
            ) : selectedEvents.length === 0 ? (
              <EmptyState icon={CalendarDays} title={t('training_calendar_no_events')} />
            ) : (
              <div className="space-y-2">
                {selectedEvents.map(tr => (
                  <div key={tr.id} className="border rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-medium text-sm truncate flex-1">{tr.title}</h4>
                      <Badge className={statusClass(tr.status)}>{t(`training_status_${tr.status}`)}</Badge>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                      <Clock className="w-3 h-3" />
                      {format(parseISO(tr.scheduled_date), 'HH:mm')}
                      {tr.duration_minutes ? ` · ${tr.duration_minutes} min` : ''}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      <Badge variant="secondary" className="text-[10px]">{t(`training_topic_${tr.topic}`)}</Badge>
                      <Badge variant="outline" className="text-[10px]">{t(`training_modality_${tr.modality}`)}</Badge>
                    </div>
                    {tr.location && <p className="text-xs text-muted-foreground mt-1 truncate">{tr.location}</p>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function addDays(date, amount) {
  const d = new Date(date);
  d.setDate(d.getDate() + amount);
  return d;
}