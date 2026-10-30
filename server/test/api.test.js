// Testes ponta a ponta da API.
// Requer uma base de dados DESCARTÁVEL: TEST_DATABASE_URL=postgres://.../ankoraone_test npm test
// ATENÇÃO: o esquema "public" dessa base de dados é apagado no início.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import http from 'node:http';

const DB = process.env.TEST_DATABASE_URL;
const PORT = Number(process.env.TEST_PORT || 3199);
const BASE = `http://127.0.0.1:${PORT}/api`;
const ADMIN = { email: 'admin@teste.local', password: 'Admin-Pass-123' };
const AUTOMATION_SECRET = 'segredo-de-automacao-para-testes-123456';
const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let proc;
let mockLlm;
let llmRequests = [];
let logs = '';
const tokens = {};
const ids = {};

if (!DB) {
  test('testes ponta a ponta', { skip: 'defina TEST_DATABASE_URL para correr os testes' }, () => {});
} else {
  before(async () => {
    const client = new pg.Client({ connectionString: DB });
    await client.connect();
    await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await client.end();
    mockLlm = await startMockAnthropic();

    proc = spawn(process.execPath, ['src/index.js'], {
      cwd: serverDir,
      env: {
        ...process.env, PORT: String(PORT), HOST: '127.0.0.1', DATABASE_URL: DB,
        PUBLIC_URL: `http://127.0.0.1:${PORT}`,
        JWT_SECRET: 'segredo-jwt-para-testes-segredo-jwt-para-testes',
        AUTOMATION_SECRET,
        BOOTSTRAP_ADMIN_EMAIL: ADMIN.email, BOOTSTRAP_ADMIN_PASSWORD: ADMIN.password,
        STORAGE_DRIVER: 'local', STORAGE_LOCAL_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'ankora-uploads-')),
        SMTP_HOST: '', LLM_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'chave-de-teste', OPENAI_API_KEY: '',
        ANTHROPIC_BASE_URL: `http://127.0.0.1:${mockLlm.address().port}`,
        ENABLE_SCHEDULER: 'false', NODE_ENV: 'test',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    proc.stdout.on('data', (d) => { logs += d; });
    proc.stderr.on('data', (d) => { logs += d; });
    for (let i = 0; i < 100; i += 1) {
      try { if ((await fetch(`${BASE}/health`)).ok) return; } catch { /* a arrancar */ }
      await sleep(200);
    }
    throw new Error(`O servidor não arrancou:\n${logs}`);
  });

  after(() => { proc?.kill('SIGTERM'); mockLlm?.close(); });

  test('estado e informação', async () => {
    assert.equal((await api('GET', '/health')).status, 'ok');
    const info = await api('GET', '/app/info');
    const base44Dir = path.join(serverDir, '..', 'base44');
    const entityFiles = fs.readdirSync(path.join(base44Dir, 'entities')).filter((f) => /\.jsonc?$/.test(f));
    assert.equal(info.entities.length, entityFiles.length);
    // Cada função cujos pacotes npm estejam instalados no servidor tem de carregar.
    const installed = (spec) => spec.startsWith('@base44/sdk') || fs.existsSync(path.join(serverDir, 'node_modules', spec.replace(/^(@[^/@]+\/[^/@]+|[^/@]+).*$/, '$1')));
    const expected = fs.readdirSync(path.join(base44Dir, 'functions')).filter((name) => {
      const src = fs.readFileSync(path.join(base44Dir, 'functions', name, 'entry.ts'), 'utf8');
      return [...src.matchAll(/from ['"]npm:([^'"]+)['"]/g)].every((m) => installed(m[1]));
    });
    assert.deepEqual([...info.functions].sort(), expected.sort(), 'funções carregadas');
  });

  test('login do administrador inicial', async () => {
    const res = await api('POST', '/auth/login', ADMIN);
    assert.ok(res.access_token);
    assert.equal(res.user.role, 'admin');
    tokens.admin = res.access_token;
    await assert.rejects(api('POST', '/auth/login', { ...ADMIN, password: 'errada' }), /401/);
  });

  test('administrador cria clientes', async () => {
    const c1 = await api('POST', '/entities/Customer', { name: 'Cliente Um', nif: '500000001', sector: 'technology' }, tokens.admin);
    const c2 = await api('POST', '/entities/Customer', { name: 'Cliente Dois', nif: '500000002', sector: 'energy' }, tokens.admin);
    ids.c1 = c1.id; ids.c2 = c2.id;
    assert.match(c1.id, /^[a-f0-9]{24}$/);
    assert.equal(c1.created_by, ADMIN.email);
    await assert.rejects(api('POST', '/entities/Customer', { name: 'X', sector: 'energy' }, tokens.admin), /422/);
    await assert.rejects(api('POST', '/entities/Customer', { name: 'X', nif: '1', sector: 'invalido' }, tokens.admin), /422/);
  });

  test('registo com código de verificação', async () => {
    for (const [key, email] of [['a', 'ana@cliente1.pt'], ['b', 'bruno@cliente2.pt']]) {
      await api('POST', '/auth/register', { email, password: 'Palavra-Passe-1' });
      await assert.rejects(api('POST', '/auth/login', { email, password: 'Palavra-Passe-1' }), /403/);
      const code = await waitForLog(new RegExp(`código de verificação para ${email}: (\\d{6})`));
      await assert.rejects(api('POST', '/auth/verify-otp', { email, otpCode: '000000' === code ? '111111' : '000000' }), /400/);
      const verified = await api('POST', '/auth/verify-otp', { email, otpCode: code });
      assert.ok(verified.access_token);
      const login = await api('POST', '/auth/login', { email, password: 'Palavra-Passe-1' });
      tokens[key] = login.access_token;
      ids[key] = login.user.id;
    }
    await assert.rejects(api('POST', '/auth/register', { email: 'ana@cliente1.pt', password: 'Outra-Pass-1' }), /409/);
  });

  test('administrador atribui clientes e papéis', async () => {
    await api('PUT', `/entities/User/${ids.a}`, { customer_id: ids.c1, customer_name: 'Cliente Um', role: 'customer_admin' }, tokens.admin);
    await api('PUT', `/entities/User/${ids.b}`, { customer_id: ids.c2, customer_name: 'Cliente Dois' }, tokens.admin);
    // A alteração de papel invalida sessões antigas.
    await assert.rejects(api('GET', '/auth/me', null, tokens.a), /401/);
    tokens.a = (await api('POST', '/auth/login', { email: 'ana@cliente1.pt', password: 'Palavra-Passe-1' })).access_token;
    const me = await api('GET', '/auth/me', null, tokens.a);
    assert.equal(me.role, 'customer_admin');
    assert.equal(me.customer_id, ids.c1);
  });

  test('utilizador comum não consegue mudar de cliente nem de papel', async () => {
    const me = await api('PUT', '/auth/me', { customer_id: ids.c1, role: 'admin', display_name: 'Bruno', language: 'pt' }, tokens.b);
    assert.equal(me.customer_id, ids.c2);
    assert.equal(me.role, 'user');
    assert.equal(me.display_name, 'Bruno');
    await assert.rejects(api('PUT', `/entities/User/${ids.a}`, { display_name: 'hack' }, tokens.b), /403/);
    const users = await api('GET', '/entities/User', null, tokens.b);
    assert.deepEqual(users.map((u) => u.id), [ids.b]);
    const all = await api('GET', '/entities/User', null, tokens.admin);
    assert.equal(all.length, 3);
  });

  test('isolamento entre clientes (RLS)', async () => {
    const ta = await api('POST', '/entities/Task', { title: 'Tarefa A', status: 'todo', priority: 'high' }, tokens.a);
    assert.equal(ta.customer_id, ids.c1, 'customer_id carimbado automaticamente');
    const tb = await api('POST', '/entities/Task', { title: 'Tarefa B', status: 'todo', customer_id: ids.c2 }, tokens.b);
    ids.ta = ta.id; ids.tb = tb.id;

    assert.deepEqual((await api('GET', '/entities/Task', null, tokens.a)).map((t) => t.id), [ta.id]);
    assert.deepEqual((await api('GET', '/entities/Task', null, tokens.b)).map((t) => t.id), [tb.id]);
    assert.equal((await api('GET', '/entities/Task', null, tokens.admin)).length, 2);

    await assert.rejects(api('GET', `/entities/Task/${tb.id}`, null, tokens.a), /404/);
    await assert.rejects(api('PUT', `/entities/Task/${tb.id}`, { title: 'x' }, tokens.a), /403/);
    await assert.rejects(api('DELETE', `/entities/Task/${tb.id}`, null, tokens.a), /403/);
    await assert.rejects(api('POST', '/entities/Task', { title: 'Intrusa', status: 'todo', customer_id: ids.c2 }, tokens.a), /403/);
    // Mover um registo para outro cliente também é bloqueado.
    await assert.rejects(api('PUT', `/entities/Task/${ta.id}`, { customer_id: ids.c2 }, tokens.a), /403/);
    // Anónimos não veem nada.
    assert.deepEqual(await api('GET', '/entities/Task'), []);
    await assert.rejects(api('POST', '/entities/Task', { title: 'anon', status: 'todo' }), /401/);
  });

  test('regressão: campos do perfil não contornam a RLS', async () => {
    // Um campo "data" ou um operador gravado no perfil não pode alterar as regras.
    await api('PUT', '/auth/me', { data: { customer_id: { $ne: null } }, customer_id: { $ne: null }, theme: 'dark' }, tokens.b);
    const me = await api('GET', '/auth/me', null, tokens.b);
    assert.equal(me.data, undefined);
    assert.equal(me.customer_id, ids.c2);
    assert.equal(me.theme, 'dark');
    const visible = await api('GET', '/entities/Task', null, tokens.b);
    assert.ok(visible.every((t) => t.customer_id === ids.c2), 'só tarefas do próprio cliente');
    // Um utilizador sem cliente não vê registos de clientes.
    await api('POST', '/auth/register', { email: 'sem.cliente@x.pt', password: 'Palavra-Passe-9' });
    const code = await waitForLog(/código de verificação para sem\.cliente@x\.pt: (\d{6})/);
    const v = await api('POST', '/auth/verify-otp', { email: 'sem.cliente@x.pt', otpCode: code, password: 'Palavra-Passe-9' });
    assert.deepEqual(await api('GET', '/entities/Task', null, v.access_token), []);
  });

  test('regressão: URLs malformados não derrubam o servidor', async () => {
    const res = await fetch(`${BASE}/entities/%E0`);
    assert.equal(res.status, 400);
    assert.equal((await api('GET', '/health')).status, 'ok');
  });

  test('regressão: voltar a registar um email não muda a palavra-passe sem o código', async () => {
    await api('POST', '/auth/register', { email: 'vitima@x.pt', password: 'Senha-Da-Vitima-1' });
    const victimCode = await waitForLog(/código de verificação para vitima@x\.pt: (\d{6})/);
    // O atacante volta a registar o mesmo email com outra palavra-passe…
    await api('POST', '/auth/register', { email: 'vitima@x.pt', password: 'Senha-Do-Atacante-1' });
    const latest = await waitForLog(/código de verificação para vitima@x\.pt: (\d{6})/);
    assert.notEqual(latest, victimCode);
    // …a vítima confirma o código mais recente que recebeu, com a sua própria palavra-passe.
    await api('POST', '/auth/verify-otp', { email: 'vitima@x.pt', otpCode: latest, password: 'Senha-Da-Vitima-1' });
    await assert.rejects(api('POST', '/auth/login', { email: 'vitima@x.pt', password: 'Senha-Do-Atacante-1' }), /401/);
    assert.ok((await api('POST', '/auth/login', { email: 'vitima@x.pt', password: 'Senha-Da-Vitima-1' })).access_token);
    // Registar de novo uma conta verificada é recusado e não altera nada.
    await assert.rejects(api('POST', '/auth/register', { email: 'vitima@x.pt', password: 'Senha-Do-Atacante-1' }), /409/);
  });

  test('regressão: X-Forwarded-For não contorna o limite de tentativas', async () => {
    let limited = false;
    for (let i = 0; i < 12 && !limited; i += 1) {
      const res = await fetch(`${BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `10.0.0.${i}` },
        body: JSON.stringify({ email: 'alvo@x.pt', password: 'errada' }),
      });
      limited = res.status === 429;
    }
    assert.ok(limited);
  });

  test('filtros, ordenação, paginação e operações em lote', async () => {
    const created = await api('POST', '/entities/Task/bulk', [
      { title: 'L1', status: 'done', priority: 'low', due_date: '2026-01-10' },
      { title: 'L2', status: 'blocked', priority: 'critical', due_date: '2026-03-01' },
      { title: 'L3', status: 'in_progress', priority: 'medium', due_date: '2026-02-15', attachments: [{ name: 'a.pdf' }] },
    ], tokens.a);
    assert.equal(created.length, 3);
    const q = (filter, extra = '') => api('GET', `/entities/Task?q=${encodeURIComponent(JSON.stringify(filter))}${extra}`, null, tokens.a);

    assert.equal((await q({ status: { $in: ['done', 'blocked'] } })).length, 2);
    assert.equal((await q({ due_date: { $gte: '2026-02-01' } })).length, 2);
    assert.equal((await q({ $or: [{ priority: 'low' }, { priority: 'critical' }] })).length, 2);
    assert.equal((await q({ attachments: { $exists: true } })).length, 1);
    assert.equal((await q({ title: { $regex: '^l', $options: 'i' } })).length, 3);
    const sorted = await q({ title: { $in: ['L1', 'L2', 'L3'] } }, '&sort=-due_date&limit=2&skip=1');
    assert.deepEqual(sorted.map((t) => t.title), ['L3', 'L1']);

    const upd = await api('PUT', '/entities/Task/bulk', created.map((t) => ({ id: t.id, status: 'done' })), tokens.a);
    assert.ok(upd.every((t) => t.status === 'done'));
    const del = await api('POST', '/entities/Task/delete-many', { title: { $in: ['L1', 'L2'] } }, tokens.a);
    assert.equal(del.deleted, 2);
    // deleteMany respeita a RLS: não apaga tarefas de outro cliente.
    const del2 = await api('POST', '/entities/Task/delete-many', { title: 'Tarefa B' }, tokens.a);
    assert.equal(del2.deleted, 0);
  });

  test('upload e download de ficheiros', async () => {
    const form = new FormData();
    form.append('file', new Blob(['conteúdo de teste'], { type: 'text/plain' }), 'nota.txt');
    const res = await fetch(`${BASE}/integrations/Core/UploadFile`, { method: 'POST', headers: { Authorization: `Bearer ${tokens.a}` }, body: form });
    assert.equal(res.status, 200);
    const { file_url } = await res.json();
    assert.match(file_url, /\/api\/files\/[a-f0-9]{32}\.txt$/);
    const file = await fetch(file_url.replace(`http://127.0.0.1:${PORT}`, `http://127.0.0.1:${PORT}`));
    assert.equal(await file.text(), 'conteúdo de teste');
    assert.equal((await fetch(`${BASE}/files/naoexiste`)).status, 404);
  });

  test('ficheiros privados só se descarregam com ligação assinada', async () => {
    const form = new FormData();
    form.append('file', new Blob(['evidência privada'], { type: 'text/plain' }), 'evidencia.txt');
    const { file_url } = await (await fetch(`${BASE}/integrations/Core/UploadFile`, { method: 'POST', headers: { Authorization: `Bearer ${tokens.a}` }, body: form })).json();
    const key = file_url.split('/').pop();
    const client = new pg.Client({ connectionString: DB });
    await client.connect();
    await client.query('UPDATE files SET private = true WHERE key = $1', [key]);
    await client.end();
    assert.equal((await fetch(file_url)).status, 403, 'sem assinatura');
    assert.equal((await fetch(`${file_url}?exp=${Math.floor(Date.now() / 1000) + 60}&sig=${'0'.repeat(64)}`)).status, 403, 'assinatura forjada');
    process.env.JWT_SECRET = 'segredo-jwt-para-testes-segredo-jwt-para-testes';
    const { signedUrlFor } = await import('../src/integrations/storage.js');
    const query = new URL(signedUrlFor(`private/${key}`, 60)).search;
    const ok = await fetch(`${file_url}${query}`);
    assert.equal(ok.status, 200);
    assert.equal(await ok.text(), 'evidência privada');
  });

  test('trilha de auditoria: só o servidor escreve, encadeada e verificável', async () => {
    const forbidden = async (method, path, body) => {
      try { await api(method, path, body, tokens.admin); return false; } catch (e) { return /^403/.test(e.message); }
    };
    assert.equal(await forbidden('POST', '/entities/AuditLog', { action: 'task_created', user_email: ADMIN.email }), true, 'administrador não escreve diretamente');
    const rec = await fn('audit', { op: 'record', action: 'task_created', entity_type: 'Task', entity_id: 't1', details: 'teste', user_email: 'forjado@x.pt' }, tokens.b);
    assert.equal(rec.status, 200, JSON.stringify(rec.data));
    const row = await api('GET', `/entities/AuditLog/${rec.data.id}`, null, tokens.admin);
    assert.equal(row.user_email, 'bruno@cliente2.pt', 'autoria da sessão, nunca a enviada');
    assert.equal(row.customer_id, ids.c2);
    assert.match(row.entry_hash, /^[a-f0-9]{64}$/);
    assert.equal((await fn('audit', { op: 'record', action: 'user_login' }, tokens.b)).status, 403, 'ação reservada ao servidor');
    assert.equal(await forbidden('PUT', `/entities/AuditLog/${rec.data.id}`, { details: 'alterado' }), true, 'administrador não altera');
    assert.equal(await forbidden('DELETE', `/entities/AuditLog/${rec.data.id}`), true, 'administrador não apaga');
    assert.equal((await fn('audit', { op: 'verify' }, tokens.b)).status, 403, 'só o administrador verifica');
    assert.equal((await fn('audit', { op: 'verify' }, tokens.admin)).data.sealed, false);
    const seal = await fn('audit', { op: 'seal' }, tokens.admin);
    assert.equal(seal.data.sealed, true, JSON.stringify(seal.data));
    await fn('audit', { op: 'record', action: 'task_updated', entity_type: 'Task', entity_id: 't1', details: 'depois do selo' }, tokens.b);
    const verified = await fn('audit', { op: 'verify' }, tokens.admin);
    assert.equal(verified.data.verdict, 'verified', JSON.stringify(verified.data));
    const status = await fn('audit', { op: 'status' }, tokens.admin);
    assert.equal(status.data.last_verification.action, 'audit_chain_verified');
  });

  test('acesso delegado: o cliente concede, o consultor só chega ao que lhe foi concedido', async () => {
    const email = 'rui@neora.pt';
    await api('POST', '/auth/register', { email, password: 'Palavra-Passe-7' });
    const code = await waitForLog(new RegExp(`código de verificação para ${email}: (\\d{6})`));
    await api('POST', '/auth/verify-otp', { email, otpCode: code });
    const login = async () => (await api('POST', '/auth/login', { email, password: 'Palavra-Passe-7' })).access_token;
    const kid = (await api('POST', '/auth/login', { email, password: 'Palavra-Passe-7' })).user.id;
    await api('PUT', `/entities/User/${kid}`, { role: 'consultant' }, tokens.admin);
    let k = await login();
    const denied = async (method, path, body, token) => { try { await api(method, path, body, token); return false; } catch (e) { return /^(403|404)/.test(e.message); } };
    const taskC1 = await api('POST', '/entities/Task', { title: 'Tarefa do cliente um', customer_id: ids.c1, status: 'todo', priority: 'medium' }, tokens.admin);
    const taskC2 = await api('POST', '/entities/Task', { title: 'Tarefa do cliente dois', customer_id: ids.c2, status: 'todo', priority: 'medium' }, tokens.admin);

    // Sem atribuição: nada.
    assert.deepEqual(await api('GET', '/entities/Customer', null, k), []);
    assert.deepEqual(await api('GET', '/entities/Task', null, k), []);

    // A plataforma pede; não decide. Ninguém decide o próprio acesso.
    const until = (ms) => new Date(Date.now() + ms).toISOString();
    const req = await fn('access', { op: 'request', customer_id: ids.c1, user_email: email, access_level: 'viewer', reason: 'Acompanhamento RJC do cliente um', expires_at: until(30 * 86400000) }, tokens.admin);
    assert.equal(req.status, 200, JSON.stringify(req.data));
    const aid = req.data.assignment.id;
    assert.equal(req.data.assignment.status, 'requested');
    assert.equal((await fn('access', { op: 'approve', id: aid }, tokens.admin)).status, 403, 'a plataforma não aprova');
    assert.equal((await fn('access', { op: 'approve', id: aid }, k)).status, 403, 'ninguém aprova o próprio acesso');
    assert.equal((await fn('access', { op: 'approve', id: aid }, tokens.b)).status, 403, 'outro cliente não decide');
    assert.deepEqual(await api('GET', '/entities/Task', null, k), [], 'pedido pendente não dá acesso');

    // O cliente aprova: leitura no cliente um, e só nele.
    assert.equal((await fn('access', { op: 'approve', id: aid }, tokens.a)).status, 200);
    k = await login();
    assert.deepEqual((await api('GET', '/entities/Customer', null, k)).map((c) => c.id), [ids.c1]);
    const visible = (await api('GET', '/entities/Task', null, k)).map((t) => t.id);
    assert.ok(visible.includes(taskC1.id));
    assert.ok(!visible.includes(taskC2.id), 'nunca o cliente dois');
    assert.equal(await denied('POST', '/entities/Task', { title: 'x', customer_id: ids.c1, status: 'todo', priority: 'low' }, k), true, 'leitor não escreve');
    assert.equal(await denied('PUT', `/entities/Task/${taskC1.id}`, { title: 'alterada' }, k), true, 'leitor não altera');
    assert.equal((await fn('listUsers', { customer_id: ids.c1 }, k)).status, 200);
    assert.equal((await fn('listUsers', { customer_id: ids.c2 }, k)).status, 403);

    // O próprio não altera as suas listas, nem o administrador as escreve à mão.
    await api('PUT', '/auth/me', { delegated_edit_customer_ids: [ids.c2] }, k);
    await api('PUT', `/entities/User/${kid}`, { delegated_admin_customer_ids: [ids.c2] }, tokens.admin);
    assert.equal(await denied('POST', '/entities/Task', { title: 'x', customer_id: ids.c2, status: 'todo', priority: 'low' }, k), true);

    // Revogação: efeito imediato. O cliente concede depois como colaborador: escreve no cliente um e não no dois.
    assert.equal((await fn('access', { op: 'revoke', id: aid }, tokens.a)).status, 200);
    assert.deepEqual(await api('GET', '/entities/Task', null, k), [], 'revogado');
    const grant = await fn('access', { op: 'grant', customer_id: ids.c1, user_email: email, access_level: 'contributor', reason: 'Implementação das medidas mínimas', expires_at: until(3000) }, tokens.a);
    assert.equal(grant.status, 200, JSON.stringify(grant.data));
    const created = await api('POST', '/entities/Task', { title: 'Criada pelo consultor', customer_id: ids.c1, status: 'todo', priority: 'low' }, k);
    assert.equal(created.customer_id, ids.c1);
    assert.equal(await denied('POST', '/entities/Task', { title: 'x', customer_id: ids.c2, status: 'todo', priority: 'low' }, k), true);
    assert.equal((await fn('access', { op: 'grant', customer_id: ids.c1, user_email: email, access_level: 'admin', reason: 'Segundo acesso em paralelo', expires_at: until(86400000) }, tokens.a)).status, 409, 'um acesso de cada vez');

    // Prazo: depois de terminar, a sincronização (de hora a hora) retira o acesso.
    await sleep(3500);
    assert.equal((await fn('access', { op: 'sync' }, tokens.admin)).status, 200);
    assert.deepEqual(await api('GET', '/entities/Task', null, k), [], 'expirado');
    const mine = await fn('access', { op: 'list' }, k);
    assert.deepEqual(mine.data.assignments.map((a) => a.status).sort(), ['expired', 'revoked']);

    // Trilha: cada decisão ficou registada.
    const trail = (await api('GET', `/entities/AuditLog?q=${encodeURIComponent(JSON.stringify({ entity_type: 'UserCustomerAssignment' }))}`, null, tokens.admin)).map((r) => r.action);
    for (const action of ['access_requested', 'access_approved', 'access_revoked', 'access_granted']) assert.ok(trail.includes(action), action);
  });

  test('funções de backend', async () => {
    const list = await fn('listUsers', {}, tokens.a);
    assert.equal(list.status, 200);
    assert.deepEqual(list.data.users.map((u) => u.email), ['ana@cliente1.pt']);
    const colleagues = await fn('listUsers', {}, tokens.b);
    assert.equal(colleagues.status, 200, 'utilizador comum vê só os colegas');
    assert.ok(colleagues.data.users.every((u) => u.customer_id === ids.c2));
    assert.ok(!colleagues.data.users.some((u) => u.email === ADMIN.email));
    const everyone = (await fn('listUsers', {}, tokens.admin)).data.users.map((u) => u.email);
    assert.ok(['ana@cliente1.pt', 'bruno@cliente2.pt', ADMIN.email].every((e) => everyone.includes(e)));

    const login = await fn('logUserLogin', {}, tokens.b);
    assert.equal(login.status, 200);
    // O registo de entrada não leva customer_id (logUserLogin atual), por isso só o administrador o vê.
    const audit = await api('GET', `/entities/AuditLog?q=${encodeURIComponent(JSON.stringify({ action: 'user_login' }))}`, null, tokens.admin);
    assert.ok(audit.some((a) => a.user_email === 'bruno@cliente2.pt'));

    assert.equal((await fn('dataRetentionPurge', {})).status, 401, 'anónimo sem segredo de automação');
    assert.equal((await fn('dataRetentionPurge', {}, tokens.b)).status, 403, 'utilizador comum sem segredo de automação');
    assert.equal((await fn('documentReviewReminders', {}, tokens.b)).status, 403, 'função de sistema bloqueada');
    assert.equal((await fn('createNotifications', { event: { type: 'create', entity_name: 'Task', entity_id: ids.tb } })).status, 401);
  });

  test('regressão: customer_admin sem cliente não gere utilizadores sem cliente', async () => {
    const r = await api('POST', '/auth/login', { email: 'sem.cliente@x.pt', password: 'Palavra-Passe-9' });
    const u = r.user;
    await api('PUT', `/entities/User/${u.id}`, { role: 'customer_admin' }, tokens.admin);
    const t = (await api('POST', '/auth/login', { email: 'sem.cliente@x.pt', password: 'Palavra-Passe-9' })).access_token;
    assert.equal((await fn('listUsers', {}, t)).status, 403);
    const adminId = (await api('GET', '/auth/me', null, tokens.admin)).id;
    assert.equal((await fn('manageUser', { action: 'delete', userId: adminId }, t)).status, 403);
    assert.equal((await fn('manageUser', { action: 'update', userId: adminId, data: { full_name: 'x' } }, t)).status, 403);
  });

  test('regressão: notificações usam o registo real e não o enviado', async () => {
    const res = await fn('taskNotifications', { type: 'assigned', task: { id: ids.ta, title: 'falso', assigned_to: 'spam@x.pt' } }, tokens.b);
    assert.equal(res.status, 403, 'tarefa de outro cliente');
  });

  test('workflow desencadeado por entidade cria notificações', async () => {
    await api('PUT', `/entities/Task/${ids.tb}`, { assigned_to: 'bruno@cliente2.pt' }, tokens.b);
    let notes = [];
    for (let i = 0; i < 40 && notes.length === 0; i += 1) {
      await sleep(150);
      notes = await api('GET', '/entities/Notification', null, tokens.b);
    }
    assert.equal(notes.length, 1, logs.slice(-2000));
    assert.equal(notes[0].type, 'task_assigned');
    // (a Ana tem a notificação do pedido de acesso delegado; de tarefas, nenhuma)
    assert.deepEqual((await api('GET', '/entities/Notification', null, tokens.a)).filter((n) => n.entity_type === 'Task'), []);
    const runs = await api('GET', '/workflows/runs', null, tokens.admin);
    assert.ok(runs.some((r) => r.workflow === 'Notify on Task Changes' && r.status === 'success'));
  });

  test('workflow agendado e função com jsPDF executados manualmente', async () => {
    const res = await api('POST', '/workflows/Monthly%20Annual%20Report%20Snapshot/run', {}, tokens.admin);
    if (!res.success) {
      const runs = await api('GET', '/workflows/runs', null, tokens.admin);
      assert.fail(`workflow falhou: ${JSON.stringify(runs.find((r) => r.workflow === 'Monthly Annual Report Snapshot'))}\n${logs.slice(-1500)}`);
    }
    assert.equal(res.results[0].data.success, true);
    const docs = await api('GET', '/entities/SecurityDocument', null, tokens.admin);
    assert.equal(docs.length, 1);
    assert.ok(docs[0].tags.includes('automated'));
    const versions = await api('GET', '/entities/DocumentVersion', null, tokens.admin);
    assert.ok(versions.some((v) => v.document_id === docs[0].id && v.changed_by === ADMIN.email), 'versão registada com a conta do proprietário');
    const again = await fn('generateMonthlyAnnualReport', {}, tokens.admin);
    assert.match(again.data.message, /Já existe/);
    assert.equal((await fn('generateMonthlyAnnualReport', {}, null)).status, 401, 'anónimo');
    assert.equal((await fn('generateMonthlyAnnualReport', {}, tokens.b)).status, 403, 'utilizador comum');
  });

  test('tempo real respeita a RLS', async () => {
    const received = [];
    const controller = new AbortController();
    const res = await fetch(`${BASE}/realtime?entities=Task`, { headers: { Authorization: `Bearer ${tokens.b}` }, signal: controller.signal });
    const reader = res.body.getReader();
    const pump = (async () => {
      const dec = new TextDecoder();
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          for (const line of dec.decode(value).split('\n')) if (line.startsWith('data: ')) received.push(JSON.parse(line.slice(6)));
        }
      } catch { /* abortado */ }
    })();
    await sleep(200);
    await api('POST', '/entities/Task', { title: 'Visível para B', status: 'todo' }, tokens.b);
    await api('POST', '/entities/Task', { title: 'Invisível para B', status: 'todo' }, tokens.a);
    await sleep(400);
    controller.abort();
    await pump;
    assert.deepEqual(received.map((e) => e.data.title), ['Visível para B']);
  });

  test('recuperação de palavra-passe invalida sessões antigas', async () => {
    await api('POST', '/auth/reset-password-request', { email: 'bruno@cliente2.pt' });
    const token = decodeURIComponent(await waitForLog(/reset-password\?token=([^\s]+)/));
    await api('POST', '/auth/reset-password', { resetToken: token, newPassword: 'Nova-Pass-456' });
    await assert.rejects(api('POST', '/auth/reset-password', { resetToken: token, newPassword: 'Outra-789xx' }), /400/);
    await assert.rejects(api('GET', '/auth/me', null, tokens.b), /401/);
    tokens.b = (await api('POST', '/auth/login', { email: 'bruno@cliente2.pt', password: 'Nova-Pass-456' })).access_token;
    assert.ok(tokens.b);
  });

  test('convites e agente', async () => {
    await assert.rejects(api('POST', '/users/invite', { email: 'x@y.pt', role: 'user' }, tokens.b), /403/);
    await assert.rejects(api('POST', '/users/invite', { email: 'x@y.pt', role: 'admin' }, tokens.a), /403/);
    const inv = await api('POST', '/users/invite', { email: 'novo@cliente1.pt', role: 'user' }, tokens.a);
    assert.equal(inv.user.email, 'novo@cliente1.pt');

    const conv = await api('POST', '/agents/conversations', { agent_name: 'framework_guide', metadata: { name: 'Teste' } }, tokens.a);
    assert.equal((await api('GET', '/agents/conversations?agent_name=framework_guide', null, tokens.a)).length, 1);
    await assert.rejects(api('GET', `/agents/conversations/${conv.id}`, null, tokens.b), /404/);

    // Admin cria um referencial; o agente lê-o com as permissões da utilizadora.
    await api('POST', '/entities/Framework', { code: 'NIS2', name: 'NIS2' }, tokens.admin).catch(() => {});
    llmRequests = [];
    await api('POST', `/agents/conversations/${conv.id}/messages`, { role: 'user', content: 'Quero avaliar a NIS2' }, tokens.a);
    let messages = [];
    for (let i = 0; i < 50; i += 1) {
      await sleep(100);
      messages = (await api('GET', `/agents/conversations/${conv.id}`, null, tokens.a)).messages;
      if (messages.length >= 3) break;
    }
    assert.equal(messages.length, 3, JSON.stringify(messages));
    assert.equal(messages[1].tool_calls[0].name, 'read_Framework');
    assert.equal(messages[1].tool_calls[0].status, 'completed');
    assert.equal(messages[2].content, 'Encontrei os referenciais disponíveis.');
    assert.match(llmRequests[0].system, /Framework Guidance agent/);
    assert.ok(llmRequests[0].tools.some((t) => t.name === 'create_AssessmentResponse'));
    assert.ok(!llmRequests[0].tools.some((t) => t.name.startsWith('delete_')), 'só as operações permitidas');
    assert.equal(llmRequests[1].messages.at(-1).content[0].type, 'tool_result');
  });

  test('InvokeLLM com e sem esquema JSON', async () => {
    const structured = await api('POST', '/integrations/Core/InvokeLLM', {
      prompt: 'Gera recomendações',
      response_json_schema: { type: 'object', properties: { recommendations: { type: 'array', items: { type: 'string' } } } },
    }, tokens.a);
    assert.deepEqual(structured, { recommendations: ['Ativar MFA'] });
    assert.equal(await api('POST', '/integrations/Core/InvokeLLM', { prompt: 'Diz olá' }, tokens.a), 'Olá!');
    await assert.rejects(api('POST', '/integrations/Core/InvokeLLM', { prompt: 'x' }), /401/);
  });
}

// ---------------------------------------------------------------------------

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

/** Servidor que imita a API Messages da Anthropic. */
function startMockAnthropic() {
  const server = http.createServer(async (req, res) => {
    let raw = '';
    for await (const c of req) raw += c;
    const body = JSON.parse(raw);
    llmRequests.push(body);
    const reply = (content, stop = 'end_turn') => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id: 'msg_test', type: 'message', role: 'assistant', content, stop_reason: stop }));
    };
    if (req.headers['x-api-key'] !== 'chave-de-teste') { res.writeHead(401); return res.end('{}'); }
    const last = body.messages.at(-1);
    if (body.tool_choice?.name === 'respond') return reply([{ type: 'tool_use', id: 'tu_r', name: 'respond', input: { recommendations: ['Ativar MFA'] } }], 'tool_use');
    if (!body.tools) return reply([{ type: 'text', text: 'Olá!' }]);
    if (Array.isArray(last.content) && last.content[0]?.type === 'tool_result') return reply([{ type: 'text', text: 'Encontrei os referenciais disponíveis.' }]);
    return reply([{ type: 'tool_use', id: 'tu_1', name: 'read_Framework', input: { query: {} } }], 'tool_use');
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function api(method, p, body, token) {
  const res = await fetch(`${BASE}${p}`, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${res.status} ${data?.message || text}`);
  return data;
}

async function fn(name, body, token, headers = {}) {
  const res = await fetch(`${BASE}/functions/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

async function waitForLog(regex) {
  for (let i = 0; i < 50; i += 1) {
    const matches = [...logs.matchAll(new RegExp(regex.source, 'g'))];
    if (matches.length) return matches[matches.length - 1][1];
    await sleep(100);
  }
  throw new Error(`Não encontrado nos registos: ${regex}`);
}
