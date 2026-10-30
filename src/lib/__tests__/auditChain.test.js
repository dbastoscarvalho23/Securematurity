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
    expect(r.covered).toBe(3);
    expect(r.checked).toBe(4);
    expect(r.chained).toBe(4);
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
    expect(r.continuous).toBe(false);
    expect(r.gaps).toBe(1);
    expect(r.ok).toBe(false);
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

  it('verifyRows sem selo nunca dá a cadeia como íntegra', async () => {
    const r = await verifyRows([{ id: '1', action: 'user_login', created_date: '2026-10-30T00:00:00Z' }]);
    expect(r.integrity_ok).toBe(false);
    expect(SEAL_ACTION).toBe('audit_chain_sealed');
  });
});
