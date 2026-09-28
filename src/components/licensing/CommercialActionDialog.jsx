import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

/**
 * Publicar ou retirar uma versão da oferta / uma tabela de preços (FM1/FM2).
 *
 * Publicar é o momento em que a versão passa a vigente: o que estava vigente é
 * retirado pela função, com data de fim no dia anterior, para que a qualquer data
 * exista uma só oferta (e um só preço) em vigor. O motivo é obrigatório — é o que
 * o histórico comercial mostra a par do antes/depois.
 */
export default function CommercialActionDialog({ kind, entity, record, pending, error, onSubmit, onClose }) {
  const { t } = useLanguage();
  const [effectiveDate, setEffectiveDate] = useState(record?.effective_from?.slice(0, 10) || new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [localError, setLocalError] = useState('');

  const isPublish = kind === 'publish';
  const entityLabel = entity === 'price' ? t('commercial_entity_price') : t('commercial_entity_offer');

  const submit = () => {
    if (reason.trim().length < 3) {
      setLocalError(t('commercial_reason_required'));
      return;
    }
    setLocalError('');
    onSubmit({
      action: isPublish
        ? (entity === 'price' ? 'publish_price_table' : 'publish_offer_version')
        : (entity === 'price' ? 'retire_price_table' : 'retire_offer_version'),
      id: record.id,
      reason,
      ...(isPublish ? { effective_from: effectiveDate } : { effective_to: effectiveDate }),
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isPublish ? t('commercial_publish_title') : t('commercial_retire_title')} — {entityLabel}
          </DialogTitle>
          <DialogDescription>{record?.code ? `${record.code} · ${record.label}` : record?.label}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isPublish && !reason && (
            <p className="text-xs text-muted-foreground">{t('commercial_publish_help')}</p>
          )}
          {!isPublish && !reason && (
            <p className="text-xs text-muted-foreground">{t('commercial_retire_help')}</p>
          )}

          <div className="space-y-2">
            <Label htmlFor="commercial-date">
              {isPublish ? t('commercial_field_effective_from') : t('commercial_field_effective_to')}
            </Label>
            <Input
              id="commercial-date"
              type="date"
              value={effectiveDate}
              onChange={(event) => setEffectiveDate(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="commercial-reason">{t('commercial_reason')}</Label>
            <Input
              id="commercial-reason"
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
          <Button
            onClick={submit}
            disabled={pending}
            variant={isPublish ? 'default' : 'destructive'}
            className="gap-2"
          >
            {pending && <Loader2 className="w-4 h-4 animate-spin" />}
            {isPublish ? t('commercial_publish_confirm') : t('commercial_retire_confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
