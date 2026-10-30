import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import AiDraftDialog from './AiDraftDialog';

/** Rascunhos de IA de um cliente (admin e administrador do cliente). */
export default function AiDraftsList({ customerId }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(null);
  const { data: drafts = [] } = useQuery({
    queryKey: ['ai-drafts', customerId],
    queryFn: () => base44.entities.AiDraft.filter({ customer_id: customerId }, '-created_date', 100),
    enabled: Boolean(customerId),
  });
  if (!customerId) return null;
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" />{t('ai_drafts_title')}</CardTitle></CardHeader>
      <CardContent>
        {drafts.length === 0 ? <p className="text-sm text-muted-foreground">{t('ai_drafts_none')}</p> : (
          <ul className="divide-y text-sm">
            {drafts.map((d) => (
              <li key={d.id} className="py-2 flex items-center gap-2 flex-wrap cursor-pointer hover:bg-muted/30" onClick={() => setOpen(d)}>
                <span className="font-medium">{d.title}</span>
                <Badge variant="outline" className="text-[10px]">{t(`ai_kind_${d.kind}`) !== `ai_kind_${d.kind}` ? t(`ai_kind_${d.kind}`) : t('ai_review_title')}</Badge>
                <Badge variant="outline" className="text-[10px]">{t(`ai_status_${d.status}`)}</Badge>
                {d.warnings?.length > 0 && <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive">{d.warnings.length}</Badge>}
                <span className="ml-auto text-[11px] text-muted-foreground">{d.target_ref} · {(d.created_date || '').slice(0, 10)} · {d.created_by_email}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <AiDraftDialog open={open !== null} onOpenChange={(v) => !v && setOpen(null)} customerId={customerId} initialDraft={open} />
    </Card>
  );
}
