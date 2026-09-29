/**
 * Reposição e criação das áreas de dados do seed de validação.
 *
 * O ponto de entrada (`seedTestEnvironment`) monta a topologia (parceiros,
 * clientes, perguntas, avaliações e delegações); este módulo trata do que é
 * **reposto a cada execução** — as subscrições declaradas, as áreas
 * operacionais de cada cliente e os dados de plataforma — de forma determinística:
 * tudo o que foi semeado antes é removido por marcador (ou por pertencer a um
 * cliente semeado) e recriado a partir de `testSeedData.ts`.
 *
 * Duas regras vieram do emulador local e valem para todo o ficheiro:
 *   • os nomes das chaves têm de ser exactamente os da entidade (chaves
 *     desconhecidas são descartadas em silêncio);
 *   • `null` só em campos com tipo união.
 * Uma criação recusada nunca derruba o seed: fica registada em `skipped` com o
 * motivo, para que o resumo diga o que o emulador recusou criar.
 */

import { MARKER, AREA_SIZES, AUDIT_ENTRIES, ACTION_TEMPLATES, ANNOUNCEMENTS, ATTESTATION_TEMPLATES, CHECKLIST_TEMPLATES, DOCUMENT_TEMPLATES, INCIDENT_TEMPLATES, RISK_TEMPLATES, SUPPLIER_TEMPLATES, TASK_STATUS_CYCLE, TRAINING_TEMPLATES, TRAINING_USER_TEMPLATES, VULNERABILITY_TEMPLATES, dayOffset, instantOffset, monthOffset, rotate, seedHash } from "./testSeedData.ts";
import { catalogueSignature, composeAddons, composeTiers, monthlyCentsFor } from "./commercialOffer.ts";

/** Contexto partilhado por todas as áreas. */
export interface SeedContext {
  referenceDate: string;
  actorEmail: string;
  actorRole: string;
  questions: any[];
  /** Oferta e preço em vigor semeados (ver `seedCommercialOffer`). */
  offer: { offerVersionId?: string; offerCode?: string; priceTableId?: string } | null;
}

/**
 * Entidades repostas antes de semear.
 *
 * `fields` são os campos onde o marcador do seed aparece; `byCustomer` alarga a
 * remoção a tudo o que pertença a um cliente semeado — é o que garante que o
 * trabalho que o harness ou a aplicação criaram sobre estes clientes (tarefas,
 * pacotes, histórico) não sobrevive de uma execução para a outra. Nada fora
 * destes dois critérios é tocado.
 */
const WIPE: Array<{ entity: string; fields: string[]; byCustomer?: boolean }> = [
  { entity: "Assessment", fields: ["title"], byCustomer: true },
  { entity: "AssessmentResponse", fields: ["evidence_notes"], byCustomer: true },
  { entity: "UserCustomerAssignment", fields: ["reason"], byCustomer: true },
  { entity: "TenantSubscription", fields: ["notes"], byCustomer: true },
  { entity: "TenantModule", fields: [], byCustomer: true },
  { entity: "TenantStandard", fields: [], byCustomer: true },
  { entity: "TenantEntitlementOverride", fields: [], byCustomer: true },
  { entity: "RiskItem", fields: ["title", "description"], byCustomer: true },
  { entity: "MitigationTask", fields: ["title", "description"], byCustomer: true },
  { entity: "RiskHistory", fields: ["note"], byCustomer: true },
  { entity: "SecurityDocument", fields: ["title", "description"], byCustomer: true },
  { entity: "DocumentVersion", fields: ["title", "change_note"], byCustomer: true },
  { entity: "Incident", fields: ["title", "description"], byCustomer: true },
  { entity: "Supplier", fields: ["name", "notes"], byCustomer: true },
  { entity: "TrainingUser", fields: ["notes"], byCustomer: true },
  { entity: "Training", fields: ["title", "description"], byCustomer: true },
  { entity: "TrainingEnrollment", fields: ["notes"], byCustomer: true },
  { entity: "ComplianceChecklist", fields: ["task_text", "notes"], byCustomer: true },
  { entity: "PolicyAttestation", fields: ["policy_title", "notes"], byCustomer: true },
  { entity: "Vulnerability", fields: ["title", "description"], byCustomer: true },
  { entity: "Recommendation", fields: ["title", "description"], byCustomer: true },
  { entity: "Task", fields: ["title", "description"], byCustomer: true },
  { entity: "AuditPackage", fields: ["title", "notes"], byCustomer: true },
  { entity: "QuotaSignal", fields: ["note"], byCustomer: true },
  { entity: "LicenseUsageRecord", fields: [], byCustomer: true },
  { entity: "LicenseChangeLog", fields: ["reason"], byCustomer: true },
  { entity: "AuditLog", fields: ["details"], byCustomer: true },
  { entity: "PlatformAnnouncement", fields: ["title", "message"] },
  { entity: "CommercialChangeLog", fields: ["reason"] },
  { entity: "OfferVersion", fields: ["label", "notes"] },
  { entity: "PriceTable", fields: ["label", "notes"] },
];

