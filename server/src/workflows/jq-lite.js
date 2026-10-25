// Avaliador mínimo do subconjunto de jq usado nas condições dos workflows Base44, por exemplo:
//   ${ ((.trigger.changed_fields | index("status") != null) and (.trigger.data.status == "under_review")) }
// Suporta: caminhos (.a.b), literais (strings, números, true/false/null), ==, !=, <, <=, >, >=,
// and, or, not, parênteses e os filtros | index(x), | length, | contains(x), | not, | ascii_downcase.

function tokenize(src) {
  const tokens = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i += 1; continue; }
    if (c === '"') {
      let j = i + 1; let s = '';
      while (j < src.length && src[j] !== '"') { if (src[j] === '\\') { s += src[j + 1]; j += 2; } else { s += src[j]; j += 1; } }
      tokens.push({ t: 'str', v: s }); i = j + 1; continue;
    }
    if (/[0-9]/.test(c) || (c === '-' && /[0-9]/.test(src[i + 1] || ''))) {
      const m = src.slice(i).match(/^-?\d+(\.\d+)?/); tokens.push({ t: 'num', v: Number(m[0]) }); i += m[0].length; continue;
    }
    const two = src.slice(i, i + 2);
    if (['==', '!=', '<=', '>='].includes(two)) { tokens.push({ t: 'op', v: two }); i += 2; continue; }
    if ('<>|(),'.includes(c)) { tokens.push({ t: c === '<' || c === '>' ? 'op' : c, v: c }); i += 1; continue; }
    if (c === '.') {
      const m = src.slice(i).match(/^(\.[A-Za-z_][A-Za-z0-9_]*|\.\["[^"]*"\])+|^\./);
      tokens.push({ t: 'path', v: m[0] }); i += m[0].length; continue;
    }
    const w = src.slice(i).match(/^[A-Za-z_][A-Za-z0-9_]*/);
    if (w) { tokens.push({ t: 'word', v: w[0] }); i += w[0].length; continue; }
    throw new Error(`jq-lite: carácter inesperado "${c}"`);
  }
  return tokens;
}

function getPathValue(input, pathStr) {
  if (pathStr === '.') return input;
  const parts = [...pathStr.matchAll(/\.([A-Za-z_][A-Za-z0-9_]*)|\.\["([^"]*)"\]/g)].map((m) => m[1] ?? m[2]);
  return parts.reduce((acc, k) => (acc == null ? null : acc[k] ?? null), input);
}

const truthy = (v) => v !== false && v !== null && v !== undefined;

export function evaluateJq(expression, input) {
  let src = String(expression).trim();
  const wrapped = src.match(/^\$\{([\s\S]*)\}$/);
  if (wrapped) src = wrapped[1];
  const tokens = tokenize(src);
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];
  const expect = (t) => { const tok = next(); if (!tok || tok.t !== t) throw new Error(`jq-lite: esperado "${t}"`); return tok; };

  function parseOr() { let l = parseAnd(); while (peek()?.t === 'word' && peek().v === 'or') { next(); const r = parseAnd(); l = truthy(l) || truthy(r); } return l; }
  function parseAnd() { let l = parseCmp(); while (peek()?.t === 'word' && peek().v === 'and') { next(); const r = parseCmp(); l = truthy(l) && truthy(r); } return l; }
  function parseCmp() {
    const l = parsePipe();
    if (peek()?.t === 'op') {
      const op = next().v; const r = parsePipe();
      const eq = JSON.stringify(l ?? null) === JSON.stringify(r ?? null);
      switch (op) {
        case '==': return eq; case '!=': return !eq;
        case '<': return l < r; case '<=': return l <= r; case '>': return l > r; case '>=': return l >= r;
        default: return false;
      }
    }
    return l;
  }
  function parsePipe() {
    let v = parsePrimary();
    while (peek()?.t === '|') {
      next();
      const fn = expect('word').v;
      let arg;
      if (peek()?.t === '(') { next(); arg = parseOr(); expect(')'); }
      switch (fn) {
        case 'index':
          if (Array.isArray(v)) { const i = v.findIndex((x) => JSON.stringify(x) === JSON.stringify(arg)); v = i < 0 ? null : i; }
          else if (typeof v === 'string') { const i = v.indexOf(arg); v = i < 0 ? null : i; }
          else v = null;
          break;
        case 'length': v = v == null ? 0 : (typeof v === 'object' ? Object.keys(v).length : String(v).length); break;
        case 'contains': v = Array.isArray(v) ? v.includes(arg) : typeof v === 'string' ? v.includes(arg) : false; break;
        case 'not': v = !truthy(v); break;
        case 'ascii_downcase': v = typeof v === 'string' ? v.toLowerCase() : v; break;
        default: throw new Error(`jq-lite: função não suportada "${fn}"`);
      }
    }
    return v;
  }
  function parsePrimary() {
    const tok = next();
    if (!tok) throw new Error('jq-lite: expressão incompleta');
    if (tok.t === '(') { const v = parseOr(); expect(')'); return v; }
    if (tok.t === 'str' || tok.t === 'num') return tok.v;
    if (tok.t === 'path') return getPathValue(input, tok.v);
    if (tok.t === 'word') {
      if (tok.v === 'true') return true;
      if (tok.v === 'false') return false;
      if (tok.v === 'null') return null;
      if (tok.v === 'not') return !truthy(parsePrimary());
    }
    throw new Error(`jq-lite: símbolo inesperado "${tok.v}"`);
  }

  const result = parseOr();
  if (pos < tokens.length) throw new Error('jq-lite: texto a mais no fim da expressão');
  return result;
}

export const jqTruthy = truthy;
