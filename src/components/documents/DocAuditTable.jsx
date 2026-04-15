import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollText } from 'lucide-react';

const STATUS_STYLES = {
  draft: 'bg-muted text-muted-foreground',
  under_review: 'bg-chart-3/10 text-chart-3',
  approved: 'bg-chart-2/10 text-chart-2',
  deprecated: 'bg-destructive/10 text-destructive',
};

function formatTs(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString([], {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function DocAuditTable({ docs, versions, scopedDocIds, cutoff }) {
  const [show, setShow] = useState(20);

  // Build unified timeline of events
  const events = useMemo(() => {
    const docMap = Object.fromEntries(docs.map(d => [d.id, d]));

    const created = docs
      .filter(d => scopedDocIds.has(d.id))
      .filter(d => !cutoff || new Date(d.created_date) >= cutoff)
      .map(d => ({
        id: `doc-${d.id}`,
        type: 'created',
        date: d.created_date,
        title: d.title,
        level: d.level,
        status: d.status,
        actor: d.owner_email || d.created_by,
        customer: d.customer_name,
      }));

    const updated = versions
      .filter(v => scopedDocIds.has(v.document_id))
      .filter(v => !cutoff || new Date(v.created_date) >= cutoff)
      .map(v => {
        const doc = docMap[v.document_id];
        return {
          id: `ver-${v.id}`,
          type: 'version_saved',
          date: v.created_date,
          title: doc?.title || 'Unknown Document',
          level: doc?.level || v.level,
          status: v.status,
          actor: v.changed_by,
          note: v.change_note,
          customer: doc?.customer_name,
          version: v.version_label,
        };
      });

    return [...created, ...updated]
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [docs, versions, scopedDocIds, cutoff]);

  const TYPE_STYLES = {
    created: { label: 'Created', cls: 'bg-chart-1/10 text-chart-1' },
    version_saved: { label: 'Version Saved', cls: 'bg-chart-5/10 text-chart-5' },
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ScrollText className="w-4 h-4 text-muted-foreground" />
          Recent Document Activity
          <span className="text-sm font-normal text-muted-foreground ml-1">({events.length} events)</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {events.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">
            No document activity found for the selected period.
          </div>
        ) : (
          <>
            <div className="divide-y">
              {events.slice(0, show).map(ev => (
                <div key={ev.id} className="flex items-start gap-3 px-5 py-3 hover:bg-muted/20 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={`${TYPE_STYLES[ev.type]?.cls} text-xs`}>
                        {TYPE_STYLES[ev.type]?.label}
                      </Badge>
                      <p className="text-sm font-medium truncate">{ev.title}</p>
                      {ev.version && <span className="text-xs text-muted-foreground">v{ev.version}</span>}
                      <Badge variant="outline" className={`text-xs ${STATUS_STYLES[ev.status] || ''}`}>
                        {ev.status?.replace('_', ' ')}
                      </Badge>
                      {ev.level && (
                        <span className="text-xs text-muted-foreground capitalize">{ev.level}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      by <span className="font-medium">{ev.actor || '—'}</span>
                      {ev.customer && <span> · {ev.customer}</span>}
                      {ev.note && <span> · {ev.note}</span>}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono flex-shrink-0 mt-0.5">
                    {formatTs(ev.date)}
                  </p>
                </div>
              ))}
            </div>
            {events.length > show && (
              <div className="px-5 py-3 border-t">
                <button
                  className="text-xs text-primary hover:underline"
                  onClick={() => setShow(s => s + 20)}
                >
                  Show more ({events.length - show} remaining)
                </button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}