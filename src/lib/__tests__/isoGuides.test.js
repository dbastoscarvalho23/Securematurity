import { describe, expect, it } from 'vitest';
import iso27 from '@/data/legal/iso27001.json';
import iso42 from '@/data/legal/iso42001.json';
import { gapSummary, gapState } from '@/lib/legal/isoGuide';
import { FRAMEWORK_DOMAINS, SELECTABLE_FRAMEWORKS } from '@/lib/frameworkConstants';
import { isoFramework } from '@/lib/legal/sync';

// Numeração conferida com os textos oficiais (ver docs/legal/referencias-iso.md).
const ISO42001_ANNEX_A = [
  'A.2.2', 'A.2.3', 'A.2.4', 'A.3.2', 'A.3.3', 'A.4.2', 'A.4.3', 'A.4.4', 'A.4.5', 'A.4.6',
  'A.5.2', 'A.5.3', 'A.5.4', 'A.5.5', 'A.6.1.2', 'A.6.1.3', 'A.6.2.2', 'A.6.2.3', 'A.6.2.4', 'A.6.2.5',
  'A.6.2.6', 'A.6.2.7', 'A.6.2.8', 'A.7.2', 'A.7.3', 'A.7.4', 'A.7.5', 'A.7.6', 'A.8.2', 'A.8.3',
  'A.8.4', 'A.8.5', 'A.9.2', 'A.9.3', 'A.9.4', 'A.10.2', 'A.10.3', 'A.10.4',
];
const ISO42001_CLAUSES = ['4.1', '4.2', '4.3', '4.4', '5.1', '5.2', '5.3', '6.1.1', '6.1.2', '6.1.3', '6.1.4', '6.2', '6.3',
  '7.1', '7.2', '7.3', '7.4', '7.5', '8.1', '8.2', '8.3', '8.4', '9.1', '9.2', '9.3', '10.1', '10.2'];

describe('guia ISO/IEC 27001:2022', () => {
  const controls = iso27.items.filter((i) => i.kind === 'control');
  it('93 controlos do Anexo A: 37 organizacionais, 8 de pessoas, 14 físicos e 34 tecnológicos', () => {
    const count = (g) => controls.filter((c) => c.group === g).length;
    expect(controls).toHaveLength(93);
    expect([count('5'), count('6'), count('7'), count('8')]).toEqual([37, 8, 14, 34]);
  });
  it('estrutura conferida e informação documentada assinalada', () => {
    expect(iso27.source.validation).toBe('estrutura_validada');
    const doc = iso27.items.filter((i) => i.documented).map((i) => i.ref);
    expect(doc).toEqual(['4.3', '5.2', '6.1.2', '6.1.3', '6.2', '7.2', '7.5', '8.1', '8.2', '8.3', '9.1', '9.2', '9.3', '10.2']);
  });
  it('A.8.34 é a proteção dos sistemas durante testes de auditoria', () => {
    expect(iso27.items.find((i) => i.id === 'A.8.34').title).toMatch(/testes de auditoria/i);
    expect(iso27.items.find((i) => i.id === 'A.8.34').title).toMatch(/^Proteção/);
  });
});

describe('guia ISO/IEC 42001:2023', () => {
  const controls = iso42.items.filter((i) => i.kind === 'control');
  const clauses = iso42.items.filter((i) => i.kind === 'clause');
  it('38 controlos do Anexo A (A.2 a A.10) e cláusulas 4 a 10 com 6.1.4 e 8.4', () => {
    expect(controls.map((c) => c.id)).toEqual(ISO42001_ANNEX_A);
    expect(clauses.map((c) => c.ref)).toEqual(ISO42001_CLAUSES);
    expect(iso42.groups.filter((g) => g.kind === 'control').map((g) => g.code)).toEqual(['2', '3', '4', '5', '6', '7', '8', '9', '10']);
  });
  it('domínios iguais aos de frameworkConstants e referencial selecionável', () => {
    expect(iso42.groups.filter((g) => g.kind === 'control').map((g) => g.name)).toEqual(FRAMEWORK_DOMAINS.ISO42001);
    expect(SELECTABLE_FRAMEWORKS).toContain('ISO42001');
  });
  it('ligações à 27001 apontam para itens que existem; a avaliação de impacto não tem equivalente', () => {
    const ids = new Set(iso27.items.map((i) => i.id));
    for (const it of iso42.items) for (const r of it.iso27001) expect(ids.has(r)).toBe(true);
    for (const id of ['C.6.1.4', 'C.8.4', 'A.5.3', 'A.5.5']) expect(iso42.items.find((i) => i.id === id).iso27001).toEqual([]);
    expect(iso42.items.find((i) => i.id === 'A.4.3').title).toMatch(/dados/i); // A.4.3 = recursos de dados (não A.4.6)
    expect(iso42.items.find((i) => i.id === 'A.4.6').title).toMatch(/humanos/i);
  });
  it('Anexo C: 11 objetivos e 7 fontes de risco', () => {
    expect(iso42.objectives).toHaveLength(11);
    expect(iso42.risk_sources).toHaveLength(7);
  });
  it('referencial ISO42001 para a sincronização: 38 perguntas com a base na 27001 na orientação', () => {
    const fw = isoFramework(iso42, { code: 'ISO42001', version: '2023', standard: 'ISO/IEC 42001:2023' });
    expect(fw.code).toBe('ISO42001');
    expect(fw.questions).toHaveLength(38);
    expect(fw.questions[0].source_ref).toMatch(/^ISO\/IEC 42001:2023, Anexo A, 2\.2/);
    expect(fw.questions.find((q) => q.control_id === 'A.5.5').guidance).toMatch(/Próprio da IA/);
    expect(isoFramework(iso27).questions).toHaveLength(93);
  });
});

describe('análise de lacunas (gapSummary)', () => {
  it('mapeia estados e separa cláusulas de controlos', () => {
    expect(['done', 'in_progress', 'pending', 'not_applicable'].map(gapState)).toEqual(['conformant', 'partial', 'nonconformant', 'not_applicable']);
    const items = [{ id: 'C.4.1', kind: 'clause' }, { id: 'C.4.2', kind: 'clause' }, { id: 'A.1', kind: 'control' }, { id: 'A.2', kind: 'control' }, { id: 'A.3', kind: 'control' }, { id: 'A.4', kind: 'control' }];
    const st = { 'C.4.1': 'done', 'C.4.2': 'not_applicable', 'A.1': 'done', 'A.2': 'in_progress', 'A.3': 'pending', 'A.4': 'not_applicable' };
    const g = gapSummary(items, (it) => st[it.id]);
    expect(g.clauses).toMatchObject({ total: 2, conformant: 1, nonconformant: 1, not_applicable: 0 }); // cláusulas não se excluem
    expect(g.controls).toMatchObject({ total: 4, conformant: 1, partial: 1, nonconformant: 1, not_applicable: 1 });
    expect(g.controls.pct).toEqual({ conformant: 25, partial: 25, nonconformant: 25, not_applicable: 25 });
  });
});
