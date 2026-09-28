import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { normalizeRole, addToArray } from "../../shared/accessUtils.ts";

/**
 * seedTestEnvironment — creates the test conditions required by the Core NIS2
 * validation (two tenants, two partners, delegation scenarios, a NIS2 assessment
 * with partial coverage).
 *
 * SAFETY: this function writes records and must only run on an isolated,
 * discardable environment (the local in-memory dev backend), never on real data.
 * It therefore requires an explicit confirmation token and refuses to run
 * without it. It is idempotent: everything is found or created by its marker, so
 * re-running never duplicates records.
 *
 * Known limitation of the local backend: `User` create/delete are ignored, so
 * the test identities themselves cannot be created here — the scenarios are
 * attached to the calling user instead (see the returned `test_conditions`).
 */
const CONFIRMATION = "create-test-conditions";
const MARKER = "[TESTE]";

const PARTNERS = [
  { key: "partner_alfa", name: `${MARKER} Parceiro Alfa` },
  { key: "partner_beta", name: `${MARKER} Parceiro Beta` },
];

const CUSTOMERS = [
  // Alfa: delegação de edição + subscrição Core → jornada completa
  { key: "tenant_alfa", name: `${MARKER} Cliente Alfa`, nif: "900000001", sector: "technology", partner: "partner_alfa", subscription: true },
  // Beta: delegação de edição + subscrição Core → conclusão parcial
  { key: "tenant_beta", name: `${MARKER} Cliente Beta`, nif: "900000002", sector: "energy", partner: "partner_beta", subscription: true },
  // Gama: delegação apenas de leitura → tentativa de escrita deve falhar
  { key: "tenant_gama", name: `${MARKER} Cliente Gama`, nif: "900000003", sector: "healthcare", partner: "partner_alfa", subscription: true },
  // Delta: delegação de edição mas sem subscrição → módulo não licenciado
  { key: "tenant_delta", name: `${MARKER} Cliente Delta`, nif: "900000004", sector: "manufacturing", partner: "partner_beta", subscription: false },
];

/** Assessment coverage mode per tenant. */
const ASSESSMENT_MODE: Record<string, string> = {
  tenant_alfa: "full",
  tenant_beta: "partial",
  tenant_gama: "full",
  tenant_delta: "full",
};

