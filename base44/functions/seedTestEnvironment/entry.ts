import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { normalizeRole, addToArray } from "../../shared/accessUtils.ts";
import {
  assertCompletionAllowed,
  appendStatusHistory,
  buildMethodology,
  computeScores,
  completionType,
} from "../../shared/assessmentScoring.ts";
import { resolveActor } from "../../shared/devActor.ts";
import {
  ASSESSMENT_MODE,
  CONFIRMATION,
  CORE_DELEGATION_MODULES,
  CUSTOMERS,
  DOMAINS,
  MARKER,
  PARTNERS,
  VALIDATION_NIF_PREFIX,
  dayOffset,
  instantOffset,
  isValidationCustomer,
  isValidationIdentifier,
} from "../../shared/testSeedData.ts";
import {
  contractedCents,
  resetSeededAreas,
  seedCommercialOffer,
  seedCustomerAreas,
  seedPlatformAreas,
} from "../../shared/testSeedAreas.ts";

/**
 * seedTestEnvironment — repõe o ambiente de demonstração e validação.
 *
 * Uma só invocação deixa a plataforma inteira povoada: o portefólio de clientes
 * com contratos em estados distintos, a topologia de parceiros e delegações que
 * o harness de validação exige e, por cliente, a jornada NIS2 (avaliação,
 * lacunas, plano de ação, riscos, evidências, documentos, incidentes,
 * fornecedores, formação) mais quotas, consumo de IA, anúncios e trilha de
 * auditoria. Serve para demonstrar e validar de ponta a ponta sem trabalho
 * manual — e para que os ecrãs não apareçam vazios numa sessão nova (os dados
 * locais são em memória e perdem-se a cada reinício).
 *
 * SAFETY: esta função escreve registos e só pode correr num ambiente isolado e
 * descartável (o backend local em memória), nunca sobre dados reais. Exige por
 * isso um token de confirmação explícito e o papel de dono da plataforma.
 *
 * REPOSIÇÃO DETERMINÍSTICA: antes de criar, remove o que uma execução anterior
 * semeou (marcador `[TESTE]` e tudo o que pertença a um cliente semeado) e
 * recria a partir de uma definição fixa — duas execuções produzem o mesmo
 * estado final. Todas as datas derivam de uma única data de referência
 * (`reference_date`, por omissão hoje). Nenhum registo que não seja do seed é
 * tocado; volumes e dados de infraestrutura nunca são apagados.
 *
 * Known limitation of the local backend: `User` create/delete are ignored, so
 * the test identities themselves cannot be created here — the scenarios are
 * attached to the calling user instead (see the returned `test_conditions`).
 * Algumas entidades que o emulador recusa criar ficam registadas em `skipped`.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await resolveActor(base44, req);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    if (normalizeRole(user.role) !== "master_admin") {
      return Response.json({ error: "Forbidden — platform administrator only" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    if (body.confirm !== CONFIRMATION) {
      return Response.json(
        {
          error:
            "Confirmação em falta. Este procedimento cria registos de teste e só pode correr num ambiente isolado e descartável.",
          code: "confirmation_required",
          expected: { confirm: CONFIRMATION },
        },
        { status: 400 },
      );
    }

    // Âmbito de validação declarado por identificador. Esta função escreve e
    // apaga registos, pelo que numa base real não pode tocar em nada que não
    // seja seu: exige que lhe digam qual é o tenant de validação (um NIF do
    // portefólio, ou o próprio prefixo) e confere-o antes de escrever.
    if (!isValidationIdentifier(String(body.validation_tenant || ""))) {
      return Response.json(
        {
          error: "Âmbito de validação em falta: indique o identificador do tenant de validação.",
          code: "validation_scope_required",
          expected: { validation_tenant: `${VALIDATION_NIF_PREFIX}…` },
        },
        { status: 400 },
      );
    }

    // `seed` (por omissão) repõe e semeia; `cleanup` remove o que o seed criou e
    // não cria nada — é a saída que deixa a base como estava.
    const action = body.action === "cleanup" ? "cleanup" : "seed";

    // Data de referência única: todas as datas do seed derivam dela, para que
    // duas execuções produzam exactamente o mesmo estado.
    const referenceDate = /^\d{4}-\d{2}-\d{2}$/.test(String(body.reference_date || ""))
      ? String(body.reference_date)
      : new Date().toISOString().split("T")[0];

    const summary: any = {
      marker: MARKER,
      reference_date: referenceDate,
      created: {},
      reused: {},
      removed: {},
      areas: {},
      skipped: {},
    };

    // ─── 0. Reposição: remover o que uma execução anterior semeou ────
    // A fronteira primeiro: um cliente com o marcador do seed mas com NIF fora
    // do prefixo de validação bloqueia a execução (409) em vez de ser apagado —
    // é o que impede um marcador herdado de destruir dados reais.
    const known = await base44.asServiceRole.entities.Customer.list("name", 1000);
    const seeded = (known || []).filter((row: any) =>
      `${row.name || ""} ${row.notes || ""}`.includes(MARKER),
    );
    const foreign = seeded.filter((row: any) => !isValidationCustomer(row));
    if (foreign.length > 0) {
      return Response.json(
        {
          error: `${foreign.length} cliente(s) com o marcador ${MARKER} têm NIF fora do prefixo de validação — nada foi tocado.`,
          code: "outside_validation_scope",
          blocked: foreign
            .slice(0, 5)
            .map((row: any) => ({ id: row.id, name: row.name, nif: row.nif })),
        },
        { status: 409 },
      );
    }

    const seededIds = seeded.map((row: any) => row.id);
    summary.removed.customers_in_scope = seededIds.length;
    await resetSeededAreas(base44, summary, seededIds);

    if (action === "cleanup") {
      await cleanupTopology(base44, summary, seededIds);
      return Response.json({ ...summary, action: "cleanup", scope: "validation" });
    }

    // ─── 1. Workspaces (2 partners) ──────────────────────────────
    const workspaces: Record<string, any> = {};
    for (const partner of PARTNERS) {
      workspaces[partner.key] = await ensureWorkspace(base44, summary, {
        name: partner.name,
        type: "organization",
        path: partner.name,
      });
    }

    // ─── 2. Customers + their workspace (one isolation boundary each) ───
    const customers: Record<string, any> = {};
    for (const spec of CUSTOMERS) {
      const parent = workspaces[spec.partner];
      const workspace = await ensureWorkspace(base44, summary, {
        name: `${spec.name} (workspace)`,
        type: "organization",
        parent_id: parent.id,
        ancestor_ids: [parent.id],
        path: `${parent.name} > ${spec.name}`,
      });
      const customer = await ensureCustomer(base44, summary, spec, workspace.id);
      customers[spec.key] = { ...spec, id: customer.id, workspace_id: workspace.id };
      await linkWorkspaceToCustomer(base44, summary, workspace, customer);
    }

    // ─── 3. NIS2 framework, controls and question bank ───────────
    const framework = await ensureFramework(base44, summary);
    const questions = await ensureQuestions(base44, summary, framework.id);
    await ensureControls(base44, summary, framework.id, questions);

    // ─── 4. Oferta e preço em vigor (contexto comercial) ─────────
    // Antes das subscrições: é a tabela publicada que dá valor contratado à
    // carteira e de onde as quotas por omissão são lidas.
    const offer = await seedCommercialOffer(base44, summary, {
      referenceDate,
      actorEmail: user.email || "",
      actorRole: normalizeRole(user.role),
      questions,
      offer: null,
    });

    // ─── 5. Subscriptions: o estado declarado de cada cliente ────
    for (const spec of CUSTOMERS) {
      await ensureSubscription(
        base44,
        summary,
        spec,
        customers[spec.key],
        { email: user.email || "", role: normalizeRole(user.role) },
        offer,
        referenceDate,
      );
    }

    // ─── 6. Assessments (completed: full coverage / partial coverage) ───
    const assessments: Record<string, any> = {};
    for (const spec of CUSTOMERS) {
      if (!ASSESSMENT_MODE[spec.key]) continue;
      assessments[spec.key] = await ensureAssessment(
        base44,
        summary,
        customers[spec.key],
        questions,
        framework,
        ASSESSMENT_MODE[spec.key],
        user,
        referenceDate,
      );
    }

    // ─── 7. Delegation scenarios ─────────────────────────────────
    const assignments = await ensureAssignments(base44, summary, user, customers, referenceDate);

    // ─── 8. Áreas operacionais de cada cliente ───────────────────
    const ctx = {
      referenceDate,
      actorEmail: user.email || "",
      actorRole: normalizeRole(user.role),
      questions,
      offer,
    };
    for (const [index, spec] of CUSTOMERS.entries()) {
      await seedCustomerAreas(base44, summary, ctx, spec, customers[spec.key], assessments[spec.key], index);
    }

    // ─── 9. Dados de plataforma (anúncios) ───────────────────────
    await seedPlatformAreas(base44, summary, ctx, Object.values(customers).slice(0, CUSTOMERS.length));

    // ─── 10. Trilha do próprio seed ──────────────────────────────
    const anchor = customers[CUSTOMERS[0].key];
    await base44.asServiceRole.entities.AuditLog.create({
      customer_id: anchor.id,
      action: "test_conditions_seeded",
      user_email: user.email || "",
      entity_type: "TestEnvironment",
      entity_id: "",
      details: JSON.stringify({
        marker: MARKER,
        reference_date: referenceDate,
        customers: CUSTOMERS.length,
        offer_version: offer?.offerCode || null,
      }),
    });

    const contracted = CUSTOMERS.filter((spec) => spec.license !== "none").reduce(
      (total, spec) => total + contractedCents(offer, spec),
      0,
    );

    return Response.json({
      ...summary,
      contracted_cents_monthly: contracted,
      test_conditions: {
        partners: Object.fromEntries(Object.entries(workspaces).map(([k, w]) => [k, w.id])),
        tenants: Object.fromEntries(Object.entries(customers).map(([k, c]) => [k, c.id])),
        assessments: Object.fromEntries(Object.entries(assessments).map(([k, a]) => [k, a.id])),
        framework_id: framework.id,
        question_ids: questions.map((q) => q.id),
        offer_version_id: offer?.offerVersionId || null,
        price_table_id: offer?.priceTableId || null,
        portfolio_size: CUSTOMERS.length,
        assignments,
        // Documented limitation: the local backend ignores User create/delete.
        identities_note:
          "As identidades de teste são as que o ambiente local disponibiliza; os cenários de delegação são associados ao utilizador que invoca esta função.",
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function ensureWorkspace(base44: any, summary: any, data: any) {
  const existing = await base44.asServiceRole.entities.Workspace.filter({ name: data.name });
  if (existing.length > 0) {
    summary.reused[`workspace:${data.name}`] = existing[0].id;
    return existing[0];
  }
  const created = await base44.asServiceRole.entities.Workspace.create(data);
  summary.created[`workspace:${data.name}`] = created.id;
  return created;
}

async function ensureCustomer(base44: any, summary: any, spec: any, workspaceId: string) {
  const existing = await base44.asServiceRole.entities.Customer.filter({ nif: spec.nif });
  const data = {
    nif: spec.nif,
    name: spec.name,
    sector: spec.sector,
    status: "active",
    workspace_id: workspaceId,
    num_employees: spec.employees,
    contact_email: `contacto.${spec.nif}@teste.pt`,
    website: `https://www.${spec.key.replace("tenant_", "")}.teste.pt`,
    notes: `${MARKER} Dados de teste — ambiente isolado.`,
  };
  if (existing.length > 0) {
    summary.reused[`customer:${spec.key}`] = existing[0].id;
    return existing[0];
  }
  const created = await base44.asServiceRole.entities.Customer.create(data);
  summary.created[`customer:${spec.key}`] = created.id;
  return created;
}

/**
 * Ensure the tenant workspace carries its customer link.
 *
 * The link exists on both sides (`Customer.workspace_id` and
 * `Workspace.customer_id`) and the carteira of a partner admin is resolved from
 * the Workspace subtree, so writing only the Customer side leaves the subtree
 * with no `customer_id` and the partner's scope resolves empty.
 */
