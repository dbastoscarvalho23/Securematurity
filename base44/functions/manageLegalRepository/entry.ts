import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { FRAMEWORK_BY_CODE } from "../../shared/frameworkCatalogue.ts";
import {
  AUTHORITY_COUNTRIES,
  AUTHORITY_ROLES,
  COPYRIGHT_REGIMES,
  LegalRepositoryError,
  VERSION_STATUSES,
  VERSION_TYPES,
  assertRepositoryReviewer,
  assertRepositoryWriter,
  checkOfficialLink,
  reviewDueFrom,
  writeLegalAuditLog,
} from "../../shared/legalRepository.ts";

/**
 * manageLegalRepository — a única porta de escrita do repositório legal
 * (Layer 1). As três entidades são legíveis por qualquer utilizador
 * autenticado e **não** têm caminho de escrita no browser: tudo passa por aqui,
 * com o ator real registado em `AuditLog`.
 *
 * Ações:
 * - `upsert_profile`      criar/editar a ficha «at a glance» (master_admin)
 * - `add_version`         acrescentar uma edição do documento (master_admin) —
 *                         cria sempre uma linha nova e, quando substitui a
 *                         anterior, fecha-a com `effective_to`; o texto de uma
 *                         versão publicada nunca é alterado
 * - `supersede_version`   fechar uma versão em vigor sem acrescentar outra
 * - `verify`              verificação periódica do link e da versão (equipa de
 *                         conteúdo: master_admin ou grc_analyst) — atualiza
 *                         `verified_at`/`verified_by`/`review_due_at`
 * - `withdraw`            retirar uma versão do repositório (ficha histórica)
 * - `archive`             arquivar a ficha de um framework
 * - `upsert_authority`    criar/editar a entidade competente
 *
 * Imutabilidade: nenhuma ação escreve `document_title`, `legal_reference`,
 * `official_url`, `summary` ou `content_hash` de uma versão existente. Corrigir
 * texto publicado faz-se acrescentando uma versão, não editando a anterior.
 */

const VERSION_FIELDS = [
  "version_label",
  "version_type",
  "status",
  "effective_from",
  "effective_to",
  "document_title",
  "legal_reference",
  "issuing_authority",
  "official_source",
  "official_url",
  "mirror_url",
  "attachment_name",
  "language",
  "page_count",
  "content_hash",
  "summary",
  "summary_en",
  "change_note",
] as const;

/** Campos que descrevem o conteúdo do documento — imutáveis depois de criados. */
const IMMUTABLE_AFTER_CREATE = [
  "version_label",
  "version_type",
  "document_title",
  "legal_reference",
  "issuing_authority",
  "official_source",
  "language",
  "summary",
  "summary_en",
  "content_hash",
] as const;

function pick(source: any, fields: readonly string[]): Record<string, any> {
  const out: Record<string, any> = {};
  for (const field of fields) {
    if (source?.[field] !== undefined) out[field] = source[field];
  }
  return out;
}

function requireFields(payload: Record<string, any>, fields: string[]): void {
  const missing = fields.filter((field) => {
    const value = payload[field];
    return value === undefined || value === null || String(value).trim() === "";
  });
  if (missing.length) {
    throw new LegalRepositoryError("missing_fields", `Campos obrigatórios em falta: ${missing.join(", ")}.`, 422);
  }
}

