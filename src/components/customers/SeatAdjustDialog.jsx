import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Minus, Loader2 } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

const MIN_SEAT_LIMIT = 5;

export default function SeatAdjustDialog({
  open, customer, currentLimit, addonSeats, saving, onConfirm, onCancel,
}) {
  const { t } = useLanguage();
  const [value, setValue] = useState(currentLimit);

  useEffect(() => {
    if (open) setValue(currentLimit);
  }, [open, currentLimit]);

  const newTotal = value + addonSeats;
  const changed = value !== currentLimit;
  const valid = value >= MIN_SEAT_LIMIT;

  const clamp = (v) => Math.max(MIN_SEAT_LIMIT, Math.min(999, v));

  return (
    <Dialog open={open} onOpenChange={v => !v && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('seat_dialog_title')}</DialogTitle>
          <DialogDescription>
            {t('seat_dialog_desc').split('{name}')[0]}
            <strong>{customer?.name}</strong>
            {t('seat_dialog_desc').split('{name}')[1]}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Stepper input */}
          <div className="flex items-center justify-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-full"
              onClick={() => setValue(clamp(value - 1))}
              disabled={value <= MIN_SEAT_LIMIT}
            >
              <Minus className="w-4 h-4" />
            </Button>
            <div className="flex flex-col items-center">
              <Input
                type="number"
                min={MIN_SEAT_LIMIT}
                className="w-24 h-12 text-center text-2xl font-bold"
                value={value}
                onChange={e => {
                  const raw = parseInt(e.target.value, 10);
                  setValue(isNaN(raw) ? MIN_SEAT_LIMIT : clamp(raw));
                }}
              />
              <span className="text-[10px] text-muted-foreground mt-1">{t('seat_min').replace('{count}', MIN_SEAT_LIMIT)}</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-full"
              onClick={() => setValue(clamp(value + 1))}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {/* Summary */}
          <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('seat_current_limit')}</span>
              <span className="font-mono font-semibold">{currentLimit}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('seat_new_limit')}</span>
              <span className={`font-mono font-semibold ${changed ? 'text-primary' : ''}`}>{value}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('seat_addon_seats')}</span>
              <span className="font-mono font-semibold">{addonSeats}</span>
            </div>
            <div className="flex justify-between border-t pt-1">
              <span className="text-muted-foreground">{t('seat_total_after')}</span>
              <span className="font-mono font-bold">{newTotal}</span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {t('seat_change_notify')}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            {t('seat_cancel')}
          </Button>
          <Button
            onClick={() => onConfirm(value)}
            disabled={saving || !changed || !valid}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : t('seat_confirm_change')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}