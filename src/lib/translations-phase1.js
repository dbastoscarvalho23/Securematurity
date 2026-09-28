// Fase 1 — quick wins de apresentação (FC1, FC2, FC3, FC5, FC6).
//
// Chaves novas introduzidas ao fechar as divergências que se repetiam em todas
// as páginas: mensagens visíveis que estavam em inglês numa interface PT-PT
// (FC3) e nomes acessíveis das ações de ícone (FC6). As mensagens de retorno e
// de erro passam a viver aqui, como no resto da aplicação, em vez de cadeias
// escritas directamente no componente.
//
// Mesclado em `translations.js` por Object.assign, tal como os restantes
// ficheiros de traduções.

export const phase1En = {
  // ─── FC3 · rótulos de entidade (SystemStatus) ────────────────
  sys_entity_assessment: 'Assessments',
  sys_entity_task: 'Tasks',
  sys_entity_risk: 'Risks',
  sys_entity_security_document: 'Security Documents',
  sys_entity_customer: 'Customers',
  sys_entity_user: 'Users',
  sys_entity_nomination: 'Nominations',
  sys_entity_incident: 'Incidents',
  sys_entity_vulnerability: 'Vulnerabilities',
  sys_entity_supplier: 'Suppliers',
  sys_entity_training_user: 'Training Users',
  sys_entity_knowledge_article: 'Knowledge Articles',
  sys_entity_assessment_response: 'Assessment Responses',

  // ─── FC3 · acesso externo (delegações e integrações) ─────────
  ea_pending_requests: 'Pending Requests',
  ea_onboarding_summary: 'Onboarding',
  ea_section_pending_requests: 'Pending Delegation Requests',
  ea_section_pending_onboarding: 'Pending Onboarding',
  ea_section_active_onboarding: 'Active Onboarding',
  ea_section_revoked_expired: 'Revoked / Expired History',
  ea_no_authorized_tenants: 'No authorized tenants',
  ea_no_authorized_tenants_desc: 'Request delegation access to a customer to get started.',
  ea_approve: 'Approve',
  ea_reject: 'Reject',
  ea_accept: 'Accept',
  ea_onboard: 'Onboard',
  ea_request_access: 'Request Access',
  ea_dialog_request_title: 'Request Delegation',
  ea_select_customer_ph: 'Select customer',
  ea_authorized_modules: 'Authorized modules (at least one)',
  ea_authorized_modules_note:
    'A delegation authorises only the modules selected here — an empty selection would grant no module at all.',
  ea_access_until: 'Access until (required)',
  ea_access_until_note:
    'Delegations are time-boxed — the customer admin must approve the request before it takes effect.',
  ea_reason: 'Reason',
  ea_reason_ph: 'Justification for access request',
  ea_send_request: 'Send Request',
  ea_sending: 'Sending…',
  ea_dialog_onboard_title: 'Onboard User to Customer',
  ea_onboarding_note:
    "Onboarding covers account set-up only. It does not grant access to the customer's compliance data — that requires a time-boxed delegation approved by the customer.",
  ea_onboarding_reason_ph: 'Reason for onboarding',
  ea_create_onboarding: 'Create Onboarding',
  ea_creating: 'Creating…',
  ea_assigned_by_inline: 'by',
  ea_expires_inline: 'expires',
  ea_status_onboarding: 'Onboarding',
  ea_legacy: 'Legacy',
  ea_delegation_request_sent: 'Delegation request sent',
  ea_request_failed: 'Failed to request delegation',
  ea_onboarding_created: 'Onboarding created',
  ea_onboarding_failed: 'Failed to create onboarding',
  ea_delegation_approved: 'Delegation approved',
  ea_approve_failed: 'Failed to approve',
  ea_delegation_rejected: 'Delegation rejected',
  ea_reject_failed: 'Failed to reject',
  ea_revoke_failed: 'Failed to revoke',
  ea_onboarding_accepted: 'Onboarding accepted',
  ea_accept_failed: 'Failed to accept',
  ea_onboarding_revoked: 'Onboarding revoked',

  // ─── FC3 · níveis de acesso e estados de atribuição ──────────
  delegation_role_viewer: 'Viewer',
  delegation_role_viewer_desc: 'Read-only access to customer data',
  delegation_role_contributor: 'Contributor',
  delegation_role_contributor_desc: 'Can create and edit customer data',
  delegation_role_admin: 'Admin',
  delegation_role_admin_desc: 'Full access to customer data and settings',
  assignment_status_pending: 'Pending',
  assignment_status_active: 'Active',
  assignment_status_expired: 'Expired',
  assignment_status_revoked: 'Revoked',

  // ─── FC3 · banco de perguntas ────────────────────────────────
  qb_all_translated: 'All questions already have a Portuguese translation!',
  qb_no_duplicates: 'No duplicates found — your question bank is clean!',
  qb_confirm_translate: 'Translate {count} question(s) to European Portuguese?',
  qb_confirm_duplicates: 'Found {count} duplicate question(s). Delete them now?',
  qb_confirm_delete: 'Delete question "{text}…"?',

  // ─── FC3 · escala de maturidade (relatório estratégico) ──────
  maturity_0: 'Not Implemented',
  maturity_1: 'Initial',
  maturity_2: 'Developing',
  maturity_3: 'Defined',
  maturity_4: 'Managed',
  maturity_5: 'Optimized',

  // ─── FC3 · clientes, documentos e lembretes ──────────────────
  customers_create_failed: 'Failed to create customer',
  customers_update_failed: 'Failed to update customer',
  customers_delete_failed: 'Failed to delete customer',
  nomination_doc_deleted: 'Nomination document deleted',
  common_fix_highlighted: 'Please correct the highlighted fields.',

  // ─── FC3 · análise de tarefas ────────────────────────────────
  analytics_no_tasks: 'No tasks to display',
  task_status_todo: 'To-Do',
  task_status_in_progress: 'In Progress',
  task_status_done: 'Done',

  // ─── FC6 · nomes acessíveis das ações de ícone ───────────────
  aria_workspace_toggle: 'Expand or collapse sub-workspaces',
  aria_workspace_add_child: 'Add sub-workspace',
  aria_workspace_edit: 'Edit workspace',
  aria_workspace_delete: 'Delete workspace',
  aria_customer_actions: 'Customer actions',
  aria_customer_open: 'Open detail of {name}',
  aria_admin_drilldown: 'Show details of {name}',
  aria_close: 'Close',
  stat_vs_last_period: 'vs last period',
  pa_expired: 'Expired',
};

