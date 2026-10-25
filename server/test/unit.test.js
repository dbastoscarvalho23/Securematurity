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
