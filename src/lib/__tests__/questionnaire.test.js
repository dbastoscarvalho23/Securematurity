import { describe, expect, it } from 'vitest';
import { buildQuestionSources, validateQuestions, sourcePromptLine, QUESTIONNAIRE_FRAMEWORKS } from '../../../base44/shared/questionnaire.ts';
import { QUESTIONNAIRE_FRAMEWORKS as UI_FRAMEWORKS } from '@/lib/ai';

const essential = { rjc_qualification: 'essencial', conformity_level: 'substancial' };

describe('fontes do questionário (Biblioteca Legal)', () => {
  it('lista igual no browser e no servidor', () => {
    expect(UI_FRAMEWORKS).toEqual(QUESTIONNAIRE_FRAMEWORKS);
  });
  it('QNRCS: medidas do nível do cliente, cumulativas, com o critério de verificação oficial', () => {
    const { sources } = buildQuestionSources(essential, ['QNRC']);
    expect(sources.length).toBeGreaterThan(40);
    expect(sources.every((s) => s.framework_code === 'QNRC' && s.official)).toBe(true);
    expect(sources.some((s) => s.id.endsWith('@elevado'))).toBe(false);
    expect(sources.some((s) => s.id.endsWith('@basico'))).toBe(true);
    expect(sources.find((s) => s.verification)).toBeTruthy();
  });
  it('entidade pública do Grupo A: Anexo IV (A e B)', () => {
    const { sources } = buildQuestionSources({ rjc_qualification: 'publica_relevante', epr_group: 'A' }, ['QNRC']);
    expect(sources.some((s) => s.control_id.startsWith('EPR-A:'))).toBe(true);
    expect(sources.some((s) => s.control_id.startsWith('EPR-B:'))).toBe(true);
  });
  it('NIS2, 2024/2690, DORA e guias ISO; referenciais sem textos ficam de fora', () => {
    const { sources, unsupported } = buildQuestionSources(essential, ['NIS2', 'EU_2024_2690', 'DORA', 'ISO27001', 'ISO42001', 'NIST_CSF']);
    const count = (f) => sources.filter((s) => s.framework_code === f).length;
    expect(count('NIS2')).toBe(10);
    expect(count('EU_2024_2690')).toBe(161);
    expect(count('DORA')).toBe(111);
    expect(count('ISO27001')).toBe(93);
    expect(count('ISO42001')).toBe(38);
    expect(sources.filter((s) => s.framework_code.startsWith('ISO')).every((s) => !s.official)).toBe(true);
    expect(unsupported).toEqual(['NIST_CSF']);
    expect(sourcePromptLine(sources.find((s) => s.framework_code === 'ISO42001'))).toMatch(/NÃO OFICIAL/);
  });
});

describe('validação das perguntas do modelo', () => {
  const { sources } = buildQuestionSources(essential, ['NIS2', 'ISO27001']);
  it('recusa fontes inventadas, repetidas e mais de duas por fonte; dados vêm da fonte', () => {
    const q = (source_id, question_text) => ({ source_id, question_text, guidance: 'Pedir o registo.' });
    const r = validateQuestions({ questions: [
      q('NIS2:21.2.b', 'Em que medida a entidade tem um processo de tratamento de incidentes?'),
      q('NIS2:21.2.b', 'Em que medida a entidade tem um processo de tratamento de incidentes?'), // repetida
      q('NIS2:21.2.b', 'A entidade testa o plano de resposta a incidentes pelo menos uma vez por ano?'),
      q('NIS2:21.2.b', 'A entidade regista as lições aprendidas depois de cada incidente relevante?'), // terceira na mesma fonte
      q('NIS2:99', 'Pergunta com uma fonte que não existe no repositório?'),
      q('ISO27001:A.5.15', 'Em que medida as regras de controlo de acessos estão definidas e aprovadas?'),
    ] }, sources, 10);
    expect(r.questions.map((x) => x.source_id)).toEqual(['NIS2:21.2.b', 'NIS2:21.2.b', 'ISO27001:A.5.15']);
    expect(r.questions[2]).toMatchObject({ framework_code: 'ISO27001', control_id: 'A.5.15', official: false });
    expect(r.questions[2].guidance).toMatch(/Critério de verificação \(guia AnkoraOne\)/);
    expect(r.questions[0].source_ref).toMatch(/^Diretiva \(UE\) 2022\/2555, art\. 21\.º, n\.º 2, alínea b\)/);
    expect(r.warnings.some((w) => w.includes('NIS2:99'))).toBe(true);
  });
});
