// Agentes de IA definidos em base44/agents/*.jsonc (ex.: framework_guide).
// As ferramentas operam sobre entidades COM AS PERMISSÕES DO UTILIZADOR (RLS aplicada).
import path from 'node:path';
import { config } from './config.js';
import { query } from './db.js';
import { emitConversationEvent } from './events.js';
import { HttpError, newId, readJsoncDir } from './util.js';
import { EntityService } from './entities/service.js';
import { getSchema } from './entities/schemas.js';
import { chat, llmConfigured } from './integrations/llm.js';
import { requireUser } from './auth/routes.js';

const MAX_TOOL_ROUNDS = 20;
let agents = null;

function loadAgents() {
  if (agents) return agents;
  agents = new Map();
  for (const { file, data } of readJsoncDir(path.join(config.base44Dir, 'agents'))) {
    const name = data.name || path.basename(file).replace(/\.jsonc?$/, '');
    agents.set(name, { ...data, name });
  }
  return agents;
}

function getAgent(name) {
  const agent = loadAgents().get(name);
  if (!agent) throw new HttpError(404, `Agente desconhecido: ${name}`);
  return agent;
}

// ---------------------------------------------------------------------------
// Ferramentas
// ---------------------------------------------------------------------------

function entityProperties(name) {
  try {
    const schema = getSchema(name);
    return { type: 'object', properties: schema.properties || {}, required: [] };
  } catch {
    return { type: 'object', properties: {} };
  }
}

function buildTools(agent) {
  const tools = [];
  for (const cfg of agent.tool_configs || []) {
    const entity = cfg.entity_name;
    if (!entity) continue;
    const ops = new Set(cfg.allowed_operations || []);
    if (ops.has('read')) {
      tools.push({
        name: `read_${entity}`, entity, op: 'read',
        description: `Lista registos de ${entity}. Use "query" com igualdades por campo (ex.: {"framework_code":"NIS2"}) ou operadores $in/$gte/$lte.`,
        input_schema: {
          type: 'object',
          properties: {
            query: { type: 'object', description: 'Filtro por campos' },
            sort: { type: 'string', description: 'Campo de ordenação; prefixo "-" para descendente' },
            limit: { type: 'integer', description: 'Máximo de registos (por omissão 50)' },
          },
        },
      });
    }
    if (ops.has('create')) {
      tools.push({ name: `create_${entity}`, entity, op: 'create', description: `Cria um registo de ${entity}.`, input_schema: { type: 'object', properties: { data: entityProperties(entity) }, required: ['data'] } });
    }
    if (ops.has('update')) {
      tools.push({ name: `update_${entity}`, entity, op: 'update', description: `Atualiza um registo de ${entity} pelo id.`, input_schema: { type: 'object', properties: { id: { type: 'string' }, data: entityProperties(entity) }, required: ['id', 'data'] } });
    }
    if (ops.has('delete')) {
      tools.push({ name: `delete_${entity}`, entity, op: 'delete', description: `Remove um registo de ${entity} pelo id.`, input_schema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } });
    }
  }
  return tools;
}

async function runTool(tool, args, user) {
  const svc = new EntityService({ user });
  switch (tool.op) {
    case 'read': {
      const rows = await svc.filter(tool.entity, args.query || {}, args.sort, Math.min(Number(args.limit) || 50, 200));
      return { success: true, count: rows.length, records: rows };
    }
    case 'create': return { success: true, record: await svc.create(tool.entity, args.data || {}) };
    case 'update': return { success: true, record: await svc.update(tool.entity, args.id, args.data || {}) };
    case 'delete': return { success: true, ...(await svc.delete(tool.entity, args.id)) };
    default: throw new Error('Operação desconhecida');
  }
}

// ---------------------------------------------------------------------------
// Conversas
// ---------------------------------------------------------------------------

const toConversation = (row) => ({
  id: row.id, agent_name: row.agent_name, metadata: row.metadata, messages: row.messages,
  created_by_id: row.user_id, created_date: row.created_date, updated_date: row.updated_date,
});

async function loadConversation(id, user) {
  const { rows } = await query('SELECT * FROM conversations WHERE id = $1', [id]);
  const row = rows[0];
  if (!row || (row.user_id !== user.id && user.role !== 'admin')) throw new HttpError(404, 'Conversa não encontrada');
  return row;
}

async function saveMessages(id, messages) {
  const { rows } = await query('UPDATE conversations SET messages = $2, updated_date = now() WHERE id = $1 RETURNING *', [id, JSON.stringify(messages)]);
  const conv = toConversation(rows[0]);
  emitConversationEvent(conv);
  return conv;
}

/** Histórico em formato neutro para o modelo (sem campos de apresentação). */
function toLlmHistory(messages) {
  const out = [];
  for (const m of messages) {
    if (m.role === 'user') out.push({ role: 'user', content: m.content || '' });
    else if (m.role === 'assistant') {
      const calls = (m.tool_calls || []).filter((tc) => tc.id && tc.status !== 'pending' && tc.status !== 'running');
      out.push({ role: 'assistant', content: m.content || '', tool_calls: calls.map((tc) => ({ id: tc.id, name: tc.name, arguments: safeParse(tc.arguments_string) })) });
      for (const tc of calls) out.push({ role: 'tool', tool_call_id: tc.id, content: typeof tc.results === 'string' ? tc.results : JSON.stringify(tc.results ?? null) });
    }
  }
  return out;
}

