// Funções que a interface pode invocar diretamente (base44.functions.invoke ou invokeFn).
// As restantes só correm pelos workflows do sistema. O teste «a interface só chama funções
// permitidas» (test/unit.test.js) falha quando a interface passa a chamar uma função nova
// que não esteja aqui.
export const HTTP_FUNCTIONS = new Set([
  // gestão de utilizadores
  'listUsers', 'logUserLogin', 'manageUser',
  // notificações
  'createNotifications', 'documentNotifications', 'riskNotifications', 'taskNotifications',
  // documentos, evidências e armazenamento
  'documents', 'documentIntake', 'evidence', 'files', 'getStorageProviders', 'searchDocuments',
  'storageConnection', 'storeFileToCloud', 'updateCustomerStorage',
  // assistente de IA
  'aiAssist', 'aiDraft', 'aiQuestionnaire',
  // outros módulos
  'assets', 'cveMonitor', 'licensing', 'sendEmail',
  // execução manual por administradores (as próprias funções verificam o papel)
  'generateMonthlyAnnualReport', 'dataRetentionPurge',
]);
