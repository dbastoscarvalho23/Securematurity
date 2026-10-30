// Ligação ao PostgreSQL e migrações do esquema.
import pg from 'pg';
import { config } from './config.js';

const { Pool, types } = pg;

// Devolver timestamps como texto ISO (compatível com o formato Base44).
types.setTypeParser(1184, (v) => (v === null ? null : new Date(v).toISOString())); // timestamptz
types.setTypeParser(20, (v) => (v === null ? null : Number(v))); // bigint (count)

export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
  max: 20,
});

pool.on('error', (err) => console.error('[db] erro inesperado no pool:', err.message));

export const query = (text, params) => pool.query(text, params);

export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

const MIGRATIONS = [
  {
    version: 1,
    name: 'esquema inicial',
    sql: `
      CREATE TABLE IF NOT EXISTS records (
        entity        text        NOT NULL,
        id            text        NOT NULL,
        data          jsonb       NOT NULL DEFAULT '{}'::jsonb,
        created_date  timestamptz NOT NULL DEFAULT now(),
        updated_date  timestamptz NOT NULL DEFAULT now(),
        created_by    text,
        created_by_id text,
        PRIMARY KEY (entity, id)
      );
      CREATE INDEX IF NOT EXISTS records_entity_created_idx ON records (entity, created_date DESC);
      CREATE INDEX IF NOT EXISTS records_data_gin_idx ON records USING gin (data jsonb_path_ops);
      CREATE INDEX IF NOT EXISTS records_customer_idx ON records (entity, (data->>'customer_id'));

      CREATE TABLE IF NOT EXISTS users (
        id             text        PRIMARY KEY,
        email          text        NOT NULL,
        password_hash  text,
        full_name      text,
        role           text        NOT NULL DEFAULT 'user',
        data           jsonb       NOT NULL DEFAULT '{}'::jsonb,
        is_verified    boolean     NOT NULL DEFAULT false,
        disabled       boolean     NOT NULL DEFAULT false,
        token_version  integer     NOT NULL DEFAULT 0,
        last_login     timestamptz,
        created_date   timestamptz NOT NULL DEFAULT now(),
        updated_date   timestamptz NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users (lower(email));

      CREATE TABLE IF NOT EXISTS auth_tokens (
        token_hash  text        PRIMARY KEY,
        purpose     text        NOT NULL,
        email       text        NOT NULL,
        data        jsonb       NOT NULL DEFAULT '{}'::jsonb,
        attempts    integer     NOT NULL DEFAULT 0,
        expires_at  timestamptz NOT NULL,
        used_at     timestamptz,
        created_at  timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS auth_tokens_email_idx ON auth_tokens (lower(email), purpose);

      CREATE TABLE IF NOT EXISTS files (
        key          text        PRIMARY KEY,
        filename     text,
        content_type text,
        size         bigint,
        created_by   text,
        created_date timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS conversations (
        id           text        PRIMARY KEY,
        agent_name   text        NOT NULL,
        user_id      text        NOT NULL,
        metadata     jsonb       NOT NULL DEFAULT '{}'::jsonb,
        messages     jsonb       NOT NULL DEFAULT '[]'::jsonb,
        created_date timestamptz NOT NULL DEFAULT now(),
        updated_date timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS conversations_user_idx ON conversations (user_id, agent_name, created_date DESC);

      CREATE TABLE IF NOT EXISTS connector_connections (
        name          text        PRIMARY KEY,
        access_token  text,
        refresh_token text,
        expires_at    timestamptz,
        scopes        text,
        account_email text,
        connected_by  text,
        updated_date  timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS oauth_states (
        state      text        PRIMARY KEY,
        data       jsonb       NOT NULL,
        expires_at timestamptz NOT NULL
      );

      CREATE TABLE IF NOT EXISTS workflow_runs (
        id            bigserial   PRIMARY KEY,
        workflow      text        NOT NULL,
        trigger_key   text,
        status        text        NOT NULL,
        detail        jsonb,
        created_date  timestamptz NOT NULL DEFAULT now(),
        finished_date timestamptz
      );
      CREATE UNIQUE INDEX IF NOT EXISTS workflow_runs_trigger_idx ON workflow_runs (workflow, trigger_key) WHERE trigger_key IS NOT NULL;
    `,
  },
  {
    version: 2,
    name: 'ficheiros privados',
    // Ficheiros guardados com UploadPrivateFile: só se descarregam com ligação assinada.
    sql: `ALTER TABLE files ADD COLUMN IF NOT EXISTS private boolean NOT NULL DEFAULT false;`,
  },
];

export async function migrate() {
  await query(`CREATE TABLE IF NOT EXISTS schema_migrations (version integer PRIMARY KEY, name text, applied_at timestamptz NOT NULL DEFAULT now())`);
  // Bloqueio consultivo para evitar migrações concorrentes com várias instâncias.
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(424242)');
    const { rows } = await client.query('SELECT version FROM schema_migrations');
    const applied = new Set(rows.map((r) => r.version));
    for (const m of MIGRATIONS) {
      if (applied.has(m.version)) continue;
      await client.query('BEGIN');
      try {
        await client.query(m.sql);
        await client.query('INSERT INTO schema_migrations (version, name) VALUES ($1, $2)', [m.version, m.name]);
        await client.query('COMMIT');
        console.log(`[db] migração ${m.version} aplicada (${m.name})`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock(424242)').catch(() => {});
    client.release();
  }
}