function safeParse(s) {
  try { return JSON.parse(s || '{}'); } catch { return {}; }
}

const running = new Set();

async function runAgent(conversationId, user) {
  if (running.has(conversationId)) return;
  running.add(conversationId);
  try {
    const row = await loadConversation(conversationId, user);
    const agent = getAgent(row.agent_name);
    const tools = buildTools(agent);
    const byName = new Map(tools.map((t) => [t.name, t]));
    let messages = row.messages;
    const today = new Date().toISOString().slice(0, 10);
    const system = `${agent.instructions || ''}\n\nContexto: data de hoje ${today}. Utilizador: ${user.full_name || user.email} (${user.email}), papel ${user.role}${user.customer_id ? `, customer_id ${user.customer_id}` : ''}.`;

    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
      const res = await chat({ system, messages: toLlmHistory(messages), tools });
      const assistant = {
        role: 'assistant', content: res.content || '', created_date: new Date().toISOString(),
        tool_calls: res.tool_calls.map((tc) => ({ id: tc.id, name: tc.name, arguments_string: JSON.stringify(tc.arguments || {}), status: 'running' })),
      };
      messages = [...messages, assistant];
      await saveMessages(conversationId, messages);
      if (!res.tool_calls.length) break;

      for (const tc of assistant.tool_calls) {
        const tool = byName.get(tc.name);
        try {
          if (!tool) throw new Error(`Ferramenta não permitida: ${tc.name}`);
          tc.results = JSON.stringify(await runTool(tool, safeParse(tc.arguments_string), user));
          tc.status = 'completed';
        } catch (err) {
          tc.results = JSON.stringify({ success: false, error: err.message });
          tc.status = 'failed';
        }
      }
      messages = [...messages.slice(0, -1), assistant];
      await saveMessages(conversationId, messages);
      if (round === MAX_TOOL_ROUNDS - 1) {
        messages = [...messages, { role: 'assistant', content: '_(Limite de passos atingido. Envie uma nova mensagem para continuar.)_', created_date: new Date().toISOString() }];
        await saveMessages(conversationId, messages);
      }
    }
  } catch (err) {
    console.error('[agents] erro:', err.message);
    const { rows } = await query('SELECT messages FROM conversations WHERE id = $1', [conversationId]);
    if (rows[0]) {
      await saveMessages(conversationId, [...rows[0].messages, { role: 'assistant', content: `⚠️ Ocorreu um erro: ${err.message}`, created_date: new Date().toISOString() }]);
    }
  } finally {
    running.delete(conversationId);
  }
}

export function registerAgentRoutes(router) {
  router.get('/agents/conversations', async (ctx) => {
    const user = requireUser(ctx);
    const params = [user.id];
    let sql = 'SELECT * FROM conversations WHERE user_id = $1';
    if (ctx.query.agent_name) { params.push(ctx.query.agent_name); sql += ' AND agent_name = $2'; }
    const { rows } = await query(`${sql} ORDER BY created_date DESC LIMIT 200`, params);
    return rows.map(toConversation);
  });

  router.post('/agents/conversations', async (ctx) => {
    const user = requireUser(ctx);
    const body = await ctx.json();
    getAgent(body.agent_name);
    const { rows } = await query(
      'INSERT INTO conversations (id, agent_name, user_id, metadata, messages) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [newId(), body.agent_name, user.id, JSON.stringify(body.metadata || {}), JSON.stringify([])],
    );
    return toConversation(rows[0]);
  });

  router.get('/agents/conversations/:id', async (ctx) => toConversation(await loadConversation(ctx.params.id, requireUser(ctx))));

  router.put('/agents/conversations/:id', async (ctx) => {
    const user = requireUser(ctx);
    const row = await loadConversation(ctx.params.id, user);
    const body = await ctx.json();
    const { rows } = await query('UPDATE conversations SET metadata = $2, updated_date = now() WHERE id = $1 RETURNING *', [row.id, JSON.stringify({ ...row.metadata, ...(body.metadata || {}) })]);
    return toConversation(rows[0]);
  });

  router.delete('/agents/conversations/:id', async (ctx) => {
    const row = await loadConversation(ctx.params.id, requireUser(ctx));
    await query('DELETE FROM conversations WHERE id = $1', [row.id]);
    return { success: true };
  });

  router.post('/agents/conversations/:id/messages', async (ctx) => {
    const user = requireUser(ctx);
    const row = await loadConversation(ctx.params.id, user);
    if (row.user_id !== user.id) throw new HttpError(403, 'Só o autor pode escrever nesta conversa');
    const body = await ctx.json();
    const content = String(body.content || '').slice(0, 20000);
    if (!content.trim()) throw new HttpError(400, 'Mensagem vazia');
    if (!llmConfigured()) throw new HttpError(503, 'Nenhum modelo de IA configurado neste servidor.');
    if (running.has(row.id)) throw new HttpError(409, 'O agente ainda está a responder');
    const message = { role: 'user', content, created_date: new Date().toISOString() };
    const conv = await saveMessages(row.id, [...row.messages, message]);
    runAgent(row.id, user); // assíncrono: as respostas chegam pelo canal de tempo real
    return conv;
  });
}
