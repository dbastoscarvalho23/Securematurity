import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { normalizeRole, isPlatformOwner } from "../../shared/accessUtils.ts";
import { resolveActor } from "../../shared/devActor.ts";

/**
 * managePlatformOperations — operação das automações e da conservação (FB4).
 *
 * O master_admin não tinha visibilidade nem configuração das automações: os
 * workflows corriam (ou não) sem registo consultável e os prazos de conservação
 * viviam apenas no código. Esta função é a única porta para:
 *
 *   - `overview`    — última execução, duração, estado e erro de cada workflow
 *                     (a partir de `WorkflowRun`, escrito por `withWorkflowRun`)
 *                     e as políticas de conservação existentes;
 *   - `set_policy`  — cria/actualiza uma política por entidade e tenant;
 *   - `simulate`    — simulação (dry-run): diz que registos a política afectaria,
 *                     sem apagar nem arquivar nada.
 *
 * Toda a escrita passa por aqui (verificação de master_admin + auditoria); as
 * páginas nunca escrevem `RetentionPolicy`.
 */

const WORKFLOWS = [
  { name: "dataRetentionPurge", label_key: "ops_wf_retention", trigger: "scheduled", cron: "0 2 * * *" },
  { name: "documentReviewReminders", label_key: "ops_wf_doc_review", trigger: "scheduled", cron: null },
  { name: "riskDueDateReminders", label_key: "ops_wf_risk_due", trigger: "scheduled", cron: null },
  { name: "generateMonthlyAnnualReport", label_key: "ops_wf_monthly_report", trigger: "scheduled", cron: null },
  { name: "documentNotifications", label_key: "ops_wf_doc_notify", trigger: "event", cron: null },
  { name: "riskNotifications", label_key: "ops_wf_risk_notify", trigger: "event", cron: null },
  { name: "taskNotifications", label_key: "ops_wf_task_notify", trigger: "event", cron: null },
  { name: "createNotifications", label_key: "ops_wf_inapp_notify", trigger: "event", cron: null },
];

const RETENTION_ENTITIES = {
  DataProcessingActivity: {
    // Campo de data de entrada do registo, usado pela simulação.
    date_field: "created_date",
    label: "RoPA — actividades de tratamento",
    actions: ["purge", "archive", "anonymise"],
  },
  DataSubjectRequest: {
    date_field: "created_date",
    label: "DSR — pedidos de titulares",
    // O pedido de titular só tem eliminação: o estado da entidade não prevê arquivo.
    actions: ["purge"],
  },
};

const MAX_RUNS_PER_WORKFLOW = 5;
const MAX_SIMULATED = 50;

/** Data de entrada de um registo, tolerando a ausência do campo. */
function recordDate(record: any, field: string): string | null {
  return record?.[field] || record?.created_date || record?.updated_date || null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await resolveActor(base44, req);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const role = normalizeRole(user.role);
    if (!isPlatformOwner(role)) return Response.json({ error: "Forbidden" }, { status: 403 });

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = body.action || "overview";

    // ── overview ──────────────────────────────────────────────────────
    if (action === "overview") {
      const runs = await base44.asServiceRole.entities.WorkflowRun.list("-started_at", 500);
      const byWorkflow: Record<string, any> = {};
      for (const run of runs) {
        const name = run.workflow_name;
        if (!byWorkflow[name]) byWorkflow[name] = { last_run: run, recent: [] };
        if (byWorkflow[name].recent.length < MAX_RUNS_PER_WORKFLOW) byWorkflow[name].recent.push(run);
      }

      const policies = await base44.asServiceRole.entities.RetentionPolicy.list("-updated_date", 200);

      return Response.json({
        workflows: WORKFLOWS.map((workflow) => ({
          ...workflow,
          last_run: byWorkflow[workflow.name]?.last_run || null,
          recent: byWorkflow[workflow.name]?.recent || [],
        })),
        policies,
        entities: Object.entries(RETENTION_ENTITIES).map(([name, meta]) => ({ name, ...meta })),
      });
    }

    // ── set_policy ────────────────────────────────────────────────────
    if (action === "set_policy") {
      const policy = body.policy || {};
      const entityName = policy.entity_name;
      if (!RETENTION_ENTITIES[entityName]) {
        return Response.json({ error: "unsupported_entity" }, { status: 422 });
      }
      const days = Number(policy.retention_days);
      if (!Number.isFinite(days) || days <= 0) {
        return Response.json({ error: "invalid_retention_days" }, { status: 422 });
      }
      const action_code = ["purge", "archive", "anonymise"].includes(policy.action) ? policy.action : "purge";
      if (!RETENTION_ENTITIES[entityName].actions.includes(action_code)) {
        return Response.json({ error: "unsupported_action_for_entity" }, { status: 422 });
      }
      const customerId = policy.customer_id || null;

      const existing = (await base44.asServiceRole.entities.RetentionPolicy.filter({
        entity_name: entityName,
      })).find((p: any) => (p.customer_id || null) === customerId);

      const payload: Record<string, any> = {
        entity_name: entityName,
        retention_days: days,
        action: action_code,
        is_active: policy.is_active !== false,
        notes: policy.notes || "",
        updated_by: user.email || user.id || "unknown",
      };
      // A política de todos os tenants fica sem a chave: `AuditLog.customer_id` é
      // string simples e o emulador local recusa `null` em ambos os campos.
      if (customerId) {
        payload.customer_id = customerId;
        payload.customer_name = policy.customer_name || "";
      }

      const saved = existing
        ? await base44.asServiceRole.entities.RetentionPolicy.update(existing.id, payload)
        : await base44.asServiceRole.entities.RetentionPolicy.create(payload);

      const auditEntry: Record<string, any> = {
        action: existing ? "retention_policy_updated" : "retention_policy_created",
        user_email: user.email || "unknown",
        entity_type: "RetentionPolicy",
        entity_id: saved?.id,
        details: `Retention policy ${entityName} = ${days} days (${action_code})${customerId ? ` for tenant ${customerId}` : " for all tenants"}`,
      };
      if (customerId) auditEntry.customer_id = customerId;
      await base44.asServiceRole.entities.AuditLog.create(auditEntry);

      return Response.json({ policy: saved });
    }

    // ── simulate (dry run) ────────────────────────────────────────────
    if (action === "simulate") {
      const policy = body.policy || {};
      const entityName = policy.entity_name;
      const meta = RETENTION_ENTITIES[entityName];
      if (!meta) return Response.json({ error: "unsupported_entity" }, { status: 422 });

      const days = Number(policy.retention_days);
      if (!Number.isFinite(days) || days <= 0) {
        return Response.json({ error: "invalid_retention_days" }, { status: 422 });
      }

      const records = await base44.asServiceRole.entities[entityName].list("-created_date", 2000);
      const scoped = policy.customer_id
        ? records.filter((r: any) => r.customer_id === policy.customer_id)
        : records;

      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      const affected = scoped.filter((r: any) => {
        const date = recordDate(r, meta.date_field);
        return date ? new Date(date).getTime() <= cutoff : false;
      });

      return Response.json({
        entity_name: entityName,
        scanned: scoped.length,
        affected_count: affected.length,
        cutoff: new Date(cutoff).toISOString(),
        action: policy.action || "purge",
        sample: affected.slice(0, MAX_SIMULATED).map((r: any) => ({
          id: r.id,
          label: r.activity_name || r.request_id || r.data_subject_name || r.id,
          date: recordDate(r, meta.date_field),
          customer_name: r.customer_name || "",
        })),
      });
    }

    return Response.json({ error: "unknown_action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
