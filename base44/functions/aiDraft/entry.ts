import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { json, readJson, getAuthenticatedUser, isPlatformAdmin, userCustomerId, resolveCustomer, roleCanManage } from '../../shared/http.ts';
import { logAudit } from '../../shared/audit.ts';
import { requireModule, getEntitlements, consumeQuota, checkQuota, LicenseError } from '../../shared/license.ts';
import { assertAiRateLimit } from '../../shared/rateLimit.ts';
import { getFile } from '../../shared/storage.ts';
import { LEGAL_PACK } from '../../shared/legalPack.ts';
import { MEASURE_TEMPLATES, REPORT_TEMPLATES, BANNED_PHRASES } from '../../shared/aiTemplates.ts';
import { callLLM, getAiSettings, aiPurposeEnabled, AI_DISABLED_MESSAGE } from '../../shared/llm.ts';
import { containsExposedAsset } from '../../shared/exposedAssets.ts';

/**
 * Assistente de IA para evidências documentais e relatórios (módulo «ai_assistant»).
 * O modelo só recebe — e só pode citar — textos oficiais da Biblioteca Legal; o resultado é sempre um rascunho
 * para revisão humana e nunca conta como evidência.
 *
 *  - sources  { target }                    → fontes oficiais que seriam usadas (sem chamar a IA)
 *  - generate { target, kind, instructions? }
 *      target = { type: 'measure', key } | { type: 'incident', id } | { type: 'annual_report', year }
 *      kind   = policy | procedure | record | evidence_plan            (medidas)
 *             | incident_initial | incident_update | incident_end | incident_interim | incident_final | annual
 *  - review   { evidence_id }               → o ficheiro cumpre o critério de verificação da medida?
 *  - approve  { id, create_document? }      - discard { id }
 *  Admin da plataforma ou administrador do cliente; customer_id só é aceite de um admin.
 */

const LEVELS = LEGAL_PACK.levels;
const str = (v, n = 4000) => (v == null ? '' : String(v)).slice(0, n);
const STOP = new Set('para pela pelo pelos pelas como deve devem quando onde entre sobre cada todos todas estes estas esse essa seus suas mais ainda sendo seja sejam forma caso entidade entidades sistemas sistema informação segurança medidas medida'.split(' '));
const words = (s) => new Set(String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter((w) => w.length > 3 && !STOP.has(w)));

/** Requisitos do Reg. Exec. 2024/2690 mais próximos do texto (sugestão por semelhança, não correspondência oficial). */
function related2690(text, k = 3) {
  const q = words(text);
  const scored = LEGAL_PACK.r2690.map((r) => {
    const w = words(r.text);
    let hit = 0; for (const x of q) if (w.has(x)) hit += 1;
    return { r, score: hit / Math.sqrt(w.size + 1) };
  }).sort((a, b) => b.score - a.score);
  const top = scored[0]?.score || 0;
  return scored.filter((x) => x.score >= 0.4 && x.score >= top * 0.9).slice(0, k).map((x) => x.r);
}

function art(doc, n, prefix, label) {
  const a = LEGAL_PACK[doc][n];
  return a ? { id: `${prefix}:${n}`, label: `${label}, art. ${n} — ${a.title}`, text: a.text } : null;
}

