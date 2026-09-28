/**
 * Cliente do harness de validação multi-identidade.
 *
 * Fala com o backend LOCAL (o mesmo que o `base44 dev` levanta), usando a sessão
 * do CLI para autenticar e o cabeçalho `x-base44-dev-actor` para dizer, em cada
 * invocação, que utilizador de teste está a actuar. Sem esse cabeçalho o
 * backend comporta-se como sempre (sessão única) — a identidade explícita só
 * existe porque `BASE44_DEV_IDENTITY=1` está definida no ambiente local.
 */
import fs from "node:fs";

const AUTH_FILE = process.env.BASE44_AUTH_FILE || "/root/.base44/auth/auth.json";
const PROJECT_FILE = process.env.BASE44_PROJECT_FILE || "base44/.app.jsonc";
const BACKEND = process.env.BASE44_BACKEND_URL || "http://localhost:4400";

let cached = null;

/** Token, app id e email da sessão do CLI (a identidade autenticada real). */
export function env() {
  if (cached) return cached;
  const auth = JSON.parse(fs.readFileSync(AUTH_FILE, "utf8"));
  const project = JSON.parse(fs.readFileSync(PROJECT_FILE, "utf8"));
  if (!auth.accessToken) throw new Error(`Sem accessToken em ${AUTH_FILE}`);
  cached = { appId: project.id, token: auth.accessToken, email: auth.email || "" };
  return cached;
}

/** Cabeçalho com a identidade de teste (JSON em base64). */
export function actorHeader(actor) {
  return Buffer.from(JSON.stringify(actor), "utf8").toString("base64");
}

/** Invoca uma função de backend, opcionalmente com uma identidade explícita. */
export async function invoke(name, { actor, body = {} } = {}) {
  const { appId, token } = env();
  const headers = {
    "Content-Type": "application/json",
    "Base44-App-Id": appId,
    Authorization: `Bearer ${token}`,
  };
  if (actor) headers["x-base44-dev-actor"] = actorHeader(actor);

  const res = await fetch(`${BACKEND}/api/apps/${appId}/functions/${name}`, {
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

/** Lista uma entidade (RLS aplicada à sessão autenticada). */
export async function listEntity(entity, { actor } = {}) {
  const { appId, token } = env();
  const headers = { "Base44-App-Id": appId, Authorization: `Bearer ${token}` };
  if (actor) headers["x-base44-dev-actor"] = actorHeader(actor);
  const res = await fetch(`${BACKEND}/api/apps/${appId}/entities/${entity}`, { headers });
  const text = await res.text();
  try {
    return { status: res.status, data: JSON.parse(text) };
  } catch {
    return { status: res.status, data: text };
  }
}
