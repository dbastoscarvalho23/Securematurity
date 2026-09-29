/**
 * Cliente do harness de validação multi-identidade.
 *
 * Dois alvos, escolhidos por `BASE44_HARNESS_TARGET` (ou `--target=` na linha de
 * comandos), nunca os dois ao mesmo tempo:
 *
 *   local (por omissão) — o backend local do `base44 dev`. A sessão é a do CLI
 *     (`base44 login`) e cada invocação diz quem actua pelo cabeçalho
 *     `x-base44-dev-actor`, honrado só com `BASE44_DEV_IDENTITY=1` (variável que
 *     existe apenas no alvo local).
 *
 *   cloud — o backend REAL. Não há injecção de identidade: cada caso
 *     identifica-se com o token da conta correspondente, lido de um ficheiro
 *     FORA do git (`BASE44_HARNESS_TOKENS`, por omissão
 *     `/run/base44/harness-tokens.json`). Também não há isenção de limitação de
 *     ritmo — os limites são os reais (um `429` é limite atingido, não defeito).
 */
import fs from "node:fs";

const AUTH_FILE = process.env.BASE44_AUTH_FILE || "/root/.base44/auth/auth.json";
const PROJECT_FILE = process.env.BASE44_PROJECT_FILE || "base44/.app.jsonc";
const LOCAL_BACKEND = process.env.BASE44_BACKEND_URL || "http://localhost:4400";
const TOKENS_FILE = process.env.BASE44_HARNESS_TOKENS || "/run/base44/harness-tokens.json";

/** As nove contas, uma por papel — é isto que o ficheiro de tokens tem de cobrir. */
export const REQUIRED_ROLES = [
  "master_admin",
  "workspace_admin",
  "customer_admin",
  "grc_analyst",
  "control_owner",
  "executive",
  "auditor",
  "employee",
  "consultant",
];

export function target() {
  return process.env.BASE44_HARNESS_TARGET || "local";
}

export function isCloud() {
  return target() === "cloud";
}

export function tokensFile() {
  return TOKENS_FILE;
}

let localCache = null;

/** Token, app id e email da sessão do CLI (a identidade autenticada real, alvo local). */
export function env() {
  if (localCache) return localCache;
  const auth = JSON.parse(fs.readFileSync(AUTH_FILE, "utf8"));
  const project = JSON.parse(fs.readFileSync(PROJECT_FILE, "utf8"));
  if (!auth.accessToken) throw new Error(`Sem accessToken em ${AUTH_FILE}`);
  localCache = { appId: project.id, token: auth.accessToken, email: auth.email || "" };
  return localCache;
}

/** Cabeçalho com a identidade de teste (JSON em base64). Só o alvo local o honra. */
export function actorHeader(actor) {
  return Buffer.from(JSON.stringify(actor), "utf8").toString("base64");
}

let cloudCache = null;

/**
 * App id, contas e backend do alvo cloud. O ficheiro de tokens é o caminho
 * principal; as variáveis de ambiente seguras (`BASE44_HARNESS_TOKEN_*`) são a
 * alternativa quando as credenciais chegam por essa via. O ficheiro é opcional.
 */
function cloudEnv() {
  if (cloudCache) return cloudCache;
  const file = fs.existsSync(TOKENS_FILE)
    ? JSON.parse(fs.readFileSync(TOKENS_FILE, "utf8"))
    : {};
  const appId = String(file.app_id || process.env.VITE_BASE44_APP_ID || "").replace(/[^0-9a-f]/gi, "");
  const backend = String(
    file.base_url || process.env.BASE44_BACKEND_URL || process.env.VITE_BASE44_APP_BASE_URL || "",
  ).replace(/\/$/, "");
  if (!appId || !backend) {
    throw new Error(
      "Alvo cloud: falta o app id (app_id ou VITE_BASE44_APP_ID) ou o backend (VITE_BASE44_APP_BASE_URL).",
    );
  }
  cloudCache = { appId, accounts: file.accounts || file.tokens || {}, backend };
  return cloudCache;
}

/** Sufixo de uma chave de conta, para o nome da variável de ambiente. */
const envSuffix = (key) => String(key).toUpperCase().replace(/[^A-Z0-9]+/g, "_");

/**
 * Conta do alvo cloud: pela chave da identidade (`workspace_admin_alfa`), pelo
 * papel (`workspace_admin`) ou pelo email — no ficheiro de tokens ou nas
 * variáveis `BASE44_HARNESS_TOKEN_<CHAVE>` / `BASE44_HARNESS_EMAIL_<CHAVE>`.
 *
 * O papel é o mínimo aceitável: as duas identidades de administrador de parceiro
 * caem na mesma conta quando só existe o papel `workspace_admin`, e nesse caso os
 * casos de carteira medem o âmbito dessa conta.
 */
