import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { loadLegal, cumulativeLevels } from '@/lib/legal';
import { useLegalData } from '@/components/legal/shared';
import EvidencePanel from '@/components/evidence/EvidencePanel';

/**
 * Evidências estruturadas de uma pergunta da avaliação.
 * Perguntas do QNRCS ligam às medidas mínimas do nível do cliente (as mesmas da Biblioteca Legal → Conformidade),
 * para que a evidência carregada aqui conte também na conformidade e possa ser preparada e analisada com IA.
 * As restantes perguntas ligam à própria pergunta.
 */
export default function QuestionEvidence({ question, customerId }) {
  const { data: customer } = useQuery({
    queryKey: ['evidence-customer', customerId],
    queryFn: () => base44.entities.Customer.get(customerId),
    enabled: Boolean(customerId),
    staleTime: 5 * 60 * 1000,
  });
  const isQnrcs = question.framework_code === 'QNRC' && question.control_id;
  const { data: qnrcs } = useLegalData(loadLegal, 'qnrcs');
  const links = useMemo(() => {
    if (!isQnrcs) return [{ type: 'question', id: question.id, ref: question.control_id || '', label: (question.question_text_pt || question.question_text || '').slice(0, 120) }];
    const level = customer?.conformity_level;
    if (!qnrcs || !level) return null;
    let control = null;
    for (const o of qnrcs.objectives) for (const c of o.categories) for (const k of c.controls) if (k.id === question.control_id) control = k;
    if (!control) return null;
    // Do nível mais alto aplicável para o mais baixo: a primeira ligação define a lista mostrada.
    const keys = cumulativeLevels(level).filter((lv) => control.measures?.[lv]).reverse();
    return keys.map((lv) => ({ type: 'measure', id: `${control.id}@${lv}`, ref: control.id, label: `${control.id} · ${lv}` }));
  }, [isQnrcs, question, customer?.conformity_level, qnrcs]);
  if (!customerId || !links?.length) return null;
  return <EvidencePanel customerId={customerId} links={links} className="mt-3" />;
}
