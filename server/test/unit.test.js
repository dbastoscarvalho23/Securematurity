// Testes unitários (não precisam de base de dados).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { evaluateJq } from '../src/workflows/jq-lite.js';
import { parseCron, cronMatches } from '../src/workflows/cron.js';
import { parseJsonc } from '../src/util.js';
import { ruleToFilter } from '../src/entities/rls.js';
import { matchesFilter } from '../src/entities/query.js';

test('condições jq dos workflows Base44', () => {
  const cond = '${ ((.trigger.changed_fields | index("status") != null) and (.trigger.data.status == "under_review" or .trigger.data.status == "approved")) }';
  assert.equal(evaluateJq(cond, { trigger: { changed_fields: ['title', 'status'], data: { status: 'approved' } } }), true);
  assert.equal(evaluateJq(cond, { trigger: { changed_fields: ['title'], data: { status: 'approved' } } }), false);
  assert.equal(evaluateJq(cond, { trigger: { changed_fields: ['status'], data: { status: 'draft' } } }), false);
  assert.equal(evaluateJq('.a.b | length > 1', { a: { b: [1, 2] } }), true);
  assert.equal(evaluateJq('not (.x == null)', { x: 1 }), true);
});

test('expressões cron com fuso horário', () => {
  const daily7 = parseCron('0 7 * * *');
  assert.equal(cronMatches(daily7, new Date('2026-10-25T07:00:00Z'), 'UTC'), true);
  assert.equal(cronMatches(daily7, new Date('2026-10-25T07:01:00Z'), 'UTC'), false);
  // 07:00 em Lisboa durante a hora de verão = 06:00 UTC.
  assert.equal(cronMatches(daily7, new Date('2026-07-01T06:00:00Z'), 'Europe/Lisbon'), true);
  const monthly = parseCron('0 5 1 * *');
  assert.equal(cronMatches(monthly, new Date('2026-11-01T05:00:00Z'), 'UTC'), true);
  assert.equal(cronMatches(monthly, new Date('2026-11-02T05:00:00Z'), 'UTC'), false);
  assert.equal(cronMatches(parseCron('*/15 9-17 * * 1-5'), new Date('2026-10-26T09:30:00Z'), 'UTC'), true); // segunda-feira
  assert.throws(() => parseCron('61 * * * *'));
});

test('JSONC com comentários, URLs e vírgulas finais', () => {
  const parsed = parseJsonc('{\n // comentário\n "url": "https://exemplo.pt/a//b", /* bloco */ "lista": [1, 2,],\n}');
  assert.deepEqual(parsed, { url: 'https://exemplo.pt/a//b', lista: [1, 2] });
});

test('regras RLS', () => {
  const rule = { $or: [{ user_condition: { role: 'admin' } }, { 'data.customer_id': '{{user.data.customer_id}}' }] };
  const user = { id: 'u1', email: 'a@x.pt', role: 'user', customer_id: 'c1' };
  assert.deepEqual(ruleToFilter(rule, user), { customer_id: 'c1' });
  assert.equal(ruleToFilter(rule, { ...user, role: 'admin' }), true);
  // Utilizador sem cliente: não vê nada…
  assert.equal(ruleToFilter(rule, { ...user, customer_id: undefined }), false);
  // …mas pode criar registos sem cliente (ex.: registo de auditoria).
  assert.deepEqual(ruleToFilter(rule, { ...user, customer_id: undefined }, { nullMatchesUnresolved: true }), { customer_id: null });
  assert.equal(ruleToFilter(rule, null), false);
  assert.equal(ruleToFilter({}, null), true);
  const get = (r, k) => r[k];
  assert.equal(matchesFilter({ customer_id: 'c1' }, ruleToFilter(rule, user), get), true);
  assert.equal(matchesFilter({ customer_id: 'c2' }, ruleToFilter(rule, user), get), false);
  const nested = { $or: [{ user_condition: { role: 'admin' } }, { $and: [{ user_condition: { role: 'customer_admin' } }, { 'data.customer_id': '{{user.data.customer_id}}' }] }] };
  assert.equal(ruleToFilter(nested, user), false);
  assert.deepEqual(ruleToFilter(nested, { ...user, role: 'customer_admin' }), { customer_id: 'c1' });
  // Regras booleanas e papel inexistente (trilha de auditoria): ninguém passa, nem o administrador.
  assert.equal(ruleToFilter(false, { ...user, role: 'admin' }), false);
  assert.equal(ruleToFilter(true, null), true);
  assert.equal(ruleToFilter({ user_condition: { role: 'service_only' } }, { ...user, role: 'admin' }), false);
});