const MAX_SCAN = 1000;

/**
 * Remove os registos semeados. Devolve o número de linhas removidas em
 * `summary.removed`, por entidade; uma listagem ou remoção recusada pelo
 * emulador fica em `summary.skipped` sem interromper a reposição.
 */
export async function resetSeededAreas(base44: any, summary: any, customerIds: string[]): Promise<void> {
  const owned = new Set(customerIds);

  for (const spec of WIPE) {
    let rows: any[] = [];
    try {
      rows = (await base44.asServiceRole.entities[spec.entity].list("-created_date", MAX_SCAN)) || [];
    } catch (error: any) {
      summary.skipped[`wipe:${spec.entity}`] = String(error?.message || error).slice(0, 200);
      continue;
    }

    for (const row of rows) {
      const labelled = spec.fields.some(
        (field) => typeof row?.[field] === "string" && row[field].includes(MARKER),
      );
      const fromSeed = spec.byCustomer === true && owned.has(row?.customer_id);
      if (!labelled && !fromSeed) continue;

      try {
        await base44.asServiceRole.entities[spec.entity].delete(row.id);
        summary.removed[spec.entity] = (summary.removed[spec.entity] || 0) + 1;
      } catch (error: any) {
        summary.skipped[`wipe:${spec.entity}`] = String(error?.message || error).slice(0, 200);
      }
    }
  }
}

/** Cria uma linha e conta a área; uma recusa fica registada e não interrompe. */
async function write(base44: any, summary: any, entity: string, scope: string, area: string, data: any) {
  try {
    const created = await base44.asServiceRole.entities[entity].create(data);
    summary.areas[area] = (summary.areas[area] || 0) + 1;
    return created;
  } catch (error: any) {
    summary.skipped[`${entity}:${scope}`] = String(error?.message || error).slice(0, 200);
    return null;
  }
}

/**
 * Publica a oferta e o preço correntes do catálogo em execução.
 *
 * Sem uma tabela de preços publicada não há receita contratada nenhuma para
 * mostrar (a leitura de negócio é `monthlyCentsFor` sobre a tabela registada na
 * subscrição), pelo que o ambiente de demonstração ficava com o indicador a
 * zero. A versão é composta a partir do **catálogo de código** — os módulos
 * continuam a vir de `licenseGuard.ts`, não desta escrita — e vigora desde um
 * mês antes da data de referência, para que uma versão publicada mais tarde
 * (pela consola ou pelo harness) seja sempre a vigente.
 */