async function linkWorkspaceToCustomer(base44: any, summary: any, workspace: any, customer: any) {
  if (workspace.customer_id === customer.id) return workspace;
  const updated = await base44.asServiceRole.entities.Workspace.update(workspace.id, {
    customer_id: customer.id,
    customer_name: customer.name,
  });
  summary.created[`workspace_link:${customer.name}`] = updated.id;
  return updated;
}

async function ensureFramework(base44: any, summary: any) {
  const existing = await base44.asServiceRole.entities.Framework.filter({ code: "NIS2" });
  if (existing.length > 0) {
    summary.reused["framework:NIS2"] = existing[0].id;
    return existing[0];
  }
  const created = await base44.asServiceRole.entities.Framework.create({
    code: "NIS2",
    name: "NIS2 / DL 125/2025 (RJCS)",
    version: "2025",
    description: `${MARKER} Framework operacional do lançamento Core.`,
    status: "active",
  });
  summary.created["framework:NIS2"] = created.id;
  return created;
}

async function ensureQuestions(base44: any, summary: any, frameworkId: string) {
  const existing = await base44.asServiceRole.entities.Question.list("order_index", 500);
  const testQuestions = existing.filter((q: any) => (q.question_text || "").startsWith(MARKER));
  if (testQuestions.length > 0) {
    summary.reused["questions:NIS2"] = testQuestions.length;
    return testQuestions;
  }

  const definitions = [];
  DOMAINS.forEach((d, di) => {
    for (let i = 1; i <= 3; i += 1) {
      const order = di * 3 + i;
      const controlId = `NIS2.${di + 1}.${i}`;
      definitions.push({
        framework_code: "NIS2",
        control_id: controlId,
        domain: d.domain,
        domain_pt: d.domain_pt,
        question_text: `${MARKER} ${d.domain} — requisito ${controlId}: a organização implementa e mantém o controlo?`,
        question_text_pt: `${MARKER} ${d.domain_pt} — requisito ${controlId}: a organização implementa e mantém o controlo?`,
        guidance: "Avaliar a evidência documental e operacional do controlo.",
        answer_type: "maturity_scale",
        weight: i, // weights 1..3 — the methodology snapshot must preserve them
        order_index: order,
        is_active: true,
      });
    }
  });

  const created = [];
  for (const q of definitions) {
    created.push(await base44.asServiceRole.entities.Question.create(q));
  }
  summary.created["questions:NIS2"] = created.length;
  void frameworkId;
  return created;
}

