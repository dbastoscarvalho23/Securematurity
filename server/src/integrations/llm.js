// Modelos de linguagem: API da Anthropic ou qualquer API compatível com OpenAI (OpenAI, Azure, Ollama, vLLM…).
import { config } from '../config.js';
import { HttpError, isPlainObject } from '../util.js';
import { fetchFileUrl } from './storage.js';

const llm = config.llm;

export const llmConfigured = () => (llm.provider === 'anthropic' && Boolean(llm.anthropicApiKey))
  || (llm.provider === 'openai' && Boolean(llm.openaiApiKey || !llm.openaiBaseUrl.includes('api.openai.com')));

function assertConfigured() {
  if (!llmConfigured()) throw new HttpError(503, 'Nenhum modelo de IA configurado (defina LLM_PROVIDER e a respetiva chave de API).');
}

async function postJson(url, headers, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), llm.timeoutMs);
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body), signal: controller.signal });
    const text = await res.text();
    let json; try { json = JSON.parse(text); } catch { json = null; }
    if (!res.ok) throw new HttpError(502, `Erro do fornecedor de IA (${res.status}): ${json?.error?.message || text.slice(0, 400)}`);
    return json;
  } catch (err) {
    if (err.name === 'AbortError') throw new HttpError(504, 'O modelo de IA demorou demasiado a responder');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Conversa genérica com ferramentas (usada pelo agente e por InvokeLLM)
// Mensagens neutras: { role: 'user'|'assistant'|'tool', content, tool_calls?: [{id,name,arguments}], tool_call_id? }
// ---------------------------------------------------------------------------

function toAnthropicMessages(messages) {
  const out = [];
  for (const m of messages) {
    if (m.role === 'tool') {
      const block = { type: 'tool_result', tool_use_id: m.tool_call_id, content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) };
      const last = out[out.length - 1];
      if (last?.role === 'user' && Array.isArray(last.content) && last.content.every((b) => b.type === 'tool_result')) last.content.push(block);
      else out.push({ role: 'user', content: [block] });
    } else if (m.role === 'assistant') {
      const content = [];
      if (m.content) content.push({ type: 'text', text: m.content });
      for (const tc of m.tool_calls || []) content.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.arguments || {} });
      if (content.length) out.push({ role: 'assistant', content });
    } else {
      out.push({ role: 'user', content: m.content_blocks || m.content || '' });
    }
  }
  return out;
}

function toOpenAiMessages(system, messages) {
  const out = system ? [{ role: 'system', content: system }] : [];
  for (const m of messages) {
    if (m.role === 'tool') out.push({ role: 'tool', tool_call_id: m.tool_call_id, content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) });
    else if (m.role === 'assistant') {
      out.push({
        role: 'assistant',
        content: m.content || null,
        ...(m.tool_calls?.length ? { tool_calls: m.tool_calls.map((tc) => ({ id: tc.id, type: 'function', function: { name: tc.name, arguments: JSON.stringify(tc.arguments || {}) } })) } : {}),
      });
    } else out.push({ role: 'user', content: m.content_parts || m.content || '' });
  }
  return out;
}

/** Devolve { content, tool_calls: [{ id, name, arguments }] }. */
export async function chat({ system, messages, tools = [], toolChoice, maxTokens = llm.maxTokens, model, jsonMode = false }) {
  assertConfigured();
  if (llm.provider === 'anthropic') {
    const json = await postJson(`${llm.anthropicBaseUrl}/v1/messages`, {
      'x-api-key': llm.anthropicApiKey, 'anthropic-version': '2023-06-01',
    }, {
      model: model || llm.anthropicModel,
      max_tokens: maxTokens,
      ...(system ? { system } : {}),
      messages: toAnthropicMessages(messages),
      ...(tools.length ? { tools: tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema })) } : {}),
      ...(toolChoice ? { tool_choice: { type: 'tool', name: toolChoice } } : {}),
    });
    const text = (json.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
    const toolCalls = (json.content || []).filter((b) => b.type === 'tool_use').map((b) => ({ id: b.id, name: b.name, arguments: b.input || {} }));
    return { content: text, tool_calls: toolCalls, stop_reason: json.stop_reason };
  }

  const json = await postJson(`${llm.openaiBaseUrl}/chat/completions`, llm.openaiApiKey ? { Authorization: `Bearer ${llm.openaiApiKey}` } : {}, {
    model: model || llm.openaiModel,
    max_tokens: maxTokens,
    messages: toOpenAiMessages(system, messages),
    ...(tools.length ? { tools: tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.input_schema } })) } : {}),
    ...(toolChoice ? { tool_choice: { type: 'function', function: { name: toolChoice } } } : {}),
    ...(jsonMode && !tools.length ? { response_format: { type: 'json_object' } } : {}),
  });
  const msg = json.choices?.[0]?.message || {};
  const toolCalls = (msg.tool_calls || []).map((tc) => {
    let args = {};
    try { args = JSON.parse(tc.function?.arguments || '{}'); } catch { args = {}; }
    return { id: tc.id, name: tc.function?.name, arguments: args };
  });
  return { content: msg.content || '', tool_calls: toolCalls, stop_reason: json.choices?.[0]?.finish_reason };
}

