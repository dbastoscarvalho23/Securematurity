import { LicenseError } from './license.ts';

/**
 * Limite de ritmo dos pedidos de IA.
 *
 * A quota mensal trava o gasto total, mas não trava uma rajada: sem limite de ritmo, um utilizador (ou um script
 * com a sessão dele) pode disparar dezenas de pedidos seguidos e esgotar os créditos de integração num minuto.
 * O registo de auditoria de cada pedido de IA serve de contador — não é preciso mais nenhum estado.
 *
 * 30 pedidos por minuto e por utilizador: folgado para os fluxos reais (a tradução do banco de perguntas envia
 * lotes de 10 e cada pedido ao modelo demora segundos), apertado para uma rajada automatizada.
 */
export const AI_REQUESTS_PER_MINUTE = 30;
const AI_ACTIONS = ['ai_assist', 'ai_draft_created', 'document_classified'];

/**
 * Recusa (429) quando o utilizador já esgotou o limite de pedidos de IA do último minuto.
 * Falha em aberto se a contagem não puder ser feita: o limite de ritmo é um travão de custo, não uma regra de acesso,
 * e a quota mensal continua a valer.
 */
export async function assertAiRateLimit(base44, user) {
  if (!user?.email) return;
  const since = new Date(Date.now() - 60_000).toISOString();
  let recent;
  try {
    recent = await base44.asServiceRole.entities.AuditLog.filter(
      { user_email: user.email, action: { $in: AI_ACTIONS }, created_date: { $gte: since } },
      '-created_date',
      AI_REQUESTS_PER_MINUTE + 1,
    );
  } catch (e) {
    console.warn('AI rate limit check failed:', e?.message || e);
    return;
  }
  if ((recent?.length || 0) >= AI_REQUESTS_PER_MINUTE) {
    throw new LicenseError(
      `Demasiados pedidos de IA seguidos (máximo de ${AI_REQUESTS_PER_MINUTE} por minuto). Aguarde um minuto e tente novamente.`,
      429,
    );
  }
}