import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { json, readJson, getAuthenticatedUser, userCustomerId } from '../../shared/http.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await getAuthenticatedUser(base44);
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const { query, customer_id } = await readJson(req);
    if (!query?.trim()) return json({ results: [] });

    // Fetch all documents (filtered by customer if provided). A non-admin can
    // only search within their own customer; admins may pass any customer_id.
    const effectiveCustomerId = user.role === 'admin'
      ? (customer_id || null)
      : userCustomerId(user);
    let docs;
    if (effectiveCustomerId) {
      docs = await base44.entities.SecurityDocument.filter({ customer_id: effectiveCustomerId });
    } else {
      docs = await base44.entities.SecurityDocument.list('-created_date', 500);
    }

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

Search query: "${query}"

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

    const matchIds = (result.matches || [])
      .filter(m => m.relevance_score >= 30)
      .sort((a, b) => b.relevance_score - a.relevance_score);

    const enriched = matchIds.map(m => {
      const doc = docs.find(d => d.id === m.id);
      return doc ? { ...doc, relevance_score: m.relevance_score, match_reason: m.reason } : null;
    }).filter(Boolean);

    return json({ results: enriched });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
});