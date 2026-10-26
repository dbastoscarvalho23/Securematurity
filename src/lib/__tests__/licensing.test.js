import { describe, expect, it } from 'vitest';
import { subscriptionState, hasModule, moduleForPath } from '@/lib/licensing';

describe('subscriptionState', () => {
  const now = '2026-10-26';
  it('sem subscrição = legacy', () => expect(subscriptionState(null, now)).toBe('legacy'));
  it('ativa sem fim', () => expect(subscriptionState({ status: 'active' }, now)).toBe('active'));
  it('expirada, em tolerância e depois da tolerância', () => {
    expect(subscriptionState({ status: 'active', expires_date: '2026-10-20', grace_until: '2026-10-30' }, now)).toBe('grace');
    expect(subscriptionState({ status: 'active', expires_date: '2026-10-20', grace_until: '2026-10-25' }, now)).toBe('expired');
    expect(subscriptionState({ status: 'active', expires_date: '2026-10-26' }, now)).toBe('active');
  });
  it('teste e fim do teste', () => {
    expect(subscriptionState({ status: 'trial', trial_ends_at: '2026-11-01' }, now)).toBe('trial');
    expect(subscriptionState({ status: 'trial', trial_ends_at: '2026-10-01' }, now)).toBe('expired');
  });
  it('suspensa e encerrada', () => {
    expect(subscriptionState({ status: 'suspended' }, now)).toBe('suspended');
    expect(subscriptionState({ status: 'closed', expires_date: '2030-01-01' }, now)).toBe('closed');
  });
});

describe('hasModule e moduleForPath', () => {
  it('admin tem sempre; cliente só os módulos efetivos', () => {
    expect(hasModule({ effective: false, modules: [] }, { role: 'admin' }, 'cve_monitoring')).toBe(true);
    expect(hasModule({ effective: true, modules: ['asset_management'] }, { role: 'customer_admin' }, 'cve_monitoring')).toBe(false);
    expect(hasModule({ effective: false, modules: ['asset_management'] }, { role: 'user' }, 'asset_management')).toBe(false);
    expect(hasModule({ effective: true, modules: [] }, { role: 'user' }, null)).toBe(true);
  });
  it('rotas e sub-rotas', () => {
    expect(moduleForPath('/assets')).toBe('asset_management');
    expect(moduleForPath('/assessments/abc')).toBe('assessments_action_plan');
    expect(moduleForPath('/settings')).toBe(null);
  });
});
