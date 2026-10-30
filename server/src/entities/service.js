// Serviço de entidades: CRUD genérico com RLS, equivalente a base44.entities.*
import { query, withTransaction } from '../db.js';
import { config } from '../config.js';
import { emitEntityEvent } from '../events.js';
import { HttpError, newId, getPath } from '../util.js';
import { getSchema, stripMeta, applyDefaults, validate } from './schemas.js';
import { RECORDS_TABLE, USERS_TABLE, Params, filterToSql, sortToSql, matchesFilter } from './query.js';
import { ruleToFilter, USER_RULES } from './rls.js';

const MAX_BULK = 1000;

// ---------------------------------------------------------------------------
// Conversão de linhas
// ---------------------------------------------------------------------------

export function rowToRecord(row) {
  return {
    ...row.data,
    id: row.id,
    created_date: row.created_date,
    updated_date: row.updated_date,
    created_by: row.created_by,
    created_by_id: row.created_by_id,
  };
}

/** Campos do utilizador que só um administrador (ou o sistema) pode alterar. */
/** Preferências guardadas pela interface que não constam do esquema User. */
const USER_UI_FIELDS = new Set(['theme']);

const USER_PROTECTED = new Set(['role', 'customer_id', 'customer_name', 'email', 'is_verified', 'disabled', 'password', 'password_hash', 'token_version']);
/** Listas de acesso delegado: só o servidor (papel de serviço) as escreve, nem o administrador (regra service_only). */
export const USER_SERVICE_ONLY = new Set(['delegated_view_customer_ids', 'delegated_edit_customer_ids', 'delegated_admin_customer_ids']);

export function rowToUser(row) {
  if (!row) return null;
  const { _pending_password_hash: _hidden, ...data } = row.data || {};
  return {
    ...data,
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    role: row.role,
    is_verified: row.is_verified,
    disabled: row.disabled,
    created_date: row.created_date,
    updated_date: row.updated_date,
  };
}

const getField = (record, key) => getPath(record, key);

function limitOf(limit) {
  const n = Number(limit);
  if (!Number.isFinite(n) || n <= 0) return config.entityDefaultLimit;
  return Math.min(Math.floor(n), config.entityMaxLimit);
}

function pickFields(record, fields) {
  if (!fields) return record;
  const list = Array.isArray(fields) ? fields : String(fields).split(',').map((s) => s.trim()).filter(Boolean);
  if (!list.length) return record;
  const out = { id: record.id };
  for (const f of list) if (record[f] !== undefined) out[f] = record[f];
  return out;
}

// ---------------------------------------------------------------------------
// Serviço
// ---------------------------------------------------------------------------

export class EntityService {
  /**
   * @param {object} opts
   * @param {object|null} opts.user          Utilizador autenticado (formato rowToUser) ou null.
   * @param {boolean}     opts.serviceRole   Ignora RLS (equivalente a asServiceRole).
   * @param {boolean}     opts.preserveMeta  Mantém id/datas enviados (importação de dados).
   */
  constructor({ user = null, serviceRole = false, preserveMeta = false } = {}) {
    this.user = user;
    this.serviceRole = serviceRole;
    this.preserveMeta = preserveMeta && serviceRole;
  }

  // --- regras --------------------------------------------------------------

  rule(schema, action) {
    if (schema.name === 'User') return USER_RULES[action];
    if (!schema.hasRls) return undefined;
    return schema.rls?.[action];
  }

  /** Filtro de acesso para a ação (true = livre, false = negado). */
  accessFilter(schema, action, opts) {
    if (this.serviceRole) return true;
    const rule = this.rule(schema, action);
    if (rule === undefined) return this.user ? true : false; // sem RLS: apenas autenticados
    if (action !== 'read' && !this.user) return false; // anónimos nunca escrevem
    return ruleToFilter(rule, this.user, opts);
  }

  assertAllowed(schema, action, record, opts) {
    const filter = this.accessFilter(schema, action, opts);
    if (filter === true) return;
    if (filter === false || !matchesFilter(record, filter, getField)) {
      throw new HttpError(this.user ? 403 : 401, this.user
        ? `Sem permissão para ${action} em ${schema.name}`
        : 'Autenticação necessária');
    }
  }

  // --- leitura -------------------------------------------------------------

