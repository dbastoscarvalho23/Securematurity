import { invokeFn } from '@/lib/invokeFn';

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
