// Cliente para o servidor próprio (pasta server/), com a mesma interface que o SDK @base44/sdk
// usado pela aplicação: entities, auth, users, functions, integrations e agents.
// Ativado com VITE_BACKEND_MODE=selfhosted (ver src/api/base44Client.js).

const TOKEN_KEY = 'base44_access_token';

const storage = {
  get(key) { try { return window.localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { window.localStorage.setItem(key, value); } catch { /* armazenamento indisponível */ } },
  remove(key) { try { window.localStorage.removeItem(key); } catch { /* armazenamento indisponível */ } },
};

function apiError(status, data, fallback) {
  const message = (data && (data.message || data.error)) || fallback || `Erro ${status}`;
  const err = new Error(message);
  err.status = status;
  err.data = data;
  err.response = { status, data }; // compatível com o formato axios do SDK Base44
  return err;
}

export function createSelfHostedClient({ serverUrl = '', token: initialToken = null } = {}) {
  const base = `${String(serverUrl).replace(/\/+$/, '')}/api`;
  let token = initialToken || storage.get(TOKEN_KEY);
  if (initialToken) storage.set(TOKEN_KEY, initialToken);

  const authHeaders = () => (token ? { Authorization: `Bearer ${token}` } : {});

  async function request(method, path, { body, query, form, raw = false, signal } = {}) {
    const url = new URL(`${base}${path}`, window.location.origin);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v === undefined || v === null || v === '') continue;
        url.searchParams.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
      }
    }
    const headers = { ...authHeaders() };
    let payload;
    if (form) payload = form;
    else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
    let res;
    try {
      res = await fetch(url, { method, headers, body: payload, signal });
    } catch (e) {
      throw apiError(0, null, `Sem ligação ao servidor: ${e.message}`);
    }
    const text = await res.text();
    let data = null;
    if (text) { try { data = JSON.parse(text); } catch { data = text; } }
    if (!res.ok) throw apiError(res.status, data);
    return raw ? { data, status: res.status, headers: Object.fromEntries(res.headers.entries()) } : data;
  }

  // --- tempo real (SSE sobre fetch, para poder enviar o cabeçalho Authorization) ---
  function openStream(query, onEvent) {
    let stopped = false;
    let controller = null;
    let retry = 1000;
    const run = async () => {
      while (!stopped) {
        controller = new AbortController();
        try {
          const url = new URL(`${base}/realtime`, window.location.origin);
          Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));
          const res = await fetch(url, { headers: { ...authHeaders(), Accept: 'text/event-stream' }, signal: controller.signal });
          if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
          retry = 1000;
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let idx;
            while ((idx = buffer.indexOf('\n\n')) >= 0) {
              const chunk = buffer.slice(0, idx);
              buffer = buffer.slice(idx + 2);
              let type = 'message';
              const dataLines = [];
              for (const line of chunk.split('\n')) {
                if (line.startsWith('event:')) type = line.slice(6).trim();
                else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
              }
              if (dataLines.length) {
                try { onEvent(type, JSON.parse(dataLines.join('\n'))); } catch (e) { console.warn('[realtime]', e); }
              }
            }
          }
        } catch (e) {
          if (stopped || e.name === 'AbortError') return;
        }
        if (stopped) return;
        await new Promise((r) => setTimeout(r, retry));
        retry = Math.min(retry * 2, 30000);
      }
    };
    run();
    return () => { stopped = true; controller?.abort(); };
  }

  // --- entidades ---
  const entityApi = (name) => {
    const p = `/entities/${encodeURIComponent(name)}`;
    return {
      list: (sort, limit, skip, fields) => request('GET', p, { query: { sort, limit, skip, fields } }),
      filter: (q, sort, limit, skip, fields) => request('GET', p, { query: { q: q || {}, sort, limit, skip, fields } }),
      get: (id) => request('GET', `${p}/${encodeURIComponent(id)}`),
      create: (data) => request('POST', p, { body: data || {} }),
      bulkCreate: (items) => request('POST', `${p}/bulk`, { body: items || [] }),
      update: (id, data) => request('PUT', `${p}/${encodeURIComponent(id)}`, { body: data || {} }),
      bulkUpdate: (items) => request('PUT', `${p}/bulk`, { body: items || [] }),
      delete: (id) => request('DELETE', `${p}/${encodeURIComponent(id)}`),
      deleteMany: (q) => request('POST', `${p}/delete-many`, { body: q || {} }),
      schema: () => request('GET', `${p}/schema`),
      subscribe: (callback) => openStream({ entities: name }, (type, event) => {
        if (type === 'entity' && event.entity === name) callback({ type: event.type, id: event.id, data: event.data, entity: name });
      }),
      importEntities: () => Promise.reject(apiError(501, null, 'importEntities não está disponível no servidor próprio')),
    };
  };
  const entityCache = new Map();
  const entities = new Proxy({}, {
    get(_, name) {
      if (typeof name !== 'string' || name === 'then') return undefined;
      if (!entityCache.has(name)) entityCache.set(name, entityApi(name));
      return entityCache.get(name);
    },
  });

  const absoluteUrl = (u) => new URL(u || '/', window.location.origin).toString();

  const setToken = (newToken, save = true) => {
    token = newToken || null;
    if (!save) return;
    if (token) storage.set(TOKEN_KEY, token); else storage.remove(TOKEN_KEY);
  };

  // --- autenticação ---
  const auth = {
    me: () => request('GET', '/auth/me'),
    updateMe: (data) => request('PUT', '/auth/me', { body: data || {} }),
    isAuthenticated: async () => {
      if (!token) return false;
      try { await auth.me(); return true; } catch { return false; }
    },
    loginViaEmailPassword: async (email, password) => {
      const res = await request('POST', '/auth/login', { body: { email, password } });
      setToken(res.access_token);
      return res;
    },
    register: (payload) => request('POST', '/auth/register', { body: payload || {} }),
    verifyOtp: (payload) => request('POST', '/auth/verify-otp', { body: payload || {} }),
    resendOtp: (email) => request('POST', '/auth/resend-otp', { body: { email } }),
    resetPasswordRequest: (email) => request('POST', '/auth/reset-password-request', { body: { email } }),
    resetPassword: (payload) => request('POST', '/auth/reset-password', { body: payload || {} }),
    changePassword: async (payload) => {
      const res = await request('POST', '/auth/change-password', { body: payload || {} });
      if (res?.access_token) setToken(res.access_token);
      return res;
    },
    loginWithProvider: (provider, fromUrl = '/') => {
      window.location.href = `${absoluteUrl(`${base}/auth/oauth/${encodeURIComponent(provider)}`)}?from_url=${encodeURIComponent(absoluteUrl(fromUrl))}`;
    },
    providers: () => request('GET', '/auth/providers'),
    logout: (redirectUrl) => {
      request('POST', '/auth/logout').catch(() => {});
      setToken(null);
      if (redirectUrl !== false) window.location.href = redirectUrl || '/login';
    },
    redirectToLogin: (nextUrl) => {
      const returnTo = nextUrl ? `?returnTo=${encodeURIComponent(new URL(nextUrl, window.location.origin).pathname)}` : '';
      window.location.href = `/login${returnTo}`;
    },
    setToken,
  };

  // --- integrações ---
  const Core = new Proxy({
    UploadFile: ({ file }) => {
      const form = new FormData();
      form.append('file', file);
      return request('POST', '/integrations/Core/UploadFile', { form });
    },
  }, {
    get(target, key) {
      if (key in target) return target[key];
      if (typeof key !== 'string' || key === 'then') return undefined;
      return (params) => request('POST', `/integrations/Core/${encodeURIComponent(key)}`, { body: params || {} });
    },
  });

  // --- agentes ---
  const agents = {
    listConversations: ({ agent_name } = {}) => request('GET', '/agents/conversations', { query: { agent_name } }),
    getConversation: (id) => request('GET', `/agents/conversations/${encodeURIComponent(id)}`),
    createConversation: (payload) => request('POST', '/agents/conversations', { body: payload || {} }),
    updateConversation: (id, payload) => request('PUT', `/agents/conversations/${encodeURIComponent(id)}`, { body: payload || {} }),
    deleteConversation: (id) => request('DELETE', `/agents/conversations/${encodeURIComponent(id)}`),
    addMessage: (conversation, message) => request('POST', `/agents/conversations/${encodeURIComponent(conversation?.id || conversation)}/messages`, { body: message || {} }),
    subscribeToConversation: (id, callback) => openStream({ conversation: id }, (type, data) => { if (type === 'conversation') callback(data); }),
  };

  return {
    mode: 'selfhosted',
    entities,
    auth,
    users: { inviteUser: (email, role = 'user') => request('POST', '/users/invite', { body: { email, role } }) },
    functions: { invoke: (name, data) => request('POST', `/functions/${encodeURIComponent(name)}`, { body: data || {}, raw: true }) },
    integrations: { Core },
    agents,
    connectors: {
      list: () => request('GET', '/connectors'),
      authorize: async (name, returnUrl) => {
        const { url } = await request('POST', `/connectors/${encodeURIComponent(name)}/authorize`, { body: { return_url: absoluteUrl(returnUrl || window.location.pathname) } });
        window.location.href = url;
      },
      disconnect: (name) => request('DELETE', `/connectors/${encodeURIComponent(name)}`),
    },
    appInfo: () => request('GET', '/app/info'),
    setToken,
  };
}