  async filter(name, filter = {}, sort, limit, skip, fields) {
    const schema = getSchema(name);
    const isUser = name === 'User';
    const table = isUser ? USERS_TABLE : RECORDS_TABLE;
    const access = this.accessFilter(schema, 'read');
    if (access === false) return [];

    const params = new Params();
    const where = [];
    if (!isUser) where.push(`entity = ${params.add(name)}`);
    where.push(`(${filterToSql(table, filter || {}, params)})`);
    if (access !== true) where.push(`(${filterToSql(table, access, params)})`);

    const sql = `SELECT * FROM ${isUser ? 'users' : 'records'} WHERE ${where.join(' AND ')}
      ORDER BY ${sortToSql(table, sort)} LIMIT ${params.add(limitOf(limit))} OFFSET ${params.add(Math.max(0, Number(skip) || 0))}`;
    const { rows } = await query(sql, params.values);
    return rows.map(isUser ? rowToUser : rowToRecord).map((r) => pickFields(r, fields));
  }

  list(name, sort, limit, skip, fields) {
    return this.filter(name, {}, sort, limit, skip, fields);
  }

  async get(name, id) {
    const [record] = await this.filter(name, { id: String(id) }, undefined, 1);
    if (!record) throw new HttpError(404, `${name} não encontrado: ${id}`);
    return record;
  }

  /** Leitura interna sem RLS (para verificar regras de escrita). */
  async loadRaw(name, id, client = null) {
    const run = client ? client.query.bind(client) : query;
    if (name === 'User') {
      const { rows } = await run('SELECT * FROM users WHERE id = $1', [String(id)]);
      return rowToUser(rows[0]);
    }
    const { rows } = await run('SELECT * FROM records WHERE entity = $1 AND id = $2', [name, String(id)]);
    return rows[0] ? rowToRecord(rows[0]) : null;
  }

  // --- escrita -------------------------------------------------------------

  prepareCreate(schema, input) {
    const raw = input || {};
    let data = this.preserveMeta ? { ...raw } : stripMeta(raw);
    const meta = {
      id: this.preserveMeta && raw.id ? String(raw.id) : newId(),
      created_date: this.preserveMeta && raw.created_date ? raw.created_date : new Date().toISOString(),
      updated_date: this.preserveMeta && raw.updated_date ? raw.updated_date : null,
      created_by: this.preserveMeta ? (raw.created_by ?? null) : (this.user?.email ?? null),
      created_by_id: this.preserveMeta ? (raw.created_by_id ?? null) : (this.user?.id ?? null),
    };
    for (const k of ['id', 'created_date', 'updated_date', 'created_by', 'created_by_id', '_id']) delete data[k];
    data = this.preserveMeta ? data : applyDefaults(schema, data);

    // Carimbar o cliente (tenant) do utilizador quando o registo não o indica.
    if (config.autoStampCustomerId && !this.serviceRole && this.user?.customer_id
        && schema.properties?.customer_id && (data.customer_id === undefined || data.customer_id === null || data.customer_id === '')) {
      data.customer_id = this.user.customer_id;
    }
    if (!this.preserveMeta) validate(schema, data);
    const record = { ...data, ...meta, updated_date: meta.updated_date || meta.created_date };
    this.assertAllowed(schema, 'create', record, { nullMatchesUnresolved: true });
    return { data, meta: { ...meta, updated_date: meta.updated_date || meta.created_date }, record };
  }

  async insertRecords(name, prepared) {
    return withTransaction(async (client) => {
      const out = [];
      for (const { data, meta } of prepared) {
        const { rows } = await client.query(
          `INSERT INTO records (entity, id, data, created_date, updated_date, created_by, created_by_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (entity, id) DO ${this.preserveMeta ? 'UPDATE SET data = EXCLUDED.data, updated_date = EXCLUDED.updated_date, created_by = EXCLUDED.created_by, created_by_id = EXCLUDED.created_by_id' : 'NOTHING'}
           RETURNING *`,
          [name, meta.id, JSON.stringify(data), meta.created_date, meta.updated_date, meta.created_by, meta.created_by_id],
        );
        if (!rows[0]) throw new HttpError(409, `Já existe um registo ${name} com o id ${meta.id}`);
        out.push(rowToRecord(rows[0]));
      }
      return out;
    });
  }

  async create(name, input) {
    const schema = getSchema(name);
    if (name === 'User') return this.createUser(input);
    const prepared = this.prepareCreate(schema, input);
    const [record] = await this.insertRecords(name, [prepared]);
    emitEntityEvent({ entity: name, type: 'create', id: record.id, data: record, old_data: null });
    return record;
  }

  async bulkCreate(name, items) {
    if (!Array.isArray(items)) throw new HttpError(400, 'bulkCreate exige uma lista');
    if (items.length > MAX_BULK) throw new HttpError(413, `Máximo de ${MAX_BULK} registos por pedido`);
    if (items.length === 0) return [];
    const schema = getSchema(name);
    if (name === 'User') return Promise.all(items.map((i) => this.createUser(i)));
    const prepared = items.map((i) => this.prepareCreate(schema, i));
    const records = await this.insertRecords(name, prepared);
    for (const r of records) emitEntityEvent({ entity: name, type: 'create', id: r.id, data: r, old_data: null });
    return records;
  }