test('InvokeLLM e conversa com API compatível com OpenAI', async () => {
  const requests = [];
  const server = http.createServer(async (req, res) => {
    let raw = ''; for await (const c of req) raw += c;
    const body = JSON.parse(raw);
    requests.push(body);
    const message = body.tools
      ? { role: 'assistant', content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'read_Task', arguments: '{"query":{"status":"todo"}}' } }] }
      : { role: 'assistant', content: body.response_format ? '```json\n{"score": 3}\n```' : 'Olá' };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message, finish_reason: 'stop' }] }));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  process.env.LLM_PROVIDER = 'openai';
  process.env.OPENAI_API_KEY = 'k';
  process.env.OPENAI_BASE_URL = `http://127.0.0.1:${server.address().port}/v1`;
  const { invokeLLM, chat } = await import('../src/integrations/llm.js');
  try {
    assert.deepEqual(await invokeLLM({ prompt: 'avalia', response_json_schema: { type: 'object', properties: { score: { type: 'number' } } } }), { score: 3 });
    assert.equal(requests[0].response_format.type, 'json_object');
    assert.equal(await invokeLLM({ prompt: 'olá' }), 'Olá');
    const res = await chat({ system: 's', messages: [{ role: 'user', content: 'x' }], tools: [{ name: 'read_Task', description: 'd', input_schema: { type: 'object' } }] });
    assert.deepEqual(res.tool_calls, [{ id: 'c1', name: 'read_Task', arguments: { query: { status: 'todo' } } }]);
    // Histórico com resultado de ferramenta é convertido para o formato OpenAI.
    await chat({ messages: [
      { role: 'user', content: 'x' },
      { role: 'assistant', content: '', tool_calls: [{ id: 'c1', name: 'read_Task', arguments: {} }] },
      { role: 'tool', tool_call_id: 'c1', content: '{"ok":true}' },
    ] });
    const sent = requests.at(-1).messages;
    assert.equal(sent[1].tool_calls[0].function.name, 'read_Task');
    assert.deepEqual(sent[2], { role: 'tool', tool_call_id: 'c1', content: '{"ok":true}' });
  } finally {
    server.close();
  }
});

test('a interface só chama funções permitidas', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { HTTP_FUNCTIONS } = await import('../src/functions/http-functions.js');
  const srcDir = process.env.APP_SRC_DIR || path.join(import.meta.dirname, '..', '..', 'src');
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : /\.(jsx?|tsx?)$/.test(e.name) ? [path.join(d, e.name)] : []));
  const called = new Set();
  for (const file of walk(srcDir)) {
    for (const m of fs.readFileSync(file, 'utf8').matchAll(/\b(?:functions\.invoke|invokeFn)\(\s*['"]([A-Za-z0-9_]+)['"]/g)) called.add(m[1]);
  }
  assert.ok(called.size > 0, `nenhuma chamada encontrada em ${srcDir}`);
  const missing = [...called].filter((name) => !HTTP_FUNCTIONS.has(name));
  assert.deepEqual(missing, [], 'acrescente estas funções a server/src/functions/http-functions.js');
});

test('ligações assinadas para ficheiros privados', async () => {
  const { signedUrlFor, privateAccessAllowed } = await import('../src/integrations/storage.js');
  const key = 'a'.repeat(32) + '.pdf';
  const now = Date.UTC(2026, 9, 29, 12, 0, 0);
  const params = (url) => new URL(url).searchParams;
  const url = signedUrlFor(`private/${key}`, 300, now);
  const meta = { key, private: true };
  assert.equal(privateAccessAllowed(meta, params(url), now), true, 'assinatura válida');
  assert.equal(privateAccessAllowed(meta, params(url), now + 301_000), false, 'expirada');
  assert.equal(privateAccessAllowed(meta, new URLSearchParams(), now), false, 'sem assinatura');
  const forged = params(url); forged.set('exp', String(Number(forged.get('exp')) + 3600));
  assert.equal(privateAccessAllowed(meta, forged, now), false, 'prazo alterado');
  assert.equal(privateAccessAllowed({ key: 'b'.repeat(32), private: true }, params(url), now), false, 'assinatura de outro ficheiro');
  assert.equal(privateAccessAllowed({ key, private: false }, new URLSearchParams(), now), true, 'ficheiro público');
  const longest = Number(params(signedUrlFor(key, 999_999, now)).get('exp'));
  assert.equal(longest, now / 1000 + 3600, 'validade máxima de uma hora');
  assert.throws(() => signedUrlFor('private/../../etc/passwd', 60, now), /file_uri inválido/);
});

test("módulo 'base44:runtime' lê os segredos do ambiente", async () => {
  const { secrets } = await import('../src/functions/runtime-shim.js');
  process.env.ANKORA_TESTE_SEGREDO = 'valor';
  assert.equal(secrets.get('ANKORA_TESTE_SEGREDO'), 'valor');
  assert.equal(secrets.get('ANKORA_SEGREDO_INEXISTENTE'), undefined);
  delete process.env.ANKORA_TESTE_SEGREDO;
});
