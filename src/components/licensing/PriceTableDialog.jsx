import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { OFFER_ADDON_ORDER, OFFER_TIER_ORDER, addonLabel, centsFromEuros, eurosFromCents } from '@/lib/commercialOffer';

/**
 * Tabela de preços (FM2) — o valor por tier, a periodicidade e os lugares
 * incluídos, com vigência. Uma alteração de preço entra como versão nova: a
 * tabela publicada que aqui se substitui é retirada pela função, com data de
 * fim, pelo que o preço vigente a qualquer data é reconstruível. Sem faturação
 * nem pagamentos nesta fase — o preço é o registo do que foi contratado.
 */
const TIER_LABEL_KEYS = {
  core: 'license_tier_core',
  professional: 'license_tier_professional',
  advanced: 'license_tier_advanced',
};

const emptyRow = () => ({ amount: '', seats: '', extra: '', discount: '' });

function rowsFromRecord(record) {
  const rows = {};
  for (const code of OFFER_TIER_ORDER) rows[code] = emptyRow();
  for (const entry of record?.entries || []) {
    rows[entry.tier_code] = {
      amount: eurosFromCents(entry.amount_cents),
      seats: entry.included_seats === null || entry.included_seats === undefined ? '' : String(entry.included_seats),
      extra: eurosFromCents(entry.extra_seat_amount_cents),
      discount:
        entry.annual_discount_pct === null || entry.annual_discount_pct === undefined
          ? ''
          : String(entry.annual_discount_pct),
    };
  }
  return rows;
}

/** Preço dos packs já registados na tabela, por código. */
function addonRowsFromRecord(record) {
  const rows = {};
  for (const entry of record?.addon_entries || []) {
    rows[entry.addon_code] = {
      amount: eurosFromCents(entry.amount_cents),
      ai: entry.included_ai_calls === null || entry.included_ai_calls === undefined ? '' : String(entry.included_ai_calls),
    };
  }
  return rows;
}