async function ensureControls(base44: any, summary: any, frameworkId: string, questions: any[]) {
  const existing = await base44.asServiceRole.entities.FrameworkControl.list("control_id", 500);
  const known = new Set(existing.map((c: any) => `${c.framework_code}:${c.control_id}`));
  let created = 0;
  for (const q of questions) {
    const key = `${q.framework_code}:${q.control_id}`;
    if (known.has(key)) continue;
    await base44.asServiceRole.entities.FrameworkControl.create({
      framework_id: frameworkId,
      framework_code: q.framework_code,
      control_id: q.control_id,
      domain: q.domain,
      title: `${MARKER} ${q.control_id}`,
      description: `${MARKER} Controlo de teste associado ao requisito ${q.control_id}.`,
    });
    created += 1;
  }
  if (created > 0) summary.created["framework_controls:NIS2"] = created;
  else summary.reused["framework_controls:NIS2"] = existing.length;
}

/**
 * Recreate the customer's subscription so the declared state holds.
 *
 * The state has to be ENFORCED, not merely written once: the licence catalogue
 * (`seedLicenseData`) subscribes every customer it finds and a previous run may
 * have provisioned or suspended the tenant — the declared condition would then
 * silently not hold and the validation cases would measure leftover data instead
 * of the behaviour under test. Everything the seed declared (subscription,
 * module exceptions and standards) is removed first.
 */
