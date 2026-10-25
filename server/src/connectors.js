// Conectores OAuth (Google Drive e OneDrive), equivalentes a base44.asServiceRole.connectors.getConnection(nome).
// Um administrador liga a conta uma vez; o servidor guarda e renova os tokens.
import path from 'node:path';
import { config } from './config.js';
import { query } from './db.js';
import { HttpError, readJsoncDir } from './util.js';
import { buildAuthorizationUrl, exchangeCode, refreshAccessToken, takeState, identityFromIdToken } from './auth/oauth.js';
import { requireRole } from './auth/routes.js';

// Tipo de conector -> fornecedor OAuth.
const CONNECTOR_PROVIDER = { googledrive: 'google', one_drive: 'microsoft' };

let definitions = null;
function loadDefinitions() {
  if (definitions) return definitions;
  definitions = new Map();
  for (const { file, data } of readJsoncDir(path.join(config.base44Dir, 'connectors'))) {
    const name = data.type || path.basename(file).replace(/\.jsonc?$/, '');
    definitions.set(name, { name, scopes: data.scopes || [], provider: CONNECTOR_PROVIDER[name] });
  }
  return definitions;
}

function definition(name) {
  const def = loadDefinitions().get(name);
  if (!def || !def.provider) throw new HttpError(404, `Conector desconhecido: ${name}`);
  return def;
}

function scopesFor(def) {
  const base = def.provider === 'google' ? ['openid', 'email'] : ['openid', 'email', 'offline_access'];
  return [...new Set([...base, ...def.scopes])];
}

/** Devolve { accessToken } renovando-o se necessário. Lança erro se o conector não estiver ligado. */
export async function getConnection(name) {
  const def = definition(name);
  const { rows } = await query('SELECT * FROM connector_connections WHERE name = $1', [name]);
  const conn = rows[0];
  if (!conn) throw new HttpError(404, `O conector ${name} não está ligado`);
  const expiresAt = conn.expires_at ? new Date(conn.expires_at).getTime() : 0;
  if (conn.access_token && expiresAt - Date.now() > 60_000) return { accessToken: conn.access_token, account: conn.account_email };
  if (!conn.refresh_token) throw new HttpError(409, `O conector ${name} expirou e precisa de ser ligado novamente`);
  const tokens = await refreshAccessToken(def.provider, conn.refresh_token, scopesFor(def).join(' '));
  await query(
    `UPDATE connector_connections SET access_token = $2, refresh_token = COALESCE($3, refresh_token), expires_at = now() + ($4 || ' seconds')::interval, updated_date = now() WHERE name = $1`,
    [name, tokens.access_token, tokens.refresh_token || null, String(tokens.expires_in || 3600)],
  );
  return { accessToken: tokens.access_token, account: conn.account_email };
}

export function registerConnectorRoutes(router) {
  router.get('/connectors', async (ctx) => {
    requireRole(ctx, ['admin']);
    const { rows } = await query('SELECT name, account_email, connected_by, updated_date FROM connector_connections');
    const connected = new Map(rows.map((r) => [r.name, r]));
    return [...loadDefinitions().values()].map((d) => ({
      name: d.name, provider: d.provider, scopes: d.scopes,
      connected: connected.has(d.name), account_email: connected.get(d.name)?.account_email || null,
      connected_by: connected.get(d.name)?.connected_by || null, updated_date: connected.get(d.name)?.updated_date || null,
    }));
  });

  // Devolve o URL de autorização (o browser não envia o token num redireccionamento direto).
  router.post('/connectors/:name/authorize', async (ctx) => {
    const admin = requireRole(ctx, ['admin']);
    const def = definition(ctx.params.name);
    const body = await ctx.json();
    const url = await buildAuthorizationUrl({
      provider: def.provider, purpose: `connector:${def.name}`, scopes: scopesFor(def), offline: true,
      returnUrl: body.return_url || `${config.publicUrl}/settings`, extra: { connectedBy: admin.email },
    });
    return { url };
  });

  router.get('/connectors/oauth/:provider/callback', async (ctx) => {
    const fail = (msg) => { ctx.res.writeHead(302, { Location: `${config.publicUrl}/settings?connector_error=${encodeURIComponent(msg)}` }); ctx.res.end(); };
    try {
      if (ctx.query.error) throw new HttpError(400, ctx.query.error_description || ctx.query.error);
      const state = await takeState(ctx.query.state);
      if (!state || !String(state.purpose).startsWith('connector:') || state.provider !== ctx.params.provider) throw new HttpError(400, 'Pedido inválido ou expirado');
      const name = state.purpose.slice('connector:'.length);
      const def = definition(name);
      const tokens = await exchangeCode(state, ctx.query.code);
      let account = null;
      try { account = identityFromIdToken(def.provider, tokens.id_token, { forLogin: false }).email; } catch { account = null; }
      await query(
        `INSERT INTO connector_connections (name, access_token, refresh_token, expires_at, scopes, account_email, connected_by, updated_date)
         VALUES ($1, $2, $3, now() + ($4 || ' seconds')::interval, $5, $6, $7, now())
         ON CONFLICT (name) DO UPDATE SET access_token = EXCLUDED.access_token,
           refresh_token = COALESCE(EXCLUDED.refresh_token, connector_connections.refresh_token),
           expires_at = EXCLUDED.expires_at, scopes = EXCLUDED.scopes, account_email = EXCLUDED.account_email,
           connected_by = EXCLUDED.connected_by, updated_date = now()`,
        [name, tokens.access_token, tokens.refresh_token || null, String(tokens.expires_in || 3600), tokens.scope || scopesFor(def).join(' '), account, state.connectedBy || null],
      );
      const target = new URL(state.returnUrl);
      target.searchParams.set('connector', name);
      target.searchParams.set('connector_status', 'connected');
      ctx.res.writeHead(302, { Location: target.toString() });
      ctx.res.end();
    } catch (err) {
      fail(err.message);
    }
  });

  router.delete('/connectors/:name', async (ctx) => {
    requireRole(ctx, ['admin']);
    definition(ctx.params.name);
    await query('DELETE FROM connector_connections WHERE name = $1', [ctx.params.name]);
    return { success: true };
  });
}
