import { secrets } from 'base44:runtime';
import { assertPublicHttpsUrl } from './storage.ts';

/**
 * Chamada ao modelo de linguagem — ponto único para todas as funções (aiDraft, aiAssist).
 *
 * Motor: o registo AiSettings (Definições → Aplicação → Assistente de IA), lido com service role uma vez por pedido.
 * Sem registo, vale o segredo AI_PROVIDER. Valores:
 *  - "claude" (ou "anthropic"): Claude (ANTHROPIC_API_KEY; modelo DEFAULT_CLAUDE_MODEL).
 *    Se o Claude não estiver configurado ou falhar, o pedido segue pelo LLM do Base44 e a resposta indica-o.
 *  - "claude_only": só o Claude; se falhar, o pedido dá erro (sem recurso ao Base44).
 *  - "base44": só o LLM do Base44 (exceto PDF/imagens fora do repositório nativo, que exigem o Claude).
 *  - sem valor: Claude quando existe ANTHROPIC_API_KEY, senão Base44.
 *
 * Pontos de uso: o mesmo registo diz em que pontos da aplicação o assistente está ativo (enabled_purposes).
 *
 * file = { url?, bytes?, mime } (opcional). Ficheiros de texto vão como texto; PDF e imagens como anexo.
 * Nunca se fazem cópias do ficheiro noutro armazenamento.
 */
export const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-5-5';

export const toB64 = (bytes) => { let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(bin); };

export const parseJson = (text) => {
  try {
    const t = String(text || '');
    return JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
  } catch { throw new Error('Não foi possível ler a resposta da IA. Tente novamente.'); }
};

/**
 * Pontos de uso do assistente e valor por omissão (sem registo AiSettings ou sem lista guardada).
 * Manter igual a AI_PURPOSES em src/lib/ai.js.
 *  - documents: tudo o que passa por aiDraft (rascunhos de documentos, análise de evidências, notificações de incidentes).
 *  - document_classification: classificação de documentos em «00 Por classificar» (função documentIntake); contexto
 *    documental, ativo por omissão.
 *  - assessment_questionnaire: questionário de avaliação elaborado a partir da Biblioteca Legal (função aiQuestionnaire);
 *    cada pergunta cita uma fonte do repositório e é revista antes de gravar.
 *  - Desligados por omissão: escolha de perguntas (segue as medidas oficiais e a qualificação, não o modelo),
 *    lacunas do banco de perguntas e traduções de texto oficial/legal (existe o texto de origem em PT-PT).
 */
export const AI_PURPOSE_DEFAULTS = {
  documents: true,
  document_classification: true,
  supplier_questionnaire_generation: true,
  supplier_email_answer_extraction: true,
  assessment_recommendations: true,
  assessment_questionnaire: true,
  recommendation_generation: true,
  assessment_question_selection: false,
  question_gap_analysis: false,
  question_bank_translation: false,
  recommendation_translation: false,
  supplier_questionnaire_translation: false,
};

export const AI_DISABLED_MESSAGE = 'O assistente de IA não está ativo neste ponto.';

// Cache só durante o pedido: a chave é o cliente do SDK criado para esse pedido.
const settingsCache = new WeakMap();

/** Registo AiSettings (ou null). Se não for possível lê-lo, o pedido falha: a escolha do administrador não pode ser ignorada. */
export function getAiSettings(base44) {
  if (!settingsCache.has(base44)) {
    settingsCache.set(base44, base44.asServiceRole.entities.AiSettings.list('-updated_date', 1)
      .then((list) => (Array.isArray(list) && list[0]) || null)
      .catch((e) => {
        console.error('[llm] Não foi possível ler AiSettings:', e?.message || e);
        throw new Error('Não foi possível ler a configuração do assistente de IA. Tente novamente.');
      }));
  }
  return settingsCache.get(base44);
}

/** O ponto de uso está ativo? Sem lista guardada, valem os valores por omissão. */
export function aiPurposeEnabled(settings, purpose) {
  if (Array.isArray(settings?.enabled_purposes)) return settings.enabled_purposes.includes(purpose);
  return AI_PURPOSE_DEFAULTS[purpose] === true;
}

