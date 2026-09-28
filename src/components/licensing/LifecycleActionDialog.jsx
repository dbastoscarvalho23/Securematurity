import React, { useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import {
  LIFECYCLE_TIER_LABEL_KEYS,
  LIFECYCLE_TIER_ORDER,
  tierDirection,
} from '@/lib/commercialLifecycle';

/**
 * Renovar, mudar de nível ou fechar uma subscrição (FM3).
 *
 * As três operações exigem motivo (fica no histórico com o antes/depois) e as
 * duas destrutivas explicam o que sai antes de acontecer: o fecho avisa que
 * nenhum módulo abre, e a descida de nível mostra o que será retirado — quando a
 * função devolve `removals_required` (422), a lista do que sobra aparece aqui e
 * só um segundo envio, com a confirmação marcada, a aplica.
 */
const MONTHS = [3, 6, 12, 24, 36];

export default function LifecycleActionDialog({ mode, tenant, removals, pending, error, onSubmit, onClose }) {
  const { t } = useLanguage();
  const [months, setMonths] = useState('12');
  const [tierCode, setTierCode] = useState(tenant?.subscription?.tier_code || 'core');
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [localError, setLocalError] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const currentTier = tenant?.subscription?.tier_code || null;
  const direction = useMemo(() => tierDirection(currentTier, tierCode), [currentTier, tierCode]);
  const tierName = (code) => t(LIFECYCLE_TIER_LABEL_KEYS[code]) || code;
  const requiresRemovalConfirm = Boolean(removals);

  const submit = (confirmRemovals = false) => {
    if (reason.trim().length < 3) {
      setLocalError(t('commercial_reason_required'));
      return;
    }
    setLocalError('');
    const customer_id = tenant.id;
    if (mode === 'renew') {
      onSubmit({ action: 'renew', customer_id, months: Number(months), reason });
      return;
    }
    if (mode === 'change_tier') {
      onSubmit({
        action: 'change_tier',
        customer_id,
        tier_code: tierCode,
        reason,
        ...(confirmRemovals ? { confirm_removals: true } : {}),
      });
      return;
    }
    onSubmit({ action: 'close', customer_id, effective_date: effectiveDate, reason });
  };

  const titleKey = mode === 'renew'
    ? 'lifecycle_renew_title'
    : mode === 'change_tier'
      ? 'lifecycle_change_tier_title'
      : 'lifecycle_close_title';

  const submitLabel = mode === 'renew'
    ? t('lifecycle_renew')
    : mode === 'change_tier'
      ? t(requiresRemovalConfirm ? 'lifecycle_removals_submit' : 'lifecycle_change_tier')
      : t('lifecycle_close_submit');

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(titleKey)}</DialogTitle>
          <DialogDescription>{tenant?.name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {mode === 'renew' && !reason && (
            <p className="text-xs text-muted-foreground">{t('lifecycle_renew_help')}</p>
          )}
          {mode === 'change_tier' && !reason && (
            <p className="text-xs text-muted-foreground">{t('lifecycle_change_tier_help')}</p>
          )}
          {mode === 'close' && !reason && (
            <p className="text-xs text-muted-foreground">{t('lifecycle_close_help')}</p>
          )}

          {mode === 'renew' && (
            <div className="space-y-2">
              <Label htmlFor="lifecycle-months">{t('lifecycle_renew_months')}</Label>
              <Select value={months} onValueChange={setMonths}>
                <SelectTrigger id="lifecycle-months">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((value) => (
                    <SelectItem key={value} value={String(value)}>{value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {mode === 'change_tier' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="lifecycle-tier">{t('lifecycle_change_tier_target')}</Label>
                <Select value={tierCode} onValueChange={setTierCode}>
                  <SelectTrigger id="lifecycle-tier">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LIFECYCLE_TIER_ORDER.map((code) => (
                      <SelectItem key={code} value={code}>{tierName(code)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {direction === 'same' ? (
                <p className="text-xs text-muted-foreground">{t('lifecycle_change_tier_same')}</p>
              ) : (
                <p className={`text-xs ${direction === 'downgrade' ? 'text-status-warning' : 'text-muted-foreground'}`}>
                  {direction === 'downgrade'
                    ? t('lifecycle_change_tier_downgrade').replace('{tier}', tierName(tierCode))
                    : t('lifecycle_change_tier_upgrade').replace('{tier}', tierName(tierCode))}
                </p>
              )}

              {requiresRemovalConfirm && (
                <div className="space-y-3 rounded-lg border border-status-warning/40 bg-status-warning/10 p-3">
                  <p className="text-sm font-medium text-status-warning">{t('lifecycle_removals_title')}</p>
                  <div className="space-y-1 text-xs">
                    <p className="text-muted-foreground">{t('lifecycle_removals_modules')}</p>
                    <p className="font-mono">
                      {(removals.modules || []).length > 0
                        ? removals.modules.join(' · ')
                        : t('lifecycle_removals_none')}
                    </p>
                    <p className="text-muted-foreground pt-1">{t('lifecycle_removals_standards')}</p>
                    <p className="font-mono">
                      {(removals.standards || []).length > 0
                        ? removals.standards.join(' · ')
                        : t('lifecycle_removals_none')}
                    </p>
                  </div>
                  <label className="flex items-start gap-2 text-xs">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={confirmed}
                      onChange={(event) => setConfirmed(event.target.checked)}
                    />
                    <span>{t('lifecycle_removals_confirm')}</span>
                  </label>
                </div>
              )}
            </>
          )}

          {mode === 'close' && (
            <div className="space-y-2">
              <Label htmlFor="lifecycle-date">{t('lifecycle_close_date')}</Label>
              <Input
                id="lifecycle-date"
                type="date"
                value={effectiveDate}
                onChange={(event) => setEffectiveDate(event.target.value)}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="lifecycle-reason">{t('commercial_reason')}</Label>
            <Input
              id="lifecycle-reason"
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
            onClick={() => submit(requiresRemovalConfirm && confirmed)}
            disabled={pending || (requiresRemovalConfirm && !confirmed)}
            variant={mode === 'close' || requiresRemovalConfirm ? 'destructive' : 'default'}
            className="gap-2"
          >
            {pending && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
