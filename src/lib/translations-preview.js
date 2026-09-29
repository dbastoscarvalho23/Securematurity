/**
 * Traduções — alvo da preview.
 *
 * O indicador discreto do alvo (local/cloud) existe para que uma captura de
 * ecrã do relatório de validação diga, sem ambiguidade, contra que backend a
 * evidência foi recolhida. Consolidado como as restantes famílias
 * (`translations-*.js`) e junto em `translations.js` por Object.assign.
 */

export const previewEn = {
  preview_target_local: 'Local backend',
  preview_target_cloud: 'Live backend',
  preview_target_title_local:
    'This preview runs against this branch’s backend in a local, throwaway emulator — the data is not real.',
  preview_target_title_cloud:
    'This preview runs against the app’s real backend: real sessions, real data and RLS evaluated server-side.',
};

export const previewPt = {
  preview_target_local: 'Backend local',
  preview_target_cloud: 'Backend real',
  preview_target_title_local:
    'Esta preview corre contra o backend desta branch num emulador local e descartável — os dados não são reais.',
  preview_target_title_cloud:
    'Esta preview corre contra o backend real da aplicação: sessões reais, dados reais e RLS avaliada no servidor.',
};
