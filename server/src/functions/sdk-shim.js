// Substituto de 'npm:@base44/sdk' para as funções de backend executadas neste servidor.
// Expõe createClientFromRequest(req) com a mesma interface usada em base44/functions/*/entry.ts.
import { EntityService } from '../entities/service.js';
import { authenticateToken } from '../auth/routes.js';
import { invokeLLM } from '../integrations/llm.js';
import { sendEmail } from '../integrations/email.js';
import { putFile } from '../integrations/storage.js';
import { getConnection } from '../connectors.js';
import { HttpError } from '../util.js';

function sdkError(status, message) {
  const err = new HttpError(status, message);
  err.response = { status, data: { message } };
  return err;
}

function entitiesProxy(getService) {
  return new Proxy({}, {
    get(_, name) {
      if (typeof name !== 'string' || name === 'then') return undefined;
      return {
        list: async (...a) => (await getService()).list(name, ...a),
        filter: async (...a) => (await getService()).filter(name, ...a),
        get: async (id) => (await getService()).get(name, id),
        create: async (data) => (await getService()).create(name, data),
        bulkCreate: async (items) => (await getService()).bulkCreate(name, items),
        update: async (id, data) => (await getService()).update(name, id, data),
        bulkUpdate: async (items) => (await getService()).bulkUpdate(name, items),
        delete: async (id) => (await getService()).delete(name, id),
        deleteMany: async (q) => (await getService()).deleteMany(name, q),
        subscribe: () => () => {},
      };
    },
  });
}

async function toBuffer(file) {
  if (!file) throw sdkError(400, 'UploadFile: "file" é obrigatório');
  if (Buffer.isBuffer(file)) return { buffer: file };
  if (file instanceof Uint8Array) return { buffer: Buffer.from(file) };
  if (typeof file.arrayBuffer === 'function') {
    return { buffer: Buffer.from(await file.arrayBuffer()), filename: file.name, contentType: file.type };
  }
  throw sdkError(400, 'UploadFile: tipo de ficheiro não suportado');
}

function integrations(getUser) {
  const Core = {
    InvokeLLM: (params) => invokeLLM(params),
    SendEmail: (params) => sendEmail(params),
    UploadFile: async ({ file }) => {
      const { buffer, filename, contentType } = await toBuffer(file);
      const user = await getUser();
      const { file_url } = await putFile(buffer, { filename, contentType, createdBy: user?.email || 'system' });
      return { file_url };
    },
  };
  return {
    Core: new Proxy(Core, {
      get(target, key) {
        if (key in target) return target[key];
        return async () => { throw sdkError(501, `Integração Core.${String(key)} não disponível no servidor próprio`); };
      },
    }),
  };
}

export function createClientFromRequest(req, { invokeFunction } = {}) {
  const header = req?.headers?.get?.('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  let userPromise = null;
  const getUser = () => (userPromise ??= authenticateToken(token).then((r) => r?.user || null).catch(() => null));

  const functions = {
    invoke: async (name, data) => {
      const invoke = invokeFunction || (await import('./runtime.js')).invokeFunction;
      const res = await invoke(name, data || {}, { token });
      return { data: res.data, status: res.status, headers: res.headers };
    },
  };

  const client = {
    auth: {
      me: async () => {
        const user = await getUser();
        if (!user) throw sdkError(401, 'Autenticação necessária');
        return user;
      },
      isAuthenticated: async () => Boolean(await getUser()),
      updateMe: async (data) => {
        const user = await client.auth.me();
        return new EntityService({ user }).updateUser(user.id, data);
      },
    },
    entities: entitiesProxy(async () => new EntityService({ user: await getUser() })),
    integrations: integrations(getUser),
    functions,
    users: {
      inviteUser: () => { throw sdkError(501, 'users.inviteUser não está disponível dentro de funções'); },
    },
    asServiceRole: {
      entities: entitiesProxy(async () => new EntityService({ serviceRole: true })),
      integrations: integrations(async () => null),
      connectors: { getConnection: (name) => getConnection(name) },
      functions,
    },
  };
  return client;
}

export const createClient = () => { throw new Error('createClient não é suportado nas funções do servidor próprio; use createClientFromRequest(req).'); };

export default { createClientFromRequest, createClient };
