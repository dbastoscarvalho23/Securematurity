// Carrega as definições de entidades de base44/entities/*.jsonc.
import path from 'node:path';
import { config } from '../config.js';
import { readJsoncDir, HttpError } from '../util.js';

let cache = null;

export function loadSchemas() {
  if (cache) return cache;
  const dir = path.join(config.base44Dir, 'entities');
  cache = new Map();
  for (const { file, data } of readJsoncDir(dir)) {
    const name = data.name || path.basename(file).replace(/\.jsonc?$/, '');
    cache.set(name, { ...data, name, hasRls: Object.prototype.hasOwnProperty.call(data, 'rls') });
  }
  if (!cache.has('User')) cache.set('User', { name: 'User', properties: {}, required: [], hasRls: false });
  return cache;
}

export function getSchema(name) {
  const schema = loadSchemas().get(name);
  if (!schema) throw new HttpError(404, `Entidade desconhecida: ${name}`);
  return schema;
}

export const entityNames = () => [...loadSchemas().keys()];

const META_FIELDS = new Set(['id', 'created_date', 'updated_date', 'created_by', 'created_by_id', '_id']);

/** Remove campos de sistema enviados pelo cliente. */
export function stripMeta(data) {
  const out = {};
  for (const [k, v] of Object.entries(data || {})) {
    if (!META_FIELDS.has(k) && v !== undefined) out[k] = v;
  }
  return out;
}

export function applyDefaults(schema, data) {
  const out = { ...data };
  for (const [key, prop] of Object.entries(schema.properties || {})) {
    if (out[key] === undefined && prop && Object.prototype.hasOwnProperty.call(prop, 'default')) {
      out[key] = structuredClone(prop.default);
    }
  }
  return out;
}

/** Validação mínima: campos obrigatórios e valores enumerados. */
export function validate(schema, data, { partial = false } = {}) {
  if (!config.strictSchemaValidation || schema.name === 'User') return;
  const errors = [];
  if (!partial) {
    for (const key of schema.required || []) {
      if (data[key] === undefined || data[key] === null) errors.push(`O campo "${key}" é obrigatório`);
    }
  }
  for (const [key, prop] of Object.entries(schema.properties || {})) {
    const value = data[key];
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(prop?.enum) && !prop.enum.includes(value)) {
      errors.push(`Valor inválido para "${key}": ${JSON.stringify(value)}`);
    }
  }
  if (errors.length) throw new HttpError(422, errors.join('; '), { errors });
}