const DOMAINS = [
  { domain: "Governance", domain_pt: "Governação" },
  { domain: "Risk Management", domain_pt: "Gestão de Risco" },
  { domain: "Incident Handling", domain_pt: "Gestão de Incidentes" },
  { domain: "Supply Chain", domain_pt: "Cadeia de Abastecimento" },
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
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

    const summary: any = { marker: MARKER, created: {}, reused: {} };

    // ─── Workspaces (2 partners) ──────────────────────────────
    const workspaces: Record<string, any> = {};
    for (const partner of PARTNERS) {
      workspaces[partner.key] = await ensureWorkspace(base44, summary, {
        name: partner.name,
        type: "organization",
        path: partner.name,
      });
    }

    // ─── Customers + their workspace (one isolation boundary each) ───
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
    }

    // ─── NIS2 framework, controls and question bank ───────────
    const framework = await ensureFramework(base44, summary);
    const questions = await ensureQuestions(base44, summary, framework.id);
    await ensureControls(base44, summary, framework.id, questions);

    // ─── Core subscription per tenant (Delta intentionally left unlicensed) ───
    for (const key of Object.keys(customers)) {
      if (customers[key].subscription === false) continue;
      await ensureSubscription(base44, summary, customers[key]);
    }

    // ─── Assessments (full coverage / partial coverage) ───────
    const assessments: Record<string, any> = {};
    for (const key of Object.keys(customers)) {
      assessments[key] = await ensureAssessment(base44, summary, customers[key], questions, ASSESSMENT_MODE[key] || "full");
    }

    // ─── Delegation scenarios ─────────────────────────────────
    const assignments = await ensureAssignments(base44, summary, user, customers);

    // ─── Audit trail of the seeding itself ────────────────────
    await base44.asServiceRole.entities.AuditLog.create({
      customer_id: customers.tenant_alfa.id,
      action: "test_conditions_seeded",
      user_email: user.email || "",
      entity_type: "TestEnvironment",
      entity_id: "",
      details: JSON.stringify({ marker: MARKER, customers: Object.keys(customers) }),
    });

    return Response.json({
      ...summary,
      test_conditions: {
        partners: Object.fromEntries(Object.entries(workspaces).map(([k, w]) => [k, w.id])),
        tenants: Object.fromEntries(Object.entries(customers).map(([k, c]) => [k, c.id])),
        assessments: Object.fromEntries(Object.entries(assessments).map(([k, a]) => [k, a.id])),
        framework_id: framework.id,
        question_ids: questions.map((q) => q.id),
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

async function ensureSubscription(base44: any, summary: any, customer: any) {
  const existing = await base44.asServiceRole.entities.TenantSubscription.filter({ customer_id: customer.id });
  if (existing.length > 0) {
    summary.reused[`subscription:${customer.key}`] = existing[0].id;
    return existing[0];
  }
  const created = await base44.asServiceRole.entities.TenantSubscription.create({
    customer_id: customer.id,
    customer_name: customer.name,
    tier_code: "core",
    status: "active",
    started_date: new Date().toISOString().split("T")[0],
    seat_limit: 25,
    notes: `${MARKER} Subscrição Core do ambiente de teste.`,
  });
  summary.created[`subscription:${customer.key}`] = created.id;
  return created;
}

/** Create the test assessment and its responses. */
async function ensureAssessment(base44: any, summary: any, customer: any, questions: any[], coverageMode: string) {
  const existing = await base44.asServiceRole.entities.Assessment.filter({ customer_id: customer.id });
  const testAssessment = existing.find((a: any) => (a.title || "").startsWith(MARKER));
  if (testAssessment) {
    summary.reused[`assessment:${customer.key}`] = testAssessment.id;
    return testAssessment;
  }

  const assessment = await base44.asServiceRole.entities.Assessment.create({
    customer_id: customer.id,
    customer_name: customer.name,
    title: `${MARKER} Diagnóstico NIS2 — ${customer.name}`,
    period: "2025-Q4",
    frameworks: ["NIS2"],
    question_ids: questions.map((q) => q.id),
    status: "draft",
    assessor_email: "",
  });

  const total = questions.length;
  const answeredCount = coverageMode === "full" ? total : Math.max(1, Math.round(total * 0.6));

  for (let index = 0; index < questions.length; index += 1) {
    const q = questions[index];
    let answer: any = null;
    if (index < answeredCount) {
      answer = { answer_state: "answered", maturity_level: (index % 5) + 1 };
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

  summary.created[`assessment:${customer.key}`] = assessment.id;
  return assessment;
}

/** Delegation scenarios: approved / pending / expired / revoked / module-restricted. */
async function ensureAssignments(base44: any, summary: any, user: any, customers: Record<string, any>) {
  const inDays = (days: number) => new Date(Date.now() + days * 86400000).toISOString();
  const scenarios = [
    {
      key: "approved_edit_tenant_alfa",
      customer: "tenant_alfa",
      assignment_type: "delegation",
      access_level: "contributor",
      status: "approved",
      expires_at: inDays(30),
      granted: true,
      reason: `${MARKER} Delegação de edição aprovada (cenário de teste).`,
    },
    {
      key: "approved_edit_tenant_beta",
      customer: "tenant_beta",
      assignment_type: "delegation",
      access_level: "contributor",
      status: "approved",
      expires_at: inDays(30),
      granted: true,
      reason: `${MARKER} Delegação de edição aprovada (cenário de teste).`,
    },
    {
      key: "approved_viewer_tenant_gama",
      customer: "tenant_gama",
      assignment_type: "delegation",
      access_level: "viewer",
      status: "approved",
      expires_at: inDays(30),
      granted: false,
      reason: `${MARKER} Delegação apenas de leitura — não deve permitir escrita.`,
    },
    {
      key: "approved_edit_tenant_delta",
      customer: "tenant_delta",
      assignment_type: "delegation",
      access_level: "contributor",
      status: "approved",
      expires_at: inDays(30),
      granted: false,
      reason: `${MARKER} Delegação de edição sem subscrição — módulo não licenciado.`,
    },
    {
      key: "pending_tenant_gama",
      customer: "tenant_gama",
      assignment_type: "delegation",
      access_level: "viewer",
      status: "pending",
      expires_at: inDays(15),
      granted: false,
      reason: `${MARKER} Pedido pendente — não deve conceder acesso.`,
    },
    {
      key: "expired_tenant_beta_reader",
      customer: "tenant_beta",
      assignment_type: "delegation",
      access_level: "viewer",
      status: "approved",
      expires_at: inDays(-2),
      granted: false,
      reason: `${MARKER} Delegação de leitura expirada — não deve conceder acesso.`,
    },
    {
      key: "revoked_tenant_alfa_reader",
      customer: "tenant_alfa",
      assignment_type: "delegation",
      access_level: "viewer",
      status: "revoked",
      expires_at: inDays(10),
      granted: false,
      reason: `${MARKER} Delegação revogada — não deve conceder acesso.`,
    },
    {
      key: "module_restricted_tenant_beta",
      customer: "tenant_beta",
      assignment_type: "delegation",
      access_level: "viewer",
      status: "approved",
      expires_at: inDays(10),
      granted: false,
      authorized_modules: ["documents_evidence"],
      reason: `${MARKER} Delegação restrita ao módulo de documentos.`,
    },
    {
      key: "onboarding_tenant_gama",
      customer: "tenant_gama",
      assignment_type: "onboarding",
      access_level: "viewer",
      status: "approved",
      granted: false,
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
    const match = existing.find((a: any) => (a.reason || "").startsWith(MARKER) && a.access_level === scenario.access_level);
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
      authorized_modules: scenario.authorized_modules || [],
      status: scenario.status,
      is_legacy: false,
      expires_at: scenario.expires_at || "",
      requested_by: user.email || "",
      approved_by: scenario.status === "approved" ? user.email || "" : "",
      assigned_by: user.email || "",
      reason: scenario.reason,
    });
    summary.created[`assignment:${scenario.key}`] = created.id;
    result[scenario.key] = created.id;

    if (scenario.granted) {
      const target = await base44.asServiceRole.entities.User.get(user.id);
      if (target) {
        const field = scenario.access_level === "viewer" ? "delegated_view_customer_ids" : "delegated_edit_customer_ids";
        await base44.asServiceRole.entities.User.update(target.id, {
          [field]: addToArray(target[field], customer.id),
        });
      }
    }
  }
  return result;
}
