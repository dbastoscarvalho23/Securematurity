// OAuth 2.0 / OpenID Connect com Google e Microsoft (login e conectores de armazenamento).
import crypto from 'node:crypto';
import { config } from '../config.js';
import { query } from '../db.js';
import { HttpError } from '../util.js';
import { randomToken } from './tokens.js';

const PROVIDERS = {
  google: {
    authUrl: () => 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: () => 'https://oauth2.googleapis.com/token',
    creds: () => config.oauth.google,
    issuers: ['https://accounts.google.com', 'accounts.google.com'],
  },
  microsoft: {
    authUrl: () => `https://login.microsoftonline.com/${config.oauth.microsoft.tenant}/oauth2/v2.0/authorize`,
    tokenUrl: () => `https://login.microsoftonline.com/${config.oauth.microsoft.tenant}/oauth2/v2.0/token`,
    creds: () => config.oauth.microsoft,
  },
};

const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Tenants Entra ID autorizados para o LOGIN Microsoft. Com o tenant "common", qualquer pessoa que
 * controle um tenant pode definir o email/UPN que quiser — por isso é obrigatório indicar os tenants.
 */
export function microsoftLoginTenants() {
  const { tenant, allowedTenants } = config.oauth.microsoft;
  if (allowedTenants.length) return allowedTenants;
  return GUID_RE.test(tenant) ? [tenant.toLowerCase()] : [];
}

const loginEnabled = (p) => PROVIDERS[p].creds().clientId && PROVIDERS[p].creds().clientSecret
  && (p !== 'microsoft' || microsoftLoginTenants().length > 0);

export const oauthProviders = () => Object.keys(PROVIDERS).filter(loginEnabled);

export function getProvider(name) {
  const p = PROVIDERS[name];
  if (!p) throw new HttpError(404, `Fornecedor OAuth desconhecido: ${name}`);
  const { clientId, clientSecret } = p.creds();
  if (!clientId || !clientSecret) throw new HttpError(501, `O início de sessão com ${name} não está configurado neste servidor.`);
  return { ...p, clientId, clientSecret };
}

/** Só se aceitam destinos dentro da própria aplicação (evita redireccionamentos abertos e fuga de tokens). */
export function safeReturnUrl(value) {
  const fallback = `${config.publicUrl}/`;
  if (!value) return fallback;
  try {
    const target = new URL(value, config.publicUrl);
    const base = new URL(config.publicUrl);
    if (target.origin !== base.origin) return fallback;
    return target.toString();
  } catch {
    return fallback;
  }
}

async function saveState(data) {
  const state = randomToken(24);
  await query(`DELETE FROM oauth_states WHERE expires_at < now()`);
  await query(`INSERT INTO oauth_states (state, data, expires_at) VALUES ($1, $2, now() + interval '10 minutes')`, [state, JSON.stringify(data)]);
  return state;
}

async function takeState(state) {
  if (!state) return null;
  const { rows } = await query(`DELETE FROM oauth_states WHERE state = $1 AND expires_at > now() RETURNING data`, [state]);
  return rows[0]?.data || null;
}

const pkce = () => {
  const verifier = randomToken(48);
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
};

function redirect(res, location) {
  res.writeHead(302, { Location: location, 'Cache-Control': 'no-store' });
  res.end();
}

/**
 * Constrói o URL de autorização.
 * purpose: 'login' (identidade) ou 'connector:<nome>' (acesso a Drive/OneDrive).
 */
