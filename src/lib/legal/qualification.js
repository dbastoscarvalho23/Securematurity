/**
 * Enquadramento regulamentar de uma entidade — Regime Jurídico da Cibersegurança (RJC, anexo ao DL 125/2025)
 * e Regulamento n.º 756/2026 (QNRCS).
 *
 * Funções puras: não fazem pedidos nem importam os textos legais. Os dados oficiais (src/data/legal/rjc.json) são
 * passados como argumento — setores, subsetores e tipos de entidade vêm dos Anexos I e II e os limiares de dimensão
 * do Anexo III (art. 2.º). Cada conclusão cita a disposição em que assenta; o que exige uma apreciação que os dados não
 * resolvem fica como ponto em aberto («a confirmar pelo CNCS / por um consultor») e o campo respetivo fica por determinar.
 *
 * Textos: as razões e os pontos em aberto trazem uma chave de tradução (qw_*) e parâmetros — ver
 * src/lib/translations-onboarding.js.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Natureza da entidade pública (RJC, art. 3.º, n.os 3 e 4; art. 7.º). */
export const PUBLIC_KINDS = [
  'adm_direta_estado',   // art. 3.º, n.º 3, a); art. 7.º, n.º 2, a) / n.º 3, a)
  'adm_direta_ra',       // art. 3.º, n.º 3, b); art. 7.º, n.º 2, b) / n.º 3, b)
  'adm_indireta_estado', // art. 3.º, n.º 3, c); art. 7.º, n.º 2, c) / n.º 3, c)
  'adm_indireta_ra',     // art. 3.º, n.º 3, d); art. 7.º, n.º 2, d) / n.º 3, d)
  'adm_autonoma',        // art. 3.º, n.º 3, e); art. 7.º, n.º 2, e) / n.º 3, e)
  'epe',                 // entidade pública empresarial — art. 7.º, n.º 2, f) / n.º 3, f)
  'eai',                 // entidade administrativa independente — art. 3.º, n.º 3, f); art. 7.º, n.º 2, g)
  'orgao_art3_4',        // Provedoria de Justiça, CES, serviços da PR, AR, tribunais… — art. 3.º, n.º 4; art. 7.º, n.º 2, h)
  'excluida_art3_3f',    // Banco de Portugal, CMVM, ASF — excluídos pelo art. 3.º, n.º 3, f)
];

/** Ordem de exigência em caso de concurso de qualificações (RJC, art. 9.º, n.º 1). */
const PRECEDENCE = ['essencial', 'importante', 'publica_relevante_A', 'publica_relevante_B', 'publica_relevante'];

// Tipos de entidade identificados pelo texto oficial dos anexos (as disposições citam-nos por extenso).
const RE_COMMS = /redes públicas de comunicações eletrónicas|serviços de comunicações eletrónicas acessíveis ao público/i; // art. 3.º, n.º 2, a), i); art. 6.º, n.º 1, c)
const RE_TRUST = /serviços de confiança/i;  // art. 3.º, n.º 2, a), ii); art. 6.º, n.º 1, b)
const RE_TLD = /\bTLD\b/;                    // art. 3.º, n.º 2, a), iii); art. 6.º, n.º 1, b)
const RE_DNS = /serviços de DNS/i;           // art. 3.º, n.º 2, a), iii); art. 6.º, n.º 1, b)
// Tipos sujeitos à regra do estabelecimento principal (art. 4.º, n.º 1, c)).
const RE_ART4C = /DNS|\bTLD\b|computação em nuvem|centro de dados|redes de distribuição de conteúdos|serviços geridos|serviços de segurança geridos|mercados em linha|motores de pesquisa|redes sociais/i;
// Setores com entidades financeiras (RJC, art. 3.º, n.º 9 — DORA).
const RE_FIN_SECTOR = /setor bancário|infraestruturas do mercado financeiro/i;

/** Características do tipo de entidade relevantes para as perguntas (arts. 3.º, n.º 2, a), 4.º e 6.º, n.º 1, b) e c)). */
export function entityTypeFlags(type = '') {
  return {
    comms: RE_COMMS.test(type),
    trust: RE_TRUST.test(type),
    tldDns: RE_TLD.test(type) || RE_DNS.test(type),
    mainEstablishment: RE_ART4C.test(type),
  };
}

