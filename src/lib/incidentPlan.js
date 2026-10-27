import { incidentDeadlines } from '@/lib/complianceUtils';

/**
 * Plano de resposta e de comunicações oficiais de um incidente, calculado a partir dos dados registados.
 * É «dinâmico»: cada vez que se regista um facto (verificação do incidente significativo, contenção, fim do impacto,
 * envio de uma notificação) as fases, os prazos e a próxima ação mudam.
 *
 * Bases legais: RJC (DL 125/2025), arts. 40.º a 44.º e 48.º; RTS (UE) 2025/301 (DORA); RGPD, arts. 33.º e 34.º.
 * Os prazos do RJC e do DORA vêm de incidentDeadlines (src/lib/complianceUtils.js).
 */

const addHours = (d, h) => (d ? new Date(new Date(d).getTime() + h * 3600 * 1000) : null);
export const GDPR_CNPD_HOURS = 72; // RGPD, art. 33.º, n.º 1 — após ter tido conhecimento da violação

// Conteúdo mínimo de cada comunicação (resumo dos textos oficiais, para lista de verificação).
export const COMMUNICATION_CONTENT = {
  rjc_initial: [
    'Representante para contacto (nome, telefone, email), se diferente do ponto de contacto permanente',
    'Data e hora do início ou, se não for possível, da deteção',
    'Breve descrição, com a categoria da causa e os efeitos, segundo a taxonomia do CNCS',
    'Estimativa do impacto: utilizadores afetados, duração, distribuição geográfica e impacto transfronteiriço',
  ],
  rjc_update: [
    'Revisão da informação da notificação inicial',
    'Avaliação inicial do incidente: gravidade e impacto',
    'Indicadores de exposição a riscos, se disponíveis',
  ],
  rjc_end_of_impact: [
    'Atualização da informação da notificação inicial',
    'Medidas adotadas para resolver o incidente',
    'Situação no fim do impacto: utilizadores afetados, duração, distribuição geográfica, tempo estimado para a recuperação total',
  ],
  rjc_final: [
    'Data e hora em que o incidente assumiu e perdeu o impacto significativo',
    'Impacto: utilizadores, duração, distribuição geográfica, descrição com categoria da causa e efeitos',
    'Medidas adotadas para mitigar o incidente',
    'Situação residual e tempo estimado para a recuperação dos serviços ainda afetados',
    'Notificações feitas a outras autoridades (Ministério Público, CNPD, autoridades setoriais)',
  ],
  rjc_interim: [
    'Atualização da informação da notificação inicial',
    'Medidas adotadas para resolver o incidente',
    'Situação atual do impacto e tempo estimado para a recuperação total',
  ],
  recipients: [
    'Que serviço foi afetado e como pode afetar o destinatário',
    'Medidas ou soluções que o destinatário pode adotar',
    'Linguagem simples e comunicação gratuita',
  ],
  cnpd: [
    'Natureza da violação, categorias e número aproximado de titulares e de registos afetados',
    'Contacto do encarregado da proteção de dados ou de outro ponto de contacto',
    'Consequências prováveis da violação',
    'Medidas adotadas ou propostas para reparar e atenuar os efeitos',
  ],
  data_subjects: [
    'Natureza da violação, em linguagem clara e simples',
    'Contacto do encarregado da proteção de dados ou de outro ponto de contacto',
    'Consequências prováveis e medidas adotadas',
  ],
  other_authorities: [
    'Ministério Público ou Polícia Judiciária, se houver crime',
    'GNS ou Entidade Fiscalizadora do Segredo de Estado, se houver informação classificada',
    'Autoridades setoriais, conforme a lei aplicável',
  ],
};

// Campos do incidente atualizados ao marcar uma comunicação como enviada.
export const SENT_FIELDS = {
  rjc_initial: ['early_warning_sent', 'early_warning_sent_at'],
  rjc_update: ['notification_sent', 'notification_sent_at'],
  rjc_end_of_impact: ['end_of_impact_notification_sent', 'end_of_impact_notification_sent_at'],
  rjc_final: ['final_report_sent', 'final_report_sent_at'],
  dora_initial: ['early_warning_sent', 'early_warning_sent_at'],
  dora_intermediate: ['notification_sent', 'notification_sent_at'],
  dora_final: ['final_report_sent', 'final_report_sent_at'],
  recipients: ['recipients_notified', 'recipients_notified_at'],
  cnpd: ['supervisor_authority_notified', 'supervisor_authority_notified_at'],
  data_subjects: ['individuals_notified', 'individuals_notified_at'],
};

// Rascunho com IA disponível (modelos da função aiDraft, que seguem as alíneas do RJC).
export const DRAFT_KIND = {
  rjc_initial: 'incident_initial', rjc_update: 'incident_update', rjc_end_of_impact: 'incident_end',
  rjc_final: 'incident_final', rjc_interim: 'incident_interim',
};

// Facto que falta registar para o prazo poder ser calculado.
const WAITING_FOR = {
  rjc_initial: 'significant_verified_at', rjc_update: 'significant_verified_at', rjc_end_of_impact: 'impact_ended_at',
  rjc_final: 'end_of_impact_notification_sent_at', dora_initial: 'dora_classified_major_at',
  dora_intermediate: 'early_warning_sent_at', dora_final: 'notification_sent_at',
};

const AUTHORITY = { rjc: 'CNCS', dora: 'Banco de Portugal / ASF / CMVM' };

