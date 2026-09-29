import React from 'react';
import { Cloud, HardDrive } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

/**
 * Indicador discreto do alvo da preview (local ou cloud).
 *
 * O valor vem do `VITE_BASE44_PREVIEW_TARGET`, posto pelo
 * `.base44/dev-entrypoint.sh` a partir de `BASE44_PREVIEW_TARGET`. Não é um
 * host resolvido: é só o nome do alvo, igual em qualquer ambiente.
 *
 * Serve para que uma captura de ecrã do relatório de validação mostre, sem
 * ambiguidade, contra que backend a evidência foi recolhida — sem duplicar o
 * indicador de contexto de tenant (FB3), que é outra coisa.
 */
export default function PreviewTargetBadge() {
  const { t } = useLanguage();
  const cloud = import.meta.env.VITE_BASE44_PREVIEW_TARGET === 'cloud';
  const Icon = cloud ? Cloud : HardDrive;

  return (
    <span
      className={`hidden xl:inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs ${
        cloud
          ? 'border-primary/40 bg-primary/10 text-primary'
          : 'border-border bg-muted/40 text-muted-foreground'
      }`}
      title={t(cloud ? 'preview_target_title_cloud' : 'preview_target_title_local')}
    >
      <Icon className="w-3 h-3 flex-shrink-0" />
      <span className="truncate">{t(cloud ? 'preview_target_cloud' : 'preview_target_local')}</span>
    </span>
  );
}