const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/** Linhas dos Anexos I e II: [{ annex, setor, subsetor, tipo_entidade }]. */
export function annexRows(rjc) {
  const out = [];
  for (const a of rjc?.annexes || []) {
    if (!['I', 'II'].includes(a.id)) continue;
    for (const r of a.rows || []) out.push({ annex: a.id, setor: r.setor, subsetor: r.subsetor || null, tipo_entidade: r.tipo_entidade });
  }
  return out;
}

/** Limiares do Anexo III, art. 2.º (lidos dos dados oficiais). */
export function sizeThresholds(rjc) {
  const list = rjc?.annexes?.find((a) => a.id === 'III')?.size_thresholds || [];
  const pme = list.find((x) => x.balanco_max_eur != null);
  const small = list.find((x) => /pequena/i.test(x.categoria));
  const micro = list.find((x) => /micro/i.test(x.categoria));
  if (!pme || !small || !micro) throw new Error('Limiares do Anexo III do RJC em falta nos dados legais');
  return {
    pme: { employees: pme.trabalhadores_menos_de, turnover: pme.volume_negocios_max_eur, balance: pme.balanco_max_eur },
    small: { employees: small.trabalhadores_menos_de, financial: small.volume_negocios_ou_balanco_max_eur },
    micro: { employees: micro.trabalhadores_menos_de, financial: micro.volume_negocios_ou_balanco_max_eur },
  };
}

/**
 * Categoria da empresa segundo o RJC, anexo III, art. 2.º:
 * PME = menos de 250 pessoas E (volume de negócios ≤ 50 M€ OU balanço ≤ 43 M€); pequena = menos de 50 pessoas E
 * (volume de negócios OU balanço ≤ 10 M€); micro = menos de 10 pessoas E (volume de negócios OU balanço ≤ 2 M€).
 * Devolve 'grande' (excede os limiares das médias empresas), 'media', 'pequena', 'micro' ou null (dados insuficientes).
 */
export function rjcSizeCategory({ employees, turnover, balance }, th) {
  const n = num(employees); const T = num(turnover); const B = num(balance);
  if (n === null) return null;
  const finWithin = (limitT, limitB) => (T !== null && T <= limitT) || (B !== null && B <= limitB);
  const finBothAbove = (limitT, limitB) => T !== null && B !== null && T > limitT && B > limitB;
  if (n >= th.pme.employees || finBothAbove(th.pme.turnover, th.pme.balance)) return 'grande';
  if (!finWithin(th.pme.turnover, th.pme.balance)) return null; // < 250 pessoas, mas sem dados financeiros que o confirmem
  if (n < th.micro.employees && finWithin(th.micro.financial, th.micro.financial)) return 'micro';
  if (n < th.small.employees && finWithin(th.small.financial, th.small.financial)) return 'pequena';
  if (n >= th.small.employees || finBothAbove(th.small.financial, th.small.financial)) return 'media';
  return null;
}

/**
 * Classe de dimensão para a matriz de risco — Reg. 756/2026, Anexo II (tabela «Dimensão»):
 * Grande: mais de 250 pessoas OU volume de negócios > 50 M€ OU balanço > 43 M€;
 * Pequena: entidade pública com menos de 50 pessoas OU, nos restantes casos, menos de 50 pessoas E volume de negócios
 * ≤ 10 M€ E balanço ≤ 10 M€; Média: valores entre as duas. Devolve 'grande' | 'media' | 'pequena' | null.
 */
export function reg756SizeClass({ employees, turnover, balance }, th, isPublic = false) {
  const n = num(employees); const T = num(turnover); const B = num(balance);
  if (n === null) return null;
  if (n > th.pme.employees || (T !== null && T > th.pme.turnover) || (B !== null && B > th.pme.balance)) return 'grande';
  if (isPublic && n < th.small.employees) return 'pequena';
  if (T === null || B === null) return null; // não se pode excluir a classe Grande nem confirmar a Pequena
  if (n < th.small.employees && T <= th.small.financial && B <= th.small.financial) return 'pequena';
  return 'media';
}

const addDays = (iso, days) => {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() + days * DAY_MS).toISOString().slice(0, 10);
};
const isIso = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

