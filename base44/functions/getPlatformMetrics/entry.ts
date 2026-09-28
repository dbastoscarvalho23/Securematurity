import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { normalizeRole } from "../../shared/accessUtils.ts";

/**
 * Cross-tenant platform metrics — master_admin only.
 * Single data source for the /system-status page.
 */

const ENTITY_MAP = {
  assessment: "Assessment",
  task: "Task",
  risk: "RiskItem",
  security_document: "SecurityDocument",
  customer: "Customer",
  user: "User",
  nomination: "NominationDocument",
  incident: "Incident",
  vulnerability: "Vulnerability",
  supplier: "Supplier",
  training_user: "TrainingUser",
  knowledge_article: "KnowledgeArticle",
  assessment_response: "AssessmentResponse",
};

const DAY_MS = 24 * 60 * 60 * 1000;
const ESTIMATED_DOC_BYTES = 500 * 1024;

/** Local-date key (YYYY-MM-DD) for a date value. */
const dayKey = (value: string | Date) => {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (normalizeRole(user.role) !== "master_admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const svc = base44.asServiceRole;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const since7 = new Date(now.getTime() - 7 * DAY_MS);
    const since30 = new Date(now.getTime() - 30 * DAY_MS);

    const dayKeys: string[] = [];
    for (let i = 29; i >= 0; i--) {
      dayKeys.push(dayKey(new Date(startOfToday.getTime() - i * DAY_MS)));
    }

    const logs = await svc.entities.AuditLog.list("-created_date", 2000);
    const since = (log, from) => !!log?.created_date && new Date(log.created_date) >= from;

    const logins30 = logs.filter((l) => l.action === "user_login" && since(l, since30));
    const logins7 = logins30.filter((l) => since(l, since7));
    const distinctUsers = (rows) => new Set(rows.map((l) => l.user_email).filter(Boolean)).size;

    const usersByDay = new Map(dayKeys.map((d) => [d, new Set<string>()]));
    const eventsByDay = new Map(dayKeys.map((d) => [d, 0]));
    for (const log of logs) {
      const key = dayKey(log.created_date);
      if (!eventsByDay.has(key)) continue;
      eventsByDay.set(key, (eventsByDay.get(key) || 0) + 1);
      if (log.action === "user_login" && log.user_email) usersByDay.get(key)?.add(log.user_email);
    }

    const daysWithActivity = dayKeys.filter((d) => (eventsByDay.get(d) || 0) > 0).length;
    const uptimePercentage = Math.min(99.99, Math.round((daysWithActivity / 30) * 99.5 * 100) / 100);

    // One listing per entity — reused for the storage estimate.
    const keys = Object.keys(ENTITY_MAP);
    const listings = await Promise.all(
      keys.map((k) => svc.entities[ENTITY_MAP[k]].list("-created_date", 5000).catch(() => [])),
    );
    const byKey = Object.fromEntries(keys.map((k, i) => [k, listings[i]]));
    const entityCounts = Object.fromEntries(keys.map((k) => [k, byKey[k].length]));

    const storageByEntity = {};
    const addStorage = (entity, bytes) => {
      storageByEntity[entity] = (storageByEntity[entity] || 0) + bytes;
    };
    const sumAttachments = (entity, rows) => {
      for (const row of rows) {
        for (const file of row?.attachments || []) addStorage(entity, file?.size || 0);
      }
    };
    sumAttachments("assessment_response", byKey.assessment_response);
    sumAttachments("task", byKey.task);
    for (const doc of byKey.security_document) {
      if (doc?.file_url) addStorage("security_document", ESTIMATED_DOC_BYTES);
    }
    for (const doc of byKey.nomination) {
      if (doc?.file_url) addStorage("nomination", ESTIMATED_DOC_BYTES);
    }

    const totalBytes = Object.values(storageByEntity).reduce((a: number, b) => a + (b as number), 0);

    return Response.json({
      activeUsers: {
        days7: distinctUsers(logins7),
        days30: distinctUsers(logins30),
        trend: dayKeys.map((d) => ({ date: d, count: usersByDay.get(d)?.size || 0 })),
      },
      auditEvents: {
        today: logs.filter((l) => since(l, startOfToday)).length,
        days30: logs.filter((l) => since(l, since30)).length,
        trend: dayKeys.map((d) => ({ date: d, count: eventsByDay.get(d) || 0 })),
      },
      failedLogins: {
        days30: logs.filter((l) => l.action === "login_failed" && since(l, since30)).length,
      },
      entityCounts,
      storageEstimated: {
        totalBytes,
        totalMB: Math.round((totalBytes / (1024 * 1024)) * 10) / 10,
        byEntity: Object.entries(storageByEntity).map(([entity, bytes]) => ({ entity, bytes })),
      },
      uptimeEstimated: {
        percentage: uptimePercentage,
        daysWithActivity,
        label: uptimePercentage >= 99 ? "Healthy" : uptimePercentage >= 90 ? "Stable" : "Limited data",
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