export const phase1Pt = {
  // ─── FC3 · rótulos de entidade (SystemStatus) ────────────────
  sys_entity_assessment: 'Avaliações',
  sys_entity_task: 'Tarefas',
  sys_entity_risk: 'Riscos',
  sys_entity_security_document: 'Documentos de segurança',
  sys_entity_customer: 'Clientes',
  sys_entity_user: 'Utilizadores',
  sys_entity_nomination: 'Nomeações',
  sys_entity_incident: 'Incidentes',
  sys_entity_vulnerability: 'Vulnerabilidades',
  sys_entity_supplier: 'Fornecedores',
  sys_entity_training_user: 'Utilizadores em formação',
  sys_entity_knowledge_article: 'Artigos de conhecimento',
  sys_entity_assessment_response: 'Respostas de avaliação',

  // ─── FC3 · acesso externo (delegações e integrações) ─────────
  ea_pending_requests: 'Pedidos pendentes',
  ea_onboarding_summary: 'Integrações',
  ea_section_pending_requests: 'Pedidos de delegação pendentes',
  ea_section_pending_onboarding: 'Integrações pendentes',
  ea_section_active_onboarding: 'Integrações ativas',
  ea_section_revoked_expired: 'Histórico de revogadas e expiradas',
  ea_no_authorized_tenants: 'Sem clientes autorizados',
  ea_no_authorized_tenants_desc: 'Peça uma delegação de acesso a um cliente para começar.',
  ea_approve: 'Aprovar',
  ea_reject: 'Rejeitar',
  ea_accept: 'Aceitar',
  ea_onboard: 'Integrar',
  ea_request_access: 'Pedir acesso',
  ea_dialog_request_title: 'Pedir delegação',
  ea_select_customer_ph: 'Selecionar cliente',
  ea_authorized_modules: 'Módulos autorizados (pelo menos um)',
  ea_authorized_modules_note:
    'A delegação autoriza apenas os módulos aqui selecionados — sem seleção não é concedido nenhum módulo.',
  ea_access_until: 'Acesso até (obrigatório)',
  ea_access_until_note:
    'As delegações têm prazo — o administrador do cliente tem de aprovar o pedido para que produza efeito.',
  ea_reason: 'Motivo',
  ea_reason_ph: 'Justificação do pedido de acesso',
  ea_send_request: 'Enviar pedido',
  ea_sending: 'A enviar…',
  ea_dialog_onboard_title: 'Integrar utilizador num cliente',
  ea_onboarding_note:
    'A integração cobre apenas a configuração da conta. Não concede acesso aos dados de conformidade do cliente — para isso é necessária uma delegação com prazo, aprovada pelo cliente.',
  ea_onboarding_reason_ph: 'Motivo da integração',
  ea_create_onboarding: 'Criar integração',
  ea_creating: 'A criar…',
  ea_assigned_by_inline: 'por',
  ea_expires_inline: 'expira em',
  ea_status_onboarding: 'Integração',
  ea_legacy: 'Legado',
  ea_delegation_request_sent: 'Pedido de delegação enviado',
  ea_request_failed: 'Não foi possível pedir a delegação',
  ea_onboarding_created: 'Integração criada',
  ea_onboarding_failed: 'Não foi possível criar a integração',
  ea_delegation_approved: 'Delegação aprovada',
  ea_approve_failed: 'Não foi possível aprovar',
  ea_delegation_rejected: 'Delegação rejeitada',
  ea_reject_failed: 'Não foi possível rejeitar',
  ea_revoke_failed: 'Não foi possível revogar',
  ea_onboarding_accepted: 'Integração aceite',
  ea_accept_failed: 'Não foi possível aceitar',
  ea_onboarding_revoked: 'Integração revogada',

  // ─── FC3 · níveis de acesso e estados de atribuição ──────────
  delegation_role_viewer: 'Consulta',
  delegation_role_viewer_desc: 'Acesso de leitura aos dados do cliente',
  delegation_role_contributor: 'Colaborador',
  delegation_role_contributor_desc: 'Pode criar e editar dados do cliente',
  delegation_role_admin: 'Administrador',
  delegation_role_admin_desc: 'Acesso total aos dados e definições do cliente',
  assignment_status_pending: 'Pendente',
  assignment_status_active: 'Ativa',
  assignment_status_expired: 'Expirada',
  assignment_status_revoked: 'Revogada',

  // ─── FC3 · banco de perguntas ────────────────────────────────
  qb_all_translated: 'Todas as perguntas já têm tradução em português!',
  qb_no_duplicates: 'Não foram encontrados duplicados — o banco de perguntas está limpo!',
  qb_confirm_translate: 'Traduzir {count} pergunta(s) para português de Portugal?',
  qb_confirm_duplicates: 'Encontradas {count} pergunta(s) duplicada(s). Eliminar agora?',
  qb_confirm_delete: 'Eliminar a pergunta "{text}…"?',

  // ─── FC3 · escala de maturidade (relatório estratégico) ──────
  maturity_0: 'Não implementado',
  maturity_1: 'Inicial',
  maturity_2: 'Em desenvolvimento',
  maturity_3: 'Definido',
  maturity_4: 'Gerido',
  maturity_5: 'Otimizado',

  // ─── FC3 · clientes, documentos e lembretes ──────────────────
  customers_create_failed: 'Não foi possível criar o cliente',
  customers_update_failed: 'Não foi possível atualizar o cliente',
  customers_delete_failed: 'Não foi possível eliminar o cliente',
  nomination_doc_deleted: 'Documento de nomeação eliminado',
  common_fix_highlighted: 'Corrija os campos assinalados.',

  // ─── FC3 · análise de tarefas ────────────────────────────────
  analytics_no_tasks: 'Sem tarefas para apresentar',
  task_status_todo: 'A fazer',
  task_status_in_progress: 'Em curso',
  task_status_done: 'Concluída',

  // ─── FC6 · nomes acessíveis das ações de ícone ───────────────
  aria_workspace_toggle: 'Expandir ou recolher sub-workspaces',
  aria_workspace_add_child: 'Adicionar sub-workspace',
  aria_workspace_edit: 'Editar workspace',
  aria_workspace_delete: 'Eliminar workspace',
  aria_customer_actions: 'Ações do cliente',
  aria_customer_open: 'Abrir detalhe de {name}',
  aria_admin_drilldown: 'Ver detalhes de {name}',
  aria_close: 'Fechar',
  stat_vs_last_period: 'vs período anterior',
  pa_expired: 'Expirada',
};
