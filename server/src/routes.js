// Rotas da API compatíveis com o cliente do frontend (src/api/selfHostedClient.js).
import { config } from './config.js';
import { bus } from './events.js';
import { HttpError } from './util.js';
import { EntityService } from './entities/service.js';
import { getSchema, entityNames } from './entities/schemas.js';
import { requireUser } from './auth/routes.js';
import { invokeLLM, llmConfigured } from './integrations/llm.js';
import { sendEmail, emailConfigured } from './integrations/email.js';
import { putFile, getFileMeta, readFileStream } from './integrations/storage.js';
import { invokeFunction, functionNames } from './functions/runtime.js';
import { pool } from './db.js';
import { createRateLimiter } from './util.js';

const parseJsonParam = (value, fallback) => {
  if (value === undefined || value === '') return fallback;
  try { return JSON.parse(value); } catch { throw new HttpError(400, 'Parâmetro JSON inválido'); }
};

const emailLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 200 });
const llmLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 30 });

export function registerApiRoutes(router) {
  // --- estado ----------------------------------------------------------------
  router.get('/health', async () => {
    await pool.query('SELECT 1');
    return { status: 'ok', time: new Date().toISOString() };
  });

  router.get('/app/info', () => ({
    mode: 'selfhosted',
    entities: entityNames(),
    functions: functionNames(),
    features: { email: emailConfigured(), llm: llmConfigured(), storage: config.storage.driver, public_signup: config.allowPublicSignup },
  }));

  // --- entidades ------------------------------------------------------------
  const svc = (ctx) => new EntityService({ user: ctx.user });

  router.get('/entities/:name', (ctx) => {
    const q = ctx.query;
    return svc(ctx).filter(ctx.params.name, parseJsonParam(q.q, {}), q.sort, q.limit, q.skip, q.fields);
  });
  router.post('/entities/:name/query', async (ctx) => {
    const b = await ctx.json();
    return svc(ctx).filter(ctx.params.name, b.query || b.q || {}, b.sort, b.limit, b.skip, b.fields);
  });
  router.get('/entities/:name/schema', (ctx) => { requireUser(ctx); const { rls: _r, ...schema } = getSchema(ctx.params.name); return schema; });
  router.get('/entities/:name/:id', (ctx) => svc(ctx).get(ctx.params.name, ctx.params.id));
  router.post('/entities/:name', async (ctx) => svc(ctx).create(ctx.params.name, await ctx.json()));
  router.post('/entities/:name/bulk', async (ctx) => svc(ctx).bulkCreate(ctx.params.name, await ctx.json()));
  router.put('/entities/:name/bulk', async (ctx) => svc(ctx).bulkUpdate(ctx.params.name, await ctx.json()));
  router.post('/entities/:name/delete-many', async (ctx) => svc(ctx).deleteMany(ctx.params.name, await ctx.json()));
  router.put('/entities/:name/:id', async (ctx) => svc(ctx).update(ctx.params.name, ctx.params.id, await ctx.json()));
  router.patch('/entities/:name/:id', async (ctx) => svc(ctx).update(ctx.params.name, ctx.params.id, await ctx.json()));
  router.delete('/entities/:name/:id', (ctx) => svc(ctx).delete(ctx.params.name, ctx.params.id));

  // --- integrações (base44.integrations.Core.*) -----------------------------
  router.post('/integrations/Core/UploadFile', async (ctx) => {
    const user = requireUser(ctx);
    const declared = Number(ctx.req.headers['content-length'] || 0);
    if (declared > config.maxUploadBytes) throw new HttpError(413, 'Ficheiro demasiado grande');
    let form;
    try { form = await ctx.webRequest().formData(); } catch { throw new HttpError(400, 'Pedido multipart inválido'); }
    const file = form.get('file');
    if (!file || typeof file.arrayBuffer !== 'function') throw new HttpError(400, 'Campo "file" em falta');
    if (file.size > config.maxUploadBytes) throw new HttpError(413, 'Ficheiro demasiado grande');
    const buffer = Buffer.from(await file.arrayBuffer());
    return putFile(buffer, { filename: file.name, contentType: file.type, createdBy: user.email });
  });

  router.post('/integrations/Core/InvokeLLM', async (ctx) => {
    const user = requireUser(ctx);
    if (!llmLimiter(user.id)) throw new HttpError(429, 'Demasiados pedidos ao modelo de IA. Aguarde um pouco.');
    return invokeLLM(await ctx.json());
  });

  router.post('/integrations/Core/SendEmail', async (ctx) => {
    const user = requireUser(ctx);
    if (!emailLimiter(user.id)) throw new HttpError(429, 'Limite de envio de emails atingido. Tente mais tarde.');
    return sendEmail(await ctx.json());
  });

  router.post('/integrations/Core/:method', (ctx) => {
    requireUser(ctx);
    throw new HttpError(501, `Integração Core.${ctx.params.method} não disponível no servidor próprio`);
  });

  // --- ficheiros ------------------------------------------------------------
  // Tal como na Base44, os URLs de ficheiros são públicos mas impossíveis de adivinhar (128 bits aleatórios).
  router.get('/files/:key', async (ctx) => {
    const meta = await getFileMeta(ctx.params.key);
    if (!meta) throw new HttpError(404, 'Ficheiro não encontrado');
    const stream = await readFileStream(meta.key);
    const safeName = (meta.filename || meta.key).replace(/["\r\n]/g, '');
    const inlineTypes = /^(image\/(png|jpeg|gif|webp)|application\/pdf|text\/plain)/;
    ctx.res.writeHead(200, {
      'Content-Type': meta.content_type || 'application/octet-stream',
      'Content-Length': meta.size,
      'Content-Disposition': `${inlineTypes.test(meta.content_type || '') ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(safeName)}`,
      'Cache-Control': 'private, max-age=31536000, immutable',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    });
    stream.pipe(ctx.res);
  });

  // --- funções --------------------------------------------------------------
  router.post('/functions/:name', async (ctx) => {
    const body = await ctx.json();
    const headers = {};
    if (ctx.req.headers['x-automation-secret']) headers['x-automation-secret'] = String(ctx.req.headers['x-automation-secret']);
    const result = await invokeFunction(ctx.params.name, body, { token: ctx.auth?.token || null, headers });
    const contentType = result.headers?.['content-type'] || 'application/json';
    ctx.res.writeHead(result.status, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
    ctx.res.end(result.raw ?? JSON.stringify(result.data ?? null));
  });

  // --- tempo real (Server-Sent Events) --------------------------------------
  // GET /realtime?entities=Notification,MaintenanceWindow  ou  ?conversation=<id>
  router.get('/realtime', (ctx) => {
    const user = ctx.user;
    const entities = new Set(String(ctx.query.entities || '').split(',').map((s) => s.trim()).filter(Boolean));
    const conversationId = ctx.query.conversation || null;
    if (conversationId && !user) throw new HttpError(401, 'Autenticação necessária');
    for (const e of entities) getSchema(e);
    const service = new EntityService({ user });

    ctx.res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    ctx.res.write(': ligado\n\n');
    const send = (type, payload) => ctx.res.write(`event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`);

    const onEntity = (event) => {
      if (!entities.has(event.entity)) return;
      try {
        if (!service.canRead(event.entity, event.data)) return;
      } catch { return; }
      send('entity', { entity: event.entity, type: event.type, id: event.id, data: event.type === 'delete' ? { id: event.id } : event.data });
    };
    const onConversation = (conv) => {
      if (conv.id !== conversationId || (conv.created_by_id !== user.id && user.role !== 'admin')) return;
      send('conversation', conv);
    };
    bus.on('entity', onEntity);
    if (conversationId) bus.on('conversation', onConversation);
    const ping = setInterval(() => ctx.res.write(': ping\n\n'), 25000);
    ctx.req.on('close', () => {
      clearInterval(ping);
      bus.off('entity', onEntity);
      bus.off('conversation', onConversation);
    });
  });
}