  async update(name, id, changes, { client = null, pendingEvents = null } = {}) {
    const schema = getSchema(name);
    if (name === 'User') return this.updateUser(id, changes);
    const run = async (c) => {
      const existing = await this.loadRaw(name, id, c);
      if (!existing) throw new HttpError(404, `${name} não encontrado: ${id}`);
      this.assertAllowed(schema, 'update', existing);
      const patch = this.preserveMeta ? { ...changes } : stripMeta(changes);
      for (const k of ['id', 'created_date', 'updated_date', 'created_by', 'created_by_id', '_id']) delete patch[k];
      const { id: _i, created_date: _c, updated_date: _u, created_by: _b, created_by_id: _bi, ...existingData } = existing;
      const merged = { ...existingData, ...patch };
      // Permitir remover campos com null (comportamento Base44: o valor fica null).
      validate(schema, merged, { partial: true });
      const now = new Date().toISOString();
      this.assertAllowed(schema, 'update', { ...merged, id: existing.id, created_by: existing.created_by, created_by_id: existing.created_by_id });
      const { rows } = await c.query(
        'UPDATE records SET data = $3, updated_date = $4 WHERE entity = $1 AND id = $2 RETURNING *',
        [name, existing.id, JSON.stringify(merged), now],
      );
      return { record: rowToRecord(rows[0]), existing };
    };
    const { record, existing } = client ? await run(client) : await withTransaction(run);
    const event = { entity: name, type: 'update', id: record.id, data: record, old_data: existing };
    if (pendingEvents) pendingEvents.push(event); else emitEntityEvent(event);
    return record;
  }

  async bulkUpdate(name, items) {
    if (!Array.isArray(items)) throw new HttpError(400, 'bulkUpdate exige uma lista de { id, ...campos }');
    if (items.length > MAX_BULK) throw new HttpError(413, `Máximo de ${MAX_BULK} registos por pedido`);
    if (name === 'User') return Promise.all(items.map(({ id, ...rest }) => this.updateUser(id, rest)));
    getSchema(name);
    const pendingEvents = [];
    const out = await withTransaction(async (client) => {
      const updated = [];
      for (const item of items) {
        if (!item?.id) throw new HttpError(400, 'Cada item de bulkUpdate precisa de "id"');
        const { id, ...changes } = item;
        updated.push(await this.update(name, id, changes, { client, pendingEvents }));
      }
      return updated;
    });
    pendingEvents.forEach(emitEntityEvent);
    return out;
  }

  async delete(name, id) {
    const schema = getSchema(name);
    if (name === 'User') return this.deleteUser(id);
    const existing = await this.loadRaw(name, id);
    if (!existing) throw new HttpError(404, `${name} não encontrado: ${id}`);
    this.assertAllowed(schema, 'delete', existing);
    await query('DELETE FROM records WHERE entity = $1 AND id = $2', [name, existing.id]);
    emitEntityEvent({ entity: name, type: 'delete', id: existing.id, data: existing, old_data: existing });
    return { success: true, id: existing.id };
  }

  async deleteMany(name, filter) {
    const schema = getSchema(name);
    if (name === 'User') throw new HttpError(400, 'deleteMany não é suportado para User');
    if (!filter || Object.keys(filter).length === 0) throw new HttpError(400, 'deleteMany exige um filtro não vazio');
    const access = this.accessFilter(schema, 'delete');
    if (access === false) throw new HttpError(this.user ? 403 : 401, 'Sem permissão');
    const params = new Params();
    const where = [`entity = ${params.add(name)}`, `(${filterToSql(RECORDS_TABLE, filter, params)})`];
    if (access !== true) where.push(`(${filterToSql(RECORDS_TABLE, access, params)})`);
    const { rows } = await query(`DELETE FROM records WHERE ${where.join(' AND ')} RETURNING *`, params.values);
    for (const row of rows) {
      const rec = rowToRecord(row);
      emitEntityEvent({ entity: name, type: 'delete', id: rec.id, data: rec, old_data: rec });
    }
    return { success: true, deleted: rows.length };
  }

  // --- utilizadores (entidade User) ----------------------------------------

  isAdmin() {
    return this.serviceRole || this.user?.role === 'admin';
  }

