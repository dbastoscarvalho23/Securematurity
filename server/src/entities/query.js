// Tradução de filtros ao estilo Base44/Mongo para SQL parametrizado sobre jsonb.
import { HttpError, isPlainObject } from '../util.js';

/**
 * Descritor de tabela: colunas físicas (meta) e coluna jsonb com os restantes campos.
 * `columnTypes` indica colunas de data para comparações corretas.
 */
export const RECORDS_TABLE = {
  columns: { id: 'id', created_date: 'created_date', updated_date: 'updated_date', created_by: 'created_by', created_by_id: 'created_by_id' },
  timestampColumns: new Set(['created_date', 'updated_date']),
  dataColumn: 'data',
};

export const USERS_TABLE = {
  columns: {
    id: 'id', email: 'email', full_name: 'full_name', role: 'role',
    created_date: 'created_date', updated_date: 'updated_date', is_verified: 'is_verified', disabled: 'disabled',
  },
  timestampColumns: new Set(['created_date', 'updated_date']),
  boolColumns: new Set(['is_verified', 'disabled']),
  dataColumn: 'data',
};

const FIELD_RE = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)*$/;

export class Params {
  constructor(start = []) { this.values = [...start]; }
  add(value) { this.values.push(value); return `$${this.values.length}`; }
}

function assertField(field) {
  if (!FIELD_RE.test(field)) throw new HttpError(400, `Campo inválido no filtro: ${field}`);
}

/** Expressão SQL para um campo. Devolve { kind: 'column'|'json', sql }. */
export function fieldExpr(table, field) {
  assertField(field);
  if (Object.hasOwn(table.columns, field)) return { kind: 'column', sql: table.columns[field], name: field };
  const parts = field.split('.');
  // Escapar aspas simples (o FIELD_RE já impede, mas por segurança).
  const pathSql = parts.map((p) => `'${p.replace(/'/g, "''")}'`).join('->');
  return { kind: 'json', sql: `${table.dataColumn}->${pathSql}` };
}

const jsonParam = (params, value) => `${params.add(JSON.stringify(value))}::jsonb`;

