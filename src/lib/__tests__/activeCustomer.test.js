import { describe, it, expect, beforeEach } from 'vitest';
import { effectiveUser, withActiveCustomer, writeActiveCustomer, readActiveCustomer, delegatedLevels, setConsultantSession } from '@/lib/activeCustomer';

const consultant = {
  id: 'k1', email: 'rui@neora.pt', role: 'consultant', customer_id: 'neora',
  delegated_view_customer_ids: ['c3'], delegated_edit_customer_ids: ['c2'], delegated_admin_customer_ids: ['c4'],
};

describe('cliente ativo dos consultores', () => {
  beforeEach(() => writeActiveCustomer(null));

  it('quem não é consultor fica igual', () => {
    const u = { role: 'customer_admin', customer_id: 'c1' };
    expect(effectiveUser(u, 'c9')).toBe(u);
  });

  it('nível no cliente ativo dá o papel na interface', () => {
    expect(effectiveUser(consultant, 'c4')).toMatchObject({ role: 'customer_admin', customer_id: 'c4', platform_role: 'consultant', read_only: false });
    expect(effectiveUser(consultant, 'c2')).toMatchObject({ role: 'user', customer_id: 'c2', delegated_level: 'contributor' });
    expect(effectiveUser(consultant, 'c3')).toMatchObject({ role: 'user', customer_id: 'c3', read_only: true });
    expect(effectiveUser(consultant, 'neora')).toMatchObject({ role: 'user', customer_id: 'neora', delegated_level: 'own' });
  });

  it('cliente ativo fora da lista não vale; com um só cliente, é esse', () => {
    expect(effectiveUser(consultant, 'c1').customer_id).toBe(null);
    expect(effectiveUser({ role: 'consultant', delegated_edit_customer_ids: ['c2'] }, null).customer_id).toBe('c2');
    expect(effectiveUser({ role: 'consultant' }, null)).toMatchObject({ customer_id: null, role: 'user' });
  });

  it('o nível mais alto prevalece', () => {
    expect(delegatedLevels({ role: 'consultant', delegated_view_customer_ids: ['c1'], delegated_admin_customer_ids: ['c1'] }).c1).toBe('admin');
  });

  it('pedidos às funções levam o cliente ativo, sem substituir o indicado (só em sessão de consultor)', () => {
    expect(withActiveCustomer({ op: 'list' })).toEqual({ op: 'list' });
    writeActiveCustomer('c2');
    setConsultantSession(false);
    expect(withActiveCustomer({ op: 'list' })).toEqual({ op: 'list' }, 'valor deixado no navegador não é enviado');
    setConsultantSession(true);
    expect(readActiveCustomer()).toBe('c2');
    expect(withActiveCustomer({ op: 'list' })).toEqual({ op: 'list', customer_id: 'c2' });
    expect(withActiveCustomer({ customer_id: 'c4' })).toEqual({ customer_id: 'c4' });
  });
});