async function ensureSubscription(
  base44: any,
  summary: any,
  spec: any,
  customer: any,
  actor: { email: string; role: string },
  offer: any,
  referenceDate: string,
) {
  for (const entity of ["TenantSubscription", "TenantModule", "TenantStandard", "TenantEntitlementOverride"]) {
    const rows = await base44.asServiceRole.entities[entity].filter({ customer_id: customer.id });
    for (const row of rows || []) {
      await base44.asServiceRole.entities[entity].delete(row.id);
      summary.removed[entity] = (summary.removed[entity] || 0) + 1;
    }
  }

  if (spec.license === "none") return null;

  const started = dayOffset(referenceDate, -30 * (spec.startedMonthsAgo || 1));
  const expires = spec.expiresInDays ? dayOffset(referenceDate, spec.expiresInDays) : null;
  const closed = spec.license === "cancelled";
  const priced = !spec.unpriced;

  const data = {
    customer_id: customer.id,
    customer_name: customer.name,
    tier_code: spec.tier,
    status: closed ? "cancelled" : spec.license,
    started_date: started,
    expires_date: expires,
    seat_limit: spec.seats,
    seats_used: Math.max(1, Math.round(spec.seats * 0.6)),
    monthly_usage_count: 0,
    monthly_usage_reset_date: `${dayOffset(referenceDate, 0).slice(0, 7)}-01`,
    ai_quota_monthly: spec.aiQuota,
    quota_warn_pct: 80,
    grace_until: spec.license === "suspended" ? dayOffset(referenceDate, -10) : null,
    renewal_count: (spec.startedMonthsAgo || 0) > 12 ? 1 : 0,
    last_renewed_at: (spec.startedMonthsAgo || 0) > 12 ? dayOffset(referenceDate, -330) : null,
    closed_at: closed ? instantOffset(referenceDate, -8, 11) : null,
    closed_reason: closed ? `${MARKER} Contrato encerrado no ambiente de teste.` : null,
    offer_version_id: priced ? offer?.offerVersionId || null : null,
    offer_version_code: priced ? offer?.offerCode || null : null,
    price_table_id: priced ? offer?.priceTableId || null : null,
    price_amount_cents: priced ? contractedCents(offer, spec) : null,
    notes: `${MARKER} Subscrição de demonstração (${spec.license}).`,
  };

  const created = await base44.asServiceRole.entities.TenantSubscription.create(data);
  summary.created[`subscription:${spec.key}`] = created.id;
  summary.areas.subscriptions = (summary.areas.subscriptions || 0) + 1;

  const snapshot = (patch: any) => ({
    subscription: {
      tier_code: spec.tier,
      status: data.status,
      seat_limit: spec.seats,
      seats_used: data.seats_used,
      started_date: started,
      expires_date: expires,
      notes: data.notes,
      grace_until: data.grace_until,
      renewal_count: data.renewal_count,
      last_renewed_at: data.last_renewed_at,
      closed_at: data.closed_at,
      closed_reason: data.closed_reason,
      ...patch,
    },
  });

  const log = (action: string, before: any, after: any, reason: string, fields: string[]) =>
    base44.asServiceRole.entities.LicenseChangeLog.create({
      customer_id: customer.id,
      customer_name: customer.name,
      action,
      actor_email: actor.email,
      actor_role: actor.role,
      entity_type: "TenantSubscription",
      entity_id: created.id,
      reason,
      changed_fields: fields,
      before,
      after,
    });

  await log("create", null, snapshot({}), `${MARKER} Subscrição criada pelo seed.`, ["*"]);
  if (spec.license === "suspended") {
    await log(
      "suspend",
      snapshot({ status: "active" }),
      snapshot({ status: "suspended" }),
      `${MARKER} Suspensão declarada no ambiente de teste.`,
      ["status", "grace_until"],
    );
  }
  if (spec.license === "expired") {
    await log(
      "update",
      snapshot({ status: "active", expires_date: dayOffset(referenceDate, 30) }),
      snapshot({ status: "expired" }),
      `${MARKER} Vigência terminada no ambiente de teste.`,
      ["status", "expires_date"],
    );
  }
  if (closed) {
    await log(
      "close",
      snapshot({ status: "active", closed_at: null, closed_reason: null }),
      snapshot({ status: "cancelled" }),
      `${MARKER} Fecho do contrato no ambiente de teste.`,
      ["status", "closed_at", "closed_reason"],
    );
  }

  return created;
}