/** Fontes oficiais para uma medida (QNRCS/Anexo III ou Anexo IV). */
function measureSources(key) {
  const out = [];
  const m = String(key || '').match(/^([A-Z]{2}\.[A-Z]{2}-\d+)@(basico|substancial|elevado)$/);
  let topic = '';
  if (m) {
    const c = LEGAL_PACK.controls[m[1]];
    if (!c) throw new Error('Controlo inexistente');
    out.push({ id: `QNRCS:${m[1]}`, label: `Reg. do CNCS n.º 756/2026, Anexo I (QNRCS) — ${m[1]}`, text: `${c.objective}; ${c.category}\n${c.statement}\n${c.description}` });
    for (const lv of LEVELS.slice(0, LEVELS.indexOf(m[2]) + 1)) {
      const mm = c.measures[lv];
      if (mm) out.push({ id: `R756-AIII:${m[1]}@${lv}`, label: `Reg. do CNCS n.º 756/2026, Anexo III — ${m[1]}, nível ${lv}`, text: `Medida: ${mm.measure}\nVerificação: ${mm.verification}` });
    }
    topic = `${c.statement} ${Object.values(c.measures).map((x) => x.measure).join(' ')}`;
    out.push(art('reg756', '30.º', 'R756', 'Reg. do CNCS n.º 756/2026'), art('rjc', '27.º', 'RJC', 'Decreto-Lei n.º 125/2025'));
  } else {
    const e = String(key || '').match(/^EPR-(A|B):([^#]+)(?:#(\d+))?$/);
    if (!e) throw new Error('Medida inválida');
    // Códigos repetidos no texto oficial (ex.: T.PPT#2) = n.ª ocorrência, como em src/lib/legal/index.js.
    const mm = LEGAL_PACK.epr[e[1]].filter((x) => x.code === e[2])[(Number(e[3]) || 1) - 1];
    if (!mm) throw new Error('Medida inexistente');
    out.push({ id: `R756-AIV:${e[1]}:${e[2]}`, label: `Reg. do CNCS n.º 756/2026, Anexo IV — Grupo ${e[1]}, ${e[2]}`, text: `${mm.area}\nMedida: ${mm.measure}\nVerificação: ${mm.verification}` });
    topic = `${mm.area} ${mm.measure}`;
    out.push(art('reg756', '30.º', 'R756', 'Reg. do CNCS n.º 756/2026'), art('rjc', '33.º', 'RJC', 'Decreto-Lei n.º 125/2025'));
  }
  for (const r of related2690(topic)) {
    const letters = LEGAL_PACK.r2690_letters[r.id.split('.')[0]] || [];
    out.push({ id: `R2690:${r.id}`, related: true, label: `Reg. de Execução (UE) 2024/2690, ponto ${r.id}${letters.length ? ` (NIS2, art. 21.º, n.º 2, alínea ${letters.join(', ')})` : ''} — relacionado por semelhança`, text: r.text });
  }
  return out.filter(Boolean);
}

/** Artigos citados num texto da jornada («RJC, art. 24.º», «arts. 54.º e 55.º», «Reg. 756/2026, art. 32.º»). */
function checklistSources(text) {
  const out = [];
  const seen = new Set();
  const add = (doc, n) => {
    const key = `${doc}:${n}`;
    if (seen.has(key)) return;
    seen.add(key);
    const s = doc === 'reg756' ? art('reg756', n, 'R756', 'Reg. do CNCS n.º 756/2026') : art('rjc', n, 'RJC', 'Decreto-Lei n.º 125/2025');
    if (s) out.push(s);
  };
  const re = /(Reg(?:ulamento)?[^,;)]*?756\/2026|RJC|DL\s*125\/2025|Decreto-Lei[^,;)]*?125\/2025)?[^a-z]{0,6}\barts?\.\s*((?:\d+\.º(?:[^.;)]*?(?:,|\be\b)\s*)?)+)/gi;
  for (const m of String(text || '').matchAll(re)) {
    const doc = m[1] && /756/.test(m[1]) ? 'reg756' : 'rjc';
    for (const n of m[2].match(/\d+\.º/g) || []) add(doc, n);
  }
  if (!out.length) add('rjc', '27.º');
  return out;
}

const reportSources = (tpl) => tpl.articles.map((n) => art('rjc', n, 'RJC', 'Decreto-Lei n.º 125/2025')).filter(Boolean);

function sectionSchema(ids) {
  return {
    type: 'object',
    properties: {
      title: { type: 'string' },
      sections: { type: 'array', items: { type: 'object', properties: { id: { type: 'string', enum: ids }, body: { type: 'string' }, citations: { type: 'array', items: { type: 'string' } } }, required: ['id', 'body', 'citations'] } },
      evidence_suggestions: { type: 'array', items: { type: 'string' } },
      gaps: { type: 'array', items: { type: 'string' } },
    },
    required: ['title', 'sections', 'gaps'],
  };
}

