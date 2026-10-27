import { LEGAL_PACK } from './legalPack.ts';
import { CLASSIFY_CATALOG } from './classifyCatalog.ts';
import { measureCandidates } from './classify.ts';

/**
 * Questionário de avaliação elaborado pela IA a partir da Biblioteca Legal — lógica pura (sem SDK nem Deno), usada pela
 * função aiQuestionnaire e testada no Vitest.
 *
 *  1. buildQuestionSources: as fontes que o modelo pode usar, só do repositório: medidas do QNRCS aplicáveis ao nível do
 *     cliente (Reg. 756/2026, Anexo III) ou do Anexo IV, NIS2 art. 21.º, n.º 2, Reg. de Execução (UE) 2024/2690, DORA
 *     (textos oficiais) e os guias ISO/IEC 27001 e 42001 (textos próprios da AnkoraOne, assinalados como não oficiais).
 *  2. validateQuestions: só ficam perguntas que citam uma fonte enviada; referencial, controlo, domínio e referência
 *     vêm da fonte (nunca do modelo); o critério de verificação oficial é acrescentado à orientação.
 */

export const QUESTIONNAIRE_FRAMEWORKS = ['QNRC', 'NIS2', 'EU_2024_2690', 'DORA', 'ISO27001', 'ISO42001'];
export const MAX_QUESTIONS = 60;
const SOURCE_TEXT = 320; // caracteres de cada fonte enviados ao modelo

export type QSource = {
  id: string; framework_code: string; control_id: string; domain: string; label: string;
  text: string; verification: string; official: boolean;
};

const cut = (s: unknown, n: number) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};
const str = (v: unknown, n: number) => (v == null ? '' : String(v)).trim().slice(0, n);

const ISO27_THEMES: Record<string, string> = { '5': 'Controlos organizacionais', '6': 'Controlos de pessoas', '7': 'Controlos físicos', '8': 'Controlos tecnológicos' };
const ISO42_DOMAINS: Record<string, string> = {
  '2': 'Políticas relativas à IA', '3': 'Organização interna', '4': 'Recursos dos sistemas de IA', '5': 'Avaliação de impactos dos sistemas de IA',
  '6': 'Ciclo de vida dos sistemas de IA', '7': 'Dados para sistemas de IA', '8': 'Informação para partes interessadas',
  '9': 'Utilização de sistemas de IA', '10': 'Relações com terceiros e clientes',
};
const DORA_PILLARS: Record<string, string> = {
  governacao: 'Governação', gestao_risco_tic: 'Gestão do risco TIC', incidentes: 'Incidentes',
  testes: 'Testes de resiliência operacional digital', terceiros_tic: 'Risco de terceiros TIC', partilha_informacao: 'Partilha de informação',
};
const LEVEL_PT: Record<string, string> = { basico: 'Básico', substancial: 'Substancial', elevado: 'Elevado' };

