import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { json, readJson, getAuthenticatedUser, isPlatformAdmin, userCustomerId } from '../../shared/http.ts';
import {
  appendAuditEntry, verifyChain, sealChain, latestSeal,
  SERVER_ONLY_ACTIONS, VERIFIED_ACTION, BROKEN_ACTION, ANCHOR_ACTION, DETAILS_MAX, RECORD_PER_MINUTE,
} from '../../shared/auditChain.ts';

/**
 * Trilha de auditoria encadeada.
 *
 * Operação em `op`; por omissão `record`.
 *
 * - `record` (qualquer utilizador autenticado): regista um ato feito na interface. A autoria é a da sessão; um
 *   `user_email` enviado pelo cliente é ignorado. Quem não é administrador da plataforma só regista no seu cliente.
 *   Ações reservadas ao servidor (SERVER_ONLY_ACTIONS) são recusadas; há um limite de RECORD_PER_MINUTE por minuto.
 * - `verify` (administrador; também o workflow diário, que corre com a sessão do proprietário): recalcula a cadeia e
 *   regista o veredito na própria trilha, com o resumo da última entrada vista (a cabeça) em `entity_id`.
 * - `seal` (administrador): selo de partida, uma vez. Substituir um selo que deixou de conferir exige
 *   `confirm: true` e `reason` (pelo menos 10 caracteres), que ficam escritos no novo selo.
 * - `status` (administrador): o selo e a última verificação, para a página da auditoria.
 */
const ACTION_RE = /^[a-z][a-z0-9_]{2,59}$/;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await getAuthenticatedUser(base44);
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const body = await readJson(req);
    // Os workflows enviam os argumentos em `args`; a interface envia-os no corpo.
    const input = body?.args && typeof body.args === 'object' ? { ...body.args, ...body } : body;
    const op = String(input.op || 'record');

    if (op === 'record') {
      const action = String(input.action || '');
      if (!ACTION_RE.test(action)) return json({ error: 'Ação de auditoria inválida' }, 400);
      if (SERVER_ONLY_ACTIONS.includes(action)) return json({ error: 'Esta ação só é registada pelo servidor' }, 403);
      const since = new Date(Date.now() - 60_000).toISOString();
      const recent = await base44.asServiceRole.entities.AuditLog
        .filter({ user_email: user.email, created_date: { $gte: since } }, '-created_date', RECORD_PER_MINUTE + 1)
        .catch(() => []);
      if ((recent?.length || 0) >= RECORD_PER_MINUTE) return json({ error: 'Demasiados registos seguidos. Aguarde um minuto.' }, 429);
      const own = userCustomerId(user);
      const customerId = isPlatformAdmin(user) ? (input.customer_id || own || null) : own;
      const result = await appendAuditEntry(base44, {
        action,
        entity_type: String(input.entity_type || '').slice(0, 80),
        entity_id: String(input.entity_id || '').slice(0, 120),
        details: String(input.details || '').slice(0, DETAILS_MAX),
        customer_id: customerId,
        user_email: user.email,
        actor_attested: true,
        origin: 'session',
      });
      return json({ success: true, id: result.id });
    }

    if (!isPlatformAdmin(user)) return json({ error: 'Admin access required' }, 403);

    if (op === 'status') {
      const seal = await latestSeal(base44);
      const last = (await base44.asServiceRole.entities.AuditLog
        .filter({ action: { $in: [VERIFIED_ACTION, BROKEN_ACTION, ANCHOR_ACTION] } }, '-created_date', 1)
        .catch(() => []))?.[0] || null;
      return json({
        seal: seal ? { at: seal.created_date, covered: Number(seal.chain_count || 0), by: seal.user_email } : null,
        last_verification: last ? { at: last.created_date, action: last.action, details: last.details } : null,
      });
    }

    if (op === 'seal') {
      return json(await sealChain(base44, user.email, { confirm: input.confirm === true, reason: String(input.reason || '') }));
    }

    if (op === 'verify') {
      const result = await verifyChain(base44);
      if (result.sealed) {
        const action = result.verdict === 'broken' ? BROKEN_ACTION : result.verdict === 'review' ? ANCHOR_ACTION : VERIFIED_ACTION;
        await appendAuditEntry(base44, {
          action,
          entity_type: 'AuditLog',
          // A cabeça vista nesta verificação: a seguinte confirma que continua na trilha.
          entity_id: result.head || '',
          chain_count: result.checked,
          details: `${result.note}${result.first_broken ? ` Entrada: ${result.first_broken.id}.` : ''}`,
          user_email: user.email,
          actor_attested: true,
          origin: 'session',
        });
      }
      return json(result);
    }

    return json({ error: 'Operação desconhecida' }, 400);
  } catch (error) {
    return json({ error: error?.message || 'Erro na trilha de auditoria' }, 500);
  }
});