const RULES = `Regras obrigatórias:
1. Escreve em português europeu (Portugal), Acordo Ortográfico de 1990, registo profissional e direto. Nunca uses português do Brasil («usuário», «tela», «arquivo» para ficheiro, «salvar», «registrar», «contato», «você»).
2. Não uses frases de marketing nem chavões («desbloqueie», «potencie», «solução robusta», «abordagem holística», «no mundo atual», «é importante notar»), emojis nem pontos de exclamação.
3. Baseia-te APENAS nas FONTES fornecidas. Não inventes artigos, alíneas, prazos, números, normas, nomes de produtos nem factos sobre a entidade.
4. Em cada secção, indica em «citations» os ids das fontes que suportam o texto (ex.: "R756-AIII:ID.GA-1@basico"). Fontes marcadas como «relacionado por semelhança» só podem ser citadas como complemento.
5. Quando faltar informação da entidade, escreve «[A preencher: …]» com o que falta, em vez de supor. Lista essas lacunas em «gaps».
6. O resultado é um rascunho para revisão humana: não afirmes que a entidade cumpre nada.`;

function sourcesBlock(sources) {
  return sources.map((s) => `[${s.id}] ${s.label}${s.related ? ' (relacionado por semelhança)' : ''}\n${s.text}`).join('\n\n');
}

// Fornecedor e chamada ao modelo: base44/shared/llm.ts (registo AiSettings ou AI_PROVIDER, ANTHROPIC_API_KEY, ANTHROPIC_MODEL).

/** Normaliza a resposta: secções na ordem do modelo, citações só das fontes enviadas, avisos de validação. */
function validate(result, sectionsDef, sources, fixedBodies = {}, facts = '') {
  const ids = new Set(sources.map((s) => s.id));
  const knownText = `${sources.map((s) => `${s.label} ${s.text}`).join(' ')} ${facts}`.toLowerCase();
  const warnings = [];
  const byId = Object.fromEntries((result.sections || []).map((s) => [s.id, s]));
  const sections = sectionsDef.map(([id, a, b, fixed]) => {
    const heading = b !== undefined && typeof b === 'string' ? b : a;
    const ref = b !== undefined && typeof b === 'string' ? a : '';
    if (fixed || fixedBodies[id] !== undefined) return { id, heading, ref, body: fixedBodies[id] ?? '[A preencher]', citations: [], fixed: true };
    const s = byId[id];
    if (!s || !String(s.body || '').trim()) { warnings.push(`Secção «${heading}» sem texto: preencher manualmente.`); return { id, heading, ref, body: '[A preencher]', citations: [] }; }
    const cites = (s.citations || []).filter((c) => ids.has(c));
    const dropped = (s.citations || []).filter((c) => !ids.has(c));
    if (dropped.length) warnings.push(`Citações recusadas em «${heading}» (não fazem parte das fontes): ${dropped.join(', ')}`);
    const body = str(s.body, 8000);
    for (const m of body.matchAll(/\bart(?:igo|\.)\s*(\d+)\.?º/gi)) if (!knownText.includes(`${m[1]}.º`)) warnings.push(`«${heading}» refere o art. ${m[1]}.º, que não está nas fontes: confirmar.`);
    for (const m of body.matchAll(/\b(\d+)\s*(horas|dias(?: úteis)?)\b/gi)) if (!knownText.includes(`${m[1]} ${m[2].toLowerCase()}`) && !knownText.includes(`${m[1]} ${m[2].split(' ')[0].toLowerCase()}`)) warnings.push(`«${heading}» indica o prazo «${m[0]}», que não está nas fontes: confirmar.`);
    for (const p of BANNED_PHRASES) if (new RegExp(`(?<![\\p{L}\\d])${p}`, 'iu').test(body)) warnings.push(`«${heading}» contém a expressão «${p}»: rever o texto.`);
    return { id, heading, ref, body, citations: cites };
  });
  return {
    title: str(result.title, 200), sections, warnings: [...new Set(warnings)],
    evidence_suggestions: (result.evidence_suggestions || []).map((x) => str(x, 500)).slice(0, 20),
    gaps: (result.gaps || []).map((x) => str(x, 500)).slice(0, 30),
  };
}

