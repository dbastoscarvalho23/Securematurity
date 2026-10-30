// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  stable, sha256, appendAuditEntry, sealChain, verifyChain, verifyRows, readTrail, SEAL_ACTION,
} from '../../../base44/shared/auditChain.ts';

/** Entidade AuditLog em memória, com a mesma forma de chamada que o SDK (list/filter/create/update). */
function fakeBase44() {
  const rows = [];
  let clock = Date.UTC(2026, 9, 30, 0, 0, 0);
  const sortRows = (sort) => {
    const desc = String(sort || '').startsWith('-');
    const sorted = [...rows].sort((a, b) => (a.created_date < b.created_date ? -1 : a.created_date > b.created_date ? 1 : a.id < b.id ? -1 : 1));
    return desc ? sorted.reverse() : sorted;
  };
  const matches = (row, query) => Object.entries(query).every(([k, v]) => (v && typeof v === 'object' && v.$in ? v.$in.includes(row[k]) : row[k] === v));
  const AuditLog = {
    list: async (sort, limit = 50, skip = 0) => sortRows(sort).slice(skip, skip + limit).map((r) => ({ ...r })),
    filter: async (query, sort, limit = 50) => sortRows(sort).filter((r) => matches(r, query)).slice(0, limit).map((r) => ({ ...r })),
    create: async (data) => {
      clock += 1000;
      const row = { ...data, id: `id${String(rows.length + 1).padStart(4, '0')}`, created_date: new Date(clock).toISOString() };
      rows.push(row);
      return { ...row };
    },
    update: async (id, data) => Object.assign(rows.find((r) => r.id === id), data),
  };
  return { rows, asServiceRole: { entities: { AuditLog } } };
}