/** Comunicações oficiais aplicáveis ao incidente, por ordem de prazo. */
export function incidentCommunications(inc) {
  if (!inc) return [];
  const regime = inc.reporting_regime || 'rjc';
  const out = incidentDeadlines(inc).map((p) => ({
    id: p.id, to: AUTHORITY[regime] || 'CNCS', labelKey: p.labelKey, due: p.due, sent: Boolean(p.sent),
    sentAt: inc[SENT_FIELDS[p.id]?.[1]] || null, ref: p.ref, mandatory: !p.optional,
    waitingFor: p.due ? null : WAITING_FOR[p.id] || null, draftKind: DRAFT_KIND[p.id] || null,
  }));
  if (regime === 'rjc' && inc.significant_verified_at && inc.status !== 'closed' && !inc.resolved_within_2h) {
    out.push({ id: 'rjc_interim', to: 'CNCS', labelKey: 'incplan_c_rjc_interim', due: null, sent: false, ref: 'RJC, art. 44.º, n.os 3 e 4', mandatory: false, onRequest: true, draftKind: 'incident_interim' });
  }
  if (regime !== 'nenhum' && inc.significant_verified_at) {
    out.push({ id: 'recipients', to: 'destinatários', labelKey: 'incplan_c_recipients', due: null, sent: Boolean(inc.recipients_notified), sentAt: inc.recipients_notified_at || null, ref: 'RJC, art. 48.º', mandatory: false, conditionKey: 'incplan_cond_recipients', withoutDelay: true });
  }
  if (inc.personal_data_affected || inc.data_breach) {
    out.push({ id: 'cnpd', to: 'CNPD', labelKey: 'incplan_c_cnpd', due: addHours(inc.detected_at, GDPR_CNPD_HOURS), sent: Boolean(inc.supervisor_authority_notified), sentAt: inc.supervisor_authority_notified_at || null, ref: 'RGPD, art. 33.º, n.º 1', mandatory: true, conditionKey: 'incplan_cond_cnpd', waitingFor: inc.detected_at ? null : 'detected_at' });
    out.push({ id: 'data_subjects', to: 'titulares', labelKey: 'incplan_c_data_subjects', due: null, sent: Boolean(inc.individuals_notified), sentAt: inc.individuals_notified_at || null, ref: 'RGPD, art. 34.º, n.º 1', mandatory: false, conditionKey: 'incplan_cond_data_subjects', withoutDelay: true });
  }
  const others = Array.isArray(inc.other_notifications) ? inc.other_notifications : [];
  out.push({ id: 'other_authorities', to: 'MP, PJ, GNS…', labelKey: 'incplan_c_other', due: null, sent: others.length > 0, sentAt: others[0]?.sent_at || null, ref: 'RJC, art. 40.º, n.º 5', mandatory: false, conditionKey: 'incplan_cond_other', records: others });
  return out.map((c) => ({ ...c, content: COMMUNICATION_CONTENT[c.id] || [] }));
}

/** Fases da resposta, com o estado calculado a partir dos factos registados. */
export function incidentPhases(inc, comms = incidentCommunications(inc)) {
  const regime = inc?.reporting_regime || 'rjc';
  const assessed = regime === 'nenhum' || Boolean(inc?.significant_verified_at) || Boolean(inc?.dora_classified_major_at) || Boolean(inc?.resolved_within_2h);
  const pendingMandatory = comms.filter((c) => c.mandatory && !c.sent);
  const phases = [
    { id: 'detect', done: Boolean(inc?.detected_at), ref: '' },
    { id: 'assess', done: assessed, ref: regime === 'dora' ? 'RTS (UE) 2024/1772' : 'RJC, art. 40.º, n.os 3 e 4' },
    { id: 'contain', done: Boolean(inc?.contained_at), ref: '' },
    { id: 'communicate', done: pendingMandatory.length === 0 && Boolean(inc?.detected_at), ref: regime === 'dora' ? 'RTS (UE) 2025/301' : 'RJC, arts. 41.º a 44.º' },
    { id: 'recover', done: Boolean(inc?.impact_ended_at || inc?.resolved_at), ref: '' },
    { id: 'close', done: inc?.status === 'closed' && Boolean(String(inc?.lessons_learned || '').trim()), ref: '' },
  ];
  const current = phases.find((p) => !p.done)?.id || null;
  return phases.map((p) => ({ ...p, current: p.id === current }));
}

/**
 * Próxima ação: a comunicação obrigatória por enviar com o prazo mais próximo; se nenhuma tiver prazo, o facto que
 * falta registar; senão, a primeira fase por concluir.
 */
export function nextIncidentAction(inc, now = Date.now()) {
  const comms = incidentCommunications(inc);
  const pending = comms.filter((c) => c.mandatory && !c.sent);
  const timed = pending.filter((c) => c.due).sort((a, b) => a.due - b.due);
  if (timed.length) {
    const c = timed[0];
    return { type: 'communication', id: c.id, labelKey: c.labelKey, due: c.due, overdue: c.due.getTime() < now, ref: c.ref };
  }
  const waiting = pending.find((c) => c.waitingFor);
  if (waiting) return { type: 'record', field: waiting.waitingFor, id: waiting.id, labelKey: waiting.labelKey, ref: waiting.ref };
  const phase = incidentPhases(inc, comms).find((p) => !p.done);
  return phase ? { type: 'phase', id: phase.id } : { type: 'done' };
}