/**
 * Enquadramento a partir das respostas do assistente.
 *
 * answers: {
 *   annex: 'I' | 'II' | 'none', sector, subsector, entity_type,      // atividade (Anexos I/II)
 *   other_activities: bool,                                            // outras atividades dos anexos
 *   establishment: 'pt' | 'ue_outro' | 'fora_ue', main_establishment_pt: bool|null, representative_pt: bool|null,
 *   provides_in_pt: bool|null,                                         // art. 4.º
 *   employees, turnover, balance, in_group: bool,                      // dimensão (Anexo III)
 *   qualified_trust: bool|null, cer_critical, sole_provider, public_safety, systemic_risk, national_critical,
 *   excluded_art37,                                                    // casos especiais (arts. 3.º e 6.º)
 *   is_public: bool, public_kind, ict_mission, high_digital, education_assessment, higher_education,
 *   already_active: bool, activity_start, platform_date, self_identified_date,   // art. 8.º
 *   cncs_qualification, cncs_epr_group, cncs_level, cncs_date,         // qualificação já notificada pelo CNCS
 * }
 * legal: { rjc } — conteúdo de src/data/legal/rjc.json; catalog opcional para a data de entrada em vigor.
 */
export function qualify(answers = {}, legal = {}) {
  const a = answers || {};
  const th = sizeThresholds(legal.rjc);
  const reasons = [];
  const open = [];
  const R = (field, value, key, basis, params) => reasons.push({ field, value, key, basis, ...(params ? { params } : {}) });
  const O = (key, basis, params) => open.push({ key, basis, ...(params ? { params } : {}) });

  const out = {
    rjc_qualification: 'por_determinar',
    rjc_annex: null, rjc_sector: null, rjc_subsector: null, rjc_entity_type: null,
    entity_size: null, conformity_level: null, epr_group: null,
    rjc_size: null, covered: null, deadline: null,
    reasons, open_points: open,
    determined: [],
  };

  // 1. Atividade — Anexos I e II
  let row = null;
  if (a.annex === 'I' || a.annex === 'II') {
    row = annexRows(legal.rjc).find((r) => r.annex === a.annex && r.setor === a.sector
      && (r.subsetor || null) === (a.subsector || null) && r.tipo_entidade === a.entity_type) || null;
    if (row) {
      out.rjc_annex = row.annex; out.rjc_sector = row.setor; out.rjc_subsector = row.subsetor; out.rjc_entity_type = row.tipo_entidade;
      R('rjc_entity_type', row.tipo_entidade, row.annex === 'I' ? 'qw_r_annex_I' : 'qw_r_annex_II', `RJC, anexo ${row.annex}`, { sector: row.setor });
    } else {
      O('qw_o_activity_unknown', 'RJC, anexos I e II');
    }
  } else if (a.annex === 'none') {
    R('rjc_annex', null, 'qw_r_annex_none', 'RJC, art. 3.º, n.os 1 e 2; anexos I e II');
  } else {
    O('qw_o_activity_missing', 'RJC, anexos I e II');
  }
  if (row && a.other_activities) O('qw_o_other_activities', 'RJC, art. 9.º, n.º 1; Reg. 756/2026, art. 30.º, n.º 4');
  if (row && RE_FIN_SECTOR.test(row.setor)) O('qw_o_dora', 'RJC, art. 3.º, n.º 9; Reg. 756/2026, art. 10.º, n.os 2 e 3');

  // 2. Dimensão — Anexo III (âmbito) e Reg. 756/2026, Anexo II (classe para a matriz de risco)
  const isPublic = a.is_public === true;
  const size = rjcSizeCategory(a, th);
  out.rjc_size = size;
  const sizeParams = { employees: num(a.employees) ?? '—', turnover: num(a.turnover) ?? '—', balance: num(a.balance) ?? '—' };
  if (size) R('rjc_size', size, `qw_r_size_${size}`, 'RJC, anexo III, art. 2.º', sizeParams);
  else if (!isPublic || a.public_kind === 'epe') O(num(a.employees) === null ? 'qw_o_employees_missing' : 'qw_o_size_financials', 'RJC, anexo III, art. 2.º');
  if (a.in_group) O('qw_o_group', 'RJC, art. 3.º, n.º 1, a), e anexo III (Recomendação 2003/361/CE)');
  const cls = reg756SizeClass(a, th, isPublic);
  if (cls) {
    out.entity_size = cls; out.determined.push('entity_size');
    R('entity_size', cls, `qw_r_class_${cls}`, 'Reg. 756/2026, Anexo II (tabela «Dimensão»)');
  }

  // 3. Tipo de entidade (texto oficial)
  const type = row?.tipo_entidade || '';
  const isComms = RE_COMMS.test(type);
  const isTrust = RE_TRUST.test(type);
  const isTldDns = RE_TLD.test(type) || RE_DNS.test(type);
  const isArt4c = RE_ART4C.test(type);
  const riskFlags = ['sole_provider', 'public_safety', 'systemic_risk', 'national_critical'].filter((k) => a[k] === true);

  // 4. Âmbito territorial (art. 4.º) — só para entidades dos anexos
  let territorial = null;
  if (row) {
    if (isComms) {
      territorial = a.provides_in_pt === true ? true : a.provides_in_pt === false ? false : null;
      if (territorial !== null) R('territorial', territorial, territorial ? 'qw_r_territorial_ok' : 'qw_r_territorial_out', 'RJC, art. 4.º, n.º 1, alínea b)');
    } else if (isArt4c) {
      if (a.establishment === 'fora_ue') territorial = a.representative_pt === true ? true : a.representative_pt === false ? false : null;
      else territorial = a.main_establishment_pt === true ? true : a.main_establishment_pt === false ? false : null;
      if (territorial !== null) R('territorial', territorial, territorial ? 'qw_r_territorial_ok' : 'qw_r_territorial_out', 'RJC, art. 4.º, n.º 1, alínea c), e n.º 2');
    } else {
      territorial = a.establishment === 'pt' ? true : (a.establishment === 'ue_outro' || a.establishment === 'fora_ue') ? false : null;
      if (territorial !== null) R('territorial', territorial, territorial ? 'qw_r_territorial_ok' : 'qw_r_territorial_out', 'RJC, art. 4.º, n.º 1, alínea a)');
    }
    if (territorial === null && !isPublic) O('qw_o_territorial', 'RJC, art. 4.º');
  }

  // 5. Qualificação por via dos anexos (arts. 3.º, n.os 1, 2 e 5, e 6.º)
  let annexQ = null; let annexBasis = null; let annexKey = null;
  if (a.cer_critical === true) {
    annexQ = 'essencial'; annexKey = 'qw_r_q_cer'; annexBasis = 'RJC, art. 3.º, n.º 5, e art. 6.º, n.º 1, alínea e)';
  } else if (row && territorial === false && !isPublic) {
    annexQ = 'nao_abrangida'; annexKey = 'qw_r_q_territorial'; annexBasis = 'RJC, art. 4.º, n.º 1';
  } else if (row && (territorial !== null || isPublic)) {
    if (isTldDns) { annexQ = 'essencial'; annexKey = 'qw_r_q_tld_dns'; annexBasis = 'RJC, art. 3.º, n.º 2, a), iii), e art. 6.º, n.º 1, alínea b)'; }
    else if (isTrust && a.qualified_trust === true) { annexQ = 'essencial'; annexKey = 'qw_r_q_trust_qualified'; annexBasis = 'RJC, art. 6.º, n.º 1, alínea b)'; }
    else if (size === 'grande' && row.annex === 'I') { annexQ = 'essencial'; annexKey = 'qw_r_q_large_I'; annexBasis = 'RJC, art. 6.º, n.º 1, alínea a)'; }
    else if (isComms && size === 'media') { annexQ = 'essencial'; annexKey = 'qw_r_q_comms_medium'; annexBasis = 'RJC, art. 6.º, n.º 1, alínea c)'; }
    else if (size === 'grande' || size === 'media') { annexQ = 'importante'; annexKey = 'qw_r_q_important'; annexBasis = 'RJC, art. 3.º, n.º 1, alínea a), e art. 6.º, n.º 2'; }
    else if ((isComms || isTrust) && (size === 'pequena' || size === 'micro')) {
      annexQ = 'importante'; annexKey = 'qw_r_q_any_size'; annexBasis = `RJC, art. 3.º, n.º 2, a), ${isComms ? 'i)' : 'ii)'}, e art. 6.º, n.º 2`;
    } else if (size === 'pequena' || size === 'micro') {
      if (riskFlags.length) O('qw_o_art32_risk', 'RJC, art. 3.º, n.º 2, b) a e); art. 6.º, n.º 1, f), e n.º 3; art. 8.º, n.º 3');
      else if (!isPublic) { annexQ = 'nao_abrangida'; annexKey = 'qw_r_q_small'; annexBasis = 'RJC, art. 3.º, n.º 1, alínea a)'; }
    }
    if (isTrust && a.qualified_trust == null && annexQ !== 'essencial') O('qw_o_trust_qualified', 'RJC, art. 6.º, n.º 1, alínea b); art. 2.º, alínea z)');
    if (annexQ === 'importante' && riskFlags.length) O('qw_o_art6_1f', 'RJC, art. 6.º, n.º 1, alínea f); art. 8.º, n.º 3');
  }

  // 6. Entidades públicas (arts. 3.º, n.os 3 e 4, 6.º, n.º 1, d), e 7.º)
  let eprGroup = null; let eprQ = null;
  if (isPublic) {
    const n = num(a.employees);
    const k = a.public_kind;
    if (k === 'excluida_art3_3f') {
      R('rjc_qualification', 'nao_abrangida', 'qw_r_public_excluded', 'RJC, art. 3.º, n.º 3, alínea f)');
    } else if (!PUBLIC_KINDS.includes(k)) {
      O('qw_o_public_kind', 'RJC, art. 3.º, n.os 3 e 4; art. 7.º');
    } else {
      eprQ = 'publica_relevante';
      const letter = { adm_direta_estado: 'a', adm_direta_ra: 'b', adm_indireta_estado: 'c', adm_indireta_ra: 'd', adm_autonoma: 'e', epe: 'f' }[k];
      if (k === 'eai') { eprGroup = 'A'; R('epr_group', 'A', 'qw_r_epr_eai', 'RJC, art. 7.º, n.º 2, alínea g)'); }
      else if (k === 'orgao_art3_4') { eprGroup = 'A'; R('epr_group', 'A', 'qw_r_epr_orgao', 'RJC, art. 3.º, n.º 4, e art. 7.º, n.º 2, alínea h)'); }
      else if (k === 'epe') {
        if (size === 'grande') { eprGroup = 'A'; R('epr_group', 'A', 'qw_r_epr_epe_A', 'RJC, art. 7.º, n.º 2, alínea f)'); }
        else if (size === 'media') { eprGroup = 'B'; R('epr_group', 'B', 'qw_r_epr_epe_B', 'RJC, art. 7.º, n.º 3, alínea f)'); }
        else if (size) O('qw_o_epr_below', 'RJC, art. 7.º, n.os 2 e 3');
      } else if (n === null) {
        O('qw_o_employees_missing', 'RJC, art. 7.º, n.os 2 e 3');
      } else {
        const direct = k === 'adm_direta_estado' || k === 'adm_direta_ra';
        // Direta: «250 ou mais» (n.º 2, a) e b)); indireta e autónoma: «mais de 250» (n.º 2, c) a e)); Grupo B: «entre 75 e 249» (n.º 3).
        if (direct ? n >= 250 : n > 250) { eprGroup = 'A'; R('epr_group', 'A', 'qw_r_epr_A', `RJC, art. 7.º, n.º 2, alínea ${letter})`, { employees: n }); }
        else if (n >= 75 && n <= 249) { eprGroup = 'B'; R('epr_group', 'B', 'qw_r_epr_B', `RJC, art. 7.º, n.º 3, alínea ${letter})`, { employees: n }); }
        else if (n === 250) O('qw_o_epr_250', `RJC, art. 7.º, n.º 2, alínea ${letter}), e n.º 3, alínea ${letter})`);
        else O('qw_o_epr_below', 'RJC, art. 7.º, n.os 2 e 3', { employees: n });
      }
      if (a.ict_mission || a.high_digital || a.education_assessment) O('qw_o_art6_1d', 'RJC, art. 6.º, n.º 1, alínea d); art. 8.º, n.º 3');
    }
  }

  // 7. Resultado — concurso de qualificações (art. 9.º, n.º 1)
  let q = null;
  const candidates = [];
  if (annexQ === 'essencial' || annexQ === 'importante') candidates.push(annexQ);
  if (eprQ) candidates.push(eprGroup ? `publica_relevante_${eprGroup}` : 'publica_relevante');
  candidates.sort((x, y) => PRECEDENCE.indexOf(x) - PRECEDENCE.indexOf(y));
  if (candidates.length) {
    const best = candidates[0];
    q = best.startsWith('publica_relevante') ? 'publica_relevante' : best;
    if (q === annexQ) R('rjc_qualification', q, annexKey, annexBasis);
    else R('rjc_qualification', q, a.public_kind === 'orgao_art3_4' ? 'qw_r_q_epr_art3_4' : 'qw_r_q_epr', a.public_kind === 'orgao_art3_4' ? 'RJC, art. 3.º, n.º 4, e art. 7.º, n.º 1' : 'RJC, art. 3.º, n.º 3, e art. 7.º, n.º 1');
    if (candidates.length > 1) R('rjc_qualification', q, 'qw_r_concurrence', 'RJC, art. 9.º, n.º 1');
    if (q === 'publica_relevante' && eprGroup) out.epr_group = eprGroup;
  } else if (annexQ === 'nao_abrangida') {
    q = 'nao_abrangida'; R('rjc_qualification', q, annexKey, annexBasis);
  } else if (isPublic && a.public_kind === 'excluida_art3_3f') {
    q = 'nao_abrangida';
  } else if (a.higher_education) {
    O('qw_o_higher_ed', 'RJC, art. 3.º, n.º 6');
  } else if (a.annex === 'none' && !isPublic) {
    q = 'nao_abrangida'; R('rjc_qualification', q, 'qw_r_q_not_listed', 'RJC, art. 3.º, n.os 1 e 2; anexos I e II');
  }
  if (a.excluded_art37) { O('qw_o_art37', 'RJC, art. 3.º, n.º 7'); q = null; out.epr_group = null; }

  // 8. Qualificação já notificada pelo CNCS — prevalece (RJC, art. 8.º, n.º 5; Reg. 756/2026, art. 9.º, n.os 4 e 5)
  const CNCS_Q = ['essencial', 'importante', 'publica_relevante', 'nao_abrangida'];
  if (CNCS_Q.includes(a.cncs_qualification)) {
    if (q && q !== a.cncs_qualification) O('qw_o_cncs_differs', 'RJC, art. 8.º, n.º 5', { computed: q });
    q = a.cncs_qualification;
    R('rjc_qualification', q, 'qw_r_cncs_notified', 'RJC, art. 8.º, n.º 5; Reg. 756/2026, art. 9.º, n.º 4', { date: a.cncs_date || '—' });
    if (q === 'publica_relevante' && (a.cncs_epr_group === 'A' || a.cncs_epr_group === 'B')) {
      out.epr_group = a.cncs_epr_group;
      R('epr_group', a.cncs_epr_group, 'qw_r_cncs_group', 'Reg. 756/2026, art. 9.º, n.º 5');
    }
    if (q !== 'publica_relevante') out.epr_group = null;
  }

  if (q) { out.rjc_qualification = q; out.determined.push('rjc_qualification'); }
  out.covered = q === 'nao_abrangida' ? false : q ? true : (riskFlags.length || a.higher_education || isPublic) ? true : null;
  if (out.epr_group) out.determined.push('epr_group');
  if (row) out.determined.push('rjc_annex', 'rjc_sector', 'rjc_subsector', 'rjc_entity_type');

  // 9. Nível de conformidade / medidas mínimas (Reg. 756/2026, arts. 28.º e 30.º; Anexos II, III e IV)
  if (q === 'essencial' || q === 'importante') {
    if (['basico', 'substancial', 'elevado'].includes(a.cncs_level)) {
      out.conformity_level = a.cncs_level; out.determined.push('conformity_level');
      R('conformity_level', a.cncs_level, 'qw_r_level_cncs', 'Reg. 756/2026, art. 9.º, n.º 5, e art. 30.º');
    } else {
      O('qw_o_level', 'Reg. 756/2026, art. 28.º, n.os 2 e 3, e Anexo II', {
        size_weight: cls ? { grande: '3/3', media: '2/3', pequena: '1/3' }[cls] : '—',
        sector_weight: row ? (row.annex === 'I' ? '1,5' : '1') : '—',
      });
    }
  } else if (q === 'publica_relevante' && out.epr_group) {
    R('epr_group', out.epr_group, out.epr_group === 'A' ? 'qw_r_measures_A' : 'qw_r_measures_B', out.epr_group === 'A' ? 'Reg. 756/2026, art. 30.º, n.º 3, e Anexo IV' : 'Reg. 756/2026, Anexo IV');
  }

  // 10. Autoidentificação na plataforma do CNCS (RJC, art. 8.º, n.º 1)
  if (q !== 'nao_abrangida' && out.covered !== null) {
    if (isIso(a.self_identified_date)) {
      R('cncs_self_identification_date', a.self_identified_date, 'qw_r_self_identified', 'RJC, art. 8.º, n.º 1; Reg. 756/2026, art. 8.º, n.º 6');
    } else if (a.already_active === false) {
      if (isIso(a.activity_start)) out.deadline = { date: addDays(a.activity_start, 30), days: 30, from: a.activity_start, key: 'qw_d_new', basis: 'RJC, art. 8.º, n.º 1' };
      else O('qw_o_activity_start', 'RJC, art. 8.º, n.º 1');
    } else if (isIso(a.platform_date)) {
      out.deadline = { date: addDays(a.platform_date, 60), days: 60, from: a.platform_date, key: 'qw_d_existing', basis: 'RJC, art. 8.º, n.º 1' };
    } else {
      O('qw_o_platform_date', 'RJC, art. 8.º, n.º 1; Reg. 756/2026, art. 5.º');
    }
    if (out.deadline) O('qw_o_deadline_count', 'RJC, art. 8.º, n.º 1');
  }

  out.determined = [...new Set(out.determined)];
  return out;
}