/** Motor efetivo: 'anthropic' (com recurso ao Base44), 'anthropic_only' ou 'base44'. */
export async function aiProvider(base44) {
  const settings = base44 ? await getAiSettings(base44) : null;
  const raw = String(settings?.provider || secrets.get('AI_PROVIDER') || '').trim().toLowerCase();
  if (['claude', 'anthropic'].includes(raw)) return 'anthropic';
  if (['claude_only', 'anthropic_only'].includes(raw)) return 'anthropic_only';
  if (raw === 'base44') return 'base44';
  return secrets.get('ANTHROPIC_API_KEY') ? 'anthropic' : 'base44';
}

/**
 * Bytes de um ficheiro indicado por endereço. O URL vem do chamador (anexo por URL em aiAssist) ou de um link
 * assinado do repositório; antes de o descarregar aplica-se a mesma verificação de https e host público usada nas
 * ligações WebDAV, para o servidor nunca ser levado a pedir a serviços internos nem a metadados da nuvem (SSRF).
 */
async function fetchFileBytes(url) {
  let safe;
  try {
    safe = await assertPublicHttpsUrl(String(url));
  } catch {
    throw new Error('O ficheiro indicado não está num endereço https público.');
  }
  const res = await fetch(safe.href, { redirect: 'error' });
  if (!res.ok) throw new Error(`Não foi possível obter o ficheiro indicado (${res.status}).`);
  return new Uint8Array(await res.arrayBuffer());
}

async function callClaude(prompt, schema, file, textFile) {
  const key = secrets.get('ANTHROPIC_API_KEY');
  if (!key) throw new Error('Falta o segredo ANTHROPIC_API_KEY');
  const model = DEFAULT_CLAUDE_MODEL;
  const content = [];
  if (file && !textFile) {
    const bytes = file.bytes || await fetchFileBytes(file.url);
    if (file.mime === 'application/pdf') content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: toB64(bytes) } });
    else if (/^image\/(png|jpeg|gif|webp)$/.test(file.mime)) content.push({ type: 'image', source: { type: 'base64', media_type: file.mime, data: toB64(bytes) } });
    else throw new Error('Tipo de ficheiro não suportado na análise');
  }
  content.push({ type: 'text', text: `${prompt}${textFile}\n\nResponde apenas com um objeto JSON que respeite este esquema:\n${JSON.stringify(schema)}` });
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', redirect: 'error',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: 8000, messages: [{ role: 'user', content }] }),
  });
  if (!res.ok) throw new Error(`O Claude respondeu ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  if (data.stop_reason === 'max_tokens') throw Object.assign(new Error('A resposta da IA ficou incompleta. Reduza o âmbito ou tente novamente.'), { final: true });
  return { result: parseJson((data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('')), provider: 'anthropic', model };
}

export async function callLLM(base44, prompt, schema, file = null) {
  const provider = await aiProvider(base44);
  let textFile = '';
  if (file && file.mime.startsWith('text/')) {
    const bytes = file.bytes || await fetchFileBytes(file.url);
    textFile = `\n\nCONTEÚDO DO FICHEIRO:\n${new TextDecoder().decode(bytes.subarray(0, 200000))}`;
  }
  // PDF ou imagem sem URL (repositório externo): só o Claude os recebe em base64.
  const needsClaude = !!(file && !textFile && !file.url);
  // Só Claude: sem recurso ao Base44; o erro do Claude chega ao utilizador.
  if (provider === 'anthropic_only') return await callClaude(prompt, schema, file, textFile);
  let claudeError = '';
  if (provider === 'anthropic' || (needsClaude && secrets.get('ANTHROPIC_API_KEY'))) {
    try {
      return await callClaude(prompt, schema, file, textFile);
    } catch (e) {
      if (e?.final || needsClaude) throw e;
      claudeError = String(e?.message || e).slice(0, 300);
      console.error('[llm] Claude indisponível, a usar o LLM do Base44:', claudeError);
    }
  }
  if (needsClaude) throw new Error('Para analisar PDF ou imagens guardados fora do repositório nativo, configure o Claude (segredo ANTHROPIC_API_KEY). Ficheiros de texto podem ser analisados já.');
  const result = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt: `${prompt}${textFile}`, response_json_schema: schema, ...(file && !textFile ? { file_urls: [file.url] } : {}) });
  return { result: typeof result === 'string' ? parseJson(result) : result, provider: claudeError ? 'base44 (recurso)' : 'base44', model: 'base44', ...(claudeError ? { fallback_reason: claudeError } : {}) };
}