const dt = (v) => (v ? String(v).replace('T', ' ').slice(0, 16) : '[A preencher]');
function incidentFacts(i) {
  // Só dados do incidente (nunca dados de contacto nem inventário de ativos).
  return [
    `Título: ${i.title || ''}`, `Categoria (interna): ${i.category || ''}`, `Gravidade (interna): ${i.severity || ''}`, `Estado: ${i.status || ''}`,
    `Deteção: ${dt(i.detected_at)}`, `Incidente significativo verificado em: ${dt(i.significant_verified_at)}`, `Contido em: ${dt(i.contained_at)}`,
    `Fim do impacto significativo: ${dt(i.impact_ended_at)}`, `Resolvido em: ${dt(i.resolved_at)}`, `Resolvido nas 2 horas após a deteção: ${i.resolved_within_2h ? 'sim' : 'não'}`,
    `Sistemas afetados: ${(i.affected_systems || []).join(', ')}`, `Pessoas afetadas (número): ${i.affected_individuals_count ?? '[desconhecido]'}`,
    `Dados pessoais afetados: ${i.personal_data_affected ? 'sim' : 'não'}`, `Descrição: ${str(i.description, 3000)}`,
    `Avaliação de impacto: ${str(i.impact_assessment, 3000)}`, `Causa raiz: ${str(i.root_cause, 2000)}`,
    `Medidas de remediação: ${str(i.remediation_actions, 3000)}`, `Lições aprendidas: ${str(i.lessons_learned, 2000)}`,
    `Autoridade de controlo (RGPD) notificada: ${i.supervisor_authority_notified ? `sim, ${dt(i.supervisor_authority_notified_at)}` : 'não'}`,
  ].join('\n');
}

function quarterStats(incidents) {
  const rows = {};
  for (const i of incidents) {
    if (!i.detected_at) continue;
    const q = `T${Math.floor(new Date(i.detected_at).getUTCMonth() / 3) + 1}`;
    rows[q] ||= {}; rows[q][i.category || 'other'] = (rows[q][i.category || 'other'] || 0) + 1;
  }
  return ['T1', 'T2', 'T3', 'T4'].map((q) => {
    const r = rows[q] || {};
    const total = Object.values(r).reduce((a, b) => a + b, 0);
    return `${q}: ${total} incidente(s)${total ? ` — ${Object.entries(r).map(([k, v]) => `${k}: ${v}`).join('; ')}` : ''}`;
  }).join('\n');
}