/**
 * Create the test assessment, its responses and its completion.
 *
 * The seeded assessment is a COMPLETED one: a full-coverage tenant completes
 * directly and the partial one completes with explicit confirmation — the same
 * rules `completeAssessment` applies, read from the same shared helpers. A
 * draft would leave the step after it (gap analysis) answering 409
 * `not_completed`, so the edit-delegation scenario would not be testable.
 */
async function ensureAssessment(
  base44: any,
  summary: any,
  customer: any,
  questions: any[],
  framework: any,
  coverageMode: string,
  user: any,
  referenceDate: string,
) {
  const existing = await base44.asServiceRole.entities.Assessment.filter({ customer_id: customer.id });
  let assessment = existing.find((a: any) => (a.title || "").startsWith(MARKER));

  if (assessment) {
    summary.reused[`assessment:${customer.key}`] = assessment.id;
  } else {
    assessment = await base44.asServiceRole.entities.Assessment.create({
      customer_id: customer.id,
      customer_name: customer.name,
      title: `${MARKER} Diagnóstico NIS2 — ${customer.name}`,
      period: `${referenceDate.slice(0, 4)}-Q4`,
      frameworks: ["NIS2"],
      question_ids: questions.map((q) => q.id),
      status: "draft",
      assessor_email: "",
    });
    summary.created[`assessment:${customer.key}`] = assessment.id;

    const total = questions.length;
    const answeredCount = coverageMode === "full" ? total : Math.max(1, Math.round(total * 0.6));
    const offset = customer.maturityOffset || 0;

    for (let index = 0; index < questions.length; index += 1) {
      const q = questions[index];
      let answer: any = null;
      if (index < answeredCount) {
        answer = { answer_state: "answered", maturity_level: ((index + offset) % 5) + 1 };
      } else if (coverageMode === "partial" && index === answeredCount) {
        // Not applicable: no maturity level at all (the field is a number).
        answer = { answer_state: "not_applicable" };
      }
      if (!answer) continue;

      await base44.asServiceRole.entities.AssessmentResponse.create({
        assessment_id: assessment.id,
        customer_id: customer.id,
        question_id: q.id,
        framework_code: q.framework_code,
        control_id: q.control_id,
        domain: q.domain,
        question_weight: q.weight,
        answer_state: answer.answer_state,
        target_level: 4,
        evidence_notes: `${MARKER} Resposta de teste.`,
        ...(answer.maturity_level !== undefined ? { maturity_level: answer.maturity_level } : {}),
      });
    }
  }

  // Completion is enforced, so an assessment left in draft by an earlier run is
  // completed instead of being silently reused.
  if (assessment.status === "completed") return assessment;

  const responses = await base44.asServiceRole.entities.AssessmentResponse.filter({
    assessment_id: assessment.id,
  });
  const coverage = assertCompletionAllowed(questions, responses, { confirm_partial: true });
  const scores = computeScores(questions, responses, assessment.frameworks || []);
  const methodology = buildMethodology(assessment, questions, [
    { code: framework.code, version: framework.version || null },
  ]);
  const completedAt = instantOffset(referenceDate, -45, 17);

  const completed = await base44.asServiceRole.entities.Assessment.update(assessment.id, {
    status: "completed",
    overall_score: scores.overall_score,
    framework_scores: scores.framework_scores,
    coverage,
    methodology,
    completion_type: completionType(coverage),
    completed_date: completedAt.split("T")[0],
    completed_by: user.email || "",
    assessor_email: assessment.assessor_email || user.email || "",
    status_history: appendStatusHistory(assessment, {
      status: "completed",
      by: user.email || "",
      via: "seed",
      coverage_pct: coverage.coverage_pct,
      scoring_model: methodology.scoring_model,
    }),
  });

  summary.completed = summary.completed || {};
  summary.completed[`assessment:${customer.key}`] = completed.id;
  return completed;
}

