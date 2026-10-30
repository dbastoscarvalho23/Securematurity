/**
 * Análise de lacunas dos guias ISO (27001 e 42001), na prática habitual dos relatórios de gap analysis: o sistema de
 * gestão (cláusulas 4 a 10) e os controlos do Anexo A são contados em separado, cada requisito numa de quatro
 * situações. O estado do acompanhamento traduz-se assim:
 *   concluído → conforme · em curso → parcialmente conforme · pendente → não conforme · não aplicável → não aplicável
 * (só controlos; as cláusulas não podem ser excluídas).
 */
export const GAP_STATES = ['conformant', 'partial', 'nonconformant', 'not_applicable'];

export function gapState(status) {
  if (status === 'done') return 'conformant';
  if (status === 'in_progress') return 'partial';
  if (status === 'not_applicable') return 'not_applicable';
  return 'nonconformant';
}

const empty = () => ({ total: 0, conformant: 0, partial: 0, nonconformant: 0, not_applicable: 0, pct: {} });

/** `statusOf(item)` devolve o estado efetivo do item (pending, in_progress, done ou not_applicable). */
export function gapSummary(items, statusOf) {
  const out = { clauses: empty(), controls: empty() };
  for (const it of items || []) {
    const s = it.kind === 'clause' ? out.clauses : out.controls;
    const g = gapState(it.kind === 'clause' && statusOf(it) === 'not_applicable' ? 'pending' : statusOf(it));
    s.total += 1;
    s[g] += 1;
  }
  for (const s of [out.clauses, out.controls]) {
    for (const k of GAP_STATES) s.pct[k] = s.total ? Math.round((s[k] / s.total) * 100) : 0;
  }
  return out;
}