export { measureSources, validate, related2690, checklistSources };

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await getAuthenticatedUser(base44);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const admin = isPlatformAdmin(user);
    const body = await readJson(req);
    // Administração do cliente: própria (customer_admin), delegada (nível admin) ou da plataforma.
    const scope = resolveCustomer(user, body.customer_id, { write: true });
    if (!scope || !roleCanManage(scope.role)) return json({ error: 'Forbidden' }, 403);
    const customerId = String(scope.customerId || '');
    if (!customerId) return json({ error: 'Sem cliente associado' }, 403);
    const db = base44.asServiceRole.entities;
    const customer = await db.Customer.get(customerId).catch(() => null);
    if (!customer) return json({ error: 'Cliente inexistente' }, 404);
    await requireModule(base44, user, customerId, 'ai_assistant');
    const action = body.action;
    // Ponto de uso «documents» (Definições → Aplicação → Assistente de IA): desligado, recusa só as ações que chamam
    // o modelo (generate, review). Fontes, aprovar e descartar continuam disponíveis.
    if ((action === 'generate' || action === 'review') && !aiPurposeEnabled(await getAiSettings(base44), 'documents')) {
      return json({ error: AI_DISABLED_MESSAGE }, 403);
    }

    if (action === 'approve' || action === 'discard') {
      const d = await db.AiDraft.get(String(body.id || '')).catch(() => null);
      if (!d || d.customer_id !== customerId) return json({ error: 'Rascunho inexistente' }, 404);
      if (d.status !== 'draft') return json({ error: 'Este rascunho já foi aprovado ou descartado' }, 409);
      if (action === 'discard') return json({ draft: await db.AiDraft.update(d.id, { status: 'discarded' }) });
      const patch = { status: 'approved', approved_by: user.email, approved_at: new Date().toISOString() };
      if (body.create_document && ['policy', 'procedure'].includes(d.kind) && !d.security_document_id) {
        const doc = await db.SecurityDocument.create({
          customer_id: customerId, customer_name: customer.name, title: d.title, level: d.kind, status: 'draft', version: '0.1',
          description: `${d.sections.map((s) => `${s.heading}\n${s.body}`).join('\n\n')}`.slice(0, 20000),
          tags: ['rascunho-ia', d.target_ref].filter(Boolean), framework_codes: ['QNRC'], owner_email: user.email,
        });
        patch.security_document_id = doc.id;
      }
      const rec = await db.AiDraft.update(d.id, patch);
      await logAudit(base44, 'ai_draft_approved', { user_email: user.email, customer_id: customerId, entity_type: 'AiDraft', entity_id: d.id, details: `Rascunho «${d.title}» aprovado${patch.security_document_id ? ' e criado como documento em rascunho' : ''}` });
      return json({ draft: rec });
    }

    // Monta fontes, estrutura e factos.
    let sources = []; let sectionsDef = []; let facts = ''; let targetType = ''; let targetRef = ''; let kind = String(body.kind || '');
    let reviewEvidence = null; const fixedBodies = {};
    const t = body.target || {};

    if (action === 'review') {
      const ev = await db.Evidence.get(String(body.evidence_id || '')).catch(() => null);
      if (!ev || ev.customer_id !== customerId) return json({ error: 'Evidência inexistente' }, 404);
      if (ev.restricted) return json({ error: 'Evidências de ativos e ferramentas (informação reservada) não são enviadas à IA' }, 403);
      const measureLink = (ev.links || []).find((l) => l.type === 'measure');
      if (!measureLink) return json({ error: 'A análise por IA só está disponível para evidências ligadas a medidas mínimas' }, 400);
      if (!/^(application\/pdf|image\/|text\/)/.test(ev.mime_type || '')) return json({ error: 'Tipo de ficheiro não suportado na análise (PDF, imagem ou texto)' }, 400);
      sources = measureSources(measureLink.id);
      reviewEvidence = ev;
      targetType = 'evidence_review'; targetRef = ev.id; kind = 'review';
      sectionsDef = [['analise', 'Análise do ficheiro face ao critério de verificação'], ['falta', 'O que falta para cumprir o critério']];
      facts = `Evidência: «${ev.title}» (${ev.evidence_type}, recolhida em ${ev.collected_at}). Ficheiro anexo a esta mensagem.`;
    } else if (t.type === 'measure') {
      if (!MEASURE_TEMPLATES[kind]) return json({ error: 'Tipo de rascunho inválido' }, 400);
      sources = measureSources(t.key);
      sectionsDef = MEASURE_TEMPLATES[kind].sections;
      targetType = 'measure'; targetRef = String(t.key);
      facts = `Entidade: ${customer.name}; setor: ${customer.sector || '[A preencher]'}; dimensão: ${customer.entity_size || '[A preencher]'}; qualificação RJC: ${customer.rjc_qualification || '[A preencher]'}; nível de conformidade: ${customer.conformity_level || customer.epr_group || '[A preencher]'}.`;
    } else if (t.type === 'checklist') {
      if (!MEASURE_TEMPLATES[kind]) return json({ error: 'Tipo de rascunho inválido' }, 400);
      const item = await db.ComplianceChecklist.get(String(t.id || '')).catch(() => null);
      if (!item || item.customer_id !== customerId) return json({ error: 'Item inexistente' }, 404);
      const text = `${item.task_text || ''} ${item.requirement_ref || ''}`;
      sources = [{ id: `JORNADA:${item.id}`, label: `Jornada de conformidade — ${item.section || ''}`, text: item.task_text || '' }, ...checklistSources(text)];
      sectionsDef = MEASURE_TEMPLATES[kind].sections;
      targetType = 'checklist'; targetRef = item.id;
      facts = `Entidade: ${customer.name}; setor: ${customer.sector || '[A preencher]'}; qualificação RJC: ${customer.rjc_qualification || '[A preencher]'}; nível de conformidade: ${customer.conformity_level || customer.epr_group || '[A preencher]'}. Tarefa da jornada: ${item.task_text}. Notas registadas: ${str(item.notes, 1000) || '(nenhuma)'}.`;
    } else if (t.type === 'incident') {
      const tpl = REPORT_TEMPLATES[kind];
      if (!tpl || !kind.startsWith('incident_')) return json({ error: 'Tipo de relatório inválido' }, 400);
      const inc = await db.Incident.get(String(t.id || '')).catch(() => null);
      if (!inc || inc.customer_id !== customerId) return json({ error: 'Incidente inexistente' }, 404);
      sources = reportSources(tpl); sectionsDef = tpl.sections; targetType = 'incident'; targetRef = inc.id;
      facts = incidentFacts(inc);
      if (kind === 'incident_initial') {
        fixedBodies.a = [customer.cybersecurity_manager, customer.cybersecurity_manager_phone, customer.cybersecurity_manager_email].filter(Boolean).join(' · ') || '[A preencher: nome, telefone e email do representante]';
      }
    } else if (t.type === 'annual_report') {
      const year = Number(t.year) || new Date().getUTCFullYear() - 1;
      const tpl = REPORT_TEMPLATES.annual; kind = 'annual';
      const all = await db.Incident.filter({ customer_id: customerId }, '-detected_at', 2000);
      const inYear = all.filter((i) => String(i.detected_at || '').startsWith(String(year)));
      const significant = inYear.filter((i) => i.significant_verified_at);
      sources = reportSources(tpl); sectionsDef = tpl.sections; targetType = 'annual_report'; targetRef = String(year);
      fixedBodies.b = quarterStats(inYear);
      facts = `Entidade: ${customer.name}. Ano civil: ${year}. Incidentes registados no ano: ${inYear.length}. Com impacto significativo: ${significant.length}.\n\nIncidentes com impacto significativo:\n${significant.slice(0, 30).map((i) => `- ${i.title}; pessoas afetadas: ${i.affected_individuals_count ?? '[desconhecido]'}; início: ${dt(i.significant_verified_at)}; fim do impacto: ${dt(i.impact_ended_at)}; causa: ${str(i.root_cause, 400)}; medidas: ${str(i.remediation_actions, 400)}`).join('\n') || '(nenhum)'}\n\nOutros incidentes (títulos): ${inYear.filter((i) => !i.significant_verified_at).map((i) => i.title).slice(0, 50).join('; ') || '(nenhum)'}`;
    } else {
      return json({ error: 'Alvo inválido' }, 400);
    }

    if (action === 'sources') return json({ sources: sources.map(({ id, label, related }) => ({ id, label, related: Boolean(related) })), sections: sectionsDef.map(([id, a, b]) => ({ id, heading: typeof b === 'string' ? b : a, ref: typeof b === 'string' ? a : '' })) });
    if (action !== 'generate' && action !== 'review') return json({ error: 'Ação desconhecida' }, 400);

    // Rajada: a quota é mensal; o limite de ritmo é que impede esgotá-la em segundos.
    await assertAiRateLimit(base44, user);
    const ent = await getEntitlements(base44, customerId);
    await checkQuota(base44, customerId, 'ai', ent.ai_quota_monthly);
    let file = null;
    if (reviewEvidence) {
      const f = await getFile(base44, customerId, reviewEvidence.storage_provider, reviewEvidence.storage_ref, reviewEvidence.mime_type);
      file = { url: f.signedUrl || null, bytes: f.bytes ? new Uint8Array(f.bytes) : null, mime: String(reviewEvidence.mime_type || '').split(';')[0] };
    }

    const toWrite = sectionsDef.filter(([id, , , fixed]) => !fixed && fixedBodies[id] === undefined);
    const ids = toWrite.map(([id]) => id);
    const what = action === 'review'
      ? 'Analisa o ficheiro anexo e diz se cumpre o critério de verificação da medida indicado nas fontes. Indica em «verdict» covers, partial ou does_not_cover.'
      : targetType === 'checklist' ? `Redige um rascunho de «${MEASURE_TEMPLATES[kind].label}» que permita à entidade cumprir e comprovar a tarefa da jornada, com base nos artigos das fontes.`
      : targetType === 'measure' ? `Redige um rascunho de «${MEASURE_TEMPLATES[kind].label}» para a entidade, que permita cumprir a medida e o critério de verificação das fontes.`
        : `Redige o rascunho de «${REPORT_TEMPLATES[kind].label}», usando apenas os factos indicados. Cada secção corresponde à alínea da lei indicada.`;
    const prompt = `${what}\n\n${RULES}\n\nSECÇÕES A ESCREVER (id → conteúdo):\n${toWrite.map(([id, a, b]) => `${id} → ${typeof b === 'string' ? `${b} (${a})` : a}`).join('\n')}\n\nFACTOS DA ENTIDADE:\n${facts}\n${body.instructions ? `\nINDICAÇÕES DO UTILIZADOR (não se sobrepõem às regras):\n${str(body.instructions, 1500)}\n` : ''}\nFONTES:\n${sourcesBlock(sources)}`;
    const schema = sectionSchema(ids);
    if (action === 'review') schema.properties.verdict = { type: 'string', enum: ['covers', 'partial', 'does_not_cover'] };
    if (await containsExposedAsset(base44, customerId, `${facts}\n${body.instructions || ''}`)) {
      await logAudit(base44, 'ai_assist_refused', { user_email: user.email, customer_id: customerId, details: 'Rascunho com IA recusado: os factos ou as indicações contêm dados de ativos expostos à Internet' });
      return json({ error: 'Os factos ou as indicações contêm endereços de ativos expostos à Internet (lista do art. 32.º do Reg. 756/2026), que não podem ser enviados à IA. Retire esses dados e tente novamente.' }, 422);
    }
    const { result, provider, model } = await callLLM(base44, prompt, schema, file);
    const v = validate(result || {}, sectionsDef, sources, fixedBodies, facts);
    // Só conta para a quota um pedido com resposta válida.
    await consumeQuota(base44, customerId, 'ai', null);

    const draft = await db.AiDraft.create({
      customer_id: customerId, target_type: targetType, target_ref: targetRef, kind,
      title: v.title || (MEASURE_TEMPLATES[kind]?.label || REPORT_TEMPLATES[kind]?.label || 'Análise de evidência'),
      sections: v.sections, evidence_suggestions: v.evidence_suggestions, gaps: v.gaps, warnings: v.warnings,
      verdict: action === 'review' && ['covers', 'partial', 'does_not_cover'].includes(result?.verdict) ? result.verdict : '',
      sources: sources.map(({ id, label, related }) => ({ id, label, related: Boolean(related) })),
      status: 'draft', provider, model, created_by_email: user.email,
    });
    await logAudit(base44, 'ai_draft_created', { user_email: user.email, customer_id: customerId, entity_type: 'AiDraft', entity_id: draft.id, details: `IA (${provider}): ${kind} para ${targetType} ${targetRef}; ${sources.length} fonte(s) oficiais; ${v.warnings.length} aviso(s)` });
    return json({ draft });
  } catch (error) {
    return json({ error: error?.message || 'Erro' }, error instanceof LicenseError ? error.status : 400);
  }
}