export async function seedCommercialOffer(base44: any, summary: any, ctx: SeedContext) {
  const effectiveFrom = dayOffset(ctx.referenceDate, -30);
  const label = `${MARKER} Oferta comercial de demonstração`;
  const notes = `${MARKER} Registada pelo seed a partir do catálogo de código.`;

  const version = await write(base44, summary, "OfferVersion", "platform", "commercial", {
    code: "v1",
    label,
    status: "published",
    effective_from: effectiveFrom,
    catalogue_signature: catalogueSignature(),
    tiers: composeTiers(),
    addons: composeAddons(),
    notes,
    author_email: ctx.actorEmail,
    published_by: ctx.actorEmail,
    published_at: instantOffset(ctx.referenceDate, -30, 8),
  });
  if (!version) return null;

  const table = await write(base44, summary, "PriceTable", "platform", "commercial", {
    offer_version_id: version.id,
    offer_version_code: version.code,
    label: `${MARKER} Tabela de preços de demonstração`,
    status: "published",
    currency: "EUR",
    billing_period: "monthly",
    effective_from: effectiveFrom,
    entries: PRICE_ENTRIES,
    addon_entries: [
      { addon_code: "privacy", amount_cents: 4900, included_ai_calls: 500, notes: null },
      { addon_code: "risk", amount_cents: 5900, included_ai_calls: 800, notes: null },
    ],
    notes,
    author_email: ctx.actorEmail,
    published_by: ctx.actorEmail,
    published_at: instantOffset(ctx.referenceDate, -30, 8),
  });

  const offer = { offerVersionId: version.id, offerCode: version.code, priceTableId: table?.id };
  for (const [id, entityType, action] of [
    [version.id, "OfferVersion", "create"],
    [version.id, "OfferVersion", "publish"],
    [table?.id, "PriceTable", "create"],
    [table?.id, "PriceTable", "publish"],
  ] as Array<[string | undefined, string, string]>) {
    if (!id) continue;
    await write(base44, summary, "CommercialChangeLog", "platform", "commercial", {
      entity_type: entityType,
      entity_id: id,
      entity_label: label,
      action,
      actor_email: ctx.actorEmail,
      actor_role: ctx.actorRole,
      reason: notes,
      changed_fields: ["*"],
      before: null,
      after: null,
    });
    await write(base44, summary, "AuditLog", "platform", "audit", {
      customer_id: "",
      user_email: ctx.actorEmail,
      action: entityType === "OfferVersion"
        ? (action === "create" ? "commercial_offer_version_created" : "commercial_offer_version_published")
        : (action === "create" ? "commercial_price_table_created" : "commercial_price_table_published"),
      entity_type: entityType,
      entity_id: id,
      details: `${notes} (${action})`,
    });
  }

  return offer;
}

/** Preço do tier na tabela semeada (a tabela publicada por `seedCommercialOffer`). */
export const PRICE_ENTRIES = [
  { tier_code: "core", amount_cents: 19000, included_seats: 10, extra_seat_amount_cents: 2500, annual_discount_pct: 10, included_ai_calls: 1000, notes: null },
  { tier_code: "professional", amount_cents: 39000, included_seats: 30, extra_seat_amount_cents: 2000, annual_discount_pct: 12, included_ai_calls: 5000, notes: null },
  { tier_code: "advanced", amount_cents: 69000, included_seats: 60, extra_seat_amount_cents: 1500, annual_discount_pct: 15, included_ai_calls: 20000, notes: null },
];

/**
 * Valor mensal contratado de um cliente semeado, lido da tabela publicada pelo
 * seed com o mesmo cálculo da consola. Um cliente sem tabela registada
 * (`unpriced`) conta zero — é assim que a leitura de negócio o mostra.
 */
export function contractedCents(offer: any, spec: any) {
  if (spec.unpriced || !offer?.priceTableId) return 0;
  return monthlyCentsFor({ billing_period: "monthly", entries: PRICE_ENTRIES }, spec.tier, spec.seats, 0);
}

/**
 * Dados operacionais de um cliente — a jornada NIS2 completa e as áreas de
 * apoio (riscos, documentos, incidentes, fornecedores, formação, listas de
 * verificação, atestados, vulnerabilidades e plano de ação).
 */
