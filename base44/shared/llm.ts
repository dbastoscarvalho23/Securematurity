import { secrets } from 'base44:runtime';

/**
 * Chamada ao modelo de linguagem — ponto único para todas as funções (aiDraft, aiAssist).
 *
 * Fornecedor (segredo AI_PROVIDER, lido em cada pedido):
 *  - "claude" ou "anthropic": Claude (ANTHROPIC_API_KEY; modelo em ANTHROPIC_MODEL, por omissão DEFAULT_CLAUDE_MODEL).
 *    Se o Claude não estiver configurado ou falhar, o pedido segue pelo LLM do Base44 e a resposta indica-o.
 *  - "base44": só o LLM do Base44 (exceto PDF/imagens fora do repositório nativo, que exigem o Claude).
 *  - sem valor: Claude quando existe ANTHROPIC_API_KEY, senão Base44.
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

export function aiProvider() {
  const raw = String(secrets.get('AI_PROVIDER') || '').trim().toLowerCase();
  if (['claude', 'anthropic'].includes(raw)) return 'anthropic';
  if (raw === 'base44') return 'base44';
  return secrets.get('ANTHROPIC_API_KEY') ? 'anthropic' : 'base44';
}

async function callClaude(prompt, schema, file, textFile) {
  const key = secrets.get('ANTHROPIC_API_KEY');
  if (!key) throw new Error('Falta o segredo ANTHROPIC_API_KEY');
  const model = String(secrets.get('ANTHROPIC_MODEL') || DEFAULT_CLAUDE_MODEL).trim();
  const content = [];
  if (file && !textFile) {
    const bytes = file.bytes || new Uint8Array(await (await fetch(file.url, { redirect: 'error' })).arrayBuffer());
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
  const provider = aiProvider();
  let textFile = '';
  if (file && file.mime.startsWith('text/')) {
    const bytes = file.bytes || new Uint8Array(await (await fetch(file.url, { redirect: 'error' })).arrayBuffer());
    textFile = `\n\nCONTEÚDO DO FICHEIRO:\n${new TextDecoder().decode(bytes.subarray(0, 200000))}`;
  }
  // PDF ou imagem sem URL (repositório externo): só o Claude os recebe em base64.
  const needsClaude = !!(file && !textFile && !file.url);
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
