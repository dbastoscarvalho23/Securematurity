// Configuração central do servidor, lida a partir de variáveis de ambiente.
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const env = process.env;

const bool = (v, d = false) => (v === undefined || v === '' ? d : ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase()));
const int = (v, d) => (v === undefined || v === '' || Number.isNaN(Number(v)) ? d : Number(v));

const isProduction = env.NODE_ENV === 'production';

function secret(name, { minLength = 32 } = {}) {
  const value = env[name];
  if (value && value.length >= minLength) return value;
  if (isProduction) {
    throw new Error(`A variável de ambiente ${name} é obrigatória em produção (mínimo ${minLength} caracteres).`);
  }
  const generated = crypto.randomBytes(32).toString('hex');
  console.warn(`[config] ${name} não definida — gerado um valor temporário (apenas para desenvolvimento).`);
  return generated;
}

const publicUrl = (env.PUBLIC_URL || `http://localhost:${int(env.PORT, 3001)}`).replace(/\/+$/, '');

export const config = {
  isProduction,
  port: int(env.PORT, 3001),
  host: env.HOST || '0.0.0.0',
  publicUrl,
  // URL pública da API (por omissão, a mesma origem do frontend com o prefixo /api).
  apiPublicUrl: (env.API_PUBLIC_URL || `${publicUrl}/api`).replace(/\/+$/, ''),
  corsOrigins: (env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
  trustProxy: bool(env.TRUST_PROXY, true),
  staticDir: env.STATIC_DIR ? path.resolve(env.STATIC_DIR) : null,
  base44Dir: path.resolve(env.BASE44_DIR || path.join(here, '..', '..', 'base44')),

  databaseUrl: env.DATABASE_URL || 'postgres://ankoraone:ankoraone@localhost:5432/ankoraone',
  databaseSsl: bool(env.DATABASE_SSL, false),

  jwtSecret: secret('JWT_SECRET'),
  jwtExpiresIn: int(env.JWT_EXPIRES_IN_SECONDS, 7 * 24 * 3600),
  automationSecret: secret('AUTOMATION_SECRET'),

  allowPublicSignup: bool(env.ALLOW_PUBLIC_SIGNUP, true),
  requireEmailVerification: bool(env.REQUIRE_EMAIL_VERIFICATION, true),
  bootstrapAdminEmail: env.BOOTSTRAP_ADMIN_EMAIL || '',
  bootstrapAdminPassword: env.BOOTSTRAP_ADMIN_PASSWORD || '',

  entityDefaultLimit: int(env.ENTITY_DEFAULT_LIMIT, 1000),
  entityMaxLimit: int(env.ENTITY_MAX_LIMIT, 10000),
  strictSchemaValidation: bool(env.STRICT_SCHEMA_VALIDATION, true),
  autoStampCustomerId: bool(env.AUTO_STAMP_CUSTOMER_ID, true),

  enableScheduler: bool(env.ENABLE_SCHEDULER, true),
  functionTimeoutMs: int(env.FUNCTION_TIMEOUT_MS, 120000),
  maxBodyBytes: int(env.MAX_BODY_MB, 10) * 1024 * 1024,
  maxUploadBytes: int(env.MAX_UPLOAD_MB, 50) * 1024 * 1024,

  smtp: {
    host: env.SMTP_HOST || '',
    port: int(env.SMTP_PORT, 587),
    secure: bool(env.SMTP_SECURE, false),
    user: env.SMTP_USER || '',
    pass: env.SMTP_PASS || '',
    from: env.MAIL_FROM || env.SMTP_USER || 'no-reply@localhost',
    fromName: env.MAIL_FROM_NAME || 'AnkoraOne',
  },

  llm: {
    provider: (env.LLM_PROVIDER || (env.ANTHROPIC_API_KEY ? 'anthropic' : env.OPENAI_API_KEY ? 'openai' : '')).toLowerCase(),
    anthropicApiKey: env.ANTHROPIC_API_KEY || '',
    anthropicBaseUrl: (env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/+$/, ''),
    anthropicModel: env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
    openaiApiKey: env.OPENAI_API_KEY || '',
    openaiBaseUrl: (env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, ''),
    openaiModel: env.OPENAI_MODEL || 'gpt-4o',
    maxTokens: int(env.LLM_MAX_TOKENS, 8192),
    timeoutMs: int(env.LLM_TIMEOUT_MS, 180000),
  },

  storage: {
    driver: (env.STORAGE_DRIVER || (env.S3_BUCKET ? 's3' : 'local')).toLowerCase(),
    localDir: path.resolve(env.STORAGE_LOCAL_DIR || path.join(here, '..', 'data', 'uploads')),
    s3: {
      endpoint: (env.S3_ENDPOINT || '').replace(/\/+$/, ''),
      region: env.S3_REGION || 'us-east-1',
      bucket: env.S3_BUCKET || '',
      accessKeyId: env.S3_ACCESS_KEY_ID || '',
      secretAccessKey: env.S3_SECRET_ACCESS_KEY || '',
      forcePathStyle: bool(env.S3_FORCE_PATH_STYLE, true),
    },
  },

  oauth: {
    google: { clientId: env.GOOGLE_CLIENT_ID || '', clientSecret: env.GOOGLE_CLIENT_SECRET || '' },
    microsoft: {
      clientId: env.MICROSOFT_CLIENT_ID || '',
      clientSecret: env.MICROSOFT_CLIENT_SECRET || '',
      tenant: env.MICROSOFT_TENANT || 'common',
    },
  },
};

// As funções Base44 leem o segredo de automação através de Deno.env.
process.env.AUTOMATION_SECRET = config.automationSecret;
