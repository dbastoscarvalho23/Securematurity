/**
 * Limpeza de HTML de mensagens escritas por utilizadores de cliente, antes de saírem com o remetente da AnkoraOne.
 *
 * Mantém só formatação de texto (parágrafos, listas, negrito, tabelas simples) e ligações https/mailto.
 * Remove scripts, estilos, formulários, iframes, imagens (píxeis de rastreio e logótipos falsos), atributos de
 * evento e de estilo. Não é um analisador completo: trabalha por lista de etiquetas permitidas e descarta tudo o resto,
 * o que basta para o conteúdo produzido pela interface (questionários, convocatórias, avisos).
 */
const ALLOWED = new Set(['p', 'br', 'b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'a', 'span', 'div', 'hr', 'small', 'code', 'pre']);
const DROP_WITH_CONTENT = /<(script|style|iframe|object|embed|form|textarea|select|svg|math|template|noscript|head|title)\b[\s\S]*?<\/\1\s*>/gi;

const escAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function safeHref(raw: string): string | null {
  const v = raw.trim().replace(/^["']|["']$/g, '').replace(/&amp;/g, '&');
  if (/^mailto:[^\s"'<>]+$/i.test(v)) return v;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}

export function sanitizeHtml(html: string): string {
  let s = String(html || '').replace(/<!--[\s\S]*?-->/g, '').replace(DROP_WITH_CONTENT, '');
  s = s.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (tag, name, attrs) => {
    const n = String(name).toLowerCase();
    if (!ALLOWED.has(n)) return '';
    if (tag.startsWith('</')) return `</${n}>`;
    if (n === 'a') {
      const m = String(attrs).match(/\shref\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i);
      const href = m ? safeHref(m[1]) : null;
      return href ? `<a href="${escAttr(href)}" rel="noopener noreferrer">` : '<a>';
    }
    if (n === 'td' || n === 'th') {
      const m = String(attrs).match(/\scolspan\s*=\s*["']?(\d{1,2})/i);
      return m ? `<${n} colspan="${m[1]}">` : `<${n}>`;
    }
    return `<${n}>`;
  });
  // Restos de «<» soltos que não formavam etiqueta permitida.
  return s.replace(/<(?![a-z/])/gi, '&lt;');
}