// ---------------------------------------------------------------------------
// InvokeLLM (compatível com base44.integrations.Core.InvokeLLM)
// ---------------------------------------------------------------------------

function extractJson(text) {
  const trimmed = String(text || '').trim();
  try { return JSON.parse(trimmed); } catch { /* continuar */ }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) { try { return JSON.parse(fenced[1]); } catch { /* continuar */ } }
  const start = trimmed.search(/[[{]/);
  const end = Math.max(trimmed.lastIndexOf('}'), trimmed.lastIndexOf(']'));
  if (start >= 0 && end > start) { try { return JSON.parse(trimmed.slice(start, end + 1)); } catch { /* continuar */ } }
  throw new HttpError(502, 'O modelo de IA não devolveu JSON válido');
}

const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);

async function attachFiles(prompt, fileUrls) {
  if (!fileUrls?.length) return { text: prompt };
  const anthropicBlocks = [];
  const openaiParts = [];
  const notes = [];
  for (const url of fileUrls.slice(0, 10)) {
    try {
      const { buffer, contentType } = await fetchFileUrl(url);
      const type = contentType.split(';')[0].trim();
      const b64 = buffer.toString('base64');
      if (IMAGE_TYPES.has(type)) {
        anthropicBlocks.push({ type: 'image', source: { type: 'base64', media_type: type, data: b64 } });
        openaiParts.push({ type: 'image_url', image_url: { url: `data:${type};base64,${b64}` } });
      } else if (type === 'application/pdf' && llm.provider === 'anthropic') {
        anthropicBlocks.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } });
      } else if (type.startsWith('text/') || type === 'application/json' || type === 'text/csv') {
        notes.push(`\n\n--- Ficheiro: ${url} ---\n${buffer.toString('utf8').slice(0, 100000)}`);
      } else {
        notes.push(`\n\n[Ficheiro anexado não suportado pelo modelo: ${url} (${type})]`);
      }
    } catch (err) {
      notes.push(`\n\n[Não foi possível ler o ficheiro ${url}: ${err.message}]`);
    }
  }
  const text = prompt + notes.join('');
  return {
    text,
    anthropic: [...anthropicBlocks, { type: 'text', text }],
    openai: [...openaiParts, { type: 'text', text }],
  };
}

export async function invokeLLM({ prompt, response_json_schema, file_urls, add_context_from_internet, model } = {}) {
  if (!prompt) throw new HttpError(400, 'InvokeLLM: "prompt" é obrigatório');
  if (add_context_from_internet) console.warn('[llm] add_context_from_internet não é suportado no servidor próprio; ignorado.');
  const files = await attachFiles(String(prompt), Array.isArray(file_urls) ? file_urls : file_urls ? [file_urls] : []);
  const userMessage = { role: 'user', content: files.text, content_blocks: files.anthropic, content_parts: files.openai };

  if (!response_json_schema) {
    const res = await chat({ messages: [userMessage], model });
    return res.content;
  }

  const schema = isPlainObject(response_json_schema) ? response_json_schema : {};
  const isObjectSchema = schema.type === 'object' || (!schema.type && schema.properties);
  const toolSchema = isObjectSchema ? { type: 'object', ...schema } : { type: 'object', properties: { result: schema }, required: ['result'] };

  if (llm.provider === 'anthropic') {
    const res = await chat({
      messages: [userMessage],
      tools: [{ name: 'respond', description: 'Devolve a resposta estruturada pedida.', input_schema: toolSchema }],
      toolChoice: 'respond',
      model,
    });
    const out = res.tool_calls[0]?.arguments ?? extractJson(res.content);
    return isObjectSchema ? out : out.result;
  }

  // Compatível com OpenAI: modo JSON + esquema nas instruções (funciona também com Ollama/Azure).
  const system = `Responda APENAS com um objeto JSON válido que cumpra este JSON Schema:\n${JSON.stringify(toolSchema)}`;
  const res = await chat({ system, messages: [userMessage], jsonMode: true, model });
  const out = extractJson(res.content);
  return isObjectSchema ? out : out.result;
}
