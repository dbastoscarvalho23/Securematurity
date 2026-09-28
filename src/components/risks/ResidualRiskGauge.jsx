import React from 'react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/LanguageContext';

/**
 * Escala de risco pelos tokens do design system (FC2): --risk-low/medium/high/
 * critical, já validados em contraste, em vez de uma paleta rígida fora do tema.
 */
const ZONE_CONFIG = [
  { min: 0,  max: 4,  labelKey: 'risk_level_low',      token: '--risk-low' },
  { min: 4,  max: 9,  labelKey: 'risk_level_medium',   token: '--risk-medium' },
  { min: 9,  max: 16, labelKey: 'risk_level_high',     token: '--risk-high' },
  { min: 16, max: 26, labelKey: 'risk_level_critical', token: '--risk-critical' },
];

const riskColor = (token, alpha) =>
  alpha == null ? `hsl(var(${token}))` : `hsl(var(${token}) / ${alpha})`;

function getZone(score) {
  return ZONE_CONFIG.find(z => score >= z.min && score < z.max) || ZONE_CONFIG[3];
}

export default function ResidualRiskGauge({ impact, likelihood }) {
  const { t } = useLanguage();
  const score = (impact || 0) * (likelihood || 0);
  const zone = getZone(score);
  const pct = Math.min(100, Math.round((score / 25) * 100));

  return (
    <div
      className="rounded-xl border p-4 space-y-3"
      style={{
        borderColor: riskColor(zone.token, 0.3),
        backgroundColor: riskColor(zone.token, 0.08),
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {t('risk_residual_score')}
        </span>
        <div
          className="flex items-center gap-2 px-3 py-1 rounded-full text-sm font-bold"
          style={{ color: riskColor(zone.token) }}
        >
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: riskColor(zone.token) }} />
          {score} — {t(zone.labelKey)}
        </div>
      </div>

      {/* Bar */}
      <div className="relative h-3 bg-background/70 rounded-full overflow-hidden border border-border">
        {/* Zone backgrounds */}
        <div className="absolute inset-0 flex">
          <div style={{ width: `${(4/25)*100}%`, backgroundColor: riskColor('--risk-low', 0.4) }} />
          <div style={{ width: `${(5/25)*100}%`, backgroundColor: riskColor('--risk-medium', 0.4) }} />
          <div style={{ width: `${(7/25)*100}%`, backgroundColor: riskColor('--risk-high', 0.4) }} />
          <div style={{ width: `${(9/25)*100}%`, backgroundColor: riskColor('--risk-critical', 0.4) }} />
        </div>
        {/* Score indicator */}
        <div
          className="absolute top-0 left-0 h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: riskColor(zone.token), opacity: 0.85 }}
        />
        {/* Pointer */}
        {score > 0 && (
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 border-background shadow-md transition-all duration-500"
            style={{ left: `${pct}%`, backgroundColor: riskColor(zone.token) }}
          />
        )}
      </div>

      {/* Zone labels */}
      <div className="flex text-[10px] text-muted-foreground font-medium">
        <span style={{ width: `${(4/25)*100}%`, color: riskColor('--risk-low') }}>{t('risk_level_low')}</span>
        <span style={{ width: `${(5/25)*100}%`, color: riskColor('--risk-medium') }}>{t('risk_level_medium')}</span>
        <span style={{ width: `${(7/25)*100}%`, color: riskColor('--risk-high') }}>{t('risk_level_high')}</span>
        <span style={{ width: `${(9/25)*100}%`, color: riskColor('--risk-critical') }} className="text-right">{t('risk_level_critical')}</span>
      </div>

      <p className="text-xs text-muted-foreground">
        {t('risk_impact')} <strong>{impact || '–'}</strong> × {t('risk_likelihood')} <strong>{likelihood || '–'}</strong> = {t('risk_score')} <strong>{score || '–'}</strong>
      </p>
    </div>
  );
}
