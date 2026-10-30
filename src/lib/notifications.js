import { base44 } from '@/api/base44Client';

/**
 * Esta app é importada do GitHub e o Base44 não corre aqui os workflows por evento; por isso as notificações são
 * pedidas diretamente às funções depois de gravar. Falhas nunca interrompem a operação principal.
 */
export function notifyDocumentStatus(documentId, status, previousDocument) {
  const type = status === 'under_review' ? 'sent_for_review' : status === 'approved' ? 'approved' : null;
  if (!type || !documentId) return;
  base44.functions.invoke('documentNotifications', { type, document_id: documentId, previousDocument: previousDocument || null })
    .catch((e) => console.warn('documentNotifications falhou', e));
}

/** Notificações de alteração (tarefas, riscos, documentos) pela função createNotifications, em modo direto. */
export function notifyEntityChange(entity, id, event = 'update', previous = null) {
  if (!entity || !id) return;
  base44.functions.invoke('createNotifications', { direct: true, entity, id, event, previous })
    .catch((e) => console.warn('createNotifications falhou', e));
}