/** Delegation scenarios: approved / pending / expired / revoked / module-restricted. */
async function ensureAssignments(
  base44: any,
  summary: any,
  user: any,
  customers: Record<string, any>,
  referenceDate: string,
) {
  const inDays = (days: number) => instantOffset(referenceDate, days, 12);
  const scenarios = [
    {
      key: "approved_edit_tenant_alfa",
      customer: "tenant_alfa",
      assignment_type: "delegation",
      access_level: "contributor",
      status: "active",
      expires_at: inDays(30),
      grant: "edit",
      reason: `${MARKER} Delegação de edição aprovada (cenário de teste).`,
    },
    {
      key: "approved_edit_tenant_beta",
      customer: "tenant_beta",
      assignment_type: "delegation",
      access_level: "contributor",
      status: "active",
      expires_at: inDays(30),
      grant: "edit",
      reason: `${MARKER} Delegação de edição aprovada (cenário de teste).`,
    },
    {
      key: "approved_viewer_tenant_gama",
      customer: "tenant_gama",
      assignment_type: "delegation",
      access_level: "viewer",
      status: "active",
      expires_at: inDays(30),
      grant: "view",
      reason: `${MARKER} Delegação apenas de leitura — não deve permitir escrita.`,
    },
    {
      key: "approved_edit_tenant_delta",
      customer: "tenant_delta",
      assignment_type: "delegation",
      access_level: "contributor",
      status: "active",
      expires_at: inDays(30),
      grant: "edit",
      reason: `${MARKER} Delegação de edição sem subscrição — módulo não licenciado.`,
    },
    {
      key: "pending_tenant_gama",
      customer: "tenant_gama",
      assignment_type: "delegation",
      access_level: "viewer",
      status: "pending",
      expires_at: inDays(15),
      grant: null,
      reason: `${MARKER} Pedido pendente — não deve conceder acesso.`,
    },
    {
      key: "expired_tenant_beta_reader",
      customer: "tenant_beta",
      assignment_type: "delegation",
      access_level: "viewer",
      status: "active",
      expires_at: inDays(-2),
      grant: null,
      reason: `${MARKER} Delegação de leitura expirada — não deve conceder acesso.`,
    },
    {
      key: "revoked_tenant_alfa_reader",
      customer: "tenant_alfa",
      assignment_type: "delegation",
      access_level: "viewer",
      status: "revoked",
      expires_at: inDays(10),
      grant: null,
      reason: `${MARKER} Delegação revogada — não deve conceder acesso.`,
    },
    {
      key: "module_restricted_tenant_beta",
      customer: "tenant_beta",
      assignment_type: "delegation",
      access_level: "viewer",
      status: "active",
      expires_at: inDays(10),
      grant: "view",
      authorized_modules: ["documents_evidence"],
      reason: `${MARKER} Delegação restrita ao módulo de documentos.`,
    },
    {
      key: "expired_only_tenant_epsilon",
      customer: "tenant_epsilon",
      assignment_type: "delegation",
      access_level: "contributor",
      status: "active",
      expires_at: inDays(-5),
      grant: null,
      reason: `${MARKER} Delegação expirada (única via para este cliente) — não deve conceder acesso.`,
    },
    {
      key: "revoked_only_tenant_zeta",
      customer: "tenant_zeta",
      assignment_type: "delegation",
      access_level: "contributor",
      status: "revoked",
      expires_at: inDays(20),
      grant: null,
      reason: `${MARKER} Delegação revogada (única via para este cliente) — não deve conceder acesso.`,
    },
    {
      key: "module_restricted_edit_tenant_eta",
      customer: "tenant_eta",
      assignment_type: "delegation",
      access_level: "contributor",
      status: "active",
      expires_at: inDays(60),
      grant: "edit",
      authorized_modules: ["documents_evidence"],
      reason: `${MARKER} Delegação de edição restrita ao módulo de documentos — não deve autorizar o percurso de avaliações.`,
    },
    {
      key: "onboarding_tenant_gama",
      customer: "tenant_gama",
      assignment_type: "onboarding",
      access_level: "viewer",
      status: "active",
      grant: null,
      reason: `${MARKER} Onboarding (setup de conta) — não concede dados operacionais.`,
    },
  ];

  const result: Record<string, any> = {};
  for (const scenario of scenarios) {
    const customer = customers[scenario.customer];
    const existing = await base44.asServiceRole.entities.UserCustomerAssignment.filter({
      customer_id: customer.id,
      assignment_type: scenario.assignment_type,
    });
    // Match by the scenario's own reason: several scenarios share customer,
    // type and access level (e.g. approved viewer vs. pending viewer), so a
    // coarser key would reuse the wrong record and silently drop the scenario.
    const match = existing.find((a: any) => a.reason === scenario.reason);
    if (match) {
      summary.reused[`assignment:${scenario.key}`] = match.id;
      result[scenario.key] = match.id;
      continue;
    }

    const created = await base44.asServiceRole.entities.UserCustomerAssignment.create({
      user_id: user.id || "",
      user_email: user.email || "",
      customer_id: customer.id,
      customer_name: customer.name,
      workspace_id: customer.workspace_id,
      assignment_type: scenario.assignment_type,
      access_level: scenario.access_level,
      authorized_modules:
        scenario.authorized_modules || (scenario.grant ? CORE_DELEGATION_MODULES : []),
      status: scenario.status,
      is_legacy: false,
      expires_at: scenario.expires_at || "",
      requested_by: user.email || "",
      approved_by: scenario.status === "active" ? user.email || "" : "",
      assigned_by: user.email || "",
      reason: scenario.reason,
    });
    summary.created[`assignment:${scenario.key}`] = created.id;
    result[scenario.key] = created.id;

    if (scenario.grant) {
      // A identidade que semeia pode não existir como registo na entidade User
      // (no emulador local a criação de utilizadores é ignorada): a ausência do
      // registo não pode derrubar o seed — os arrays denormalizados deixam
      // simplesmente de ser escritos e as autorizações leem a atribuição.
      const target = await base44.asServiceRole.entities.User.get(user.id).catch(() => null);
      if (target) {
        const field = scenario.grant === "view" ? "delegated_view_customer_ids" : "delegated_edit_customer_ids";
        await base44.asServiceRole.entities.User.update(target.id, {
          [field]: addToArray(target[field], customer.id),
        });
      }
    }
  }
  return result;
}

