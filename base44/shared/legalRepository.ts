/**
 * Regras partilhadas do repositório legal (Layer 1 da base de conhecimento).
 *
 * O repositório é da plataforma (não tem tenant), pelo que a escrita não vive
 * numa RLS de entidade: vive em `manageLegalRepository`, que decide a partir
 * deste ficheiro quem escreve, o que é imutável e o que conta como revisão
 * vencida. Assim as três entidades (`CompetentAuthority`, `FrameworkProfile`,
 * `LegalDocumentVersion`) são legíveis por qualquer utilizador autenticado e
 * não têm nenhum caminho de escrita no browser.
 */

import { normalizeRole } from "./accessUtils.ts";

/**
 * Escrita: a decisão sobre o texto legal é da administração da plataforma.
 * Revisão (verificação de links e da versão em vigor): a equipa de conteúdo,
 * que inclui o analista de GRC como revisor.
 */
export const REPOSITORY_WRITE_ROLES = ["master_admin"];
export const REPOSITORY_REVIEW_ROLES = ["master_admin", "grc_analyst"];

export const VERSION_TYPES = ["original", "transposicao", "consolidada", "emenda", "norma_tecnica"] as const;
export const VERSION_STATUSES = ["current", "superseded", "draft", "withdrawn"] as const;
export const AUTHORITY_ROLES = ["regulador", "supervisor", "auditor", "organismo_normalizador", "acreditacao"] as const;
export const AUTHORITY_COUNTRIES = ["PT", "EU", "INT"] as const;
export const COPYRIGHT_REGIMES = ["archiveable", "metadata_only"] as const;

export type VersionStatus = (typeof VERSION_STATUSES)[number];

export class LegalRepositoryError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function assertRole(user: any, roles: string[], code: string, message: string): string {
  const role = normalizeRole(user?.role);
  if (!roles.includes(role)) throw new LegalRepositoryError(code, message, 403);
  return role;
}

/** Escrita do repositório (ficha, versões, retirada, arquivo). */
export function assertRepositoryWriter(user: any): string {
  return assertRole(
    user,
    REPOSITORY_WRITE_ROLES,
    "forbidden",
    "Apenas a administração da plataforma pode alterar o repositório legal.",
  );
}

/** Verificação periódica (links oficiais e versão em vigor). */
export function assertRepositoryReviewer(user: any): string {
  return assertRole(
    user,
    REPOSITORY_REVIEW_ROLES,
    "forbidden",
    "Apenas a equipa de conteúdo pode verificar o repositório legal.",
  );
}

/** Data de revisão a partir da verificação e do ciclo da ficha, em meses. */
export function reviewDueFrom(verifiedAt: string, months: number): string {
  const base = new Date(verifiedAt);
  if (Number.isNaN(base.getTime())) return verifiedAt;
  const due = new Date(base);
  due.setMonth(due.getMonth() + (Number.isFinite(months) ? months : 12));
  return due.toISOString();
}

/** Estado de frescura de uma ficha ou versão. */
export function freshnessOf(record: any, now = Date.now()): "fresh" | "due" | "unverified" {
  const verified = record?.verified_at ? new Date(record.verified_at).getTime() : NaN;
  if (Number.isNaN(verified)) return "unverified";
  const due = record?.review_due_at ? new Date(record.review_due_at).getTime() : NaN;
  if (!Number.isNaN(due) && due < now) return "due";
  return "fresh";
}

export function isReviewDue(record: any, now = Date.now()): boolean {
  return freshnessOf(record, now) === "due";
}

/** SHA-256 em hexadecimal — usado para a cópia arquivada de uma versão. */
export async function sha256Hex(input: string | Uint8Array): Promise<string> {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Verificação automática de uma ligação oficial.
 *
 * O `verification_method` existe exactamente por isto: a seed e a ação `verify`
 * dizem se a ligação foi mesmo contactada (`link_check`) ou se a verificação foi
 * declarada por uma pessoa (`manual`). Sem resposta, a versão fica por
 * verificar — nunca se escreve `verified_at` sem ter verificado nada.
 */
export interface LinkCheckResult {
  ok: boolean;
  /** `ok`, `no_url`, `http_<estado>` ou `network_error: …` — fica registado. */
  reason: string;
}

export async function checkOfficialLink(url: string, timeoutMs = 4000): Promise<LinkCheckResult> {
  if (!url) return { ok: false, reason: "no_url" };

  let lastReason = "no_response";
  const attempt = async (method: string): Promise<LinkCheckResult | null> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { method, redirect: "follow", signal: controller.signal });
      if (res.status < 400) return { ok: true, reason: "ok" };
      lastReason = `http_${res.status}`;
      return null;
    } catch (error) {
      lastReason = `network_error: ${(error as Error)?.message || "desconhecido"}`;
      return null;
    } finally {
      clearTimeout(timer);
    }
  };

  const get = await attempt("GET");
  if (get) return get;
  const head = await attempt("HEAD");
  if (head) return head;
  return { ok: false, reason: lastReason };
}

/** Registo de auditoria de uma decisão sobre o repositório. */
export async function writeLegalAuditLog(
  base44: any,
  action: string,
  details: string,
  entityType: string,
  entityId: string,
  userEmail: string,
): Promise<void> {
  await base44.asServiceRole.entities.AuditLog.create({
    customer_id: "",
    action,
    user_email: userEmail || "",
    entity_type: entityType,
    entity_id: entityId || "",
    details,
  });
}