export async function seedCustomerAreas(
  base44: any,
  summary: any,
  ctx: SeedContext,
  spec: any,
  customer: any,
  assessment: any,
  index: number,
) {
  const size = AREA_SIZES[spec.dataset as keyof typeof AREA_SIZES] || AREA_SIZES.none;
  if (spec.license === "none" || spec.dataset === "none") return;

  const ref = ctx.referenceDate;
  const owner = `grc${spec.nif}.local@teste.pt`.replace(/\s/g, "").toLowerCase();
  const who = `${spec.key}@local.test`;

  // ─── Riscos, tratamento e histórico ───────────────────────────────
  const risks: any[] = [];
  for (const [i, tpl] of rotate(RISK_TEMPLATES, size.risks, index).entries()) {
    const risk = await write(base44, summary, "RiskItem", spec.key, "risks", {
      risk_id: `RISK-${String(index + 1).padStart(2, "0")}${String(i + 1).padStart(2, "0")}`,
      title: `${MARKER} ${tpl.title}`,
      description: `${tpl.treatment}`,
      category: tpl.category,
      impact: tpl.impact,
      likelihood: tpl.likelihood,
      status: tpl.status,
      owner_email: owner,
      customer_id: customer.id,
      customer_name: customer.name,
      treatment_notes: tpl.treatment,
      due_date: dayOffset(ref, 45 + i * 30),
    });
    if (risk) risks.push(risk);
  }

  for (const [i, risk] of risks.slice(0, size.mitigations).entries()) {
    await write(base44, summary, "MitigationTask", spec.key, "mitigation_tasks", {
      risk_id: risk.id,
      title: `${MARKER} Tratar: ${risk.title.replace(`${MARKER} `, "")}`,
      description: "Ação de tratamento com responsável e prazo definidos no plano de ação.",
      assigned_to: owner,
      due_date: dayOffset(ref, 60 + i * 21),
      status: TASK_STATUS_CYCLE[i % TASK_STATUS_CYCLE.length],
      priority: ["high", "medium", "low"][i % 3],
      notes: `${MARKER} Ação de tratamento do risco ${risk.risk_id}.`,
    });
  }

  for (const [i, risk] of risks.slice(0, size.riskHistory).entries()) {
    await write(base44, summary, "RiskHistory", spec.key, "risk_history", {
      risk_id: risk.id,
      changed_by: ctx.actorEmail,
      action: i === 0 ? "created" : "updated",
      changed_fields: i === 0
        ? [
          { field: "title", label: "Título", from: "", to: risk.title },
          { field: "impact", label: "Impacto", from: "3", to: String(risk.impact) },
          { field: "likelihood", label: "Probabilidade", from: "3", to: String(risk.likelihood) },
        ]
        : [
          { field: "status", label: "Estado", from: "open", to: risk.status },
          { field: "treatment_notes", label: "Tratamento", from: "", to: risk.treatment_notes || "" },
        ],
      note: `${MARKER} Registo de histórico do risco ${risk.risk_id}.`,
    });
  }

  // ─── Documentos e versões (evidência com hash) ─────────────────────
  const documents: any[] = [];
  for (const [i, tpl] of rotate(DOCUMENT_TEMPLATES, size.documents, index).entries()) {
    const hash = seedHash(`${spec.key}:document:${tpl.title}`);
    const document = await write(base44, summary, "SecurityDocument", spec.key, "documents", {
      title: `${MARKER} ${tpl.title}`,
      level: tpl.level,
      customer_id: customer.id,
      customer_name: customer.name,
      description: `${tpl.note}`,
      version: `1.${i}`,
      status: tpl.status,
      owner_email: owner,
      approved_by: tpl.status === "approved" ? ctx.actorEmail : "",
      approved_date: tpl.status === "approved" ? dayOffset(ref, -60 - i * 10) : "",
      review_date: dayOffset(ref, 180 - i * 15),
      file_name: `${tpl.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`,
      content_hash: hash,
      review_note: `${MARKER} ${tpl.note}`,
      tags: ["nis2", spec.sector],
      framework_codes: ["NIS2"],
    });
    if (document) documents.push({ document, tpl, hash, i });
  }

  for (const { document, tpl, hash, i } of documents.slice(0, size.versions)) {
    await write(base44, summary, "DocumentVersion", spec.key, "document_versions", {
      document_id: document.id,
      version_label: `1.${i}`,
      title: document.title,
      description: `${tpl.note}`,
      level: tpl.level,
      status: tpl.status,
      file_name: document.file_name,
      content_hash: hash,
      approved_by: tpl.status === "approved" ? ctx.actorEmail : "",
      approved_date: tpl.status === "approved" ? dayOffset(ref, -60 - i * 10) : "",
      review_date: dayOffset(ref, 180 - i * 15),
      tags: ["nis2", spec.sector],
      framework_codes: ["NIS2"],
      changed_by: ctx.actorEmail,
      change_note: `${MARKER} Versão registada pelo seed.`,
    });
  }

  // ─── Incidentes ───────────────────────────────────────────────────
  for (const [i, tpl] of rotate(INCIDENT_TEMPLATES, size.incidents, index).entries()) {
    const detected = instantOffset(ref, -30 - i * 12, 7);
    await write(base44, summary, "Incident", spec.key, "incidents", {
      customer_id: customer.id,
      customer_name: customer.name,
      incident_id: `INC-${String(index + 1).padStart(2, "0")}${String(i + 1).padStart(2, "0")}`,
      title: `${MARKER} ${tpl.title}`,
      description: "Incidente registado no âmbito do exercício de validação do plano de resposta.",
      category: tpl.category,
      severity: tpl.severity,
      status: tpl.status,
      detected_at: detected,
      contained_at: ["contained", "closed"].includes(tpl.status) ? instantOffset(ref, -29 - i * 12, 11) : "",
      resolved_at: tpl.status === "closed" ? instantOffset(ref, -28 - i * 12, 15) : "",
      closed_at: tpl.status === "closed" ? instantOffset(ref, -27 - i * 12, 9) : "",
      data_breach: tpl.breach,
      personal_data_affected: tpl.breach,
      affected_systems: ["Portal de clientes", "Servidor de aplicações"],
      affected_individuals_count: tpl.breach ? 120 : 0,
      assigned_to: owner,
      root_cause: tpl.status === "closed" ? "Credenciais obtidas por engenharia social." : "",
      lessons_learned: tpl.status === "closed" ? "Reforçar a verificação fora de banda nos pedidos de pagamento." : "",
      remediation_actions: "Revisão de acessos e reforço da sensibilização.",
      early_warning_sent: ["contained", "closed"].includes(tpl.status),
      early_warning_sent_at: ["contained", "closed"].includes(tpl.status) ? instantOffset(ref, -29 - i * 12, 12) : "",
      notification_sent: tpl.breach,
      notification_sent_at: tpl.breach ? instantOffset(ref, -27 - i * 12, 12) : "",
      final_report_sent: tpl.status === "closed",
      final_report_sent_at: tpl.status === "closed" ? instantOffset(ref, -20 - i * 12, 12) : "",
      supervisor_authority_notified: tpl.breach,
      supervisor_authority_notified_at: tpl.breach ? instantOffset(ref, -26 - i * 12, 12) : "",
    });
  }

  // ─── Fornecedores ─────────────────────────────────────────────────
  for (const [i, tpl] of rotate(SUPPLIER_TEMPLATES, size.suppliers, index).entries()) {
    await write(base44, summary, "Supplier", spec.key, "suppliers", {
      customer_id: customer.id,
      customer_name: customer.name,
      name: `${MARKER} ${tpl.name}`,
      nif: `50${String(index + 1).padStart(2, "0")}${String(i + 1).padStart(3, "0")}${String(index + 7).padStart(2, "0")}`,
      contact_email: `fornecedor${i + 1}.${spec.nif}@teste.pt`,
      contact_phone: `+351 2${String(index + 1).padStart(2, "0")} 000 0${i}0`,
      website: "https://fornecedor.teste.pt",
      tier: tpl.tier,
      country: tpl.country,
      sector: tpl.sector,
      service_provided: tpl.service,
      contract_start_date: dayOffset(ref, -420 + i * 30),
      contract_renewal_date: dayOffset(ref, 90 + i * 45),
      annual_value: tpl.annual,
      access_to_personal_data: tpl.access,
      access_to_critical_systems: tpl.critical,
      notes: `${MARKER} Fornecedor do ambiente de teste.`,
      status: "active",
    });
  }

  // ─── Formação (colaboradores, ações e presenças) ──────────────────
  const trainingUsers: any[] = [];
  for (const [i, tpl] of rotate(TRAINING_USER_TEMPLATES, size.trainingUsers, index).entries()) {
    const user = await write(base44, summary, "TrainingUser", spec.key, "training_users", {
      customer_id: customer.id,
      customer_name: customer.name,
      full_name: tpl.full_name,
      position: tpl.position,
      department: tpl.department,
      email: `${spec.key}.${i + 1}@teste.pt`,
      phone: `+351 9${String(index + 1).padStart(2, "0")} 000 0${i}0`,
      notes: `${MARKER} Colaborador do ambiente de teste.`,
      status: "active",
    });
    if (user) trainingUsers.push(user);
  }

  const trainings: any[] = [];
  for (const [i, tpl] of rotate(TRAINING_TEMPLATES, size.trainings, index).entries()) {
    const training = await write(base44, summary, "Training", spec.key, "trainings", {
      customer_id: customer.id,
      customer_name: customer.name,
      title: `${MARKER} ${tpl.title}`,
      topic: tpl.topic,
      description: `${MARKER} Ação de formação do plano anual.`,
      modality: tpl.modality,
      trainer: "Equipa de cibersegurança",
      location: "Sede",
      scheduled_date: dayOffset(ref, tpl.status === "completed" ? -45 - i * 15 : 21 + i * 15),
      duration_minutes: tpl.duration,
      status: tpl.status,
      notes: `${MARKER} Formação do ambiente de teste.`,
    });
    if (training) trainings.push(training);
  }

  for (const [i, training] of trainings.entries()) {
    for (const [j, user] of trainingUsers.slice(0, Math.max(1, Math.floor(size.enrollments / trainings.length))).entries()) {
      await write(base44, summary, "TrainingEnrollment", spec.key, "training_enrollments", {
        training_id: training.id,
        training_title: training.title,
        training_user_id: user.id,
        customer_id: customer.id,
        customer_name: customer.name,
        user_name: user.full_name,
        user_email: user.email,
        user_position: user.position,
        user_department: user.department,
        attendance_status: training.status === "completed" ? (j === 0 ? "attended" : "absent") : "invited",
        summoned: true,
        summoned_at: instantOffset(ref, -10 - i * 5, 10),
        notes: `${MARKER} Inscrição do ambiente de teste.`,
      });
    }
  }

  // ─── Lista de verificação NIS2 ────────────────────────────────────
  for (const [i, tpl] of rotate(CHECKLIST_TEMPLATES, size.checklist, index).entries()) {
    await write(base44, summary, "ComplianceChecklist", spec.key, "checklist", {
      customer_id: customer.id,
      customer_name: customer.name,
      framework: tpl.framework,
      section: tpl.section,
      section_order: i + 1,
      task_text: `${MARKER} ${tpl.task_text}`,
      task_order: i + 1,
      status: ["done", "in_progress", "pending"][i % 3],
      owner,
      due_date: dayOffset(ref, 30 + i * 15),
      notes: `${MARKER} Item da lista de verificação.`,
    });
  }

  // ─── Atestados de política ────────────────────────────────────────
  for (const [i, tpl] of rotate(ATTESTATION_TEMPLATES, size.attestations, index).entries()) {
    await write(base44, summary, "PolicyAttestation", spec.key, "attestations", {
      customer_id: customer.id,
      customer_name: customer.name,
      policy_title: `${MARKER} ${tpl.policy_title}`,
      policy_version: tpl.version,
      policy_document_id: documents[i]?.document?.id || "",
      user_email: who,
      user_name: "Colaborador de teste",
      status: tpl.status,
      attested_date: tpl.status === "accepted" ? dayOffset(ref, -25 - i * 5) : "",
      due_date: dayOffset(ref, 30 + i * 10),
      assigned_by: ctx.actorEmail,
      notes: `${MARKER} Atestado do ambiente de teste.`,
    });
  }

  // ─── Vulnerabilidades ─────────────────────────────────────────────
  const vulnerabilities: any[] = [];
  for (const [i, tpl] of rotate(VULNERABILITY_TEMPLATES, size.vulnerabilities, index).entries()) {
    const fixed = tpl.status === "remediated";
    const vulnerability = await write(base44, summary, "Vulnerability", spec.key, "vulnerabilities", {
      customer_id: customer.id,
      customer_name: customer.name,
      vulnerability_id: `VULN-${String(index + 1).padStart(2, "0")}${String(i + 1).padStart(2, "0")}`,
      title: `${MARKER} ${tpl.title}`,
      description: `${MARKER} Achado técnico do ambiente de teste.`,
      severity: tpl.severity,
      cve_id: tpl.cve_id,
      cvss_score: tpl.cvss,
      cvss_vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
      status: tpl.status,
      affected_asset: "Servidor de aplicações",
      affected_version: "1.4.2",
      discovered_date: dayOffset(ref, -70 - i * 12),
      discovered_by: owner,
      due_date: dayOffset(ref, fixed ? -20 : 25 + i * 10),
      remediated_date: fixed ? dayOffset(ref, -15) : "",
      verified_date: fixed ? dayOffset(ref, -10) : "",
      assigned_to: owner,
      remediation_plan: "Aplicar a atualização e validar em ambiente de pré-produção.",
      remediation_notes: fixed ? "Atualização aplicada e validada." : "",
      exploit_available: tpl.severity === "critical",
      patch_available: true,
      sla_breached: !fixed && tpl.severity === "critical",
    });
    if (vulnerability) vulnerabilities.push(vulnerability);
  }

  // ─── Lacunas e plano de ação ──────────────────────────────────────
  const gaps = rotate(ACTION_TEMPLATES, size.recommendations, index);
  for (const [i, tpl] of gaps.entries()) {
    const question = ctx.questions[(index + i) % Math.max(1, ctx.questions.length)] || {};
    const recommendation = await write(base44, summary, "Recommendation", spec.key, "recommendations", {
      assessment_id: assessment?.id || "",
      question_id: question.id || "",
      source: "assessment_gap",
      customer_id: customer.id,
      framework_code: question.framework_code || "NIS2",
      domain: question.domain || tpl.domain,
      control_id: question.control_id || "",
      priority: tpl.priority,
      title: `${MARKER} ${tpl.title}`,
      title_pt: `${MARKER} ${tpl.title}`,
      description: tpl.description,
      description_pt: tpl.description,
      current_level: Math.max(0, ((index + i) % 3) + 1),
      target_level: 4,
      effort: ["low", "medium", "high"][i % 3],
      timeline: ["30 dias", "90 dias", "180 dias"][i % 3],
      status: ["open", "in_progress", "done"][i % 3],
    });
    if (!recommendation) continue;

    if (i < size.tasks) {
      await write(base44, summary, "Task", spec.key, "tasks", {
        title: `${MARKER} ${tpl.title}`,
        description: tpl.description,
        status: TASK_STATUS_CYCLE[(index + i) % TASK_STATUS_CYCLE.length],
        priority: tpl.priority,
        assigned_to: owner,
        due_date: dayOffset(ref, 30 + i * 21),
        assessment_id: assessment?.id || "",
        customer_id: customer.id,
        customer_name: customer.name,
        recommendation_id: recommendation.id,
        framework_code: question.framework_code || "NIS2",
        framework_control_id: question.control_id || "",
        domain: question.domain || tpl.domain,
        notes: `Evidência exigida: ${tpl.evidence}`,
      });
    }
  }

  // ─── Pacote de auditoria congelado ────────────────────────────────
  if (size.auditPackages > 0) {
    const periodStart = monthOffset(ref, 6);
    const periodEnd = ref;
    await write(base44, summary, "AuditPackage", spec.key, "audit_packages", {
      customer_id: customer.id,
      customer_name: customer.name,
      title: `${MARKER} Pacote de auditoria NIS2 — ${customer.name}`,
      status: "final",
      package_version: "1.0",
      period_start: `${periodStart}-01`,
      period_end: periodEnd,
      frameworks: ["NIS2"],
      scope: {
        customer_id: customer.id,
        customer_name: customer.name,
        frameworks: ["NIS2"],
        standards: [],
        period_start: `${periodStart}-01`,
        period_end: periodEnd,
        assessments_considered: assessment ? 1 : 0,
        methodology_versions: [{ code: "NIS2", version: "2025" }],
      },
      index: [
        { key: "documents", label: "Documentos e evidências", description: "Versões congeladas com hash de integridade", count: documents.length },
        { key: "risks", label: "Riscos e tratamento", description: "Riscos identificados e ações de tratamento", count: risks.length },
        { key: "actions", label: "Plano de ação", description: "Tarefas com responsável, prazo e evidência", count: size.tasks },
      ],
      sections: [
        {
          key: "documents",
          label: "Documentos e evidências",
          entries: documents.map(({ document, hash, tpl }) => ({
            ref: document.id,
            label: document.title,
            detail: tpl.note,
            status: document.status,
            hash,
            date: document.approved_date || dayOffset(ref, -40),
          })),
        },
        {
          key: "risks",
          label: "Riscos e tratamento",
          entries: risks.map((risk) => ({
            ref: risk.id,
            label: risk.title,
            detail: `Impacto ${risk.impact} × probabilidade ${risk.likelihood}`,
            status: risk.status,
            hash: seedHash(`risk:${risk.id}`),
            date: dayOffset(ref, -20),
          })),
        },
      ],
      summary: {
        versions: documents.length,
        controls: ctx.questions.length,
        controls_not_implemented: vulnerabilities.length,
        evidence: documents.length,
        decisions: size.auditEntries,
        open_actions: size.tasks,
      },
      generated_by: ctx.actorEmail,
      generated_at: instantOffset(ref, -5, 10),
      notes: `${MARKER} Pacote de demonstração.`,
    });
  }

  // ─── Quotas e consumo de IA ───────────────────────────────────────
  for (let month = 0; month < size.usageMonths; month += 1) {
    const period = monthOffset(ref, month);
    const consumed = quotaFor(spec, index, month);
    await write(base44, summary, "LicenseUsageRecord", `${spec.key}:${period}`, "usage_records", {
      customer_id: customer.id,
      month: period,
      usage_count: consumed,
      reset_date: `${period}-01`,
    });
  }

  const quota = spec.aiQuota || 0;
  for (let i = 0; i < size.quotaSignals; i += 1) {
    const period = monthOffset(ref, i);
    const consumed = quotaFor(spec, index, i);
    const usedPct = quota > 0 ? Math.round((consumed / quota) * 1000) / 10 : null;
    const level = usedPct === null ? "ok" : usedPct >= 100 ? "excess" : usedPct >= 80 ? "warning" : "ok";
    await write(base44, summary, "QuotaSignal", `${spec.key}:${period}:ai_usage`, "quota_signals", {
      customer_id: customer.id,
      customer_name: customer.name,
      period,
      metric: "ai_usage",
      level,
      quota,
      consumed,
      excess: Math.max(0, consumed - quota),
      used_pct: usedPct,
      threshold_pct: 80,
      detected_at: instantOffset(ref, -i * 30, 6),
      recorded_by: ctx.actorEmail,
      recorded_by_role: ctx.actorRole,
      note: `${MARKER} Sinal de quota do ambiente de teste.`,
    });
  }

  // ─── Trilha de auditoria do tenant ────────────────────────────────
  for (const [i, entry] of rotate(AUDIT_ENTRIES, size.auditEntries, index).entries()) {
    await write(base44, summary, "AuditLog", spec.key, "audit", {
      customer_id: customer.id,
      user_email: ctx.actorEmail,
      action: entry.action,
      entity_type: entry.entity_type,
      entity_id: i === 0 ? customer.id : "",
      details: `${MARKER} Registo de auditoria semeado para ${customer.name}.`,
    });
  }
}

