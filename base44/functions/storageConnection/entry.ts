import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { json, readJson, getAuthenticatedUser, isPlatformAdmin, userCustomerId } from '../../shared/http.ts';
import { logAudit } from '../../shared/audit.ts';
import { encryptSecret, assertPublicHttpsUrl, testWebdav } from '../../shared/storage.ts';

/**
 * Configuração do repositório NAS (WebDAV sobre HTTPS) de um cliente.
 *  - get  { customer_id }                                         → configuração sem a palavra-passe
 *                                                                   (admin da plataforma; admin do próprio cliente)
 *  - save { customer_id, base_url, base_path, username, password? } → guarda (palavra-passe cifrada). Só admin.
 *  - test { customer_id }                                         → testa a ligação (PROPFIND). Só admin.
 * O endereço do NAS só é configurado pelo administrador da plataforma (risco de DNS rebinding, ver storage.ts).
 */
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await getAuthenticatedUser(base44);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const body = await readJson(req);
    const ownTenantRead = body.action === 'get' && user.role === 'customer_admin' && userCustomerId(user) && String(body.customer_id || '') === userCustomerId(user);
    if (!isPlatformAdmin(user) && !ownTenantRead) return json({ error: 'Forbidden' }, 403);
    const customerId = String(body.customer_id || '');
    const customer = customerId ? await base44.asServiceRole.entities.Customer.get(customerId).catch(() => null) : null;
    if (!customer) return json({ error: 'Cliente inexistente' }, 404);

    const rows = await base44.asServiceRole.entities.StorageConnection.filter({ customer_id: customerId, provider: 'webdav' });
    const current = rows[0] || null;
    const safe = (c) => c && { id: c.id, customer_id: c.customer_id, provider: c.provider, base_url: c.base_url, base_path: c.base_path, username: c.username, has_password: Boolean(c.password_enc), last_test_at: c.last_test_at, last_test_ok: c.last_test_ok, last_test_message: c.last_test_message };

    if (body.action === 'get') return json({ connection: safe(current) });

    if (body.action === 'save') {
      const u = await assertPublicHttpsUrl(String(body.base_url || ''));
      const data = {
        customer_id: customerId, provider: 'webdav', base_url: u.href,
        base_path: String(body.base_path || '').slice(0, 300), username: String(body.username || '').slice(0, 200),
      };
      if (body.password) data.password_enc = await encryptSecret(String(body.password));
      const saved = current
        ? await base44.asServiceRole.entities.StorageConnection.update(current.id, data)
        : await base44.asServiceRole.entities.StorageConnection.create(data);
      await logAudit(base44, 'settings_changed', { user_email: user.email, customer_id: customerId, entity_type: 'StorageConnection', entity_id: saved.id, details: `Repositório NAS (WebDAV) configurado: ${u.host}` });
      return json({ connection: safe(saved) });
    }

    if (body.action === 'test') {
      if (!current) return json({ error: 'Sem configuração' }, 404);
      let ok = false;
      let message = '';
      try { ok = await testWebdav(base44, customerId); message = 'Ligação bem-sucedida'; } catch (e) { message = e?.message || 'Falha'; }
      const saved = await base44.asServiceRole.entities.StorageConnection.update(current.id, { last_test_at: new Date().toISOString(), last_test_ok: ok, last_test_message: message });
      return json({ ok, message, connection: safe(saved) });
    }

    return json({ error: 'Ação desconhecida' }, 400);
  } catch (error) {
    return json({ error: error?.message || 'Erro' }, 400);
  }
}