describe('trilha de auditoria encadeada', () => {
  it('serialização estável e SHA-256', async () => {
    expect(stable({ b: 1, a: [2, { d: null, c: 'x' }] })).toBe(stable({ a: [2, { c: 'x', d: null }], b: 1 }));
    expect(await sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('sem selo, a verificação diz que falta o ponto de partida', async () => {
    const b = fakeBase44();
    await b.asServiceRole.entities.AuditLog.create({ action: 'user_login', user_email: 'a@x.pt' });
    const r = await verifyChain(b);
    expect(r.sealed).toBe(false);
    expect(r.ok).toBe(false);
  });

  it('selo de partida cobre as entradas antigas e a cadeia verifica-se', async () => {
    const b = fakeBase44();
    for (let i = 0; i < 3; i += 1) await b.asServiceRole.entities.AuditLog.create({ action: 'task_created', user_email: 'antigo@x.pt', details: `antiga ${i}` });
    const seal = await sealChain(b, 'admin@x.pt');
    expect(seal.sealed).toBe(true);
    expect(seal.covered).toBe(3);
    for (let i = 0; i < 4; i += 1) {
      await appendAuditEntry(b, { action: 'risk_updated', user_email: 'ana@cliente.pt', customer_id: 'c1', details: `nova ${i}`, actor_attested: true, origin: 'session' });
    }
    const r = await verifyChain(b);
    expect(r.ok).toBe(true);
    expect(r.verdict).toBe('verified');
    expect(r.covered).toBe(3);
    expect(r.checked).toBe(4);
    // Um segundo selo não se repete enquanto o primeiro conferir.
    expect((await sealChain(b, 'admin@x.pt')).already).toBe(true);
  });

  it('deteta uma entrada alterada depois de escrita', async () => {
    const b = fakeBase44();
    await sealChain(b, 'admin@x.pt');
    await appendAuditEntry(b, { action: 'document_approved', user_email: 'ana@cliente.pt', details: 'Política aprovada' });
    await appendAuditEntry(b, { action: 'document_updated', user_email: 'ana@cliente.pt', details: 'Revisão' });
    b.rows.find((r) => r.action === 'document_approved').details = 'Política aprovada por outra pessoa';
    const r = await verifyChain(b);
    expect(r.integrity_ok).toBe(false);
    expect(r.first_broken.action).toBe('document_approved');
  });

  it('deteta uma entrada antiga alterada (coberta pelo selo)', async () => {
    const b = fakeBase44();
    await b.asServiceRole.entities.AuditLog.create({ action: 'user_login', user_email: 'a@x.pt', details: 'original' });
    await sealChain(b, 'admin@x.pt');
    b.rows[0].details = 'alterado';
    const r = await verifyChain(b);
    expect(r.baseline_ok).toBe(false);
    expect(r.integrity_ok).toBe(false);
  });

  it('deteta uma entrada apagada como lacuna no encadeamento', async () => {
    const b = fakeBase44();
    await sealChain(b, 'admin@x.pt');
    for (let i = 0; i < 3; i += 1) await appendAuditEntry(b, { action: 'task_updated', user_email: 'ana@cliente.pt', details: `passo ${i}` });
    b.rows.splice(b.rows.findIndex((r) => r.details === 'passo 1'), 1);
    const r = await verifyChain(b);
    expect(r.gaps).toBe(1);
    expect(r.integrity_ok).toBe(false);
    expect(r.verdict).toBe('broken');
  });

  it('o resumo cobre a autoria: mudar o autor quebra a cadeia', async () => {
    const b = fakeBase44();
    await sealChain(b, 'admin@x.pt');
    await appendAuditEntry(b, { action: 'settings_changed', user_email: 'ana@cliente.pt', actor_attested: true, origin: 'session' });
    b.rows.find((r) => r.action === 'settings_changed').user_email = 'outro@cliente.pt';
    expect((await verifyChain(b)).first_broken).not.toBeNull();
  });

  it('a leitura percorre todas as páginas', async () => {
    const b = fakeBase44();
    for (let i = 0; i < 12; i += 1) await b.asServiceRole.entities.AuditLog.create({ action: 'user_login', user_email: `u${i}@x.pt` });
    const read = await readTrail(b, { pageSize: 5 });
    expect(read.rows).toHaveLength(12);
    expect(read.truncated).toBe(false);
    const short = await readTrail(b, { pageSize: 5, maxPages: 2 });
    expect(short.truncated).toBe(true);
  });

  it('uma entrada alterada e sem resumo conta como quebra, mesmo sendo a última', async () => {
    const b = fakeBase44();
    await sealChain(b, 'admin@x.pt');
    await appendAuditEntry(b, { action: 'task_updated', user_email: 'ana@cliente.pt', details: 'original' });
    const last = b.rows.at(-1);
    last.details = 'alterado';
    delete last.entry_hash;
    delete last.prev_hash;
    const r = await verifyChain(b);
    expect(r.verdict).toBe('broken');
  });

  it('uma entrada sem resumo no meio conta como quebra', async () => {
    const b = fakeBase44();
    await sealChain(b, 'admin@x.pt');
    for (let i = 0; i < 3; i += 1) await appendAuditEntry(b, { action: 'task_updated', user_email: 'ana@cliente.pt', details: `p${i}` });
    const middle = b.rows.find((r) => r.details === 'p1');
    middle.details = 'alterado';
    delete middle.entry_hash;
    expect((await verifyChain(b)).verdict).toBe('broken');
  });

  it('o conteúdo do selo está protegido', async () => {
    const b = fakeBase44();
    await b.asServiceRole.entities.AuditLog.create({ action: 'user_login', user_email: 'a@x.pt' });
    await sealChain(b, 'admin@x.pt');
    b.rows.find((r) => r.action === SEAL_ACTION).user_email = 'outro@x.pt';
    const r = await verifyChain(b);
    expect(r.seal_ok).toBe(false);
    expect(r.verdict).toBe('broken');
  });

  it('remover uma entrada já vista por uma verificação deteta-se', async () => {
    const b = fakeBase44();
    await sealChain(b, 'admin@x.pt');
    for (let i = 0; i < 3; i += 1) await appendAuditEntry(b, { action: 'task_updated', user_email: 'ana@cliente.pt', details: `p${i}` });
    const first = await verifyChain(b);
    await appendAuditEntry(b, { action: 'audit_chain_verified', user_email: 'admin@x.pt', entity_type: 'AuditLog', entity_id: first.head, chain_count: first.checked });
    await appendAuditEntry(b, { action: 'task_updated', user_email: 'ana@cliente.pt', details: 'depois' });
    // remove a última entrada vista pela verificação (p2): a verificação seguinte tem de o detetar
    b.rows.splice(b.rows.findIndex((r) => r.details === 'p2'), 1);
    expect((await verifyChain(b)).verdict).toBe('broken');
  });

  it('um novo selo depois de uma quebra exige confirmação e justificação', async () => {
    const b = fakeBase44();
    await b.asServiceRole.entities.AuditLog.create({ action: 'user_login', user_email: 'a@x.pt', details: 'original' });
    await sealChain(b, 'admin@x.pt');
    b.rows[0].details = 'alterado';
    const refused = await sealChain(b, 'admin@x.pt');
    expect(refused.sealed).toBe(false);
    expect(refused.requires_confirmation).toBe(true);
    expect((await sealChain(b, 'admin@x.pt', { confirm: true, reason: 'curta' })).sealed).toBe(false);
    const resealed = await sealChain(b, 'admin@x.pt', { confirm: true, reason: 'Reposição aprovada pela direção após análise' });
    expect(resealed.sealed).toBe(true);
    expect(b.rows.at(-1).details.includes('Justificação')).toBe(true);
  });

  it('bifurcação e leitura incompleta pedem revisão, sem dar a cadeia como verificada', async () => {
    const b = fakeBase44();
    await sealChain(b, 'admin@x.pt');
    await appendAuditEntry(b, { action: 'task_updated', user_email: 'ana@cliente.pt', details: 'a' });
    const prev = b.rows.at(-1).entry_hash;
    await appendAuditEntry(b, { action: 'task_updated', user_email: 'ana@cliente.pt', details: 'b' });
    // simula uma escrita simultânea que ligou à mesma anterior que a entrada «b»
    const fork = { action: 'task_updated', entity_type: '', entity_id: '', user_email: 'rui@cliente.pt', details: 'c', actor_attested: false, origin: 'session', prev_hash: b.rows.at(-2).prev_hash };
    const { sha256: h, contentOf } = await import('../../../base44/shared/auditChain.ts');
    await b.asServiceRole.entities.AuditLog.create({ ...fork, entry_hash: await h(`${contentOf(fork)}|${fork.prev_hash}`) });
    expect(prev).toBeTruthy();
    const r = await verifyChain(b);
    expect(r.integrity_ok).toBe(true);
    expect(r.verdict).toBe('review');
    const rows = (await readTrail(b)).rows;
    expect((await verifyRows(rows.slice(0, 3), { truncated: true })).verdict).toBe('review');
  });

  it('verifyRows sem selo nunca dá a cadeia como íntegra', async () => {
    const r = await verifyRows([{ id: '1', action: 'user_login', created_date: '2026-10-30T00:00:00Z' }]);
    expect(r.integrity_ok).toBe(false);
    expect(SEAL_ACTION).toBe('audit_chain_sealed');
  });
});
