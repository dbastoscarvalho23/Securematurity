import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { json, readJson, getAuthenticatedUser, isStaffRole, isPlatformAdmin, userCustomerId } from '../../shared/http.ts';
import { logAudit } from '../../shared/audit.ts';
import { PROVIDERS, normalizeStorageRoot, defaultStorageRoot } from '../../shared/storage.ts';

/**
 * Repositório documental de um cliente: fornecedor (`provider`) e localização (`storage_root`).
 * O administrador da plataforma altera qualquer cliente; o administrador do cliente só o seu. Usa a service role para
 * que a entidade Customer continue fechada: esta função só toca em storage_provider, storage_root e
 * storage_configured_at.
 *
 * { customer_id? (só admin), provider, storage_root? } — storage_root omitido mantém o atual; '' volta à localização
 * por omissão (AnkoraOne/<cliente>). A localização é validada por normalizeStorageRoot.
 * Os ficheiros já guardados não mudam de sítio: só os novos seguem o repositório e a localização escolhidos.
 */
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await getAuthenticatedUser(base44);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    if (!isStaffRole(user)) return json({ error: 'Forbidden' }, 403);

    const isAdmin = isPlatformAdmin(user);
    const body = await readJson(req);
    const provider = body.provider;
    if (!PROVIDERS.includes(provider)) {
      return json({ error: 'Repositório inválido' }, 400);
    }

    const ownCustomerId = userCustomerId(user);
    const customerId = isAdmin ? (body.customer_id || ownCustomerId) : ownCustomerId;

    if (!customerId) {
      return json({ error: 'Sem cliente associado' }, 400);
    }
    if (!isAdmin && body.customer_id && body.customer_id !== ownCustomerId) {
      return json({ error: 'Forbidden' }, 403);
    }
    const customer = await base44.asServiceRole.entities.Customer.get(customerId).catch(() => null);
    if (!customer) return json({ error: 'Cliente inexistente' }, 404);

    let storageRoot = customer.storage_root || '';
    if (body.storage_root !== undefined) {
      try {
        storageRoot = normalizeStorageRoot(body.storage_root);
      } catch (e) {
        return json({ error: (e as Error).message }, 400);
      }
      // Guardar a localização por omissão como vazio: continua a acompanhar o nome do cliente.
      if (storageRoot === defaultStorageRoot(customer)) storageRoot = '';
      // Google Drive e OneDrive são uma conta só para toda a plataforma: dois clientes nunca partilham a mesma pasta.
      if (storageRoot) {
        // Comparação sem maiúsculas/minúsculas (o OneDrive não as distingue).
        const all = await base44.asServiceRole.entities.Customer.list('-created_date', 5000).catch(() => []);
        const key = storageRoot.toLowerCase();
        if (all.some((c) => c.id !== customerId && String(c.storage_root || '').toLowerCase() === key)) {
          return json({ error: 'Já existe outro cliente com esta localização. Escolha outra pasta.' }, 409);
        }
      }
    }

    if (provider === 'webdav') {
      // O NAS tem de estar configurado (e testado com sucesso) antes de passar a ser o repositório do cliente.
      const conn = (await base44.asServiceRole.entities.StorageConnection.filter({ customer_id: customerId, provider: 'webdav' }))[0];
      if (!conn || !conn.last_test_ok) {
        return json({ error: 'O NAS deste cliente ainda não está configurado ou o último teste falhou. Peça ao administrador da plataforma para o configurar.' }, 409);
      }
    }

    const before = { provider: customer.storage_provider || 'base44', root: customer.storage_root || '' };
    const changed = before.provider !== provider || before.root !== storageRoot;
    if (changed) {
      await base44.asServiceRole.entities.Customer.update(customerId, {
        storage_provider: provider,
        storage_root: storageRoot,
        storage_configured_at: new Date().toISOString(),
      });
      await logAudit(base44, 'settings_changed', {
        user_email: user.email, customer_id: customerId, entity_type: 'Customer', entity_id: customerId,
        details: `Repositório documental: ${before.provider} → ${provider}; localização «${before.root || defaultStorageRoot(customer)}» → «${storageRoot || defaultStorageRoot(customer)}». Os ficheiros existentes ficam onde estão.`,
      });
    }

    return json({ success: true, provider, storage_root: storageRoot, effective_root: storageRoot || defaultStorageRoot(customer), changed });
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
}
