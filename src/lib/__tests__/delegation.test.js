// @vitest-environment node
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { customerRole, resolveCustomer, delegatedCustomerIds, canAccessRecord, roleCanWrite, roleCanManage } from '../../../base44/shared/http.ts';
import {
  validateRequest, effectiveStatus, decisionRefusal, revokeRefusal, deriveScope, isOwnAccess,
} from '../../../base44/shared/delegation.ts';
import { delegateRule, delegateEntity } from '../../../tools/rls/delegation.mjs';

const DAY = 24 * 3600 * 1000;
const NOW = Date.UTC(2026, 9, 30, 12);
const iso = (ms) => new Date(ms).toISOString();
const consultant = {
  id: 'k1', email: 'rui@neora.pt', role: 'consultant',
  delegated_view_customer_ids: ['c3'], delegated_edit_customer_ids: ['c2'], delegated_admin_customer_ids: ['c4'],
};

describe('papel efetivo por cliente', () => {
  it('próprio, delegado e sem acesso', () => {
    expect(customerRole({ role: 'admin' }, 'c9')).toBe('platform');
    expect(customerRole({ role: 'customer_admin', customer_id: 'c1' }, 'c1')).toBe('admin');
    expect(customerRole({ role: 'user', customer_id: 'c1' }, 'c1')).toBe('member');
    expect(customerRole({ role: 'user', customer_id: 'c1' }, 'c2')).toBe(null);
    expect(customerRole(consultant, 'c2')).toBe('member');
    expect(customerRole(consultant, 'c3')).toBe('viewer');
    expect(customerRole(consultant, 'c4')).toBe('admin');
    expect(customerRole(consultant, 'c1')).toBe(null);
    // listas também em user.data (forma do SDK)
    expect(customerRole({ role: 'consultant', data: { delegated_view_customer_ids: ['c7'] } }, 'c7')).toBe('viewer');
  });

  it('escrita e gestão por papel', () => {
    expect(roleCanWrite('viewer')).toBe(false);
    expect(roleCanWrite('member')).toBe(true);
    expect(roleCanManage('member')).toBe(false);
    expect(roleCanManage('admin')).toBe(true);
  });

  it('cliente de um pedido', () => {
    expect(resolveCustomer(consultant, 'c2', { write: true })).toEqual({ customerId: 'c2', role: 'member' });
    expect(resolveCustomer(consultant, 'c3', { write: true })).toBe(null);
    expect(resolveCustomer(consultant, 'c3')).toEqual({ customerId: 'c3', role: 'viewer' });
    expect(resolveCustomer(consultant, 'c1')).toBe(null);
    expect(resolveCustomer(consultant, '')).toBe(null); // vários clientes delegados: tem de indicar
    expect(resolveCustomer({ role: 'consultant', delegated_edit_customer_ids: ['c2'] }, '')).toEqual({ customerId: 'c2', role: 'member' });
    expect(resolveCustomer({ role: 'user', customer_id: 'c1' }, 'c2')).toBe(null);
    expect(resolveCustomer({ role: 'admin' }, 'c5')).toEqual({ customerId: 'c5', role: 'platform' });
  });

  it('listas por nível e acesso a registos', () => {
    expect(delegatedCustomerIds(consultant).sort()).toEqual(['c2', 'c3', 'c4']);
    expect(delegatedCustomerIds(consultant, 'contributor').sort()).toEqual(['c2', 'c4']);
    expect(canAccessRecord(consultant, { customer_id: 'c3' })).toBe(true);
    expect(canAccessRecord(consultant, { customer_id: 'c1' })).toBe(false);
  });
});