  async createUser(input) {
    if (!this.isAdmin()) throw new HttpError(403, 'Apenas administradores podem criar utilizadores');
    const { email, full_name, role, ...rest } = stripMeta(input);
    if (!email) throw new HttpError(422, 'O campo "email" é obrigatório');
    const id = this.preserveMeta && input.id ? String(input.id) : newId();
    if (role && !['admin', 'customer_admin', 'user', 'consultant'].includes(role)) throw new HttpError(422, `Papel inválido: ${role}`);
    // As listas de acesso delegado só entram pelo servidor (sincronização) ou numa importação com o papel de serviço.
    const data = Object.fromEntries(Object.entries(rest).filter(([k]) => !['password', 'password_hash', 'is_verified', 'disabled', 'token_version'].includes(k)
      && !(USER_SERVICE_ONLY.has(k) && !(this.serviceRole && this.preserveMeta))));
    const { rows } = await query(
      `INSERT INTO users (id, email, full_name, role, data, is_verified, created_date, updated_date)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::timestamptz, now()), COALESCE($8::timestamptz, now()))
       ON CONFLICT (lower(email)) DO NOTHING RETURNING *`,
      [id, String(email).trim().toLowerCase(), full_name ?? null, role || 'user', JSON.stringify(data),
        Boolean(input.is_verified ?? this.preserveMeta), this.preserveMeta ? input.created_date : null, this.preserveMeta ? input.updated_date : null],
    );
    if (!rows[0]) throw new HttpError(409, `Já existe um utilizador com o email ${email}`);
    const user = rowToUser(rows[0]);
    emitEntityEvent({ entity: 'User', type: 'create', id: user.id, data: user, old_data: null });
    return user;
  }

  async updateUser(id, changes) {
    const existing = await this.loadRaw('User', id);
    if (!existing) throw new HttpError(404, `Utilizador não encontrado: ${id}`);
    const admin = this.isAdmin();
    if (!admin && existing.id !== this.user?.id) throw new HttpError(403, 'Sem permissão para alterar este utilizador');

    const patch = stripMeta(changes);
    const columns = {};
    const dataPatch = {};
    // Lista de campos permitidos: os do esquema User + preferências da interface.
    const schemaFields = new Set(Object.keys(getSchema('User').properties || {}));
    for (const [k, v] of Object.entries(patch)) {
      if (k === 'role' || k === 'disabled' || k === 'is_verified') { if (admin) columns[k] = v; continue; }
      if (k === 'full_name') { columns.full_name = v === null ? null : String(v).slice(0, 200); continue; }
      if (k === 'email') { if (admin) columns.email = String(v).trim().toLowerCase(); continue; }
      if (!schemaFields.has(k) && !USER_UI_FIELDS.has(k)) continue;
      if (!admin && USER_PROTECTED.has(k)) continue; // utilizadores comuns não alteram papel nem cliente
      if (USER_SERVICE_ONLY.has(k)) {
        if (this.serviceRole && Array.isArray(v)) dataPatch[k] = v.map(String).slice(0, 1000);
        continue;
      }
      if (v !== null && typeof v === 'object') continue; // só valores simples
      dataPatch[k] = v;
    }
    if (columns.role !== undefined && !['admin', 'customer_admin', 'user', 'consultant'].includes(columns.role)) {
      throw new HttpError(422, `Papel inválido: ${columns.role}`);
    }
    const sets = ['data = data || $2::jsonb', 'updated_date = now()'];
    const values = [existing.id, JSON.stringify(dataPatch)];
    for (const [k, v] of Object.entries(columns)) { values.push(v); sets.push(`${k} = $${values.length}`); }
    if (columns.role !== undefined || columns.disabled) sets.push('token_version = token_version + 1');
    const { rows } = await query(`UPDATE users SET ${sets.join(', ')} WHERE id = $1 RETURNING *`, values);
    const user = rowToUser(rows[0]);
    emitEntityEvent({ entity: 'User', type: 'update', id: user.id, data: user, old_data: existing });
    return user;
  }

  async deleteUser(id) {
    if (!this.isAdmin()) throw new HttpError(403, 'Apenas administradores podem remover utilizadores');
    const existing = await this.loadRaw('User', id);
    if (!existing) throw new HttpError(404, `Utilizador não encontrado: ${id}`);
    await query('DELETE FROM users WHERE id = $1', [existing.id]);
    emitEntityEvent({ entity: 'User', type: 'delete', id: existing.id, data: existing, old_data: existing });
    return { success: true, id: existing.id };
  }

  /** Verifica se o utilizador atual pode ler um registo (usado no tempo real). */
  canRead(name, record) {
    if (this.serviceRole) return true;
    const filter = this.accessFilter(getSchema(name), 'read');
    if (filter === true) return true;
    if (filter === false) return false;
    return matchesFilter(record, filter, getField);
  }
}
