import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { OFFER_ADDON_ORDER, addonLabel } from '@/lib/commercialOffer';

/**
 * Versão da oferta (FM1) — criar um rascunho a partir do catálogo em execução e
 * ajustar, enquanto rascunho, a decisão comercial de cada tier.
 *
 * Os módulos de cada tier não são editáveis de propósito: o que o gating abre
 * continua a ser o catálogo de código (FB7). O que aqui se decide é o que está
 * à venda (comercializável / preparado) e que normas acompanham cada tier — e
 * essa decisão passa a ter versão e vigência, em vez de existir só no código.
 */
const TIER_LABEL_KEYS = {
  core: 'license_tier_core',
  professional: 'license_tier_professional',
  advanced: 'license_tier_advanced',
};

export default function OfferVersionDialog({ mode, record, catalogue, pending, error, onSubmit, onClose }) {
  const { t } = useLanguage();
  const isEdit = mode === 'edit';

  const [label, setLabel] = useState(record?.label || '');
  const [effectiveFrom, setEffectiveFrom] = useState(record?.effective_from ? String(record.effective_from).slice(0, 10) : '');
  const [effectiveTo, setEffectiveTo] = useState(record?.effective_to ? String(record.effective_to).slice(0, 10) : '');
  const [notes, setNotes] = useState(record?.notes || '');
  const [reason, setReason] = useState('');
  const [tiers, setTiers] = useState(() => (record?.tiers || []).map((row) => ({ ...row, standards: [...(row.standards || [])] })));
  // Um rascunho criado antes dos packs não tem decisão sobre eles: nesse caso a
  // composição nasce do catálogo em execução (nenhum à venda), para que a versão
  // passe a ter decisão em vez de ficar sem ela.
  const [addons, setAddons] = useState(() => {
    const fromRecord = (record?.addons || []).map((row) => ({ ...row }));
    if (fromRecord.length > 0) return fromRecord;
    return (catalogue?.addons || []).map((addon) => ({
      addon_code: addon.code,
      commercially_available: false,
      modules: (addon.modules || []).map((module) => module.code),
    }));
  });

  const standards = catalogue?.standards || [];
  const previewTiers = catalogue?.tiers || [];
  const previewAddons = catalogue?.addons || [];

  /** Nome de um módulo do pack (o catálogo traz o nome; o registo traz o código). */
  const moduleNames = new Map(
    previewAddons.flatMap((addon) => (addon.modules || []).map((module) => [module.code, module.name])),
  );

  /** Packs pela ordem da oferta; um código fora do catálogo fica no fim. */
  const orderedAddons = (rows) => {
    const byCode = new Map((rows || []).map((row) => [row.addon_code, row]));
    const ordered = OFFER_ADDON_ORDER.map((code) => byCode.get(code)).filter(Boolean);
    return [...ordered, ...(rows || []).filter((row) => !OFFER_ADDON_ORDER.includes(row.addon_code))];
  };

  const toggleTier = (tierCode, field, value) => {
    setTiers((current) => current.map((row) => (row.tier_code === tierCode ? { ...row, [field]: value } : row)));
  };

  const toggleStandard = (tierCode, standardCode, checked) => {
    setTiers((current) => current.map((row) => {
      if (row.tier_code !== tierCode) return row;
      const list = checked
        ? [...row.standards, standardCode]
        : row.standards.filter((code) => code !== standardCode);
      return { ...row, standards: [...new Set(list)] };
    }));
  };

  const toggleAddon = (addonCode, checked) => {
    setAddons((current) => current.map((row) => (
      row.addon_code === addonCode ? { ...row, commercially_available: checked } : row
    )));
  };

  const submit = () => {
    if (isEdit) {
      onSubmit({
        action: 'update_offer_version',
        id: record.id,
        label,
        effective_from: effectiveFrom || null,
        effective_to: effectiveTo || null,
        notes,
        reason,
        tiers,
        addons: addons.map((row) => ({
          addon_code: row.addon_code,
          commercially_available: row.commercially_available === true,
        })),
      });
      return;
    }
    onSubmit({ action: 'create_offer_version', label, effective_from: effectiveFrom || null, notes, reason });
  };

  const tierName = (code) => t(TIER_LABEL_KEYS[code]) || code;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('commercial_offer_dialog_edit_title') : t('commercial_offer_dialog_create_title')}
          </DialogTitle>
          <DialogDescription>
            {isEdit ? record?.code : t('commercial_offer_dialog_create_help')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          <div className="space-y-2">
            <Label htmlFor="offer-label">{t('commercial_offer_field_label')}</Label>
            <Input
              id="offer-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder={t('commercial_offer_field_label_placeholder')}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="offer-from">{t('commercial_offer_field_effective_from')}</Label>
              <Input
                id="offer-from"
                type="date"
                value={effectiveFrom}
                onChange={(event) => setEffectiveFrom(event.target.value)}
              />
            </div>
            {isEdit && (
              <div className="space-y-2">
                <Label htmlFor="offer-to">{t('commercial_offer_field_effective_to')}</Label>
                <Input
                  id="offer-to"
                  type="date"
                  value={effectiveTo}
                  onChange={(event) => setEffectiveTo(event.target.value)}
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="offer-notes">{t('commercial_offer_field_notes')}</Label>
            <Textarea
              id="offer-notes"
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>

          <div className="space-y-3 rounded-lg border p-3">
            <p className="text-sm font-medium">{t('commercial_offer_composition_title')}</p>
            <p className="text-xs text-muted-foreground">{t('commercial_offer_composition_help')}</p>

            {isEdit ? (
              <div className="space-y-3">
                {tiers.map((row) => (
                  <div key={row.tier_code} className="rounded-md border p-3 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{tierName(row.tier_code)}</p>
                        <p className="text-xs text-muted-foreground">
                          {(row.modules || []).length} {t('licensing_modules_count')} · {t('commercial_offer_modules_from_code')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`sale-${row.tier_code}`} className="text-xs text-muted-foreground">
                          {t('commercial_offer_field_commercially_available')}
                        </Label>
                        <Switch
                          id={`sale-${row.tier_code}`}
                          checked={row.commercially_available === true}
                          onCheckedChange={(checked) => toggleTier(row.tier_code, 'commercially_available', checked)}
                        />
                      </div>
                    </div>
                    {standards.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs text-muted-foreground">{t('licensing_standards')}</p>
                        <div className="flex flex-wrap gap-3">
                          {standards.map((standard) => (
                            <label
                              key={standard.code}
                              className="flex items-center gap-2 text-sm"
                              htmlFor={`std-${row.tier_code}-${standard.code}`}
                            >
                              <Checkbox
                                id={`std-${row.tier_code}-${standard.code}`}
                                checked={(row.standards || []).includes(standard.code)}
                                onCheckedChange={(checked) =>
                                  toggleStandard(row.tier_code, standard.code, checked === true)}
                              />
                              {standard.name}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <ul className="space-y-1.5">
                {previewTiers.map((tier) => (
                  <li key={tier.tier_code} className="text-sm">
                    <span className="font-medium">{tierName(tier.tier_code)}</span>
                    <span className="text-muted-foreground">
                      {' · '}{(tier.modules || []).length} {t('licensing_modules_count')}
                      {' · '}{standards.length} {t('licensing_standards').toLowerCase()}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {/* Packs/acréscimos (FM1) — a decisão comercial desta versão */}
            <div className="space-y-2 border-t pt-3">
              <p className="text-sm font-medium">{t('commercial_offer_addons_title')}</p>
              <p className="text-xs text-muted-foreground">{t('commercial_offer_addons_help')}</p>
              <div className="space-y-2">
                {orderedAddons(isEdit ? addons : previewAddons).map((row) => (
                  <div key={row.addon_code} className="flex items-start justify-between gap-3 rounded-md border p-2.5">
                    <div>
                      <p className="text-sm font-medium">{addonLabel(row.addon_code, t)}</p>
                      <p className="text-xs text-muted-foreground">
                        {(row.modules || [])
                          .map((module) => (typeof module === 'string' ? moduleNames.get(module) || module : module.name))
                          .join(' · ') || '—'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`sale-addon-${row.addon_code}`} className="text-xs text-muted-foreground">
                        {t('commercial_offer_field_commercially_available')}
                      </Label>
                      <Switch
                        id={`sale-addon-${row.addon_code}`}
                        checked={row.commercially_available === true}
                        disabled={!isEdit}
                        onCheckedChange={(checked) => toggleAddon(row.addon_code, checked)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="offer-reason">{t('commercial_reason')}</Label>
            <Input
              id="offer-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={t('commercial_reason_placeholder')}
            />
            <p className="text-xs text-muted-foreground">{t('commercial_reason_help')}</p>
          </div>

          {error && (
            <p className="flex items-start gap-2 text-sm text-destructive">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            {t('common_cancel')}
          </Button>
          <Button onClick={submit} disabled={pending} className="gap-2">
            {pending && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEdit ? t('common_save') : t('commercial_offer_create_confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