/** Fontes por referencial. Referenciais fora de QUESTIONNAIRE_FRAMEWORKS são ignorados (devolvidos em `unsupported`). */
export function buildQuestionSources(customer: any, frameworks: string[]): { sources: QSource[]; unsupported: string[] } {
  const wanted = [...new Set((frameworks || []).map(String))];
  const unsupported = wanted.filter((f) => !QUESTIONNAIRE_FRAMEWORKS.includes(f));
  const out: QSource[] = [];
  const pack: any = LEGAL_PACK;

  if (wanted.includes('QNRC')) {
    for (const c of measureCandidates(customer)) {
      const ctl = c.group ? null : pack.controls[c.code];
      out.push({
        id: `QNRC:${c.key}`, framework_code: 'QNRC', control_id: c.group ? String(c.key) : c.code,
        domain: ctl ? ctl.category : `Anexo IV — Grupo ${c.group}`,
        label: c.group ? `Reg. do CNCS n.º 756/2026, Anexo IV — Grupo ${c.group}, ${c.code}` : `Reg. do CNCS n.º 756/2026, Anexo III — ${c.code}, nível ${LEVEL_PT[c.level || ''] || c.level}`,
        text: `${c.title} Medida: ${c.text}`, verification: c.check || '', official: true,
      });
    }
  }
  if (wanted.includes('NIS2')) {
    for (const m of pack.nis2_art21 || []) {
      out.push({
        id: `NIS2:21.2.${m.letter}`, framework_code: 'NIS2', control_id: `NIS2-21.2.${m.letter}`, domain: `Art. 21.º, n.º 2, alínea ${m.letter})`,
        label: `Diretiva (UE) 2022/2555, art. 21.º, n.º 2, alínea ${m.letter})`, text: m.text, verification: '', official: true,
      });
    }
  }
  if (wanted.includes('EU_2024_2690')) {
    for (const r of pack.r2690 || []) {
      out.push({
        id: `R2690:${r.id}`, framework_code: 'EU_2024_2690', control_id: r.id, domain: r.section,
        label: `Reg. de Execução (UE) 2024/2690, Anexo, ponto ${r.id}`, text: r.text, verification: '', official: true,
      });
    }
  }
  if (wanted.includes('DORA')) {
    for (const o of pack.dora || []) {
      out.push({
        id: `DORA:${o.id}`, framework_code: 'DORA', control_id: o.id, domain: DORA_PILLARS[o.pillar] || o.pillar,
        label: `${o.ref} — ${o.title}`, text: o.text, verification: '', official: true,
      });
    }
  }
  for (const [code, key, domains, name] of [['ISO27001', 'iso27001', ISO27_THEMES, 'ISO/IEC 27001:2022'], ['ISO42001', 'iso42001', ISO42_DOMAINS, 'ISO/IEC 42001:2023']] as const) {
    if (!wanted.includes(code)) continue;
    for (const i of (CLASSIFY_CATALOG as any)[key] || []) {
      if (i.kind !== 'control') continue;
      const group = String(i.ref || '').split('.')[0];
      out.push({
        id: `${code}:${i.id}`, framework_code: code, control_id: i.id, domain: domains[group] || '',
        label: `Guia AnkoraOne ${name}, Anexo A, ${i.ref} (texto próprio, não oficial)`,
        text: `${i.title}. ${i.description}`, verification: i.evidence || '', official: false,
      });
    }
  }
  return { sources: out, unsupported };
}

/** Linha de uma fonte no pedido ao modelo. */
export function sourcePromptLine(s: QSource): string {
  return `[${s.id}] ${s.label}${s.official ? '' : ' — NÃO OFICIAL'}\n${cut(s.text, SOURCE_TEXT)}${s.verification ? `\nVerificação: ${cut(s.verification, 220)}` : ''}`;
}

/**
 * Normaliza as perguntas do modelo. Recusa as que não citam uma fonte enviada, as repetidas (mesmo texto) e mais de
 * duas por fonte; corta ao número pedido. Devolve { questions, warnings }.
 */
export function validateQuestions(result: any, sources: QSource[], count: number) {
  const byId = new Map(sources.map((s) => [s.id, s]));
  const perSource: Record<string, number> = {};
  const seenText = new Set<string>();
  const warnings: string[] = [];
  const questions = [];
  for (const q of Array.isArray(result?.questions) ? result.questions : []) {
    const sid = str(q?.source_id, 160);
    const src = byId.get(sid);
    if (!src) { if (sid) warnings.push(`Pergunta recusada: a fonte «${sid}» não foi enviada`); continue; }
    const text = str(q?.question_text, 400).replace(/\s+/g, ' ');
    if (text.length < 15) continue;
    const key = text.toLowerCase();
    if (seenText.has(key)) continue;
    if ((perSource[sid] || 0) >= 2) continue;
    seenText.add(key);
    perSource[sid] = (perSource[sid] || 0) + 1;
    const guidance = str(q?.guidance, 1200);
    questions.push({
      source_id: sid, framework_code: src.framework_code, control_id: src.control_id, domain: src.domain,
      question_text: text,
      guidance: [guidance, src.verification && `Critério de verificação (${src.official ? 'texto oficial' : 'guia AnkoraOne'}): ${src.verification}`].filter(Boolean).join('\n\n'),
      source_ref: `${src.label} — pergunta elaborada com IA a partir desta fonte`,
      official: src.official,
    });
    if (questions.length >= count) break;
  }
  const n = Math.max(1, Math.min(MAX_QUESTIONS, Number(count) || 20));
  if (questions.length < n) warnings.push(`O modelo devolveu ${questions.length} pergunta(s) válidas de ${n} pedidas.`);
  return { questions: questions.slice(0, n), warnings: [...new Set(warnings)].slice(0, 20) };
}
