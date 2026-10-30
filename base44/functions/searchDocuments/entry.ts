import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { json, readJson, getAuthenticatedUser, isPlatformAdmin, userCustomerId } from '../../shared/http.ts';
import { getEntitlements, checkQuota, consumeQuota, LicenseError } from '../../shared/license.ts';

// Limites: o pedido é enviado ao modelo, por isso o tamanho tem de ser previsível.
const MAX_DOCS = 200;
const MAX_QUERY = 300;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await getAuthenticatedUser(base44);
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const body = await readJson(req);
    const query = String(body.query || '').trim().slice(0, MAX_QUERY);
    if (!query) return json({ results: [] });

    // Isolamento por cliente: um utilizador de cliente pesquisa sempre e apenas o próprio cliente — sem cliente
    // associado não pesquisa nada. Só o administrador da plataforma pode indicar um cliente ou pesquisar em todos.
    const admin = isPlatformAdmin(user);
    const customerId = admin ? (String(body.customer_id || '') || null) : String(userCustomerId(user) || '');
    if (!customerId && !admin) return json({ error: 'Sem cliente associado' }, 403);

    // Cada pesquisa é um pedido de IA: conta para a quota «ai» do cliente (sem limite no regime legacy).
    let quota = null;
    if (customerId) {
      quota = (await getEntitlements(base44, customerId)).ai_quota_monthly;
      await checkQuota(base44, customerId, 'ai', quota);
    }

    const docs = customerId
      ? await base44.entities.SecurityDocument.filter({ customer_id: customerId }, '-created_date', MAX_DOCS)
      : await base44.entities.SecurityDocument.list('-created_date', MAX_DOCS);

    // Use LLM to search across document metadata (title, description, tags, framework_codes)
    // For actual file content search we use metadata — full binary parsing is not possible server-side here
    const docsContext = docs.map(d => ({
      id: d.id,
      title: d.title,
      level: d.level,
      description: d.description || '',
      tags: (d.tags || []).join(', '),
      framework_codes: (d.framework_codes || []).join(', '),
      status: d.status,
      file_name: d.file_name || '',
      version: d.version || '',
      approved_by: d.approved_by || '',
    }));

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are a document search assistant. Given a search query and a list of security documents, return the IDs of documents most relevant to the query. Consider the title, description, tags, framework codes, and file name. Return a JSON object with a "matches" array of objects: { id, relevance_score (0-100), reason }.

Search query: ${JSON.stringify(query)}

Documents:
${JSON.stringify(docsContext, null, 2)}`,
      response_json_schema: {
        type: 'object',
        properties: {
          matches: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                relevance_score: { type: 'number' },
                reason: { type: 'string' },
              },
            },
          },
        },
      },
    });

    // Conta a pesquisa na quota só depois de haver resposta do modelo.
    if (customerId) await consumeQuota(base44, customerId, 'ai', quota);

    const matchIds = (result.matches || [])
      .filter(m => m.relevance_score >= 30)
      .sort((a, b) => b.relevance_score - a.relevance_score);

    const enriched = matchIds.map(m => {
      const doc = docs.find(d => d.id === m.id);
      return doc ? { ...doc, relevance_score: m.relevance_score, match_reason: m.reason } : null;
    }).filter(Boolean);

    return json({ results: enriched });
  } catch (error) {
    return json({ error: error.message }, error instanceof LicenseError ? error.status : 500);
  }
});