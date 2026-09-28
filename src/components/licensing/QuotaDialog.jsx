import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { formatMoney } from '@/lib/commercialOffer';

/**
 * Quotas contratuais (FM4): lugares, consumo de IA por mês e limiar de aviso.
 *
 * Os valores por omissão vêm da tabela de preços em vigor para o nível
 * contratado (lugares incluídos e consumo de IA incluído) — o botão «usar os
 * valores da tabela» repõe-nos. Guardar não bloqueia nada: a quota sinaliza, e
 * não há cobrança nesta fase.
 */
export default function QuotaDialog({ tenant, defaults, pending, error, onSubmit, onClose }) {
  const { t } = useLanguage();
  const [seats, setSeats] = useState(String(tenant?.seats?.quota ?? defaults?.included_seats ?? ''));
  const [aiQuota, setAiQuota] = useState(
    tenant?.ai?.quota !== null && tenant?.ai?.quota !== undefined
      ? String(tenant.ai.quota)
      : (defaults?.included_ai_calls !== null && defaults?.included_ai_calls !== undefined
          ? String(defaults.included_ai_calls)
          : ''),
  );
  const [warnPct, setWarnPct] = useState(String(tenant?.seats?.threshold_pct ?? 80));
  const [reason, setReason] = useState('');
  const [localError, setLocalError] = useState('');

  const useDefaults = () => {
    setSeats(defaults?.included_seats !== null && defaults?.included_seats !== undefined ? String(defaults.included_seats) : '');
    setAiQuota(
      defaults?.included_ai_calls !== null && defaults?.included_ai_calls !== undefined
        ? String(defaults.included_ai_calls)
        : '',
    );
  };

  const submit = () => {
    if (reason.trim().length < 3) {
      setLocalError(t('commercial_reason_required'));
      return;
    }
    if (seats !== '' && !Number.isFinite(Number(seats))) {
      setLocalError(t('quota_error'));
      return;
    }
    setLocalError('');
    onSubmit({
      action: 'set_quotas',
      customer_id: tenant.id,
      seat_limit: seats === '' ? undefined : Number(seats),
      ai_quota_monthly: aiQuota === '' ? null : Number(aiQuota),
      quota_warn_pct: Number(warnPct),
      reason,
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('quota_dialog_title')}</DialogTitle>
          <DialogDescription>{tenant?.name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">{t('quota_dialog_help')}</p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="quota-seats">{t('quota_field_seats')}</Label>
              <Input id="quota-seats" type="number" min="0" value={seats} onChange={(event) => setSeats(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quota-ai">{t('quota_field_ai')}</Label>
              <Input id="quota-ai" type="number" min="0" value={aiQuota} onChange={(event) => setAiQuota(event.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quota-warn">{t('quota_field_warn')}</Label>
            <Input
              id="quota-warn"
              type="number"
              min="1"
              max="100"
              value={warnPct}
              onChange={(event) => setWarnPct(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t('quota_field_warn_help')}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 rounded-lg bg-muted/40 p-3">
            <Button type="button" variant="outline" size="sm" onClick={useDefaults}>
              {t('quota_use_defaults')}
            </Button>
            <p className="text-xs text-muted-foreground">
              {defaults?.price_table_label
                ? t('quota_defaults_note')
                    .replace('{table}', defaults.price_table_label)
                    .replace('{seats}', String(defaults.included_seats ?? '—'))
                    .replace('{ai}', String(defaults.included_ai_calls ?? '—'))
                : t('quota_source_from_price')}
              {defaults?.extra_seat_amount_cents !== null && defaults?.extra_seat_amount_cents !== undefined && (
                <> · {t('commercial_price_field_extra_seat')}: {formatMoney(defaults.extra_seat_amount_cents, defaults.currency)}</>
              )}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quota-reason">{t('commercial_reason')}</Label>
            <Input
              id="quota-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={t('commercial_reason_placeholder')}
            />
          </div>

          {(localError || error) && (
            <p className="flex items-start gap-2 text-sm text-destructive">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {localError || error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            {t('common_cancel')}
          </Button>
          <Button onClick={submit} disabled={pending} className="gap-2">
            {pending && <Loader2 className="w-4 h-4 animate-spin" />}
            {t('quota_submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
