// Teste de qualify() — empacotar com esbuild e correr com node.
import assert from 'node:assert/strict';
import rjc from '../../../data/legal/rjc.json';
import { qualify, annexRows, rjcSizeCategory, reg756SizeClass, sizeThresholds, journeyUpdates } from '../qualification.js';

const legal = { rjc };
const rows = annexRows(rjc);
const pick = (annex, re) => {
  const r = rows.find((x) => x.annex === annex && re.test(x.tipo_entidade));
  assert.ok(r, `linha não encontrada: ${re}`);
  return { annex, sector: r.setor, subsector: r.subsetor, entity_type: r.tipo_entidade };
};
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('ok -', name); };

test('limiares lidos do Anexo III', () => {
  const th = sizeThresholds(rjc);
  assert.equal(th.pme.employees, 250); assert.equal(th.pme.turnover, 50e6); assert.equal(th.pme.balance, 43e6);
  assert.equal(rjcSizeCategory({ employees: 300 }, th), 'grande');
  assert.equal(rjcSizeCategory({ employees: 200, turnover: 60e6, balance: 20e6 }, th), 'media'); // balanço ≤ 43 M€ → PME
  assert.equal(rjcSizeCategory({ employees: 200, turnover: 60e6, balance: 50e6 }, th), 'grande');
  assert.equal(rjcSizeCategory({ employees: 30, turnover: 5e6 }, th), 'pequena');
  assert.equal(rjcSizeCategory({ employees: 120 }, th), null); // sem dados financeiros
  assert.equal(reg756SizeClass({ employees: 200, turnover: 60e6, balance: 20e6 }, th), 'grande'); // Anexo II do Reg. 756: OU
});

test('grande empresa num setor do Anexo I → essencial (art. 6.º, n.º 1, a))', () => {
  const r = qualify({ ...pick('I', /Operadores da rede de distribuição na aceção do ponto 29/), establishment: 'pt', employees: 600, turnover: 120e6, balance: 90e6, already_active: true, platform_date: '2026-11-02' }, legal);
  assert.equal(r.rjc_qualification, 'essencial');
  assert.equal(r.rjc_annex, 'I');
  assert.equal(r.entity_size, 'grande');
  assert.equal(r.conformity_level, null); // depende da matriz de risco do CNCS
  assert.ok(r.open_points.some((o) => o.key === 'qw_o_level'));
  assert.ok(r.reasons.some((x) => x.basis === 'RJC, art. 6.º, n.º 1, alínea a)'));
  assert.equal(r.deadline.date, '2027-01-01');
});

test('média empresa num setor do Anexo II → importante (art. 6.º, n.º 2)', () => {
  const r = qualify({ ...pick('II', /divisão 28/), establishment: 'pt', employees: 120, turnover: 30e6, balance: 20e6, already_active: false, activity_start: '2026-10-01' }, legal);
  assert.equal(r.rjc_qualification, 'importante');
  assert.equal(r.entity_size, 'media');
  assert.ok(r.reasons.some((x) => x.basis === 'RJC, art. 3.º, n.º 1, alínea a), e art. 6.º, n.º 2'));
  assert.equal(r.deadline.date, '2026-10-31');
});

test('pequena empresa — abrangida independentemente da dimensão (art. 3.º, n.º 2, a))', () => {
  const comms = qualify({ ...pick('I', /Prestadores de serviços de comunicações eletrónicas acessíveis ao público/), provides_in_pt: true, employees: 12, turnover: 1.5e6, balance: 1e6 }, legal);
  assert.equal(comms.rjc_qualification, 'importante');
  assert.equal(comms.entity_size, 'pequena');
  const dns = qualify({ ...pick('I', /serviços de DNS/), establishment: 'pt', main_establishment_pt: true, employees: 4, turnover: 3e5, balance: 2e5 }, legal);
  assert.equal(dns.rjc_qualification, 'essencial'); // art. 6.º, n.º 1, b)
  // Pequena empresa sem caso especial → não abrangida (art. 3.º, n.º 1, a))
  const small = qualify({ ...pick('II', /divisão 28/), establishment: 'pt', employees: 20, turnover: 3e6, balance: 2e6 }, legal);
  assert.equal(small.rjc_qualification, 'nao_abrangida');
  // Pequena com critério de risco (art. 3.º, n.º 2, b) a e)) → fica por determinar (decisão do CNCS)
  const risky = qualify({ ...pick('II', /divisão 28/), establishment: 'pt', employees: 20, turnover: 3e6, balance: 2e6, sole_provider: true }, legal);
  assert.equal(risky.rjc_qualification, 'por_determinar');
  assert.ok(risky.open_points.some((o) => o.key === 'qw_o_art32_risk'));
});