export default function PriceTableDialog({ mode, record, offerVersions, pending, error, onSubmit, onClose }) {
  const { t } = useLanguage();
  const isEdit = mode === 'edit';

  const [offerVersionId, setOfferVersionId] = useState(record?.offer_version_id || '');
  const [label, setLabel] = useState(record?.label || '');
  const [currency, setCurrency] = useState(record?.currency || 'EUR');
  const [billingPeriod, setBillingPeriod] = useState(record?.billing_period || 'monthly');
  const [effectiveFrom, setEffectiveFrom] = useState(record?.effective_from ? String(record.effective_from).slice(0, 10) : '');
  const [notes, setNotes] = useState(record?.notes || '');
  const [reason, setReason] = useState('');
  const [rows, setRows] = useState(() => rowsFromRecord(record));
  const [addonRows, setAddonRows] = useState(() => addonRowsFromRecord(record));
  const [localError, setLocalError] = useState('');

  const selectableVersions = (offerVersions || []).filter((version) => version.status !== 'retired');
  const selectedVersion = selectableVersions.find((version) => version.id === (isEdit ? record.offer_version_id : offerVersionId));

  /**
   * Só se preça o que a oferta põe à venda: os packs comercializáveis da versão
   * escolhida, mais os que esta tabela já preça (para que editar um rascunho não
   * perca o preço de um pack entretanto retirado da oferta).
   */
  const pricedAddons = OFFER_ADDON_ORDER.filter((code) =>
    (selectedVersion?.addons || []).some((row) => row.addon_code === code && row.commercially_available === true)
  );
  const addonCodes = Array.from(new Set([
    ...pricedAddons,
    ...Object.keys(addonRows).filter((code) => String(addonRows[code]?.amount ?? '').trim() !== ''),
  ]));

  const setRow = (tierCode, field, value) => {
    setRows((current) => ({ ...current, [tierCode]: { ...current[tierCode], [field]: value } }));
  };

  const setAddonRow = (addonCode, field, value) => {
    setAddonRows((current) => ({
      ...current,
      [addonCode]: { amount: '', ai: '', ...current[addonCode], [field]: value },
    }));
  };

  const submit = () => {
    const entries = OFFER_TIER_ORDER
      .filter((code) => rows[code] && String(rows[code].amount).trim() !== '')
      .map((code) => ({
        tier_code: code,
        amount_cents: centsFromEuros(rows[code].amount),
        included_seats: String(rows[code].seats).trim() === '' ? null : Number(rows[code].seats),
        extra_seat_amount_cents: centsFromEuros(rows[code].extra),
        annual_discount_pct: String(rows[code].discount).trim() === '' ? null : Number(rows[code].discount),
      }));

    if (entries.length === 0) {
      setLocalError(t('commercial_price_needs_entry'));
      return;
    }
    if (!isEdit && !offerVersionId) {
      setLocalError(t('commercial_price_needs_offer'));
      return;
    }

    // Packs: só entra quem tem preço preenchido — um pack da oferta que esta
    // tabela não preça fica sem valor nesta versão (e a consola di-lo).
    const addonEntries = addonCodes
      .filter((code) => String(addonRows[code]?.amount ?? '').trim() !== '')
      .map((code) => ({
        addon_code: code,
        amount_cents: centsFromEuros(addonRows[code].amount),
        included_ai_calls: String(addonRows[code].ai ?? '').trim() === '' ? null : Number(addonRows[code].ai),
      }));

    setLocalError('');
    onSubmit({
      action: isEdit ? 'update_price_table' : 'create_price_table',
      ...(isEdit ? { id: record.id } : { offer_version_id: offerVersionId }),
      label,
      currency,
      billing_period: billingPeriod,
      effective_from: effectiveFrom || null,
      notes,
      entries,
      addon_entries: addonEntries,
      reason,
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('commercial_price_dialog_edit_title') : t('commercial_price_dialog_create_title')}
          </DialogTitle>
          <DialogDescription>{t('commercial_price_dialog_help')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {!isEdit && (
            <div className="space-y-2">
              <Label htmlFor="price-offer">{t('commercial_price_field_offer')}</Label>
              <Select value={offerVersionId} onValueChange={setOfferVersionId}>
                <SelectTrigger id="price-offer"><SelectValue placeholder={t('commercial_price_field_offer')} /></SelectTrigger>
                <SelectContent>
                  {selectableVersions.map((version) => (
                    <SelectItem key={version.id} value={version.id}>
                      {version.code} · {version.label} ({t(`commercial_status_${version.status}`)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t('commercial_price_field_offer_help')}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="price-label">{t('commercial_price_field_label')}</Label>
            <Input id="price-label" value={label} onChange={(event) => setLabel(event.target.value)} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="price-currency">{t('commercial_price_field_currency')}</Label>
              <Input
                id="price-currency"
                value={currency}
                maxLength={3}
                onChange={(event) => setCurrency(event.target.value.toUpperCase())}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price-period">{t('commercial_price_field_period')}</Label>
              <Select value={billingPeriod} onValueChange={setBillingPeriod}>
                <SelectTrigger id="price-period"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">{t('commercial_period_monthly')}</SelectItem>
                  <SelectItem value="annual">{t('commercial_period_annual')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="price-from">{t('commercial_offer_field_effective_from')}</Label>
              <Input
                id="price-from"
                type="date"
                value={effectiveFrom}
                onChange={(event) => setEffectiveFrom(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-3 rounded-lg border p-3">
            <p className="text-sm font-medium">{t('commercial_price_entries_title')}</p>
            <p className="text-xs text-muted-foreground">{t('commercial_price_entries_help')}</p>

            <div className="space-y-3">
              {OFFER_TIER_ORDER.map((code) => (
                <div key={code} className="space-y-2">
                  <p className="text-sm font-medium">{t(TIER_LABEL_KEYS[code]) || code}</p>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor={`amount-${code}`} className="text-xs text-muted-foreground">
                        {t('commercial_price_field_amount')}
                      </Label>
                      <Input
                        id={`amount-${code}`}
                        inputMode="decimal"
                        value={rows[code].amount}
                        onChange={(event) => setRow(code, 'amount', event.target.value)}
                        placeholder="0,00"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`seats-${code}`} className="text-xs text-muted-foreground">
                        {t('commercial_price_field_seats')}
                      </Label>
                      <Input
                        id={`seats-${code}`}
                        inputMode="numeric"
                        value={rows[code].seats}
                        onChange={(event) => setRow(code, 'seats', event.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`extra-${code}`} className="text-xs text-muted-foreground">
                        {t('commercial_price_field_extra_seat')}
                      </Label>
                      <Input
                        id={`extra-${code}`}
                        inputMode="decimal"
                        value={rows[code].extra}
                        onChange={(event) => setRow(code, 'extra', event.target.value)}
                        placeholder="0,00"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`discount-${code}`} className="text-xs text-muted-foreground">
                        {t('commercial_price_field_discount')}
                      </Label>
                      <Input
                        id={`discount-${code}`}
                        inputMode="numeric"
                        value={rows[code].discount}
                        onChange={(event) => setRow(code, 'discount', event.target.value)}
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Preço dos packs (FM2) — só os que a oferta escolhida põe à venda */}
            <div className="space-y-2 border-t pt-3">
              <p className="text-sm font-medium">{t('commercial_price_addons_title')}</p>
              <p className="text-xs text-muted-foreground">{t('commercial_price_addons_help')}</p>
              {addonCodes.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t('commercial_price_addons_none')}</p>
              ) : (
                <div className="space-y-3">
                  {addonCodes.map((code) => (
                    <div key={code} className="space-y-2">
                      <p className="text-sm font-medium">{addonLabel(code, t)}</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label htmlFor={`addon-amount-${code}`} className="text-xs text-muted-foreground">
                            {t('commercial_price_field_amount')}
                          </Label>
                          <Input
                            id={`addon-amount-${code}`}
                            inputMode="decimal"
                            value={addonRows[code]?.amount ?? ''}
                            onChange={(event) => setAddonRow(code, 'amount', event.target.value)}
                            placeholder="0,00"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`addon-ai-${code}`} className="text-xs text-muted-foreground">
                            {t('commercial_price_field_addon_ai')}
                          </Label>
                          <Input
                            id={`addon-ai-${code}`}
                            inputMode="numeric"
                            value={addonRows[code]?.ai ?? ''}
                            onChange={(event) => setAddonRow(code, 'ai', event.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="price-notes">{t('commercial_offer_field_notes')}</Label>
            <Textarea id="price-notes" rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="price-reason">{t('commercial_reason')}</Label>
            <Input
              id="price-reason"
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
            {isEdit ? t('common_save') : t('commercial_price_create_confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
