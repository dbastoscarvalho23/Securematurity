/**
 * Regra do art. 32.º do Regulamento do CNCS n.º 756/2026: a lista de ativos acessíveis pela Internet nunca é
 * enviada à IA. Usada pelas funções aiAssist e documentIntake antes de chamar o modelo.
 */

const MAX_ASSETS = 500;

/** Valores identificadores de ativos expostos à Internet (IP, FQDN) com tamanho suficiente para não dar falsos positivos. */
export function exposedIdentifiers(assets) {
  const out = new Set<string>();
  for (const a of assets || []) {
    if (!a?.internet_exposed) continue;
    for (const v of [a.ip_address, a.fqdn]) {
      for (const part of String(v || '').split(/[\s,;]+/)) {
        const x = part.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
        if (x.length >= 4) out.add(x);
      }
    }
  }
  return [...out];
}

/** O texto contém algum dos identificadores? Coincidência exata (10.0.0.1 não coincide com 10.0.0.15 nem com a.10.0.0.1). */
export function textHasIdentifier(text, identifiers) {
  const t = String(text || '').toLowerCase();
  const esc = (v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return identifiers.some((id) => new RegExp(`(^|[^a-z0-9.-])${esc(id)}(?![a-z0-9-]|\\.[a-z0-9])`).test(t));
}

/**
 * O texto contém algum IP ou FQDN de um ativo exposto à Internet do cliente? (comparação literal, sem distinguir
 * maiúsculas). Sem cliente (admin da plataforma em trabalho global): verifica os ativos expostos de todos os clientes.
 * Se não for possível confirmar, lança erro: a regra não pode falhar em aberto.
 */
export async function containsExposedAsset(base44, customerId, text) {
  const db = base44.asServiceRole.entities;
  const query = customerId ? { customer_id: customerId, internet_exposed: true } : { internet_exposed: true };
  const assets = await db.Asset.filter(query, '-updated_date', MAX_ASSETS).catch(() => {
    throw new Error('Não foi possível confirmar que o pedido não contém dados de ativos. Tente novamente.');
  });
  return textHasIdentifier(text, exposedIdentifiers(assets));
}
