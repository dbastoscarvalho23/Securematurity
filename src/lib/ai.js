import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { invokeFn } from '@/lib/invokeFn';

/**
 * Pontos de uso do assistente de IA e valor por omissão (sem registo AiSettings ou sem lista guardada).
 * Manter igual a AI_PURPOSE_DEFAULTS em base44/shared/llm.ts, que é quem decide no servidor.
 * «documents» abrange tudo o que passa pela função aiDraft; «document_classification», a classificação de documentos
 * em «00 Por classificar» (função documentIntake).
 */
export const AI_PURPOSES = [
  { key: 'documents', default: true },
  { key: 'document_classification', default: true },
  { key: 'supplier_questionnaire_generation', default: true },
  { key: 'supplier_email_answer_extraction', default: true },
  { key: 'assessment_recommendations', default: true },
  { key: 'recommendation_generation', default: true },
  { key: 'assessment_question_selection', default: false },
  { key: 'question_gap_analysis', default: false },
  { key: 'question_bank_translation', default: false },
  { key: 'recommendation_translation', default: false },
  { key: 'supplier_questionnaire_translation', default: false },
];

export const AI_ENGINES = ['claude', 'claude_only', 'base44'];

export const defaultAiPurposes = () => AI_PURPOSES.filter((p) => p.default).map((p) => p.key);

/** Configuração do assistente (registo único AiSettings, ou null). */
export function useAiSettings() {
  return useQuery({
    queryKey: ['ai-settings'],
    queryFn: async () => {
      const list = await base44.entities.AiSettings.list('-updated_date', 1);
      return list?.[0] || null;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** O ponto de uso está ativo? Sem lista guardada, valem os valores por omissão. */
export function aiEnabled(settings, purpose) {
  if (Array.isArray(settings?.enabled_purposes)) return settings.enabled_purposes.includes(purpose);
  return AI_PURPOSES.some((p) => p.key === purpose && p.default);
}

/** Atalho para os componentes: false enquanto a configuração carrega (o botão só aparece quando se sabe que está ativo). */
export function useAiEnabled(purpose) {
  const { data, isSuccess } = useAiSettings();
  return isSuccess && aiEnabled(data, purpose);
}

/** Assistente de IA (função «aiDraft»): rascunhos com base apenas nos textos oficiais da Biblioteca Legal. */
const call = (payload) => invokeFn('aiDraft', payload);

export const aiSources = (customerId, target, kind) => call({ action: 'sources', customer_id: customerId, target, kind });
export const aiGenerate = (customerId, target, kind, instructions) => call({ action: 'generate', customer_id: customerId, target, kind, instructions });
export const aiReview = (customerId, evidenceId) => call({ action: 'review', customer_id: customerId, evidence_id: evidenceId });
export const aiApprove = (customerId, id, createDocument) => call({ action: 'approve', customer_id: customerId, id, create_document: createDocument });
export const aiDiscard = (customerId, id) => call({ action: 'discard', customer_id: customerId, id });

/**
 * Pedido de IA da interface (função «aiAssist»): o browser nunca chama o modelo diretamente. O servidor confirma a
 * sessão, a licença e a quota, recusa pedidos com ativos expostos à Internet (art. 32.º) e regista a auditoria.
 * Devolve o objeto JSON que respeita `schema` (a mesma forma que a integração do Base44 devolvia no browser). Erros chegam como Error com a
 * mensagem do servidor.
 */
export async function aiAssist(purpose, { prompt, schema, customerId, fileUrls } = {}) {
  const data = await invokeFn('aiAssist', {
    purpose,
    prompt,
    schema,
    ...(customerId ? { customer_id: customerId } : {}),
    ...(fileUrls?.length ? { file_urls: fileUrls } : {}),
  });
  return data?.result ?? null;
}

export const MEASURE_KINDS =['policy', 'procedure', 'record', 'evidence_plan'];
export const INCIDENT_KINDS = ['incident_initial', 'incident_update', 'incident_end', 'incident_interim', 'incident_final'];

export function draftToMarkdown(d) {
  const lines = [`# ${d.title}`, '', '> Rascunho gerado com apoio de IA a partir dos textos oficiais indicados. Requer revisão e aprovação; não constitui evidência.', ''];
  for (const s of d.sections || []) {
    lines.push(`## ${s.heading}`);
    if (s.ref) lines.push(`*${s.ref}*`);
    lines.push('', s.body || '', '');
    if (s.citations?.length) lines.push(`Fontes: ${s.citations.join(', ')}`, '');
  }
  if (d.gaps?.length) lines.push('## A completar', ...d.gaps.map((g) => `- ${g}`), '');
  if (d.evidence_suggestions?.length) lines.push('## Evidências sugeridas', ...d.evidence_suggestions.map((g) => `- ${g}`), '');
  lines.push('## Fontes oficiais', ...(d.sources || []).map((s) => `- [${s.id}] ${s.label}`));
  return lines.join('\n');
}

export async function draftToPdf(d) {
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = 20;
  const page = () => { if (y > 275) { doc.addPage(); y = 20; } };
  const para = (text, size = 10, style = 'normal') => {
    doc.setFont(undefined, style); doc.setFontSize(size);
    for (const l of doc.splitTextToSize(String(text || ''), 170)) { page(); doc.text(l, 20, y); y += size * 0.45; }
    y += 2;
  };
  para(d.title, 16, 'bold');
  doc.setTextColor(120); para('Rascunho gerado com apoio de IA a partir dos textos oficiais indicados. Requer revisão e aprovação; não constitui evidência.', 8); doc.setTextColor(0);
  for (const s of d.sections || []) {
    para(s.heading, 12, 'bold');
    if (s.ref) { doc.setTextColor(110); para(s.ref, 8, 'italic'); doc.setTextColor(0); }
    para(s.body, 10);
  }
  if (d.gaps?.length) { para('A completar', 12, 'bold'); d.gaps.forEach((g) => para(`• ${g}`, 9)); }
  para('Fontes oficiais', 12, 'bold');
  (d.sources || []).forEach((s) => para(`[${s.id}] ${s.label}`, 8));
  doc.save(`${(d.title || 'rascunho').replace(/[^\w\- ]+/g, '').slice(0, 60)}.pdf`);
}
