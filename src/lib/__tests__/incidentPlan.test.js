import { describe, expect, it } from 'vitest';
import { incidentCommunications, incidentPhases, nextIncidentAction, SENT_FIELDS, DRAFT_KIND } from '@/lib/incidentPlan';

const base = { reporting_regime: 'rjc', detected_at: '2026-10-01T08:00:00Z', significant_verified_at: '2026-10-01T10:00:00Z', status: 'open' };
const ids = (inc) => incidentCommunications(inc).map((c) => c.id);

describe('plano de incidentes — comunicações', () => {
  it('RJC: inicial, atualização, fim do impacto, final, intercalar a pedido, destinatários e outras autoridades', () => {
    expect(ids(base)).toEqual(['rjc_initial', 'rjc_update', 'rjc_end_of_impact', 'rjc_final', 'rjc_interim', 'recipients', 'other_authorities']);
    const c = incidentCommunications(base);
    expect(c[0].due.toISOString()).toBe('2026-10-02T10:00:00.000Z'); // 24 h após a verificação (art. 42.º, n.º 1)
    expect(c[2].waitingFor).toBe('impact_ended_at');
    expect(c.find((x) => x.id === 'rjc_update').mandatory).toBe(false);
    expect(c[0].content.length).toBeGreaterThan(2);
  });
  it('resolvido em 2 horas: só o fim do impacto (art. 41.º, n.º 2), sem intercalar', () => {
    expect(ids({ ...base, resolved_within_2h: true })).toEqual(['rjc_end_of_impact', 'recipients', 'other_authorities']);
  });
  it('dados pessoais: CNPD em 72 h após a deteção e titulares (RGPD, arts. 33.º e 34.º)', () => {
    const c = incidentCommunications({ ...base, personal_data_affected: true });
    const cnpd = c.find((x) => x.id === 'cnpd');
    expect(cnpd.due.toISOString()).toBe('2026-10-04T08:00:00.000Z');
    expect(cnpd.mandatory).toBe(true);
    expect(c.find((x) => x.id === 'data_subjects').mandatory).toBe(false);
  });
  it('sem regime: só as comunicações de dados pessoais e outras autoridades', () => {
    expect(ids({ ...base, reporting_regime: 'nenhum', data_breach: true })).toEqual(['cnpd', 'data_subjects', 'other_authorities']);
  });
  it('campos de envio e rascunhos de IA definidos para as comunicações ao CNCS', () => {
    for (const id of ['rjc_initial', 'rjc_update', 'rjc_end_of_impact', 'rjc_final', 'recipients', 'cnpd', 'data_subjects']) expect(SENT_FIELDS[id]).toHaveLength(2);
    expect(DRAFT_KIND.rjc_initial).toBe('incident_initial');
  });
});

describe('plano de incidentes — fases e próxima ação', () => {
  it('próxima ação: a notificação inicial com prazo; em atraso depois das 24 h', () => {
    const n = nextIncidentAction(base, Date.parse('2026-10-01T12:00:00Z'));
    expect(n).toMatchObject({ type: 'communication', id: 'rjc_initial', overdue: false });
    expect(nextIncidentAction(base, Date.parse('2026-10-03T12:00:00Z')).overdue).toBe(true);
  });
  it('enviada a inicial, pede o registo do fim do impacto', () => {
    const n = nextIncidentAction({ ...base, early_warning_sent: true, early_warning_sent_at: '2026-10-01T20:00:00Z' });
    expect(n).toMatchObject({ type: 'record', field: 'impact_ended_at', id: 'rjc_end_of_impact' });
  });
  it('fases calculadas a partir dos factos', () => {
    const p = incidentPhases({ ...base, contained_at: '2026-10-01T11:00:00Z' });
    expect(p.map((x) => [x.id, x.done])).toEqual([['detect', true], ['assess', true], ['contain', true], ['communicate', false], ['recover', false], ['close', false]]);
    expect(p.find((x) => x.current).id).toBe('communicate');
  });
});