/** Consumo mensal de IA determinístico (o mês 0 é o período corrente). */
function quotaFor(spec: any, index: number, month: number): number {
  const quota = spec.aiQuota || 0;
  if (quota === 0) return 0;
  // Um cliente acima da quota (sinalização de excedente), outro no limiar de
  // aviso e os restantes abaixo — os três estados que a consola de quotas mostra.
  const share = spec.license === "suspended" ? 1.05 : spec.unpriced ? 0.85 : 0.45 + (index % 4) * 0.08;
  const drift = month * (index % 3) * 0.02;
  return Math.round(quota * Math.max(0, share - drift));
}

/** Dados de plataforma: anúncios publicados e a trilha do próprio seed. */
export async function seedPlatformAreas(base44: any, summary: any, ctx: SeedContext, customers: any[]) {
  for (const [i, tpl] of ANNOUNCEMENTS.entries()) {
    const target = i === ANNOUNCEMENTS.length - 1 ? customers[customers.length - 1] : null;
    await write(base44, summary, "PlatformAnnouncement", `platform:${i}`, "announcements", {
      title: tpl.title,
      message: tpl.message,
      severity: tpl.severity,
      scope: tpl.scope,
      tier_code: tpl.scope === "tier" ? tpl.tier_code : null,
      customer_id: target ? target.id : null,
      customer_name: target ? target.name : null,
      starts_at: instantOffset(ctx.referenceDate, -3 + i, 8),
      ends_at: instantOffset(ctx.referenceDate, 30 + i * 10, 23),
      is_active: true,
      published_by: ctx.actorEmail,
      published_at: instantOffset(ctx.referenceDate, -3 + i, 8),
    });
  }
}

export { dayOffset as seedDayOffset, instantOffset as seedInstantOffset, monthOffset as seedMonthOffset, seedHash as seedContentHash };
