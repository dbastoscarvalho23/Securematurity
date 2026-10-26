import { invokeFn } from '@/lib/invokeFn';

/**
 * Documentos de segurança: todas as escritas passam pela função `documents`, que aplica as permissões,
 * guarda as versões e só deixa aprovar com assinatura.
 */
const call = (payload) => invokeFn('documents', payload);

export const saveDocument = (document, changeNote) => call({ action: 'save', document, change_note: changeNote });
export const approveDocument = (documentId, signature, comments) => call({ action: 'approve', document_id: documentId, signature, comments });
export const revertDocument = (documentId, versionId) => call({ action: 'revert', document_id: documentId, version_id: versionId });
export const deleteDocument = (documentId) => call({ action: 'delete', document_id: documentId });
