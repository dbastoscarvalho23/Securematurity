import React from 'react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/LanguageContext';

const ZONE_CONFIG = [
  { min: 0,  max: 4,  labelKey: 'risk_level_low',      bg: 'bg-emerald-500', text: 'text-emerald-700',  border: 'border-emerald-200', light: 'bg-emerald-50' },
  { min: 4,  max: 9,  labelKey: 'risk_level_medium',   bg: 'bg-yellow-400',  text: 'text-yellow-700',   border: 'border-yellow-200',  light: 'bg-yellow-50' },
  { min: 9,  max: 16, labelKey: 'risk_level_high',     bg: 'bg-orange-500',  text: 'text-orange-700',   border: 'border-orange-200',  light: 'bg-orange-50' },
  { min: 16, max: 26, labelKey: 'risk_level_critical', bg: 'bg-red-500',     text: 'text-red-700',       border: 'border-red-200',    light: 'bg-red-50' },
];

function getZone(score) {
  return ZONE_CONFIG.find(z => score >= z.min && score < z.max) || ZONE_CONFIG[3];
}

export default function ResidualRiskGauge({ impact, likelihood }) {
  const { t } = useLanguage();
  const score = (impact || 0) * (likelihood || 0);
  const zone = getZone(score);
  const pct = Math.min(100, Math.round((score / 25) * 100));

  return (
    <div className={cn('rounded-xl border p-4 space-y-3', zone.border, zone.light)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {t('risk_residual_score')}
        </span>
        <div className={cn('flex items-center gap-2 px-3 py-1 rounded-full text-sm font-bold', zone.text)}>
          <span className={cn('w-2 h-2 rounded-full', zone.bg)} />
          {score} — {t(zone.labelKey)}
        </div>
      </div>

      {/* Bar */}
      <div className="relative h-3 bg-white/70 rounded-full overflow-hidden border border-white/50">
        {/* Zone backgrounds */}
        <div className="absolute inset-0 flex">
          <div className="bg-emerald-400/40" style={{ width: `${(4/25)*100}%` }} />
          <div className="bg-yellow-400/40" style={{ width: `${(5/25)*100}%` }} />
          <div className="bg-orange-400/40" style={{ width: `${(7/25)*100}%` }} />
          <div className="bg-red-400/40"    style={{ width: `${(9/25)*100}%` }} />
        </div>
        {/* Score indicator */}
        <div
          className={cn('absolute top-0 left-0 h-full rounded-full transition-all duration-500', zone.bg)}
          style={{ width: `${pct}%`, opacity: 0.85 }}
        />
        {/* Pointer */}
        {score > 0 && (
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 border-white shadow-md transition-all duration-500"
            style={{ left: `${pct}%`, background: 'currentColor' }}
          />
        )}
      </div>

      {/* Zone labels */}
      <div className="flex text-[10px] text-muted-foreground font-medium">
        <span style={{ width: `${(4/25)*100}%` }} className="text-emerald-600">{t('risk_level_low')}</span>
        <span style={{ width: `${(5/25)*100}%` }} className="text-yellow-600">{t('risk_level_medium')}</span>
        <span style={{ width: `${(7/25)*100}%` }} className="text-orange-600">{t('risk_level_high')}</span>
        <span style={{ width: `${(9/25)*100}%` }} className="text-red-600 text-right">{t('risk_level_critical')}</span>
      </div>

      <p className="text-xs text-muted-foreground">
        {t('risk_impact')} <strong>{impact || '–'}</strong> × {t('risk_likelihood')} <strong>{likelihood || '–'}</strong> = {t('risk_score')} <strong>{score || '–'}</strong>
      </p>
    </div>
  );
}