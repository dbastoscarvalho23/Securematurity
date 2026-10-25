// Autenticação: email/palavra-passe com verificação por código, recuperação, convites e OAuth (Google/Microsoft).
import { config } from '../config.js';
import { query } from '../db.js';
import { HttpError, newId, sha256, createRateLimiter } from '../util.js';
import { EntityService, rowToUser } from '../entities/service.js';
import { emitEntityEvent } from '../events.js';
import { sendEmail, systemEmail, emailConfigured } from '../integrations/email.js';
import { signJwt, verifyJwt, hashPassword, verifyPassword, randomToken, randomOtp } from './tokens.js';
import { oauthProviders, startOAuth, finishOAuth } from './oauth.js';

const loginLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10 });
const otpLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10 });
const mailLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 5 });

const normEmail = (e) => String(e || '').trim().toLowerCase();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------------------------------------------------------------------------
// Utilizadores e sessões
// ---------------------------------------------------------------------------

export async function findUserByEmail(email) {
  const { rows } = await query('SELECT * FROM users WHERE lower(email) = $1', [normEmail(email)]);
  return rows[0] || null;
}

export async function findUserById(id) {
  const { rows } = await query('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0] || null;
}

export function issueToken(row) {
  return signJwt({ sub: row.id, email: row.email, tv: row.token_version });
}

/** Valida o cabeçalho Authorization e devolve { user, token } ou null. */
export async function authenticate(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  return authenticateToken(token);
}

export async function authenticateToken(token) {
  if (!token) return null;
  const payload = verifyJwt(token);
  if (!payload?.sub) return null;
  const row = await findUserById(payload.sub);
  if (!row || row.disabled || (payload.tv ?? 0) !== row.token_version) return null;
  return { user: rowToUser(row), token };
}

export function requireUser(ctx) {
  if (!ctx.user) throw new HttpError(401, 'Autenticação necessária');
  return ctx.user;
}

export function requireRole(ctx, roles) {
  const user = requireUser(ctx);
  if (!roles.includes(user.role)) throw new HttpError(403, 'Sem permissão');
  return user;
}

async function createUserRow({ email, password_hash = null, full_name = null, role = 'user', is_verified = false, data = {} }) {
  const { rows } = await query(
    `INSERT INTO users (id, email, password_hash, full_name, role, data, is_verified)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [newId(), normEmail(email), password_hash, full_name, role, JSON.stringify(data), is_verified],
  );
  const user = rowToUser(rows[0]);
  emitEntityEvent({ entity: 'User', type: 'create', id: user.id, data: user, old_data: null });
  return rows[0];
}

// ---------------------------------------------------------------------------
// Tokens de uso único (código de verificação, recuperação, convite)
// ---------------------------------------------------------------------------

async function storeToken(purpose, email, secret, { ttlSeconds, data = {} }) {
  await query(`UPDATE auth_tokens SET used_at = now() WHERE lower(email) = $1 AND purpose = $2 AND used_at IS NULL`, [normEmail(email), purpose]);
  await query(
    `INSERT INTO auth_tokens (token_hash, purpose, email, data, expires_at) VALUES ($1, $2, $3, $4, now() + ($5 || ' seconds')::interval)`,
    [sha256(`${purpose}:${secret}`), purpose, normEmail(email), JSON.stringify(data), String(ttlSeconds)],
  );
}

async function consumeToken(purpose, secret) {
  const { rows } = await query(
    `UPDATE auth_tokens SET used_at = now() WHERE token_hash = $1 AND purpose = $2 AND used_at IS NULL AND expires_at > now() RETURNING *`,
    [sha256(`${purpose}:${secret}`), purpose],
  );
  return rows[0] || null;
}

async function activeInvite(email) {
  const { rows } = await query(
    `SELECT * FROM auth_tokens WHERE lower(email) = $1 AND purpose = 'invite' AND used_at IS NULL AND expires_at > now() ORDER BY created_at DESC LIMIT 1`,
    [normEmail(email)],
  );
  return rows[0] || null;
}

async function sendOtp(email) {
  const code = randomOtp();
  await storeToken('otp', email, `${normEmail(email)}:${code}`, { ttlSeconds: 10 * 60 });
  await sendEmail({
    to: email,
    subject: 'Código de verificação',
    body: systemEmail({ title: 'Confirme o seu email', intro: 'Utilize o código seguinte para concluir o registo. É válido durante 10 minutos.', code }),
  });
  if (!emailConfigured() && !config.isProduction) console.warn(`[auth] código de verificação para ${email}: ${code}`);
}

async function verifyOtpCode(email, code) {
  const e = normEmail(email);
  const row = await consumeToken('otp', `${e}:${String(code).trim()}`);
  if (row) return true;
  // Contar tentativas falhadas no código ativo e invalidá-lo ao fim de 5.
  await query(
    `UPDATE auth_tokens SET attempts = attempts + 1, used_at = CASE WHEN attempts + 1 >= 5 THEN now() ELSE used_at END
     WHERE lower(email) = $1 AND purpose = 'otp' AND used_at IS NULL`,
    [e],
  );
  return false;
}

/** Aplica um convite pendente (papel) a um utilizador que acabou de se registar. */
async function applyInvite(row) {
  const invite = await activeInvite(row.email);
  if (!invite) return row;
  await query(`UPDATE auth_tokens SET used_at = now() WHERE token_hash = $1`, [invite.token_hash]);
  const role = invite.data?.role === 'admin' ? 'admin' : row.role;
  if (role !== row.role) {
    const { rows } = await query('UPDATE users SET role = $2, updated_date = now() WHERE id = $1 RETURNING *', [row.id, role]);
    return rows[0];
  }
  return row;
}

export async function ensureBootstrapAdmin() {
  if (!config.bootstrapAdminEmail || !config.bootstrapAdminPassword) return;
  const existing = await findUserByEmail(config.bootstrapAdminEmail);
  if (existing) return;
  await createUserRow({
    email: config.bootstrapAdminEmail,
    password_hash: await hashPassword(config.bootstrapAdminPassword),
    full_name: 'Administrador',
    role: 'admin',
    is_verified: true,
    data: { display_name: 'Administrador' },
  });
  console.log(`[auth] administrador inicial criado: ${config.bootstrapAdminEmail}`);
}

// ---------------------------------------------------------------------------
// Rotas
// ---------------------------------------------------------------------------

export function registerAuthRoutes(router) {
  router.get('/auth/me', (ctx) => requireUser(ctx));

  router.put('/auth/me', async (ctx) => {
    const user = requireUser(ctx);
    return new EntityService({ user }).updateUser(user.id, await ctx.json());
  });

  router.post('/auth/login', async (ctx) => {
    const { email, password } = await ctx.json();
    if (!loginLimiter(`${ctx.ip}:${normEmail(email)}`)) throw new HttpError(429, 'Demasiadas tentativas. Tente novamente mais tarde.');
    const row = await findUserByEmail(email);
    const ok = row && row.password_hash && !row.disabled && await verifyPassword(password, row.password_hash);
    if (!ok) throw new HttpError(401, 'Email ou palavra-passe inválidos');
    if (config.requireEmailVerification && !row.is_verified) {
      throw new HttpError(403, 'O email ainda não foi verificado', { extra_data: { reason: 'email_not_verified' } });
    }
    const { rows } = await query('UPDATE users SET last_login = now() WHERE id = $1 RETURNING *', [row.id]);
    return { access_token: issueToken(rows[0]), user: rowToUser(rows[0]) };
  });

  router.post('/auth/register', async (ctx) => {
    const { email, password, full_name } = await ctx.json();
    const e = normEmail(email);
    if (!EMAIL_RE.test(e)) throw new HttpError(422, 'Email inválido');
    if (!password || String(password).length < 8) throw new HttpError(422, 'A palavra-passe deve ter pelo menos 8 caracteres');
    if (!mailLimiter(`register:${ctx.ip}:${e}`)) throw new HttpError(429, 'Demasiados pedidos. Tente novamente mais tarde.');

    let row = await findUserByEmail(e);
    if (row && row.password_hash && row.is_verified) throw new HttpError(409, 'Este email já está registado. Inicie sessão ou recupere a palavra-passe.');
    if (!row && !config.allowPublicSignup && !(await activeInvite(e))) {
      throw new HttpError(403, 'O registo está limitado a utilizadores convidados.');
    }
    const password_hash = await hashPassword(password);
    const verified = !config.requireEmailVerification;

    if (row && !row.password_hash) {
      // Conta importada/convidada sem palavra-passe: só fica definida depois de provar a posse do email.
      if (verified) {
        await query('UPDATE users SET password_hash = $2, is_verified = true, updated_date = now() WHERE id = $1', [row.id, password_hash]);
      } else {
        await query(`UPDATE users SET data = data || jsonb_build_object('_pending_password_hash', $2::text) WHERE id = $1`, [row.id, password_hash]);
      }
    } else if (row) {
      await query('UPDATE users SET password_hash = $2, full_name = COALESCE($3, full_name), updated_date = now() WHERE id = $1', [row.id, password_hash, full_name || null]);
    } else {
      row = await createUserRow({ email: e, password_hash, full_name: full_name || null, is_verified: verified, data: full_name ? { display_name: full_name } : {} });
      row = await applyInvite(row);
    }
    if (!verified) await sendOtp(e);
    return { success: true, requires_verification: !verified };
  });

  router.post('/auth/verify-otp', async (ctx) => {
    const body = await ctx.json();
    const e = normEmail(body.email);
    const code = body.otpCode ?? body.otp_code ?? body.code;
    if (!otpLimiter(`${ctx.ip}:${e}`)) throw new HttpError(429, 'Demasiadas tentativas. Tente novamente mais tarde.');
    if (!code || !(await verifyOtpCode(e, code))) throw new HttpError(400, 'Código de verificação inválido ou expirado');
    const row = await findUserByEmail(e);
    if (!row) throw new HttpError(400, 'Código de verificação inválido ou expirado');
    const pending = row.data?._pending_password_hash;
    const { rows } = await query(
      `UPDATE users SET is_verified = true, password_hash = COALESCE($2, password_hash), data = data - '_pending_password_hash', updated_date = now()
       WHERE id = $1 RETURNING *`,
      [row.id, pending || null],
    );
    const updated = await applyInvite(rows[0]);
    return { success: true, access_token: issueToken(updated), user: rowToUser(updated) };
  });

  router.post('/auth/resend-otp', async (ctx) => {
    const { email } = await ctx.json();
    const e = normEmail(email);
    if (!mailLimiter(`otp:${ctx.ip}:${e}`)) throw new HttpError(429, 'Demasiados pedidos. Tente novamente mais tarde.');
    const row = await findUserByEmail(e);
    if (row && (!row.is_verified || row.data?._pending_password_hash)) await sendOtp(e);
    return { success: true };
  });

  router.post('/auth/reset-password-request', async (ctx) => {
    const { email } = await ctx.json();
    const e = normEmail(email);
    if (!mailLimiter(`reset:${ctx.ip}:${e}`)) return { success: true };
    const row = await findUserByEmail(e);
    if (row && !row.disabled) {
      const token = randomToken();
      await storeToken('reset', e, token, { ttlSeconds: 60 * 60 });
      const link = `${config.publicUrl}/reset-password?token=${encodeURIComponent(token)}`;
      await sendEmail({
        to: e,
        subject: 'Recuperação da palavra-passe',
        body: systemEmail({
          title: 'Recuperar a palavra-passe',
          intro: 'Recebemos um pedido para definir uma nova palavra-passe. A ligação é válida durante 1 hora.',
          buttonLabel: 'Definir nova palavra-passe', buttonUrl: link,
          outro: 'Se não fez este pedido, pode ignorar este email.',
        }),
      });
      if (!emailConfigured() && !config.isProduction) console.warn(`[auth] ligação de recuperação para ${e}: ${link}`);
    }
    return { success: true }; // resposta idêntica para não revelar contas existentes
  });

  router.post('/auth/reset-password', async (ctx) => {
    const body = await ctx.json();
    const token = body.resetToken ?? body.reset_token ?? body.token;
    const newPassword = body.newPassword ?? body.new_password ?? body.password;
    if (!newPassword || String(newPassword).length < 8) throw new HttpError(422, 'A palavra-passe deve ter pelo menos 8 caracteres');
    const row = token && await consumeToken('reset', token);
    if (!row) throw new HttpError(400, 'Ligação inválida ou expirada');
    await query(
      `UPDATE users SET password_hash = $2, is_verified = true, token_version = token_version + 1, data = data - '_pending_password_hash', updated_date = now()
       WHERE lower(email) = $1`,
      [normEmail(row.email), await hashPassword(newPassword)],
    );
    return { success: true };
  });

  router.post('/auth/change-password', async (ctx) => {
    const user = requireUser(ctx);
    const { currentPassword, newPassword } = await ctx.json();
    const row = await findUserById(user.id);
    if (row.password_hash && !(await verifyPassword(currentPassword, row.password_hash))) throw new HttpError(400, 'Palavra-passe atual incorreta');
    if (!newPassword || String(newPassword).length < 8) throw new HttpError(422, 'A palavra-passe deve ter pelo menos 8 caracteres');
    const { rows } = await query('UPDATE users SET password_hash = $2, token_version = token_version + 1 WHERE id = $1 RETURNING *', [row.id, await hashPassword(newPassword)]);
    return { success: true, access_token: issueToken(rows[0]) };
  });

  router.post('/auth/logout', () => ({ success: true }));

  router.get('/auth/providers', () => ({ providers: oauthProviders(), public_signup: config.allowPublicSignup }));

  router.get('/auth/oauth/:provider', (ctx) => startOAuth(ctx, 'login'));
  router.get('/auth/oauth/:provider/callback', (ctx) => finishOAuth(ctx, async ({ email, name }) => {
    let row = await findUserByEmail(email);
    if (!row) {
      if (!config.allowPublicSignup && !(await activeInvite(email))) throw new HttpError(403, 'O registo está limitado a utilizadores convidados.');
      row = await createUserRow({ email, full_name: name || null, is_verified: true, data: name ? { display_name: name } : {} });
      row = await applyInvite(row);
    } else {
      if (row.disabled) throw new HttpError(403, 'Conta desativada');
      const { rows } = await query('UPDATE users SET is_verified = true, last_login = now(), full_name = COALESCE(full_name, $2) WHERE id = $1 RETURNING *', [row.id, name || null]);
      row = await applyInvite(rows[0]);
    }
    return issueToken(row);
  }));

  // Convites (equivalente a base44.users.inviteUser(email, role)).
  router.post('/users/invite', async (ctx) => {
    const inviter = requireRole(ctx, ['admin', 'customer_admin']);
    const body = await ctx.json();
    const e = normEmail(body.email ?? body.user_email);
    const role = body.role === 'admin' ? 'admin' : 'user';
    if (!EMAIL_RE.test(e)) throw new HttpError(422, 'Email inválido');
    if (role === 'admin' && inviter.role !== 'admin') throw new HttpError(403, 'Apenas administradores podem convidar administradores');

    let row = await findUserByEmail(e);
    if (!row) row = await createUserRow({ email: e, role: 'user', is_verified: false });
    await storeToken('invite', e, randomToken(), { ttlSeconds: 14 * 24 * 3600, data: { role, invited_by: inviter.email } });
    const link = `${config.publicUrl}/register?email=${encodeURIComponent(e)}`;
    await sendEmail({
      to: e,
      subject: 'Convite para a plataforma',
      body: systemEmail({
        title: 'Foi convidado para a plataforma',
        intro: `${inviter.full_name || inviter.email} convidou-o a aceder à plataforma. Crie a sua palavra-passe para entrar.`,
        buttonLabel: 'Aceitar convite', buttonUrl: link,
      }),
    });
    if (!emailConfigured() && !config.isProduction) console.warn(`[auth] convite para ${e}: ${link}`);
    return { success: true, user: rowToUser(row) };
  });
}
