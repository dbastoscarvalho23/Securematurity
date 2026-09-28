/**
 * Traduções — Fase 2 do plano de correção.
 *
 * Chaves novas desta fase, nos dois idiomas. Consolidadas como as restantes
 * famílias (`translations-*.js`) e juntas em `translations.js` por Object.assign.
 *
 * Cobre: estados de erro com repetição e fronteira de página (FA4/FA5),
 * indicador de contexto ativo (FB3), bloqueio de escrita por capacidade (FC4)
 * e as exportações declaradas na matriz (FA3).
 */

export const phase2En = {
  // ─── Erros de leitura e fronteira de página (FA4/FA5) ───
  error_page_title: 'Something went wrong',
  error_page_desc: 'This page could not be displayed. Try again or continue using the navigation to the left.',
  error_data_title: 'Could not load the data',
  error_data_desc: 'The data did not arrive. This is not an empty list — try again.',
  error_retry: 'Try again',

  // ─── Contexto de tenant ativo (FB3) ───
  context_active_customer: 'Active context',
  context_no_customer: 'No active context',
  context_delegated: 'Delegated access',

  // ─── Bloqueio de escrita na simulação de papel (FC4) ───
  simulation_write_blocked_capability: 'This action is not part of the simulated role.',

  // ─── Exportações declaradas na matriz (FA3) ───
  compliance_metrics_export_pdf: 'Export PDF',
  compliance_metrics_export_error: 'Could not export the metrics.',
  strategic_report_export_pdf: 'Export PDF',
  strategic_report_export_error: 'Could not export the report.',
};

export const phase2Pt = {
  // ─── Erros de leitura e fronteira de página (FA4/FA5) ───
  error_page_title: 'Algo correu mal',
  error_page_desc: 'Esta página não pôde ser apresentada. Tente de novo ou continue a usar a navegação à esquerda.',
  error_data_title: 'Não foi possível carregar os dados',
  error_data_desc: 'Os dados não chegaram. Isto não é uma lista vazia — tente de novo.',
  error_retry: 'Tentar de novo',

  // ─── Contexto de tenant ativo (FB3) ───
  context_active_customer: 'Contexto ativo',
  context_no_customer: 'Sem contexto ativo',
  context_delegated: 'Acesso delegado',

  // ─── Bloqueio de escrita na simulação de papel (FC4) ───
  simulation_write_blocked_capability: 'Esta ação não faz parte do papel simulado.',

  // ─── Exportações declaradas na matriz (FA3) ───
  compliance_metrics_export_pdf: 'Exportar PDF',
  compliance_metrics_export_error: 'Não foi possível exportar as métricas.',
  strategic_report_export_pdf: 'Exportar PDF',
  strategic_report_export_error: 'Não foi possível exportar o relatório.',
};