describe('regras da delegação', () => {
  const ok = { customer_id: 'c1', user_email: 'rui@neora.pt', access_level: 'contributor', reason: 'Acompanhamento NIS2 do cliente', expires_at: iso(NOW + 90 * DAY) };

  it('validação do pedido', () => {
    expect(validateRequest(ok, NOW)).toBe(null);
    expect(validateRequest({ ...ok, reason: 'curta' }, NOW)).toMatch(/justificação/);
    expect(validateRequest({ ...ok, expires_at: iso(NOW - DAY) }, NOW)).toMatch(/futuro/);
    expect(validateRequest({ ...ok, expires_at: iso(NOW + 400 * DAY) }, NOW)).toMatch(/365/);
    expect(validateRequest({ ...ok, assignment_type: 'external', access_level: 'contributor' }, NOW)).toMatch(/leitura/);
    expect(validateRequest({ ...ok, assignment_type: 'external', access_level: 'viewer', expires_at: iso(NOW + 40 * DAY) }, NOW)).toMatch(/30/);
    expect(validateRequest({ ...ok, access_level: 'owner' }, NOW)).toMatch(/Nível/);
  });

  it('estado efetivo e prazo', () => {
    expect(effectiveStatus({ status: 'active', expires_at: iso(NOW + DAY) }, NOW)).toBe('active');
    expect(effectiveStatus({ status: 'active', expires_at: iso(NOW - 1) }, NOW)).toBe('expired');
    expect(effectiveStatus({ status: 'revoked', expires_at: iso(NOW + DAY) }, NOW)).toBe('revoked');
  });

  it('quem decide: o cliente, nunca a plataforma nem o próprio', () => {
    const a = { customer_id: 'c1', user_email: 'rui@neora.pt', user_id: 'k1' };
    expect(decisionRefusal({ role: 'customer_admin', customer_id: 'c1', email: 'ana@c1.pt' }, a)).toBe(null);
    expect(decisionRefusal({ role: 'admin', email: 'op@neora.pt' }, a)).toMatch(/decidido pelo cliente/);
    expect(decisionRefusal({ role: 'customer_admin', customer_id: 'c2', email: 'x@c2.pt' }, a)).not.toBe(null);
    expect(decisionRefusal({ role: 'user', customer_id: 'c1', email: 'joao@c1.pt' }, a)).not.toBe(null);
    expect(decisionRefusal({ ...consultant, delegated_admin_customer_ids: ['c1'] }, a)).toMatch(/próprio/);
    expect(decisionRefusal({ id: 'k9', email: 'eva@neora.pt', role: 'consultant', delegated_admin_customer_ids: ['c1'] }, a)).toBe(null);
    expect(isOwnAccess({ email: 'RUI@neora.pt' }, a)).toBe(true);
  });

  it('revogar: cliente, plataforma ou o próprio', () => {
    const a = { customer_id: 'c1', user_email: 'rui@neora.pt' };
    expect(revokeRefusal({ role: 'admin' }, a)).toBe(null);
    expect(revokeRefusal({ email: 'rui@neora.pt', role: 'consultant' }, a)).toBe(null);
    expect(revokeRefusal({ role: 'customer_admin', customer_id: 'c1', email: 'ana@c1.pt' }, a)).toBe(null);
    expect(revokeRefusal({ role: 'user', customer_id: 'c1', email: 'joao@c1.pt' }, a)).not.toBe(null);
  });

  it('listas derivadas só das atribuições ativas e dentro do prazo', () => {
    const scope = deriveScope([
      { customer_id: 'c1', status: 'active', access_level: 'admin', expires_at: iso(NOW + DAY) },
      { customer_id: 'c2', status: 'active', access_level: 'contributor', expires_at: iso(NOW - DAY) },
      { customer_id: 'c3', status: 'requested', access_level: 'viewer', expires_at: iso(NOW + DAY) },
      { customer_id: 'c4', status: 'revoked', access_level: 'viewer', expires_at: iso(NOW + DAY) },
      { customer_id: 'c5', status: 'active', assignment_type: 'external', access_level: 'admin', expires_at: iso(NOW + DAY) },
    ], NOW);
    expect(scope).toEqual({ delegated_view_customer_ids: ['c5'], delegated_edit_customer_ids: [], delegated_admin_customer_ids: ['c1'] });
  });
});

describe('regras de acesso das entidades', () => {
  const own = { 'data.customer_id': '{{user.data.customer_id}}' };
  const admin = { user_condition: { role: 'admin' } };

  it('membro: leitura com os três níveis, escrita sem o viewer', () => {
    const read = delegateRule({ $or: [admin, own] }, 'read', 'Task');
    expect(read.$or).toHaveLength(5);
    const write = delegateRule({ $or: [admin, own] }, 'update', 'Task');
    expect(JSON.stringify(write)).not.toContain('delegated_view');
    expect(write.$or).toHaveLength(4);
  });

  it('só administrador do cliente: só o nível admin, e as outras condições mantêm-se', () => {
    const r = delegateRule({ $or: [admin, { $and: [{ user_condition: { role: 'customer_admin' } }, own] }, { $and: [own, { 'data.restricted': false }] }] }, 'read', 'Evidence');
    const extra = r.$or.slice(3).map((x) => JSON.stringify(x));
    expect(extra).toContain(JSON.stringify({ 'data.customer_id': { $in: '{{user.data.delegated_admin_customer_ids}}' } }));
    expect(extra.filter((x) => x.includes('restricted'))).toHaveLength(3);
    expect(extra.some((x) => x.includes('customer_admin'))).toBe(false);
  });

  it('idempotente, sem mexer em alternativas de outros papéis', () => {
    const once = delegateRule({ $or: [admin, own] }, 'read', 'Task');
    expect(delegateRule(once, 'read', 'Task')).toEqual(once);
    expect(delegateRule(admin, 'update', 'Task')).toEqual(admin);
    expect(delegateRule(false, 'delete', 'AuditLog')).toBe(false);
    expect(delegateRule({ $or: [admin, { user_condition: { role: 'user' } }] }, 'read', 'Framework').$or).toContainEqual({ user_condition: { role: 'consultant' } });
  });

  it('todas as entidades do repositório já têm as regras delegadas (correr o gerador não muda nada)', () => {
    const dir = path.resolve(import.meta.dirname, '../../../base44/entities');
    const stale = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonc')).filter((f) => {
      const entity = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8').replace(/^\s*\/\/.*$/gm, ''));
      return JSON.stringify(delegateEntity(entity).rls) !== JSON.stringify(entity.rls);
    });
    expect(stale.join(',')).toBe('');
  });
});