/** A versão passa a substituída: a anterior fecha-se, nunca se reescreve. */
function supersedePatch(effectiveTo: string | null) {
  return {
    status: "superseded",
    effective_to: effectiveTo || new Date().toISOString().slice(0, 10),
  };
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = body.action;

    // Verificação periódica: a equipa de conteúdo, incluindo o revisor de GRC.
    if (action === "verify") return await handleVerify(base44, user, body);

    // Todas as restantes ações são decisões de plataforma.
    assertRepositoryWriter(user);
    const actor = user.email || "unknown";

    switch (action) {
      case "upsert_profile":
        return await handleUpsertProfile(base44, actor, body);
      case "upsert_authority":
        return await handleUpsertAuthority(base44, actor, body);
      case "add_version":
        return await handleAddVersion(base44, actor, body);
      case "supersede_version":
        return await handleSupersede(base44, actor, body);
      case "withdraw":
        return await handleWithdraw(base44, actor, body);
      case "archive":
        return await handleArchive(base44, actor, body);
      default:
        return Response.json({ error: "Acção inválida.", code: "unknown_action" }, { status: 400 });
    }
  } catch (error) {
    if (error instanceof LegalRepositoryError) {
      return Response.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// ─── Ficha «at a glance» ───────────────────────────────────────
async function handleUpsertProfile(base44: any, actor: string, body: any) {
  const input = body.profile || {};
  const frameworkCode = String(input.framework_code || "").trim();
  if (!FRAMEWORK_BY_CODE.has(frameworkCode)) {
    throw new LegalRepositoryError("unknown_framework", `Framework desconhecido: ${frameworkCode}.`, 422);
  }

  const catalogueEntry = FRAMEWORK_BY_CODE.get(frameworkCode);
  const payload: Record<string, any> = {
    ...pick(input, [
      "display_name",
      "display_name_en",
      "acronym",
      "mission",
      "mission_en",
      "scope_areas",
      "scope_areas_en",
      "objectives",
      "objectives_en",
      "applicability",
      "applicability_en",
      "obligations",
      "penalties",
      "penalties_en",
      "certifiability",
      "certifiability_en",
      "related_frameworks",
      "references",
      "copyright_notice",
      "review_cycle_months",
    ]),
    framework_code: frameworkCode,
    catalogue_key: catalogueEntry!.key,
  };
  requireFields(payload, ["display_name", "mission", "mission_en", "applicability"]);

  const existing = await base44.asServiceRole.entities.FrameworkProfile.filter({ framework_code: frameworkCode });
  const current = Array.isArray(existing) && existing.length ? existing[0] : null;

  if (!current) {
    const created = await base44.asServiceRole.entities.FrameworkProfile.create({
      ...payload,
      competent_authority_codes: input.competent_authority_codes?.length
        ? input.competent_authority_codes
        : catalogueEntry!.authority_codes,
      review_cycle_months: payload.review_cycle_months || 12,
      verified_at: null,
      verified_by: null,
      verification_method: null,
      is_active: true,
      archived_at: null,
    });
    await writeLegalAuditLog(base44, "legal_profile_upserted", `Ficha criada para ${frameworkCode}.`, "FrameworkProfile", created.id, actor);
    return Response.json({ profile: created, created: true });
  }

  // A verificação é da ação `verify`: editar a ficha nunca a marca como verificada.
  const updated = await base44.asServiceRole.entities.FrameworkProfile.update(current.id, {
    ...payload,
    is_active: input.is_active !== false,
  });
  await writeLegalAuditLog(base44, "legal_profile_upserted", `Ficha de ${frameworkCode} atualizada (${Object.keys(payload).join(", ")}).`, "FrameworkProfile", current.id, actor);
  return Response.json({ profile: updated, created: false });
}

// ─── Entidade competente ───────────────────────────────────────
async function handleUpsertAuthority(base44: any, actor: string, body: any) {
  const input = body.authority || {};
  const code = String(input.code || "").trim();
  if (!code) throw new LegalRepositoryError("missing_fields", "O código da entidade é obrigatório.", 422);

  const payload: Record<string, any> = pick(input, [
    "name",
    "name_en",
    "website_url",
    "legal_basis",
    "legal_basis_en",
    "contact",
    "enforcement_register_url",
    "frameworks",
    "notes",
    "notes_en",
  ]);
  requireFields(payload, ["name", "website_url"]);
  if (!AUTHORITY_COUNTRIES.includes(input.country)) {
    throw new LegalRepositoryError("unsupported_country", "País inválido (PT, EU ou INT).", 422);
  }
  if (!AUTHORITY_ROLES.includes(input.role)) {
    throw new LegalRepositoryError("unsupported_role", "Papel inválido da entidade competente.", 422);
  }
  payload.country = input.country;
  payload.role = input.role;

  const existing = await base44.asServiceRole.entities.CompetentAuthority.filter({ code });
  const current = Array.isArray(existing) && existing.length ? existing[0] : null;

  const saved = current
    ? await base44.asServiceRole.entities.CompetentAuthority.update(current.id, { ...payload, is_active: input.is_active !== false })
    : await base44.asServiceRole.entities.CompetentAuthority.create({ ...payload, code, is_active: true });

  await writeLegalAuditLog(base44, "legal_profile_upserted", `Entidade competente ${code} ${current ? "atualizada" : "criada"}.`, "CompetentAuthority", saved.id, actor);
  return Response.json({ authority: saved, created: !current });
}

// ─── Versões ───────────────────────────────────────────────────
async function handleAddVersion(base44: any, actor: string, body: any) {
  const input = body.version || {};
  const frameworkCode = String(input.framework_code || "").trim();
  if (!FRAMEWORK_BY_CODE.has(frameworkCode)) {
    throw new LegalRepositoryError("unknown_framework", `Framework desconhecido: ${frameworkCode}.`, 422);
  }
  const catalogueEntry = FRAMEWORK_BY_CODE.get(frameworkCode);

  const payload: Record<string, any> = pick(input, VERSION_FIELDS);
  requireFields(payload, ["version_label", "document_title", "effective_from"]);
  if (!VERSION_TYPES.includes(payload.version_type)) {
    throw new LegalRepositoryError("unsupported_type", "Tipo de versão inválido.", 422);
  }
  const status = VERSION_STATUSES.includes(payload.status) ? payload.status : "draft";
  payload.status = status;
  payload.effective_to = status === "superseded" ? payload.effective_to || null : null;

  // Direitos de autor: uma norma paga nunca entra no repositório com cópia.
  if (catalogueEntry!.copyright === "metadata_only" && (payload.mirror_url || payload.content_hash)) {
    throw new LegalRepositoryError(
      "copyright_metadata_only",
      `${frameworkCode} é uma norma paga: o repositório guarda metadados, ligação oficial e resumo próprio — nunca uma cópia do texto.`,
      422,
    );
  }
  if (!COPYRIGHT_REGIMES.includes(catalogueEntry!.copyright)) {
    throw new LegalRepositoryError("unknown_copyright_regime", "Regime de direitos de autor desconhecido.", 422);
  }

  const duplicated = await base44.asServiceRole.entities.LegalDocumentVersion.filter({
    framework_code: frameworkCode,
    version_label: payload.version_label,
  });
  if (Array.isArray(duplicated) && duplicated.length) {
    throw new LegalRepositoryError("version_exists", `A versão "${payload.version_label}" já existe para ${frameworkCode}.`, 409);
  }

  // A versão que esta substitui: explícita, ou a que está em vigor sem sucessor.
  let supersedesId: string | null = body.supersedes_id || null;
  let previous: any = null;
  if (supersedesId) {
    previous = await base44.asServiceRole.entities.LegalDocumentVersion.get(supersedesId);
    if (!previous) throw new LegalRepositoryError("version_not_found", "Versão a substituir não encontrada.", 404);
    if (previous.framework_code !== frameworkCode) {
      throw new LegalRepositoryError("framework_mismatch", "A versão a substituir é de outro framework.", 422);
    }
  }

  const created = await base44.asServiceRole.entities.LegalDocumentVersion.create({
    ...payload,
    framework_code: frameworkCode,
    supersedes_id: supersedesId,
    copyright_regime: catalogueEntry!.copyright,
    mirror_url: payload.mirror_url ?? null,
    attachment_name: payload.attachment_name ?? null,
    page_count: payload.page_count ?? null,
    content_hash: payload.content_hash ?? null,
    change_note: payload.change_note ?? null,
    official_url: payload.official_url ?? null,
    summary: payload.summary || "",
    summary_en: payload.summary_en || "",
    withdrawn_reason: null,
    verified_at: null,
    verified_by: null,
    verification_method: null,
    review_due_at: null,
  });

  // Substituir fecha a anterior: a sua vigência termina quando a nova começa.
  if (previous && status === "current") {
    await base44.asServiceRole.entities.LegalDocumentVersion.update(previous.id, supersedePatch(payload.effective_from));
  }

  await writeLegalAuditLog(
    base44,
    "legal_version_added",
    JSON.stringify({
      framework_code: frameworkCode,
      version_label: payload.version_label,
      status,
      supersedes: previous?.version_label || null,
    }),
    "LegalDocumentVersion",
    created.id,
    actor,
  );

  return Response.json({ version: created, superseded: previous?.version_label || null });
}

async function handleSupersede(base44: any, actor: string, body: any) {
  const versionId = body.version_id;
  if (!versionId) throw new LegalRepositoryError("missing_id", "version_id é obrigatório.", 422);
  const version = await base44.asServiceRole.entities.LegalDocumentVersion.get(versionId);
  if (!version) throw new LegalRepositoryError("version_not_found", "Versão não encontrada.", 404);

  const updated = await base44.asServiceRole.entities.LegalDocumentVersion.update(
    versionId,
    supersedePatch(body.effective_to || null),
  );
  await writeLegalAuditLog(
    base44,
    "legal_version_superseded",
    `${version.framework_code} ${version.version_label} fechada em ${updated.effective_to}.`,
    "LegalDocumentVersion",
    versionId,
    actor,
  );
  return Response.json({ version: updated });
}

async function handleWithdraw(base44: any, actor: string, body: any) {
  const versionId = body.version_id;
  if (!versionId) throw new LegalRepositoryError("missing_id", "version_id é obrigatório.", 422);
  const reason = String(body.reason || "").trim();
  if (!reason) throw new LegalRepositoryError("reason_required", "A retirada exige um motivo.", 422);

  const version = await base44.asServiceRole.entities.LegalDocumentVersion.get(versionId);
  if (!version) throw new LegalRepositoryError("version_not_found", "Versão não encontrada.", 404);

  const updated = await base44.asServiceRole.entities.LegalDocumentVersion.update(versionId, {
    status: "withdrawn",
    withdrawn_reason: reason,
    effective_to: version.effective_to || new Date().toISOString().slice(0, 10),
  });
  await writeLegalAuditLog(
    base44,
    "legal_version_withdrawn",
    `${version.framework_code} ${version.version_label} retirada: ${reason}`,
    "LegalDocumentVersion",
    versionId,
    actor,
  );
  return Response.json({ version: updated });
}

// ─── Frescura ──────────────────────────────────────────────────
async function handleVerify(base44: any, user: any, body: any) {
  assertRepositoryReviewer(user);
  const actor = user.email || "unknown";
  const target = body.target === "profile" || body.target === "framework" ? body.target : "version";
  const id = body.id || body.version_id || body.profile_id;
  const frameworkCode = String(body.framework_code || "").trim();

  // Verificação de um framework inteiro: a ficha e todas as versões do seu
  // registo (é este o ato periódico de quem confirma as fontes oficiais).
  if (target === "framework") {
    if (!FRAMEWORK_BY_CODE.has(frameworkCode)) {
      throw new LegalRepositoryError("unknown_framework", `Framework desconhecido: ${frameworkCode}.`, 422);
    }
    return await verifyFramework(base44, actor, frameworkCode, body);
  }

  if (!id) throw new LegalRepositoryError("missing_id", "id é obrigatório.", 422);

  const entity =
    target === "profile"
      ? base44.asServiceRole.entities.FrameworkProfile
      : base44.asServiceRole.entities.LegalDocumentVersion;
  const record = await entity.get(id);
  if (!record) throw new LegalRepositoryError("not_found", "Registo não encontrado.", 404);

  // A verificação pode repetir a análise automática da ligação oficial; se o
  // servidor oficial não responder, fica registado como tal — não se declara
  // verificada uma ligação que ninguém confirmou.
  let method = body.method === "manual" ? "manual" : "link_check";
  if (target === "version" && body.check_link === true) {
    const check = await checkOfficialLink(record.official_url || "");
    method = check.ok ? "link_check" : "link_check_failed";
    if (!check.ok) {
      const failed = await entity.update(id, { verification_method: method });
      await writeLegalAuditLog(
        base44,
        "legal_version_verified",
        `${record.framework_code} ${record.version_label}: verificação automática não conclusiva (${record.official_url || "sem ligação"}) — ${check.reason}.`,
        "LegalDocumentVersion",
        id,
        actor,
      );
      return Response.json({ verified: false, method, reason: check.reason, record: failed });
    }
  }

  const now = new Date().toISOString();
  let cycleMonths = 12;
  if (target === "version") {
    const profiles = await base44.asServiceRole.entities.FrameworkProfile.filter({
      framework_code: record.framework_code,
    });
    cycleMonths = (Array.isArray(profiles) && profiles[0]?.review_cycle_months) || 12;
  } else {
    cycleMonths = record.review_cycle_months || 12;
  }

  const patch: Record<string, any> = {
    verified_at: now,
    verified_by: actor,
    verification_method: method,
    review_due_at: body.review_due_at || reviewDueFrom(now, cycleMonths),
  };
  const updated = await entity.update(id, patch);

  await writeLegalAuditLog(
    base44,
    "legal_version_verified",
    `${target === "profile" ? "Ficha" : "Versão"} ${record.framework_code || ""} ${record.version_label || ""} verificada (${method}); revisão devida em ${patch.review_due_at}.`,
    target === "profile" ? "FrameworkProfile" : "LegalDocumentVersion",
    id,
    actor,
  );

  return Response.json({ verified: true, method, review_due_at: patch.review_due_at, record: updated });
}

/**
 * Verificação de um framework inteiro: a ficha e todas as versões do registo
 * (em vigor e substituídas — o histórico também é revisto). É o ato periódico
 * de quem confirma as ligações e a versão oficial em vigor; fica registado com
 * o ator real e o método declarado.
 */
async function verifyFramework(base44: any, actor: string, frameworkCode: string, body: any) {
  const now = new Date().toISOString();
  const method = body.method === "link_check" ? "link_check" : "manual";

  const profiles = await base44.asServiceRole.entities.FrameworkProfile.filter({ framework_code: frameworkCode });
  const profile = Array.isArray(profiles) && profiles.length ? profiles[0] : null;
  const cycleMonths = profile?.review_cycle_months || 12;
  const dueAt = reviewDueFrom(now, cycleMonths);

  let verified = 0;
  let skipped = 0;
  if (profile) {
    await base44.asServiceRole.entities.FrameworkProfile.update(profile.id, {
      verified_at: now,
      verified_by: actor,
      verification_method: method,
    });
    verified += 1;
  }

  const versions = await base44.asServiceRole.entities.LegalDocumentVersion.filter({ framework_code: frameworkCode });
  for (const version of Array.isArray(versions) ? versions : []) {
    if (version.status === "draft" || version.status === "withdrawn") {
      skipped += 1;
      continue;
    }
    await base44.asServiceRole.entities.LegalDocumentVersion.update(version.id, {
      verified_at: now,
      verified_by: actor,
      verification_method: method,
      review_due_at: dueAt,
    });
    verified += 1;
  }

  await writeLegalAuditLog(
    base44,
    "legal_version_verified",
    `Repositório de ${frameworkCode} verificado (${method}): ${verified} registos, revisão devida em ${dueAt}${profile ? "" : " — ficha em falta"}.`,
    "FrameworkProfile",
    profile?.id || "",
    actor,
  );

  return Response.json({ verified: true, framework_code: frameworkCode, method, records: verified, skipped, review_due_at: dueAt });
}

// ─── Arquivar a ficha ──────────────────────────────────────────
async function handleArchive(base44: any, actor: string, body: any) {
  const profileId = body.profile_id;
  const frameworkCode = body.framework_code;
  let profile = null;
  if (profileId) {
    profile = await base44.asServiceRole.entities.FrameworkProfile.get(profileId);
  } else if (frameworkCode) {
    const found = await base44.asServiceRole.entities.FrameworkProfile.filter({ framework_code: frameworkCode });
    profile = Array.isArray(found) && found.length ? found[0] : null;
  }
  if (!profile) throw new LegalRepositoryError("not_found", "Ficha não encontrada.", 404);

  const updated = await base44.asServiceRole.entities.FrameworkProfile.update(profile.id, {
    is_active: false,
    archived_at: new Date().toISOString(),
  });
  await writeLegalAuditLog(
    base44,
    "legal_profile_archived",
    `Ficha de ${profile.framework_code} arquivada.`,
    "FrameworkProfile",
    profile.id,
    actor,
  );
  return Response.json({ profile: updated });
}
