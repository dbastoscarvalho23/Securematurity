import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { normalizeRole, isPlatformOwner } from "../../shared/accessUtils.ts";
import { resolveActor } from "../../shared/devActor.ts";
import { guardRateLimit } from "../../shared/rateLimit.ts";

/**
 * extractQuestionBank — extrai uma base de perguntas de um documento (PDF/DOCX).
 *
 * Uma base de perguntas chega muitas vezes como documento (norma, guia, anexo
 * de concurso) e não como folha de cálculo. Esta função é a única peça que
 * depende de IA na importação: recebe o URL do documento já carregado no
 * armazenamento da aplicação, devolve o MESMO pacote normalizado que os
 * ficheiros JSON/Excel produzem (`{ framework, controls, questions }`) e nada
 * mais — a classificação, a revisão e a publicação continuam a passar por
 * `manageQuestionImport`. O modelo não decide nada sobre o catálogo e o
 * resultado nunca é publicado sem revisão humana.
 *
 * Só o dono da plataforma pode extrair (é ele que gere o catálogo partilhado).
 */

const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    framework: {
      type: "object",
      properties: {
        code: { type: "string" },
        name: { type: "string" },
        version: { type: "string" },
      },
    },
    controls: {
      type: "array",
      items: {
        type: "object",
        properties: {
          control_id: { type: "string" },
          domain: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          maturity_levels: {
            type: "array",
            items: {
              type: "object",
              properties: {
                level: { type: "number" },
                description: { type: "string" },
              },
            },
          },
        },
      },
    },
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          framework_code: { type: "string" },
          control_id: { type: "string" },
          domain: { type: "string" },
          domain_pt: { type: "string" },
          question_text: { type: "string" },
          question_text_pt: { type: "string" },
          guidance: { type: "string" },
          guidance_pt: { type: "string" },
          answer_type: { type: "string" },
          weight: { type: "number" },
          order_index: { type: "number" },
        },
      },
    },
  },
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await resolveActor(base44, req);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    // OP-S2 — caminho de IA: extrair um documento inteiro é trabalho longo e caro.
    const limited = guardRateLimit(user, "ai_extract", req);
    if (limited) return limited;

    const role = normalizeRole(user.role);
    if (!isPlatformOwner(role)) return Response.json({ error: "Forbidden" }, { status: 403 });

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const fileUrls = Array.isArray(body.file_urls) ? body.file_urls.filter(Boolean) : [];
    if (fileUrls.length === 0) return Response.json({ error: "missing_file" }, { status: 422 });

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are extracting a cybersecurity assessment question bank from an attached document (standard, framework guide or questionnaire annex).

Extract ONLY what the document actually contains. Never invent questions, controls or translations.

Rules:
- Identify the framework (code, name and version) when the document states it; use a short code such as "NIS2", "ISO27001", "NIST_CSF", "CIS_V8", "QNRC" or "ENISA".
- List every requirement/control you find with its identifier (control_id), its domain, title and — when the document gives them — the maturity level descriptions (levels 1 to 5).
- List every assessment question with: framework_code, control_id, domain, question_text, guidance (help text for the assessor) and weight (1 to 5; omit when the document gives no weighting).
- Keep the original language in question_text/domain/guidance. Fill question_text_pt/domain_pt/guidance_pt ONLY when the document itself contains a Portuguese version; leave them empty otherwise.
- answer_type is one of "maturity_scale", "yes_no" or "multiple_choice" — default to "maturity_scale".
- Preserve the document's order in order_index.`,
      file_urls: fileUrls,
      response_json_schema: EXTRACTION_SCHEMA,
    });

    const bundle = {
      framework: result?.framework || null,
      controls: result?.controls || [],
      questions: result?.questions || [],
    };

    return Response.json({
      bundle,
      counts: { controls: bundle.controls.length, questions: bundle.questions.length },
    });
  } catch (error) {
    return Response.json({ error: error?.message || "extraction_failed" }, { status: 500 });
  }
});
