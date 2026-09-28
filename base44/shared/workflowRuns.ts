import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

/**
 * Registo das execuções de automação (FB4).
 *
 * O painel de automações e conservação precisa de saber quando cada workflow
 * correu, quanto demorou e se falhou. Em vez de cada função repetir esse código,
 * o corpo de cada automação é envolvido por `withWorkflowRun`, que mede a
 * execução e escreve uma linha em `WorkflowRun`.
 *
 * Regras:
 *  - O envelope é transparente: devolve exactamente a resposta do handler.
 *  - Uma execução que responde `{ skipped: ... }` (evento que não se aplica) não
 *    é registada — o histórico só mostra execuções com trabalho efectivo.
 *  - O registo nunca altera o resultado da automação: se a escrita falhar, o
 *    erro é engolido e a resposta segue igual.
 */

/** Resumo curto e legível do corpo devolvido pela automação. */
function summarize(body: any): string {
  if (!body || typeof body !== "object") return "";
  const parts: string[] = [];
  for (const [key, value] of Object.entries(body)) {
    if (value === null || value === undefined) continue;
    if (typeof value === "number") parts.push(`${key}: ${value}`);
    else if (typeof value === "string" && value.length <= 60) parts.push(`${key}: ${value}`);
    else if (Array.isArray(value)) parts.push(`${key}: ${value.length}`);
  }
  return parts.slice(0, 6).join(" · ");
}

export async function withWorkflowRun(
  workflowName: string,
  triggerType: string,
  req: Request,
  handler: () => Promise<Response>,
): Promise<Response> {
  const startedMs = Date.now();
  let status = "success";
  let error: string | null = null;
  let summary = "";
  let shouldRecord = true;

  try {
    const response = await handler();
    if (!response.ok) {
      status = "failed";
      error = `HTTP ${response.status}`;
    }
    try {
      const body = await response.clone().json();
      if (body && typeof body === "object") {
        if ("skipped" in body) {
          shouldRecord = false;
        } else {
          if (typeof body.error === "string" && body.error) {
            status = "failed";
            error = body.error;
          }
          summary = summarize(body);
        }
      }
    } catch {
      // Sem corpo JSON — regista a execução sem resumo.
    }
    return response;
  } catch (e) {
    status = "failed";
    error = String((e as any)?.message || e);
    throw e;
  } finally {
    if (shouldRecord) {
      try {
        const base44 = createClientFromRequest(req);
        const finishedMs = Date.now();
        await base44.asServiceRole.entities.WorkflowRun.create({
          workflow_name: workflowName,
          trigger_type: triggerType,
          status,
          started_at: new Date(startedMs).toISOString(),
          finished_at: new Date(finishedMs).toISOString(),
          duration_ms: finishedMs - startedMs,
          error,
          summary,
        });
      } catch {
        // O registo é observabilidade: nunca pode derrubar a automação.
      }
    }
  }
}
