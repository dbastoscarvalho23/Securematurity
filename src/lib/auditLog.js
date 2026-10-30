import { invokeFn } from '@/lib/invokeFn';

/**
 * Regista uma entrada na trilha de auditoria, pelo servidor (função `audit`).
 *
 * A trilha é encadeada e só o servidor escreve: a autoria é a da sessão e um `user_email` indicado aqui é ignorado.
 * Quem não é administrador da plataforma só regista no seu próprio cliente. A auditoria nunca interrompe a
 * operação principal: uma falha fica na consola.
 */
export async function writeAuditLog({ action, entity_type, entity_id, details, customer_id }) {
  try {
    await invokeFn('audit', { op: 'record', action, entity_type, entity_id, details, customer_id });
  } catch (e) {
    console.warn('Audit log write failed:', e);
  }
}

/** Estado da cadeia (administrador): selo e última verificação. */
export const auditChainStatus = () => invokeFn('audit', { op: 'status' });
/** Verifica a cadeia agora (administrador). */
export const verifyAuditChain = () => invokeFn('audit', { op: 'verify' });
/** Selo de partida (administrador). */
export const sealAuditChain = () => invokeFn('audit', { op: 'seal' });
