// Motor de workflows: executa base44/workflows/*.jsonc (agendados e desencadeados por entidades).
import path from 'node:path';
import { config } from '../config.js';
import { query } from '../db.js';
import { bus } from '../events.js';
import { readJsoncDir, HttpError } from '../util.js';
import { invokeFunction } from '../functions/runtime.js';
import { requireRole } from '../auth/routes.js';
import { parseCron, cronMatches } from './cron.js';
import { evaluateJq, jqTruthy } from './jq-lite.js';

let workflows = [];

export function loadWorkflows() {
  workflows = readJsoncDir(path.join(config.base44Dir, 'workflows')).map(({ file, data }) => {
    const trig = data.trigger?.config || {};
    const wf = { file, name: data.name || file, trigger: trig, condition: data.trigger?.condition || null, steps: data.definition?.do || [], enabled: data.enabled !== false };
    if (trig.trigger_type === 'scheduled' && trig.schedule_mode !== 'one_time' && trig.cron_expression) {
      try { wf.cron = parseCron(trig.cron_expression); } catch (err) { console.error(`[workflows] ${wf.name}: ${err.message}`); wf.enabled = false; }
    }
    return wf;
  });
  console.log(`[workflows] ${workflows.length} workflows carregados`);
  return workflows;
}

function changedFields(oldData, newData) {
  if (!oldData || !newData) return Object.keys(newData || oldData || {});
  const keys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
  return [...keys].filter((k) => !['updated_date'].includes(k) && JSON.stringify(oldData[k]) !== JSON.stringify(newData[k]));
}

/** Substitui o segredo de automação (fixo nos ficheiros) pelo valor configurado no servidor. */
function resolveArgs(args) {
  const out = { ...(args || {}) };
  if ('automation_secret' in out) out.automation_secret = config.automationSecret;
  return out;
}

async function runSteps(wf, payloadBase) {
  const results = [];
  for (const step of wf.steps) {
    for (const [stepName, def] of Object.entries(step)) {
      if (def?.call !== 'invoke_backend_function') {
        results.push({ step: stepName, skipped: `tipo de passo não suportado: ${def?.call}` });
        continue;
      }
      const fnName = def.with?.function_name;
      const args = resolveArgs(def.with?.args);
      const res = await invokeFunction(fnName, { ...payloadBase, args });
      results.push({ step: stepName, function: fnName, status: res.status, data: res.data });
      if (res.status >= 400) throw Object.assign(new Error(`Função ${fnName} devolveu ${res.status}`), { results });
      if (def.then === 'end') return results;
    }
  }
  return results;
}