export function cloudAccount(ref) {
  const { accounts } = cloudEnv();
  const candidates = typeof ref === "string" ? [ref] : [ref?.key, ref?.role, ref?.email];
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (accounts[candidate]) return accounts[candidate];
    const suffix = envSuffix(candidate);
    const token = process.env[`BASE44_HARNESS_TOKEN_${suffix}`];
    if (token) {
      return { email: process.env[`BASE44_HARNESS_EMAIL_${suffix}`] || candidate, token };
    }
  }
  throw new Error(`Sem token para «${candidates.filter(Boolean)[0] || "?"}» em ${TOKENS_FILE}.`);
}

/**
 * Recusa cedo — e a dizer o que falta — quando o alvo cloud não tem o que precisa.
 * A suíte da nuvem escreve num backend real, pelo que nunca corre por omissão e
 * nunca arranca com identidades em falta.
 */
export function assertCloudReady() {
  if (!isCloud()) return;
  cloudEnv();
  const { accounts } = cloudEnv();
  const missing = REQUIRED_ROLES.filter((role) => {
    if (accounts[role]) return false;
    if (Object.keys(accounts).some((key) => key.startsWith(role))) return false;
    return !process.env[`BASE44_HARNESS_TOKEN_${envSuffix(role)}`];
  });
  if (missing.length) {
    throw new Error(
      [
        `Alvo cloud sem conta para: ${missing.join(", ")}.`,
        `Cada conta vem do ficheiro FORA do git ${TOKENS_FILE} (nunca em git, nunca em chat):`,
        '{ "app_id": "<app id>", "accounts": { "<papel>": { "email": "...", "token": "..." } } }',
        "O token de cada conta é o `base44_access_token` da sessão dessa conta no browser.",
        "Alternativa por variáveis de ambiente seguras: BASE44_HARNESS_TOKEN_<PAPEL> (e BASE44_HARNESS_EMAIL_<PAPEL>).",
      ].join("\n"),
    );
  }
}

/** Endereço do backend do alvo em curso. */
export function backend() {
  return isCloud() ? cloudEnv().backend : LOCAL_BACKEND;
}

/** App id e cabeçalhos do alvo em curso, para a identidade indicada. */
function requestContext(actor, rateLimit) {
  if (isCloud()) {
    const { appId } = cloudEnv();
    const account = cloudAccount(actor);
    return {
      appId,
      // Sem `x-base44-dev-actor` e sem `x-base44-rate-limit`: no backend real a
      // identidade é a sessão da conta e a limitação de ritmo é a real.
      headers: {
        "Content-Type": "application/json",
        "Base44-App-Id": appId,
        Authorization: `Bearer ${account.token}`,
      },
    };
  }
  const { appId, token } = env();
  const headers = {
    "Content-Type": "application/json",
    "Base44-App-Id": appId,
    Authorization: `Bearer ${token}`,
    "x-base44-rate-limit": rateLimit,
  };
  if (actor) headers["x-base44-dev-actor"] = actorHeader(actor);
  return { appId, headers };
}

/**
 * Invoca uma função de backend, opcionalmente com uma identidade explícita.
 *
 * `rateLimit` (só no alvo local) diz à limitação de ritmo (OP-S2) o que fazer
 * com esta chamada: o harness local corre centenas de chamadas do mesmo ator,
 * pelo que pede `off` por omissão — o cabeçalho só é honrado quando
 * `BASE44_DEV_IDENTITY=1` (o fecho hermético do `devActor.ts`). Um caso que
 * queira medir o `429` passa `on`. No alvo cloud o cabeçalho não é enviado.
 */
export async function invoke(name, { actor, body = {}, rateLimit = "off" } = {}) {
  const { appId, headers } = requestContext(actor, rateLimit);
  const res = await fetch(`${backend()}/api/apps/${appId}/functions/${name}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

/** Lista uma entidade (RLS aplicada à sessão da identidade indicada). */
export async function listEntity(entity, { actor } = {}) {
  const { appId, headers } = requestContext(actor, "off");
  const res = await fetch(`${backend()}/api/apps/${appId}/entities/${entity}`, { headers });
  const text = await res.text();
  try {
    return { status: res.status, data: JSON.parse(text) };
  } catch {
    return { status: res.status, data: text };
  }
}
