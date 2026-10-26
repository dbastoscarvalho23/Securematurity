import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { json, readJson, getAuthenticatedUser, isPlatformAdmin, userCustomerId } from '../../shared/http.ts';
import { logAudit } from '../../shared/audit.ts';
import { requireModule, getEntitlements, checkQuota, consumeQuota, LicenseError } from '../../shared/license.ts';
import { assertAiRateLimit } from '../../shared/rateLimit.ts';
import { callLLM, parseJson, getAiSettings, aiPurposeEnabled, aiProvider, AI_DISABLED_MESSAGE } from '../../shared/llm.ts';
import { containsExposedAsset } from '../../shared/exposedAssets.ts';

/**
 * Pedidos de IA feitos a partir da interface (módulo «ai_assistant»).
 * O browser nunca chama o modelo diretamente: tudo passa por aqui, com autenticação, licença, quota «ai»,
 * auditoria e a regra de que a lista de ativos do art. 32.º (Reg. 756/2026) nunca é enviada à IA.
 *
 * Corpo: { purpose, prompt, schema, customer_id?, file_urls? }
 * Resposta: { result, provider, model } — `result` é o objeto JSON que respeita `schema`.
 * Só o administrador da plataforma pode indicar customer_id; os restantes utilizadores agem sempre sobre o seu cliente.
 */

// Uma chave por ponto de chamada na interface. Cada uma pode ser ligada ou desligada em AiSettings (shared/llm.ts).
const PURPOSES = new Set([
  'assessment_question_selection', // AssessmentWizardAI: escolher perguntas do banco para uma avaliação
  'assessment_recommendations', // AssessmentDetail: recomendações ao concluir uma avaliação
  'question_gap_analysis', // AIQuestionGeneratorDialog: perguntas novas para lacunas do banco
  'question_bank_translation', // QuestionBank: traduzir perguntas para PT-PT
  'recommendation_generation', // AIRecommendationDialog: recomendações por referencial
  'recommendation_translation', // ActionPlan: traduzir recomendações para PT-PT
  'supplier_questionnaire_generation', // QuestionnaireDetail: gerar perguntas para fornecedores
  'supplier_questionnaire_translation', // QuestionnaireDetail: traduzir perguntas para fornecedores
  'supplier_email_answer_extraction', // EmailAnswerImportDialog: extrair respostas de um email do fornecedor
]);

const MAX_PROMPT = 60000;
const MAX_FILES = 5;

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await getAuthenticatedUser(base44);
    if (!user) return json({ error: 'Sessão inválida. Entre novamente.' }, 401);
    const admin = isPlatformAdmin(user);
    const body = await readJson(req);

    const purpose = String(body.purpose || '');
    if (!PURPOSES.has(purpose)) return json({ error: 'Pedido de IA não reconhecido' }, 400);
    if (!aiPurposeEnabled(await getAiSettings(base44), purpose)) return json({ error: AI_DISABLED_MESSAGE }, 403);
    const prompt = typeof body.prompt === 'string' ? body.prompt : '';
    if (!prompt.trim()) return json({ error: 'Pedido de IA vazio' }, 400);
    if (prompt.length > MAX_PROMPT) return json({ error: `O pedido de IA é demasiado longo (máximo de ${MAX_PROMPT} caracteres). Reduza o âmbito.` }, 400);
    const schema = body.schema;
    if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return json({ error: 'Esquema de resposta inválido' }, 400);
    const fileUrls = body.file_urls == null ? [] : body.file_urls;
    if (!Array.isArray(fileUrls) || fileUrls.length > MAX_FILES) return json({ error: `Pode enviar no máximo ${MAX_FILES} ficheiros` }, 400);
    for (const u of fileUrls) {
      let ok = false;
      try { ok = new URL(String(u)).protocol === 'https:'; } catch { ok = false; }
      if (!ok) return json({ error: 'Os ficheiros têm de ser indicados por um endereço https' }, 400);
    }

    // Cliente: o admin pode indicar qualquer um (ou nenhum, em trabalho global); os outros, só o seu.
    const own = userCustomerId(user);
    const customerId = admin ? String(body.customer_id || '') : String(own || '');
    if (!admin && !customerId) return json({ error: 'Sem cliente associado' }, 403);
    if (admin && customerId && !(await base44.asServiceRole.entities.Customer.get(customerId).catch(() => null))) return json({ error: 'Cliente inexistente' }, 404);
    if (customerId) await requireModule(base44, user, customerId, 'ai_assistant');

    if (await containsExposedAsset(base44, customerId, prompt)) {
      await logAudit(base44, 'ai_assist_refused', { user_email: user.email, customer_id: customerId || undefined, details: `IA recusada (${purpose}): o pedido contém dados de ativos expostos à Internet` });
      return json({ error: 'O pedido contém endereços de ativos expostos à Internet (lista do art. 32.º do Reg. 756/2026), que não podem ser enviados à IA. Retire esses dados e tente novamente.' }, 422);
    }

    // Rajada: a quota é mensal, por isso é o limite de ritmo que impede esgotá-la em segundos.
    await assertAiRateLimit(base44, user);

    if (customerId) {
      const ent = await getEntitlements(base44, customerId);
      await checkQuota(base44, customerId, 'ai', ent.ai_quota_monthly);
    }

    // Um ficheiro: segue a escolha de fornecedor de shared/llm.ts. Vários: só o LLM do Base44 os recebe (por URL).
    let out;
    if (fileUrls.length > 1 && (await aiProvider(base44)) === 'anthropic_only') {
      return json({ error: 'Com o motor «Só Claude» só é possível enviar um ficheiro por pedido.' }, 400);
    }
    if (fileUrls.length > 1) {
      const result = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt, response_json_schema: schema, file_urls: fileUrls });
      out = { result: typeof result === 'string' ? parseJson(result) : result, provider: 'base44', model: 'base44' };
    } else {
      const file = fileUrls.length === 1 ? { url: String(fileUrls[0]), mime: await mimeOf(String(fileUrls[0])) } : null;
      out = await callLLM(base44, prompt, schema, file);
    }

    // Só conta para a quota um pedido com resposta.
    if (customerId) await consumeQuota(base44, customerId, 'ai', null);
    await logAudit(base44, 'ai_assist', {
      user_email: user.email,
      customer_id: customerId || undefined,
      details: `IA (${out.provider}, ${out.model}): ${purpose}; pedido com ${prompt.length} caracteres${fileUrls.length ? `; ${fileUrls.length} ficheiro(s)` : ''}${out.fallback_reason ? '; Claude indisponível, usado o Base44' : ''}`,
    });
    return json({ result: out.result, provider: out.provider, model: out.model });
  } catch (error) {
    return json({ error: error?.message || 'Erro' }, error instanceof LicenseError ? error.status : 400);
  }
}

/** Tipo do ficheiro pelo cabeçalho da resposta (HEAD), para escolher como o enviar ao modelo. */
async function mimeOf(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'error' });
    return String(res.headers.get('content-type') || 'application/octet-stream').split(';')[0].trim().toLowerCase();
  } catch {
    return 'application/octet-stream';
  }
}