// ─── Jornada de conformidade ─────────────────────────────────────────────────────────────────────────────────────

/** Registos ComplianceChecklist para um modelo de jornada (mesma estrutura usada em ComplianceJourney). */
export function buildJourneyRecords(template, { customerId, customerName = '', framework }) {
  const records = [];
  for (const sec of template || []) {
    sec.tasks.forEach((task, idx) => {
      records.push({
        customer_id: customerId,
        customer_name: customerName,
        framework,
        section: sec.section,
        section_order: sec.section_order,
        task_text: task,
        task_order: idx + 1,
        status: 'pending',
      });
    });
  }
  return records;
}

/** Tarefas da secção A da jornada RJC_2026 usadas pelo enquadramento (ordem em journeyTemplate.js). */
export const JOURNEY_STEPS = { scope: [1, 1], selfId: [1, 3], notified: [1, 5] };
const findItem = (items, [s, t]) => (items || []).find((i) => i.section_order === s && i.task_order === t) || null;
export const findScopeItem = (items) => findItem(items, JOURNEY_STEPS.scope);

/**
 * Atualizações a aplicar à jornada a partir do resultado: [{ id, data }].
 * - A.1 (verificar se a entidade está abrangida) → concluída, com o resultado nas notas;
 * - A.3 (autoidentificação) → data-limite do art. 8.º, n.º 1, ou concluída se já houve autoidentificação;
 *   não aplicável se a entidade não estiver abrangida;
 * - A.5 (registar a qualificação notificada) → concluída quando o CNCS já notificou.
 */
export function journeyUpdates(items, result, { note = '', selfIdentifiedDate = null, cncsNotified = false } = {}) {
  const ups = [];
  const scope = findItem(items, JOURNEY_STEPS.scope);
  if (scope) ups.push({ id: scope.id, data: { status: 'done', notes: note } });
  const selfId = findItem(items, JOURNEY_STEPS.selfId);
  if (selfId) {
    if (result.rjc_qualification === 'nao_abrangida') ups.push({ id: selfId.id, data: { status: 'not_applicable' } });
    else if (selfIdentifiedDate) ups.push({ id: selfId.id, data: { status: 'done' } });
    else if (result.deadline?.date) ups.push({ id: selfId.id, data: { due_date: result.deadline.date, ...(selfId.status === 'done' ? {} : { status: selfId.status === 'not_applicable' ? 'pending' : selfId.status }) } });
  }
  const notified = findItem(items, JOURNEY_STEPS.notified);
  if (notified && cncsNotified) ups.push({ id: notified.id, data: { status: 'done' } });
  return ups;
}
