// Leitura de respostas WebDAV, sem dependências (testada em src/lib/__tests__/classify.test.js).

/**
 * Lê a resposta PROPFIND (Depth 1) de um servidor WebDAV. Aceita qualquer prefixo de espaço de nomes.
 * Devolve [{ name, size, mimeType, collection, self }]; `self` marca a própria pasta (a primeira entrada).
 */
export function parsePropfind(xml) {
  const tag = (name) => new RegExp(`<(?:[\\w-]+:)?${name}\\b[^>]*>([\\s\\S]*?)</(?:[\\w-]+:)?${name}>`, "i");
  const out = [];
  const responses = String(xml || "").match(/<(?:[\w-]+:)?response\b[\s\S]*?<\/(?:[\w-]+:)?response>/gi) || [];
  responses.forEach((block, i) => {
    const href = (block.match(tag("href"))?.[1] || "").trim();
    const parts = href.replace(/\/+$/, "").split("/");
    let name = parts[parts.length - 1] || "";
    try { name = decodeURIComponent(name); } catch { /* fica como veio */ }
    name = name.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    const collection = /<(?:[\w-]+:)?collection\b/i.test(block.match(tag("resourcetype"))?.[0] || "");
    out.push({
      name,
      size: Number((block.match(tag("getcontentlength"))?.[1] || "0").trim()) || 0,
      mimeType: (block.match(tag("getcontenttype"))?.[1] || "").trim(),
      collection,
      self: i === 0 && (collection || href.endsWith("/")),
    });
  });
  return out;
}