test('administração pública → entidade pública relevante, grupo A/B (art. 7.º)', () => {
  const mun = qualify({ annex: 'none', is_public: true, public_kind: 'adm_autonoma', employees: 400 }, legal);
  assert.equal(mun.rjc_qualification, 'publica_relevante');
  assert.equal(mun.epr_group, 'A');
  const b = qualify({ annex: 'none', is_public: true, public_kind: 'adm_direta_estado', employees: 120 }, legal);
  assert.equal(b.epr_group, 'B');
  const edge = qualify({ annex: 'none', is_public: true, public_kind: 'adm_indireta_estado', employees: 250 }, legal);
  assert.equal(edge.epr_group, null); // «mais de 250» vs «entre 75 e 249»
  assert.ok(edge.open_points.some((o) => o.key === 'qw_o_epr_250'));
  const eai = qualify({ annex: 'none', is_public: true, public_kind: 'eai', employees: 40 }, legal);
  assert.equal(eai.epr_group, 'A');
  // Concurso: entidade pública grande com atividade do Anexo I → essencial (art. 9.º, n.º 1)
  const hosp = qualify({ ...pick('I', /Prestadores de cuidados de saúde/), is_public: true, public_kind: 'epe', employees: 3000, turnover: 200e6, balance: 150e6 }, legal);
  assert.equal(hosp.rjc_qualification, 'essencial');
  assert.equal(hosp.epr_group, null);
});

test('não abrangida', () => {
  const r = qualify({ annex: 'none', employees: 800, turnover: 90e6, balance: 70e6 }, legal);
  assert.equal(r.rjc_qualification, 'nao_abrangida');
  assert.equal(r.deadline, null);
  const foreign = qualify({ ...pick('II', /divisão 28/), establishment: 'ue_outro', employees: 800, turnover: 90e6, balance: 70e6 }, legal);
  assert.equal(foreign.rjc_qualification, 'nao_abrangida');
  const bdp = qualify({ annex: 'none', is_public: true, public_kind: 'excluida_art3_3f', employees: 1500 }, legal);
  assert.equal(bdp.rjc_qualification, 'nao_abrangida');
});

test('qualificação notificada pelo CNCS prevalece', () => {
  const r = qualify({ ...pick('II', /divisão 28/), establishment: 'pt', employees: 120, turnover: 30e6, balance: 20e6, cncs_qualification: 'essencial', cncs_level: 'substancial' }, legal);
  assert.equal(r.rjc_qualification, 'essencial');
  assert.equal(r.conformity_level, 'substancial');
  assert.ok(r.open_points.some((o) => o.key === 'qw_o_cncs_differs'));
});

test('atualizações da jornada', () => {
  const items = [{ id: 'a1', section_order: 1, task_order: 1, status: 'pending' }, { id: 'a3', section_order: 1, task_order: 3, status: 'pending' }];
  const r = qualify({ ...pick('II', /divisão 28/), establishment: 'pt', employees: 120, turnover: 30e6, balance: 20e6, already_active: false, activity_start: '2026-10-01' }, legal);
  const ups = journeyUpdates(items, r, { note: 'x' });
  assert.deepEqual(ups.find((u) => u.id === 'a1').data.status, 'done');
  assert.equal(ups.find((u) => u.id === 'a3').data.due_date, '2026-10-31');
});

console.log(`\n${passed} testes passaram`);