/**
 * Remove a topologia do seed — a acção `cleanup`.
 *
 * As áreas por cliente ficam a cargo do `resetSeededAreas`, que corre antes
 * (clientes, avaliações, riscos, documentos, planos, subscrições, histórico,
 * anúncios e a oferta/preço semeados); o que sobra é o que não pertence a
 * nenhum cliente: os clientes em si, os workspaces, as perguntas, os controlos
 * e o framework. Só recebe os ids que passaram a fronteira do âmbito de
 * validação, pelo que nada fora do portefólio pode ser removido por aqui.
 *
 * A trilha de auditoria do próprio seed fica como está: a limpeza também é um
 * facto registado, e apagá-la seria apagar a prova de que os dados existiram.
 */
async function cleanupTopology(base44: any, summary: any, customerIds: string[]) {
  const remove = async (entity: string, row: any, match: boolean) => {
    if (!match) return;
    try {
      await base44.asServiceRole.entities[entity].delete(row.id);
      summary.removed[entity] = (summary.removed[entity] || 0) + 1;
    } catch (error: any) {
      summary.skipped[`cleanup:${entity}:${row.id}`] = String(error?.message || error).slice(0, 200);
    }
  };

  for (const id of customerIds) {
    try {
      await base44.asServiceRole.entities.Customer.delete(id);
      summary.removed.Customer = (summary.removed.Customer || 0) + 1;
    } catch (error: any) {
      summary.skipped[`cleanup:Customer:${id}`] = String(error?.message || error).slice(0, 200);
    }
  }

  const workspaces = (await base44.asServiceRole.entities.Workspace.list("name", 1000).catch(() => [])) || [];
  for (const row of workspaces) {
    await remove("Workspace", row, String(row.name || "").includes(MARKER));
  }

  const questions = (await base44.asServiceRole.entities.Question.list("order_index", 500).catch(() => [])) || [];
  for (const row of questions) {
    await remove("Question", row, String(row.question_text || "").startsWith(MARKER));
  }

  const controls =
    (await base44.asServiceRole.entities.FrameworkControl.list("control_id", 500).catch(() => [])) || [];
  for (const row of controls) {
    await remove("FrameworkControl", row, String(row.title || "").startsWith(MARKER));
  }

  const frameworks = (await base44.asServiceRole.entities.Framework.list("code", 100).catch(() => [])) || [];
  for (const row of frameworks) {
    await remove("Framework", row, String(row.description || "").includes(MARKER));
  }
}
