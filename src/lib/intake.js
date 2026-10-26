import { invokeFn } from '@/lib/invokeFn';

/**
 * Documentos por classificar («00 Por classificar»), função «documentIntake».
 * O browser só envia o ficheiro e as decisões da pessoa; a pré-seleção, a classificação e a criação da evidência
 * são feitas no servidor.
 */

export const INTAKE_MAX_BYTES = 8 * 1024 * 1024;
export const INTAKE_OPEN_STATES = ['pending', 'proposed', 'error'];
export const DOC_LEVEL_TO_KEY = { L1: 'policy', L2: 'standard', L3: 'procedure', L4: 'playbook' };
export const DOCUMENT_KINDS = ['politica', 'norma', 'procedimento', 'playbook', 'registo', 'relatorio', 'contrato', 'captura', 'plano', 'ata', 'certificado', 'outro'];
// Pastas que a classificação pode propor (igual a CLASSIFY_FOLDERS em base44/shared/classify.ts).
export const CLASSIFY_FOLDERS = ['framing', 'security_docs', 'evidence', 'assessments', 'risks', 'incidents', 'suppliers', 'other'];

const call = (payload) => invokeFn('documentIntake', payload);

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(',')[1] || '');
  r.onerror = () => reject(r.error);
  r.readAsDataURL(file);
});

/** Carrega um ficheiro para «00 Por classificar». Devolve { intake, duplicate? }. */
export async function uploadIntake(file, customerId) {
  if (file.size > INTAKE_MAX_BYTES) throw new Error('O ficheiro excede 8 MB');
  const content_base64 = await fileToBase64(file);
  return call({
    action: 'upload', customer_id: customerId, file_name: file.name,
    mime_type: file.type || 'application/octet-stream', content_base64,
  });
}

export const listIntakes = async (customerId) => (await call({ action: 'list', customer_id: customerId }))?.intakes || [];
export const getIntake = (id) => call({ action: 'get', id });
export const refreshCandidates = (id) => call({ action: 'candidates', id });
export const classifyIntake = (id) => call({ action: 'classify', id });
export const acceptIntake = (id, payload) => call({ action: 'accept', id, ...payload });
export const rejectIntake = (id, reason) => call({ action: 'reject', id, reason });