export async function buildAuthorizationUrl({ provider, purpose, scopes, returnUrl, extra = {}, offline = false }) {
  const p = getProvider(provider);
  const { verifier, challenge } = pkce();
  const callbackPath = purpose === 'login' ? `/auth/oauth/${provider}/callback` : `/connectors/oauth/${provider}/callback`;
  const redirectUri = `${config.apiPublicUrl}${callbackPath}`;
  const state = await saveState({ provider, purpose, verifier, redirectUri, returnUrl: safeReturnUrl(returnUrl), ...extra });
  const url = new URL(p.authUrl());
  url.searchParams.set('client_id', p.clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', scopes.join(' '));
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  if (provider === 'google') {
    if (offline) { url.searchParams.set('access_type', 'offline'); url.searchParams.set('prompt', 'consent'); } else url.searchParams.set('prompt', 'select_account');
  } else {
    url.searchParams.set('prompt', 'select_account');
  }
  return url.toString();
}

/** Troca o código por tokens. */
export async function exchangeCode(state, code) {
  const p = getProvider(state.provider);
  const res = await fetch(p.tokenUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code', code, redirect_uri: state.redirectUri,
      client_id: p.clientId, client_secret: p.clientSecret, code_verifier: state.verifier,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new HttpError(400, `Falha na troca do código OAuth: ${json.error_description || json.error || res.status}`);
  return json;
}

export async function refreshAccessToken(provider, refreshToken, scopes) {
  const p = getProvider(provider);
  const res = await fetch(p.tokenUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token', refresh_token: refreshToken,
      client_id: p.clientId, client_secret: p.clientSecret,
      ...(provider === 'microsoft' && scopes ? { scope: scopes } : {}),
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new HttpError(502, `Falha ao renovar o token de ${provider}: ${json.error_description || json.error || res.status}`);
  return json;
}

/** Lê as reivindicações do id_token (obtido diretamente do endpoint de tokens por TLS). */
export function identityFromIdToken(provider, idToken, { forLogin = true } = {}) {
  if (!idToken) throw new HttpError(400, 'O fornecedor não devolveu id_token');
  const payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64url').toString('utf8'));
  const p = getProvider(provider);
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes(p.clientId)) throw new HttpError(400, 'id_token com audiência inválida');
  if (p.issuers && !p.issuers.includes(payload.iss)) throw new HttpError(400, 'id_token com emissor inválido');
  if (payload.exp && payload.exp * 1000 < Date.now()) throw new HttpError(400, 'id_token expirado');
  let email = payload.email;
  if (provider === 'google' && payload.email_verified === false) throw new HttpError(400, 'Email Google não verificado');
  if (provider === 'microsoft') {
    const tid = String(payload.tid || '').toLowerCase();
    if (forLogin) {
      if (!microsoftLoginTenants().includes(tid)) throw new HttpError(403, 'Esta organização Microsoft não está autorizada');
      if (payload.iss !== `https://login.microsoftonline.com/${tid}/v2.0`) throw new HttpError(400, 'id_token com emissor inválido');
    }
    // Dentro de um tenant autorizado, o UPN é gerido pelo administrador da organização.
    email = payload.email || payload.preferred_username || payload.upn;
  }
  if (!email || !String(email).includes('@')) throw new HttpError(400, 'Não foi possível obter o email da conta');
  return { email: String(email).toLowerCase(), name: payload.name || null };
}

// ---------------------------------------------------------------------------
// Rotas de login
// ---------------------------------------------------------------------------

export async function startOAuth(ctx) {
  const provider = ctx.params.provider;
  try {
    if (provider === 'microsoft' && !microsoftLoginTenants().length) {
      throw new HttpError(501, 'O início de sessão Microsoft exige MICROSOFT_ALLOWED_TENANT_IDS (ou MICROSOFT_TENANT com o ID do tenant).');
    }
    const url = await buildAuthorizationUrl({
      provider, purpose: 'login', scopes: ['openid', 'email', 'profile'],
      returnUrl: ctx.query.from_url || ctx.query.redirect_url || ctx.query.returnTo,
    });
    redirect(ctx.res, url);
  } catch (err) {
    redirect(ctx.res, `${config.publicUrl}/login?error=${encodeURIComponent(err.message)}`);
  }
}

export async function finishOAuth(ctx, onIdentity) {
  try {
    if (ctx.query.error) throw new HttpError(400, ctx.query.error_description || ctx.query.error);
    const state = await takeState(ctx.query.state);
    if (!state || state.purpose !== 'login' || state.provider !== ctx.params.provider) throw new HttpError(400, 'Pedido de autenticação inválido ou expirado');
    const tokens = await exchangeCode(state, ctx.query.code);
    const identity = identityFromIdToken(state.provider, tokens.id_token);
    const accessToken = await onIdentity(identity);
    const target = new URL(state.returnUrl);
    // No fragmento (#): não é enviado ao servidor nem fica nos registos de acesso.
    target.hash = `access_token=${encodeURIComponent(accessToken)}`;
    redirect(ctx.res, target.toString());
  } catch (err) {
    redirect(ctx.res, `${config.publicUrl}/login?error=${encodeURIComponent(err.message)}`);
  }
}

export { takeState };