async function recordRun(wf, triggerKey, fn) {
  let runId = null;
  const { rows } = await query(
    `INSERT INTO workflow_runs (workflow, trigger_key, status) VALUES ($1, $2, 'running')
     ON CONFLICT (workflow, trigger_key) WHERE trigger_key IS NOT NULL DO NOTHING RETURNING id`,
    [wf.name, triggerKey],
  );
  if (!rows[0]) return null; // outra instância já tratou este disparo
  runId = rows[0].id;
  try {
    const results = await fn();
    await query(`UPDATE workflow_runs SET status = 'success', detail = $2, finished_date = now() WHERE id = $1`, [runId, JSON.stringify(results).slice(0, 100000)]);
    return results;
  } catch (err) {
    console.error(`[workflows] ${wf.name} falhou:`, err.message);
    await query(`UPDATE workflow_runs SET status = 'error', detail = $2, finished_date = now() WHERE id = $1`,
      [runId, JSON.stringify({ error: err.message, results: err.results || null }).slice(0, 100000)]);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Gatilhos por entidade
// ---------------------------------------------------------------------------

function onEntityEvent(event) {
  for (const wf of workflows) {
    const t = wf.trigger;
    if (!wf.enabled || t.trigger_type !== 'entity' || t.entity_name !== event.entity) continue;
    if (Array.isArray(t.events) && t.events.length && !t.events.includes(event.type)) continue;
    const changed = event.type === 'update' ? changedFields(event.old_data, event.data) : Object.keys(event.data || {});
    if (event.type === 'update' && changed.length === 0) continue;
    const trigger = { type: event.type, entity_name: event.entity, entity_id: event.id, data: event.data, old_data: event.old_data, changed_fields: changed };
    if (wf.condition) {
      let ok = false;
      try { ok = jqTruthy(evaluateJq(wf.condition, { trigger, event: trigger, data: event.data, old_data: event.old_data })); }
      catch (err) { console.error(`[workflows] condição inválida em ${wf.name}: ${err.message}`); }
      if (!ok) continue;
    }
    const key = `entity:${event.entity}:${event.id}:${event.type}:${event.data?.updated_date || Date.now()}:${process.hrtime.bigint()}`;
    recordRun(wf, key, () => runSteps(wf, {
      event: { type: event.type, entity_name: event.entity, entity_id: event.id },
      data: event.data, old_data: event.old_data, changed_fields: changed,
    })).catch((err) => console.error(`[workflows] ${wf.name}:`, err.message));
  }
}

// ---------------------------------------------------------------------------
// Agendamentos
// ---------------------------------------------------------------------------

function scheduledDue(wf, minuteDate) {
  const t = wf.trigger;
  if (t.ends_type === 'on_date' && t.ends_on_date && minuteDate > new Date(t.ends_on_date)) return false;
  if (t.schedule_mode === 'one_time') {
    if (!t.one_time_date) return false;
    const at = new Date(t.one_time_date);
    return Math.floor(at.getTime() / 60000) === Math.floor(minuteDate.getTime() / 60000);
  }
  if (wf.cron) return cronMatches(wf.cron, minuteDate, t.timezone || 'UTC');
  if (t.interval_value && t.interval_unit) {
    const unitMs = { minutes: 60e3, minute: 60e3, hours: 3600e3, hour: 3600e3, days: 86400e3, day: 86400e3, weeks: 604800e3, week: 604800e3 }[t.interval_unit];
    if (!unitMs) return false;
    const anchor = t.interval_anchor ? new Date(t.interval_anchor).getTime() : 0;
    const elapsed = minuteDate.getTime() - anchor;
    return elapsed >= 0 && Math.floor(elapsed / 60000) % Math.round((t.interval_value * unitMs) / 60000) === 0;
  }
  return false;
}

function tick() {
  const minute = new Date(Math.floor(Date.now() / 60000) * 60000);
  for (const wf of workflows) {
    if (!wf.enabled || wf.trigger.trigger_type !== 'scheduled') continue;
    if (!scheduledDue(wf, minute)) continue;
    recordRun(wf, `schedule:${minute.toISOString()}`, () => runSteps(wf, {}))
      .catch((err) => console.error(`[workflows] ${wf.name}:`, err.message));
  }
}

export function startWorkflows() {
  loadWorkflows();
  bus.on('entity', onEntityEvent);
  if (!config.enableScheduler) { console.log('[workflows] agendador desativado (ENABLE_SCHEDULER=false)'); return; }
  const scheduleNext = () => {
    const delay = 60000 - (Date.now() % 60000) + 500;
    setTimeout(() => { tick(); scheduleNext(); }, delay).unref();
  };
  scheduleNext();
}

export function registerWorkflowRoutes(router) {
  router.get('/workflows', async (ctx) => {
    requireRole(ctx, ['admin']);
    const { rows } = await query(
      `SELECT DISTINCT ON (workflow) workflow, status, created_date, finished_date FROM workflow_runs ORDER BY workflow, created_date DESC`,
    );
    const last = new Map(rows.map((r) => [r.workflow, r]));
    return workflows.map((wf) => ({
      name: wf.name, enabled: wf.enabled, trigger_type: wf.trigger.trigger_type,
      cron: wf.trigger.cron_expression || null, entity: wf.trigger.entity_name || null, events: wf.trigger.events || [],
      last_run: last.get(wf.name) || null,
    }));
  });

  router.get('/workflows/runs', async (ctx) => {
    requireRole(ctx, ['admin']);
    const { rows } = await query('SELECT * FROM workflow_runs ORDER BY created_date DESC LIMIT 200');
    return rows;
  });

  router.post('/workflows/:name/run', async (ctx) => {
    requireRole(ctx, ['admin']);
    const wf = workflows.find((w) => w.name === ctx.params.name);
    if (!wf) throw new HttpError(404, 'Workflow desconhecido');
    if (wf.trigger.trigger_type !== 'scheduled') throw new HttpError(400, 'Só workflows agendados podem ser executados manualmente');
    const results = await recordRun(wf, `manual:${Date.now()}`, () => runSteps(wf, {}));
    return { success: Boolean(results), results };
  });
}