function columnValue(table, name, value) {
  if (table.boolColumns?.has(name)) return Boolean(value);
  if (value === null || value === undefined) return null;
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

function columnCast(table, name) {
  if (table.timestampColumns?.has(name)) return '::timestamptz';
  if (table.boolColumns?.has(name)) return '::boolean';
  return '::text';
}

/** Igualdade com semântica Mongo: num campo array, basta conter o valor. */
function equalsSql(table, f, value, params) {
  if (f.kind === 'column') {
    if (value === null || value === undefined) return `${f.sql} IS NULL`;
    return `${f.sql} = ${params.add(columnValue(table, f.name, value))}${columnCast(table, f.name)}`;
  }
  if (value === null || value === undefined) return `(${f.sql} IS NULL OR ${f.sql} = 'null'::jsonb)`;
  const p = jsonParam(params, value);
  if (Array.isArray(value) || isPlainObject(value)) return `${f.sql} = ${p}`;
  return `(${f.sql} = ${p} OR (jsonb_typeof(${f.sql}) = 'array' AND ${f.sql} @> jsonb_build_array(${p})))`;
}

function inSql(table, f, values, params) {
  if (!Array.isArray(values)) throw new HttpError(400, '$in exige uma lista');
  if (values.length === 0) return 'FALSE';
  const parts = values.map((v) => equalsSql(table, f, v, params));
  return `(${parts.join(' OR ')})`;
}

function compareSql(table, f, op, value, params) {
  const sqlOp = { $gt: '>', $gte: '>=', $lt: '<', $lte: '<=' }[op];
  if (f.kind === 'column') {
    return `${f.sql} ${sqlOp} ${params.add(columnValue(table, f.name, value))}${columnCast(table, f.name)}`;
  }
  const p = jsonParam(params, value);
  return `(jsonb_typeof(${f.sql}) = jsonb_typeof(${p}) AND ${f.sql} ${sqlOp} ${p})`;
}

function textSql(f) {
  return f.kind === 'column' ? `${f.sql}::text` : `(${f.sql} #>> '{}')`;
}

function operatorSql(table, field, ops, params) {
  const f = fieldExpr(table, field);
  const parts = [];
  for (const [op, value] of Object.entries(ops)) {
    switch (op) {
      case '$eq': parts.push(equalsSql(table, f, value, params)); break;
      case '$ne': parts.push(`NOT ${equalsSql(table, f, value, params)}`); break;
      case '$in': parts.push(inSql(table, f, value, params)); break;
      case '$nin': parts.push(`NOT ${inSql(table, f, value, params)}`); break;
      case '$gt': case '$gte': case '$lt': case '$lte': parts.push(compareSql(table, f, op, value, params)); break;
      case '$exists':
        parts.push(value
          ? (f.kind === 'column' ? `${f.sql} IS NOT NULL` : `(${f.sql} IS NOT NULL AND ${f.sql} <> 'null'::jsonb)`)
          : (f.kind === 'column' ? `${f.sql} IS NULL` : `(${f.sql} IS NULL OR ${f.sql} = 'null'::jsonb)`));
        break;
      case '$regex': {
        const insensitive = String(ops.$options || '').includes('i');
        parts.push(`${textSql(f)} ${insensitive ? '~*' : '~'} ${params.add(String(value))}`);
        break;
      }
      case '$options': break;
      case '$all':
        if (!Array.isArray(value)) throw new HttpError(400, '$all exige uma lista');
        parts.push(`${f.sql} @> ${jsonParam(params, value)}`);
        break;
      case '$size': parts.push(`(jsonb_typeof(${f.sql}) = 'array' AND jsonb_array_length(${f.sql}) = ${params.add(Number(value))}::int)`); break;
      default:
        throw new HttpError(400, `Operador não suportado: ${op}`);
    }
  }
  return parts.length ? parts.join(' AND ') : 'TRUE';
}

/** Converte um objeto de filtro num predicado SQL. */
export function filterToSql(table, filter, params) {
  if (filter === undefined || filter === null) return 'TRUE';
  if (!isPlainObject(filter)) throw new HttpError(400, 'O filtro tem de ser um objeto');
  const parts = [];
  for (const [key, value] of Object.entries(filter)) {
    if (key === '$or' || key === '$and' || key === '$nor') {
      if (!Array.isArray(value)) throw new HttpError(400, `${key} exige uma lista`);
      if (value.length === 0) { parts.push(key === '$and' ? 'TRUE' : key === '$or' ? 'FALSE' : 'TRUE'); continue; }
      const sub = value.map((v) => `(${filterToSql(table, v, params)})`);
      if (key === '$nor') parts.push(`NOT (${sub.join(' OR ')})`);
      else parts.push(`(${sub.join(key === '$or' ? ' OR ' : ' AND ')})`);
    } else if (key === '$not') {
      parts.push(`NOT (${filterToSql(table, value, params)})`);
    } else if (isPlainObject(value) && Object.keys(value).some((k) => k.startsWith('$'))) {
      parts.push(operatorSql(table, key, value, params));
    } else {
      parts.push(equalsSql(table, fieldExpr(table, key), value, params));
    }
  }
  return parts.length ? parts.join(' AND ') : 'TRUE';
}

/** Ordenação: "-campo" (descendente) ou "campo" (ascendente). */
export function sortToSql(table, sort) {
  const items = (Array.isArray(sort) ? sort : String(sort || '-created_date').split(','))
    .map((s) => String(s).trim()).filter(Boolean);
  const clauses = items.map((item) => {
    const desc = item.startsWith('-');
    const field = item.replace(/^[-+]/, '');
    const f = fieldExpr(table, field);
    return `${f.sql} ${desc ? 'DESC' : 'ASC'} NULLS LAST`;
  });
  clauses.push('id ASC');
  return clauses.join(', ');
}

// ---------------------------------------------------------------------------
// Avaliação em memória (para regras RLS em escritas e filtragem de eventos).
// ---------------------------------------------------------------------------

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function matchEquals(actual, expected) {
  if (expected === null || expected === undefined) return actual === null || actual === undefined;
  if (Array.isArray(actual) && !Array.isArray(expected)) return actual.some((v) => deepEqual(v, expected));
  return deepEqual(actual, expected);
}

function compareValues(a, b) {
  if (typeof a !== typeof b || a === null || b === null) return null;
  return a < b ? -1 : a > b ? 1 : 0;
}

export function matchesFilter(record, filter, getField) {
  if (!filter) return true;
  return Object.entries(filter).every(([key, value]) => {
    if (key === '$or') return value.some((v) => matchesFilter(record, v, getField));
    if (key === '$and') return value.every((v) => matchesFilter(record, v, getField));
    if (key === '$nor') return !value.some((v) => matchesFilter(record, v, getField));
    if (key === '$not') return !matchesFilter(record, value, getField);
    const actual = getField(record, key);
    if (isPlainObject(value) && Object.keys(value).some((k) => k.startsWith('$'))) {
      return Object.entries(value).every(([op, v]) => {
        switch (op) {
          case '$eq': return matchEquals(actual, v);
          case '$ne': return !matchEquals(actual, v);
          case '$in': return v.some((x) => matchEquals(actual, x));
          case '$nin': return !v.some((x) => matchEquals(actual, x));
          case '$gt': return compareValues(actual, v) === 1;
          case '$gte': { const c = compareValues(actual, v); return c === 1 || c === 0; }
          case '$lt': return compareValues(actual, v) === -1;
          case '$lte': { const c = compareValues(actual, v); return c === -1 || c === 0; }
          case '$exists': return v ? actual !== undefined && actual !== null : actual === undefined || actual === null;
          case '$regex': return new RegExp(v, String(value.$options || '').includes('i') ? 'i' : '').test(String(actual ?? ''));
          case '$options': return true;
          case '$all': return Array.isArray(actual) && v.every((x) => actual.some((y) => deepEqual(x, y)));
          case '$size': return Array.isArray(actual) && actual.length === v;
          default: return false;
        }
      });
    }
    return matchEquals(actual, value);
  });
}
