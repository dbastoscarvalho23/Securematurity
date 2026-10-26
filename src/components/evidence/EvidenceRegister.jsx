import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { openEvidence, evidenceState } from '@/lib/evidence';
import { useCustomerEvidence } from './EvidencePanel';

const STYLE = {
  valid: 'bg-chart-2/10 text-chart-2 border-chart-2/30',
  pending: 'bg-chart-3/10 text-chart-3 border-chart-3/30',
  expired: 'bg-destructive/10 text-destructive border-destructive/30',
  rejected: 'bg-muted text-muted-foreground line-through',
};

/** Registo de evidências estruturadas (com ficheiro, hash, validade e revisão). */
export default function EvidenceRegister() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [selected, setSelected] = useState(null);
  const [state, setState] = useState('all');
  const customerId = isAdmin ? selected : user?.customer_id;
  const { data: customers = [] } = useQuery({
    queryKey: ['evreg-customers'],
    queryFn: () => base44.entities.Customer.list('name', 500),
    enabled: isAdmin,
  });
  const { data: items = [], isLoading } = useCustomerEvidence(customerId);
  const shown = useMemo(() => items.filter((e) => state === 'all' || evidenceState(e) === state), [items, state]);
  const counts = useMemo(() => items.reduce((acc, e) => { const s = evidenceState(e); acc[s] = (acc[s] || 0) + 1; return acc; }, {}), [items]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-primary" />{t('ev_register_title')}</CardTitle>
          <div className="flex gap-2">
            {isAdmin && (
              <Select value={selected || undefined} onValueChange={setSelected}>
                <SelectTrigger className="w-56 h-8 text-xs"><SelectValue placeholder={t('common_select_customer')} /></SelectTrigger>
                <SelectContent>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            )}
            <Select value={state} onValueChange={setState}>
              <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('at_filter_all')} ({items.length})</SelectItem>
                {['valid', 'pending', 'expired', 'rejected'].map((s) => <SelectItem key={s} value={s}>{t(`ev_state_${s}`)} ({counts[s] || 0})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{t('ev_register_help')}</p>
      </CardHeader>
      <CardContent>
        {!customerId ? <p className="text-sm text-muted-foreground">{t('at_pick_customer')}</p>
          : isLoading ? <p className="text-sm text-muted-foreground">{t('common_loading')}</p>
          : shown.length === 0 ? <p className="text-sm text-muted-foreground">{t('ev_none')}</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs bg-muted/50">
                  <tr>
                    <th className="text-left p-2">{t('ev_field_title')}</th>
                    <th className="text-left p-2">{t('ev_register_links')}</th>
                    <th className="text-left p-2">{t('ev_field_type')}</th>
                    <th className="text-left p-2">{t('ev_field_collected')}</th>
                    <th className="text-left p-2">{t('ev_field_valid_until')}</th>
                    <th className="text-left p-2">{t('ev_register_state')}</th>
                    <th className="p-2" />
                  </tr>
                </thead>
                <tbody>
                  {shown.map((e) => {
                    const st = evidenceState(e);
                    return (
                      <tr key={e.id} className="border-t align-top">
                        <td className="p-2">{e.title}<div className="text-[10px] text-muted-foreground font-mono">v{e.version || 1} · SHA-256 {String(e.sha256 || '').slice(0, 12)}…</div></td>
                        <td className="p-2 text-xs">{(e.links || []).map((l) => l.label || l.ref || `${l.type}`).join(' · ')}</td>
                        <td className="p-2 text-xs">{t(`ev_type_${e.evidence_type || 'other'}`)}</td>
                        <td className="p-2 text-xs">{e.collected_at}</td>
                        <td className="p-2 text-xs">{e.valid_until || '—'}</td>
                        <td className="p-2"><Badge variant="outline" className={`text-[10px] ${STYLE[st]}`}>{t(`ev_state_${st}`)}</Badge></td>
                        <td className="p-2 text-right">
                          <Button size="sm" variant="ghost" className="h-7" onClick={() => openEvidence(e).catch((err) => toast.error(err?.message || t('ev_error')))}><Download className="w-3.5 h-3.5" /></Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
      </CardContent>
    </Card>
  );
}
