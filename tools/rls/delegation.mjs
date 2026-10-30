#!/usr/bin/env node
// Regras de acesso delegado nas entidades (base44/entities/*.jsonc).
//
// Para cada operação, cada alternativa da regra que dá acesso pelo cliente do próprio utilizador
// (`data.customer_id == {{user.data.customer_id}}`, ou `id` na entidade Customer) ganha alternativas equivalentes para
// quem chega a esse cliente por acesso delegado (docs/acesso-delegado.md):
//   - alternativa só do administrador do cliente (role customer_admin) → nível admin;
//   - alternativa de qualquer membro → leitura: viewer, contributor e admin; escrita: contributor e admin.
// As restantes condições da alternativa (ex.: restricted == false) mantêm-se. Alternativas com outras condições de
// papel ficam como estão. As leituras abertas ao papel `user` (referenciais, perguntas, licenças) abrem-se também ao
// papel `consultant`. Os convites (InvitedUser) ficam só do cliente. A transformação é idempotente.
//
// Uso: node tools/rls/delegation.mjs           aplica às entidades
//      node tools/rls/delegation.mjs --check   sai com 1 se alguma entidade não estiver atualizada
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OWN = '{{user.data.customer_id}}';
const FIELD = { viewer: 'delegated_view_customer_ids', contributor: 'delegated_edit_customer_ids', admin: 'delegated_admin_customer_ids' };
const OPS = ['create', 'read', 'update', 'delete'];
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const key = (v) => JSON.stringify(v);

/** Condições de uma alternativa, uma por objeto (um objeto com várias chaves é um E implícito). */
function conditionsOf(alt) {
  if (!isObj(alt)) return null;
  if (Object.keys(alt).length === 1 && Array.isArray(alt.$and)) return alt.$and.flatMap((c) => conditionsOf(c) || [c]);
  if (alt.$or) return null; // alternativas aninhadas: não se mexe
  return Object.entries(alt).map(([k, v]) => ({ [k]: v }));
}

function delegatedCopies(alt, op, entityName) {
  const conds = conditionsOf(alt);
  if (!conds) return [];
  const ownKey = entityName === 'Customer' ? 'id' : 'data.customer_id';
  const own = conds.findIndex((c) => Object.keys(c).length === 1 && c[ownKey] === OWN);
  if (own < 0) return [];
  const roles = conds.filter((c) => isObj(c.user_condition));
  if (roles.some((c) => Object.keys(c.user_condition).some((k) => k !== 'role'))) return [];
  const roleNames = roles.map((c) => c.user_condition.role);
  let levels;
  if (roleNames.length === 0) levels = op === 'read' ? ['viewer', 'contributor', 'admin'] : ['contributor', 'admin'];
  else if (roleNames.every((r) => r === 'customer_admin')) levels = ['admin'];
  else return [];
  const rest = conds.filter((c, i) => i !== own && !isObj(c.user_condition));
  return levels.map((level) => {
    const parts = [{ [ownKey]: { $in: `{{user.data.${FIELD[level]}}}` } }, ...rest];
    return parts.length === 1 ? parts[0] : { $and: parts };
  });
}

/** Regra de uma operação com as alternativas delegadas acrescentadas (sem repetir as que já existem). */
export function delegateRule(rule, op, entityName) {
  if (!isObj(rule)) return rule;
  const alts = Array.isArray(rule.$or) && Object.keys(rule).length === 1 ? rule.$or : [rule];
  const seen = new Set(alts.map(key));
  const extra = [];
  const add = (c) => { if (!seen.has(key(c))) { seen.add(key(c)); extra.push(c); } };
  for (const alt of alts) {
    for (const copy of delegatedCopies(alt, op, entityName)) add(copy);
    if (op === 'read' && key(alt) === key({ user_condition: { role: 'user' } })) add({ user_condition: { role: 'consultant' } });
  }
  if (!extra.length) return rule;
  return { $or: [...alts, ...extra] };
}

/**
 * Entidades que ficam só do cliente: os convites decidem quem entra no cliente e com que papel (o início de sessão
 * confia no criador do convite), por isso nenhum acesso delegado os pode criar ou alterar.
 */
export const CUSTOMER_ONLY = new Set(['InvitedUser']);

export function delegateEntity(entity) {
  if (!isObj(entity?.rls) || CUSTOMER_ONLY.has(entity.name)) return entity;
  const rls = { ...entity.rls };
  for (const op of OPS) if (op in rls) rls[op] = delegateRule(rls[op], op, entity.name);
  return { ...entity, rls };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../base44/entities');
  const check = process.argv.includes('--check');
  const stale = [];
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.jsonc')).sort()) {
    const full = path.join(dir, file);
    const raw = fs.readFileSync(full, 'utf8');
    const entity = JSON.parse(raw.replace(/^\s*\/\/.*$/gm, ''));
    const next = delegateEntity(entity);
    if (key(next.rls) === key(entity.rls)) continue;
    stale.push(file);
    if (!check) fs.writeFileSync(full, `${JSON.stringify(next, null, 2)}\n`);
  }
  if (check && stale.length) {
    console.error(`Regras de acesso delegado em falta: ${stale.join(', ')}. Corra node tools/rls/delegation.mjs.`);
    process.exit(1);
  }
  console.log(check ? 'Regras de acesso delegado atualizadas em todas as entidades.' : `Entidades atualizadas: ${stale.length ? stale.join(', ') : 'nenhuma'}`);
}
