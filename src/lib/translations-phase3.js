/**
 * Traduções — Fase 3 do plano de correção.
 *
 * Chaves novas desta fase, nos dois idiomas, consolidadas como as restantes
 * famílias (`translations-*.js`) e juntas em `translations.js` por Object.assign.
 *
 * Cobre: trilha de auditoria com filtros de servidor e exportação (FB5) e o
 * painel de automações/conservação e os anúncios da plataforma (FB4/FB8).
 */

export const phase3En = {
  // ─── Trilha de auditoria (FB5) ───
  audit_date_from: 'From',
  audit_date_to: 'To',
  audit_export_csv: 'Export CSV',
  audit_export_empty: 'Nothing to export with these filters.',
  audit_exported: 'entries exported.',
  audit_export_error: 'Could not export the audit trail.',
  audit_truncated: 'The result was capped at the most recent records in scope; narrow the date range for older entries.',
  audit_load_more: 'Load more',

  // ─── Automações e conservação (FB4) ───
  platform_ops_title: 'Automations and retention',
  platform_ops_subtitle: 'Workflow runs, retention policies and purge simulation',
  ops_automations_title: 'Scheduled automations',
  ops_automations_desc: 'Last run, duration and error for each workflow.',
  ops_col_workflow: 'Workflow',
  ops_col_last_run: 'Last run',
  ops_col_duration: 'Duration',
  ops_col_status: 'Status',
  ops_col_error: 'Error',
  ops_status_success: 'Success',
  ops_status_failed: 'Failed',
  ops_status_unknown: 'No runs recorded',
  ops_never_run: 'Never ran',
  ops_runs_title: 'Run history',
  ops_retention_title: 'Retention policies',
  ops_retention_desc: 'Retention window per entity and tenant, applied by the purge automation.',
  ops_col_entity: 'Entity',
  ops_col_days: 'Days',
  ops_col_tenant: 'Tenant',
  ops_col_action: 'Action',
  ops_action_purge: 'Purge',
  ops_action_archive: 'Archive',
  ops_action_anonymise: 'Anonymise',
  ops_all_tenants: 'All tenants',
  ops_policy_create: 'Add policy',
  ops_policy_updated: 'Retention policy saved.',
  ops_policy_error: 'Could not save the retention policy.',
  ops_simulate: 'Simulate (dry run)',
  ops_simulation_title: 'Purge simulation',
  ops_simulation_desc: 'Nothing is deleted: this shows what the purge would affect.',
  ops_simulation_empty: 'No records match the policy.',
  ops_simulation_affected: 'records would be affected',
  ops_simulation_error: 'Could not run the simulation.',
};

export const phase3Pt = {
  // ─── Trilha de auditoria (FB5) ───
  audit_date_from: 'De',
  audit_date_to: 'Até',
  audit_export_csv: 'Exportar CSV',
  audit_export_empty: 'Nada para exportar com estes filtros.',
  audit_exported: 'registos exportados.',
  audit_export_error: 'Não foi possível exportar a trilha de auditoria.',
  audit_truncated: 'O resultado ficou limitado aos registos mais recentes do âmbito; estreite o intervalo de datas para ver os mais antigos.',
  audit_load_more: 'Carregar mais',

  // ─── Automações e conservação (FB4) ───
  platform_ops_title: 'Automações e conservação',
  platform_ops_subtitle: 'Execuções das automações, políticas de conservação e simulação de purga',
  ops_automations_title: 'Automações agendadas',
  ops_automations_desc: 'Última execução, duração e erro de cada workflow.',
  ops_col_workflow: 'Automação',
  ops_col_last_run: 'Última execução',
  ops_col_duration: 'Duração',
  ops_col_status: 'Estado',
  ops_col_error: 'Erro',
  ops_status_success: 'Sucesso',
  ops_status_failed: 'Falhou',
  ops_status_unknown: 'Sem execuções registadas',
  ops_never_run: 'Nunca correu',
  ops_runs_title: 'Histórico de execuções',
  ops_retention_title: 'Políticas de conservação',
  ops_retention_desc: 'Prazo de conservação por entidade e por tenant, aplicado pela automação de purga.',
  ops_col_entity: 'Entidade',
  ops_col_days: 'Dias',
  ops_col_tenant: 'Tenant',
  ops_col_action: 'Ação',
  ops_action_purge: 'Purgar',
  ops_action_archive: 'Arquivar',
  ops_action_anonymise: 'Anonimizar',
  ops_all_tenants: 'Todos os tenants',
  ops_policy_create: 'Adicionar política',
  ops_policy_updated: 'Política de conservação guardada.',
  ops_policy_error: 'Não foi possível guardar a política de conservação.',
  ops_simulate: 'Simular (sem apagar)',
  ops_simulation_title: 'Simulação de purga',
  ops_simulation_desc: 'Nada é apagado: mostra o que a purga afectaria.',
  ops_simulation_empty: 'Nenhum registo corresponde à política.',
  ops_simulation_affected: 'registos seriam afectados',
  ops_simulation_error: 'Não foi possível executar a simulação.',
};
