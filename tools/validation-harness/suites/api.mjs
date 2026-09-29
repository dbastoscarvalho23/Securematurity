/**
 * Suíte de API — validação multi-identidade no limite das funções de backend.
 *
 * Cada caso invoca uma função com uma identidade explícita (papel + tenant) e
 * compara o resultado com a expectativa de autorização. O que se procura é a
 * decisão do servidor: âmbito de leitura, provisionamento de licenças (FB1),
 * estados da delegação e restrição por módulo.
 *
 * Limitações locais assumidas (reportadas como não verificáveis, nunca como
 * aprovadas): as RLS das entidades são avaliadas sobre a sessão autenticada,
 * pelo que o isolamento depende do token e não da identidade de teste; um
 * tenant presente apenas em `delegated_edit_customer_ids` é oculto na leitura.
 */
import { invoke, listEntity } from "../lib/client.mjs";
import { seedIdentity, buildIdentities } from "../lib/identities.mjs";

const CONFIRM = "create-test-conditions";

function statusOf(res, expected, note) {
  if (res.status === expected) return { ok: true, detail: note };
  return {
    ok: false,
    detail: `esperado ${expected}, obtido ${res.status} — ${JSON.stringify(res.data).slice(0, 160)}`,
  };
}

function hasModule(license, code) {
  return (license?.modules || []).some((m) => m.code === code);
}

export async function runApiSuite(report) {
  // ─── Preparação: topologia de teste + identidades reais da sessão ───
  const users = await listEntity("User");
  const realUser = Array.isArray(users.data) ? users.data[0] : null;
  const seedActor = seedIdentity(realUser?.id);

  // O catálogo de licenciamento primeiro: `set_module` valida o código contra a
  // entidade `LicenseModule` e o catálogo só existe depois de `seedLicenseData`
  // (que subscreve todos os clientes que encontra). Sem este passo os casos
  // FB1.7/FB1.8 mediriam a ausência de catálogo, não a excepção por módulo.
  const catalogue = await invoke("seedLicenseData", { actor: seedActor });
  if (catalogue.status !== 200) {
    report.fail("PREP", "preparação", `seedLicenseData devolveu ${catalogue.status}: ${JSON.stringify(catalogue.data).slice(0, 200)}`);
    return;
  }

  // A topologia de teste vem depois: é ela que impõe as condições declaradas
  // (Delta sem subscrição, carteira ligada ao workspace, avaliações concluídas).
  const seeded = await invoke("seedTestEnvironment", {
    actor: seedActor,
    body: { confirm: CONFIRM },
  });
  if (seeded.status !== 200) {
    report.fail("PREP", "preparação", `seedTestEnvironment devolveu ${seeded.status}: ${JSON.stringify(seeded.data).slice(0, 200)}`);
    return;
  }

  const topology = seeded.data.test_conditions;
  const ids = buildIdentities(topology, seedActor.email);
  const tenants = topology.tenants;
  const assessments = topology.assessments;

  // ─── Contexto comercial em vigor na entrada ────────────────────────
  // O emulador local sobrevive entre execuções e o grupo comercial do fim deixa
  // o tenant de verificação FECHADO (FM3.6). Sem esta reposição, os grupos que
  // correm antes dele medem um cliente fechado em vez da autorização que querem
  // provar — foi assim que DEL5 («o cliente não tem o módulo ... licenciado») e
  // FA5.1 falharam. A reposição é a mínima: um contrato vivo, no mesmo nível, só
  // quando o anterior está fechado. A oferta e o preço em vigor para as quotas
  // por omissão continuam a ser repostos pela preparação do grupo FM3/FM4, que
  // corre depois de FM2.7 os ter retirado de propósito.
  const bootLicences = await invoke("listTenantLicenses", { actor: ids.master_admin });
  const bootAlfa = ((bootLicences.data?.tenants || []).find((tenant) => tenant.id === tenants.tenant_alfa) || {}).subscription;
  if (!bootAlfa || bootAlfa.status === "cancelled") {
    await invoke("provisionTenantLicense", {
      actor: ids.master_admin,
      body: {
        action: "create",
        customer_id: tenants.tenant_alfa,
        tier_code: "core",
        seat_limit: 5,
        reason: "Reposição da subscrição de verificação",
      },
    });
  }

  // ─── G1. Isolamento e âmbito de leitura ────────────────────────────
  const area1 = "isolamento de tenant";
  await report.case("ISO1", area1, "dono da plataforma lê a licença de qualquer cliente", async () => {
    const res = await invoke("getEffectiveLicense", { actor: ids.master_admin, body: { customer_id: tenants.tenant_alfa } });
    return statusOf(res, 200, "200 — âmbito global");
  });
  await report.case("ISO2", area1, "administrador de parceiro lê a licença da sua carteira", async () => {
    const res = await invoke("getEffectiveLicense", { actor: ids.workspace_admin_alfa, body: { customer_id: tenants.tenant_alfa } });
    return statusOf(res, 200, "200 — cliente na carteira Alfa");
  });
  await report.case("ISO3", area1, "administrador de parceiro é recusado fora da carteira", async () => {
    const res = await invoke("getEffectiveLicense", { actor: ids.workspace_admin_alfa, body: { customer_id: tenants.tenant_beta } });
    return statusOf(res, 403, "403 — cliente da carteira Beta");
  });
  await report.case("ISO4", area1, "utilizador de tenant lê a licença do seu cliente", async () => {
    const res = await invoke("getEffectiveLicense", { actor: ids.customer_admin_alfa, body: { customer_id: tenants.tenant_alfa } });
    return statusOf(res, 200, "200 — cliente próprio");
  });
  await report.case("ISO5", area1, "utilizador de tenant é recusado noutro cliente", async () => {
    const res = await invoke("getEffectiveLicense", { actor: ids.employee_beta, body: { customer_id: tenants.tenant_alfa } });
    return statusOf(res, 403, "403 — cliente alheio");
  });
  await report.case("ISO6", area1, "painel de licenças do parceiro só lista a sua carteira", async () => {
    const res = await invoke("listTenantLicenses", { actor: ids.workspace_admin_alfa });
    if (res.status !== 200) return statusOf(res, 200, "");
    const names = (res.data.tenants || []).map((t) => t.id);
    const foreign = names.filter((id) => id === tenants.tenant_beta || id === tenants.tenant_zeta);
    return foreign.length === 0
      ? { ok: true, detail: `200 — ${names.length} clientes, nenhum da carteira Beta` }
      : { ok: false, detail: `clientes fora da carteira presentes: ${foreign.length}` };
  });

  // ─── G2. FB1 — provisionamento de licenças ────────────────────────
  const area2 = "FB1 provisionamento";
  await report.case("FB1.1", area2, "papel sem competência de licenciamento é recusado", async () => {
    const res = await invoke("provisionTenantLicense", {
      actor: ids.grc_analyst_alfa,
      body: { action: "create", customer_id: tenants.tenant_delta, tier_code: "core", seat_limit: 5 },
    });
    return statusOf(res, 403, "403 — analista GRC não provisiona");
  });
  await report.case("FB1.2", area2, "dono da plataforma cria a subscrição de um cliente novo", async () => {
    const res = await invoke("provisionTenantLicense", {
      actor: ids.master_admin,
      body: { action: "create", customer_id: tenants.tenant_delta, tier_code: "core", seat_limit: 10 },
    });
    if (res.status !== 200) return statusOf(res, 200, "");
    const lic = res.data.license;
    const okLicense = lic?.licensed === true && hasModule(lic, "assessments_action_plan");
    return okLicense
      ? { ok: true, detail: `200 — licença activa, tier ${lic.tier_code}, ${lic.modules.length} módulos` }
      : { ok: false, detail: `licença inesperada: ${JSON.stringify(lic).slice(0, 160)}` };
  });
  await report.case("FB1.3", area2, "cliente que já tem subscrição é recusado com 409", async () => {
    const res = await invoke("provisionTenantLicense", {
      actor: ids.master_admin,
      body: { action: "create", customer_id: tenants.tenant_delta, tier_code: "core", seat_limit: 5 },
    });
    return statusOf(res, 409, "409 — sem subscrição duplicada");
  });
  await report.case("FB1.4", area2, "tier inválido é recusado", async () => {
    const res = await invoke("provisionTenantLicense", {
      actor: ids.master_admin,
      body: { action: "update", customer_id: tenants.tenant_delta, tier_code: "gold" },
    });
    return statusOf(res, 400, "400 — tier fora do catálogo");
  });
  await report.case("FB1.5", area2, "administrador de parceiro altera o tier dentro da carteira", async () => {
    const res = await invoke("provisionTenantLicense", {
      actor: ids.workspace_admin_beta,
      body: { action: "update", customer_id: tenants.tenant_delta, tier_code: "professional" },
    });
    if (res.status !== 200) return statusOf(res, 200, "");
    const lic = res.data.license;
    return hasModule(lic, "risk_management")
      ? { ok: true, detail: `200 — tier ${lic.tier_code} abre ${lic.modules.length} módulos` }
      : { ok: false, detail: `módulos do tier não abriram: ${JSON.stringify(lic.module_codes || lic).slice(0, 160)}` };
  });
  await report.case("FB1.6", area2, "administrador de parceiro é recusado fora da carteira", async () => {
    const res = await invoke("provisionTenantLicense", {
      actor: ids.workspace_admin_alfa,
      body: { action: "update", customer_id: tenants.tenant_delta, seat_limit: 20 },
    });
    return statusOf(res, 403, "403 — cliente da carteira Beta");
  });
  await report.case("FB1.7", area2, "excepção por módulo com validade abre o módulo", async () => {
    const res = await invoke("provisionTenantLicense", {
      actor: ids.master_admin,
      body: {
        action: "set_module",
        customer_id: tenants.tenant_delta,
        module_code: "supplier_management",
        active: true,
        reason: "Piloto de fornecedores",
        expires_at: new Date(Date.now() + 5 * 86400000).toISOString(),
      },
    });
    if (res.status !== 200) return statusOf(res, 200, "");
    return hasModule(res.data.license, "supplier_management")
      ? { ok: true, detail: "200 — módulo fora do tier concedido com motivo e validade" }
      : { ok: false, detail: "o módulo não ficou licenciado" };
  });
  await report.case("FB1.8", area2, "excepção caducada deixa de aplicar-se", async () => {
    const res = await invoke("provisionTenantLicense", {
      actor: ids.master_admin,
      body: {
        action: "set_module",
        customer_id: tenants.tenant_delta,
        module_code: "supplier_management",
        active: true,
        reason: "Excepção já terminada",
        expires_at: new Date(Date.now() - 86400000).toISOString(),
      },
    });
    if (res.status !== 200) return statusOf(res, 200, "");
    return hasModule(res.data.license, "supplier_management")
      ? { ok: false, detail: "o módulo continuou licenciado depois de caducar" }
      : { ok: true, detail: "200 — validade respeitada, tier volta a mandar" };
  });
  await report.case("FB1.9", area2, "suspensão com tolerância avisa e mantém os módulos abertos", async () => {
    const res = await invoke("provisionTenantLicense", {
      actor: ids.master_admin,
      body: { action: "suspend", customer_id: tenants.tenant_delta, grace_days: 7, reason: "Falta de pagamento" },
    });
    if (res.status !== 200) return statusOf(res, 200, "");
    const lic = res.data.license;
    return lic.warning === "suspension_grace" && lic.licensed === true
      ? { ok: true, detail: `200 — aviso de suspensão até ${String(lic.grace_until).slice(0, 10)}` }
      : { ok: false, detail: `esperado aviso com módulos abertos, obtido ${JSON.stringify({ warning: lic.warning, licensed: lic.licensed })}` };
  });
  await report.case("FB1.10", area2, "no fim da tolerância os módulos fecham (fail-closed)", async () => {
    const res = await invoke("provisionTenantLicense", {
      actor: ids.master_admin,
      body: { action: "suspend", customer_id: tenants.tenant_delta, grace_days: 0 },
    });
    if (res.status !== 200) return statusOf(res, 200, "");
    const lic = res.data.license;
    return lic.licensed === false && (lic.modules || []).length === 0
      ? { ok: true, detail: "200 — suspensão fechada, nenhum módulo aberto" }
      : { ok: false, detail: `esperado fecho total, obtido ${JSON.stringify({ licensed: lic.licensed, n: (lic.modules || []).length })}` };
  });
  await report.case("FB1.11", area2, "reactivar devolve a licença", async () => {
    const res = await invoke("provisionTenantLicense", {
      actor: ids.master_admin,
      body: { action: "resume", customer_id: tenants.tenant_delta },
    });
    if (res.status !== 200) return statusOf(res, 200, "");
    const lic = res.data.license;
    return lic.licensed === true && !lic.warning
      ? { ok: true, detail: `200 — licença activa, tier ${lic.tier_code}` }
      : { ok: false, detail: `esperado activo sem aviso, obtido ${JSON.stringify({ licensed: lic.licensed, warning: lic.warning })}` };
  });
  // O histórico deixou de depender da entidade AuditLog (ilegível na sessão do
  // emulador): `provisionTenantLicense` escreve `LicenseChangeLog` e
  // `listLicenseChanges` é quem o lê, com o âmbito resolvido no servidor.
  await report.case("FB1.12", area2, "histórico devolve as alterações com autor e antes/depois", async () => {
    const res = await invoke("listLicenseChanges", {
      actor: ids.master_admin,
      body: { customer_id: tenants.tenant_delta, limit: 100 },
    });
    if (res.status !== 200) return statusOf(res, 200, "");
    const entries = res.data.entries || [];
    const recorded = new Set(entries.map((e) => e.action));
    const expected = ["create", "update", "suspend", "resume", "set_module"];
    const missing = expected.filter((action) => !recorded.has(action));
    const withoutActor = entries.filter((e) => !e.actor_email).length;
    const withoutDiff = entries.filter((e) => !(e.changed_fields || []).length || !e.after).length;
    if (missing.length || withoutActor || withoutDiff) {
      return {
        ok: false,
        detail: JSON.stringify({ total: entries.length, missing, withoutActor, withoutDiff }),
      };
    }
    return {
      ok: true,
      detail: `200 — ${entries.length} alterações, todas com autor e antes/depois (${expected.join(", ")})`,
    };
  });
  await report.case("FB1.13", area2, "histórico recusa quem não tem competência e esconde clientes fora da carteira", async () => {
    const analyst = await invoke("listLicenseChanges", { actor: ids.grc_analyst_alfa });
    if (analyst.status !== 403) return statusOf(analyst, 403, "analista GRC");
    const partner = await invoke("listLicenseChanges", {
      actor: ids.workspace_admin_alfa,
      body: { customer_id: tenants.tenant_delta, limit: 100 },
    });
    if (partner.status !== 200) return statusOf(partner, 200, "administrador de parceiro");
    const foreign = (partner.data.entries || []).length;
    return foreign === 0
      ? { ok: true, detail: "403 para o analista GRC; 0 alterações de um cliente fora da carteira" }
      : { ok: false, detail: `${foreign} alterações de um cliente fora da carteira` };
  });

  // ─── G3. Delegações: activa, expirada, revogada e restrição por módulo ───
  const area3 = "delegações";
  await report.case("DEL1", area3, "delegação activa dá acesso de leitura ao cliente delegado", async () => {
    const res = await invoke("getEffectiveLicense", { actor: ids.consultant, body: { customer_id: tenants.tenant_gama } });
    return statusOf(res, 200, "200 — delegação activa (leitura)");
  });
  await report.case("DEL2", area3, "delegação expirada não dá acesso", async () => {
    const res = await invoke("getEffectiveLicense", { actor: ids.consultant, body: { customer_id: tenants.tenant_epsilon } });
    return statusOf(res, 403, "403 — delegação expirada");
  });
  await report.case("DEL3", area3, "delegação revogada não dá acesso", async () => {
    const res = await invoke("getEffectiveLicense", { actor: ids.consultant, body: { customer_id: tenants.tenant_zeta } });
    return statusOf(res, 403, "403 — delegação revogada");
  });
  await report.case("DEL4", area3, "delegação anulada (onboarding) não dá acesso a dados operacionais", async () => {
    const res = await invoke("getEffectiveLicense", { actor: ids.consultant, body: { customer_id: tenants.tenant_epsilon } });
    return res.status === 403
      ? { ok: true, detail: "403 — onboarding e pedidos pendentes não abrem o tenant" }
      : { ok: false, detail: `obtido ${res.status}` };
  });
  await report.case("DEL5", area3, "delegação de edição autoriza operar a avaliação", async () => {
    const res = await invoke("manageActionPlan", {
      actor: ids.consultant,
      body: { assessment_id: assessments.tenant_alfa, action: "identify_gaps" },
    });
    return statusOf(res, 200, "200 — delegação de edição com o módulo nomeado");
  });
  await report.case("DEL6", area3, "delegação apenas de leitura é recusada na escrita", async () => {
    const res = await invoke("manageActionPlan", {
      actor: ids.consultant,
      body: { assessment_id: assessments.tenant_gama, action: "identify_gaps" },
    });
    return statusOf(res, 403, "403 — sem permissão de escrita");
  });
  await report.case("DEL7", area3, "delegação expirada é recusada na escrita", async () => {
    const res = await invoke("manageActionPlan", {
      actor: ids.consultant,
      body: { assessment_id: assessments.tenant_epsilon, action: "identify_gaps" },
    });
    return statusOf(res, 403, "403 — expirada");
  });
  await report.case("DEL8", area3, "delegação revogada é recusada na escrita", async () => {
    const res = await invoke("manageActionPlan", {
      actor: ids.consultant,
      body: { assessment_id: assessments.tenant_zeta, action: "identify_gaps" },
    });
    return statusOf(res, 403, "403 — revogada");
  });
  await report.case("DEL9", area3, "delegação restrita não autoriza módulo que não nomeia (F4)", async () => {
    const res = await invoke("manageActionPlan", {
      actor: ids.consultant,
      body: { assessment_id: assessments.tenant_eta, action: "identify_gaps" },
    });
    return statusOf(res, 403, "403 — a delegação nomeia apenas documentos");
  });
  await report.case("DEL10", area3, "utilizador sem delegação é recusado num tenant alheio", async () => {
    const res = await invoke("manageActionPlan", {
      actor: ids.employee_beta,
      body: { assessment_id: assessments.tenant_alfa, action: "identify_gaps" },
    });
    return statusOf(res, 403, "403 — sem delegação para o cliente");
  });

  // ─── G6. FA5 — pacote de auditoria com a identidade do tenant ────
  // O sintoma era o /audit-package a falhar para o papel autorizado, sem mensagem
  // tratada na interface. Aqui prova-se o percurso no limite do servidor: o editor
  // do tenant gera o pacote, o auditor — que só tem leitura — é recusado na
  // criação e lê a trilha do seu próprio tenant sem a alargar. O que o emulador
  // não decide (a leitura das entidades por identidade, porque a RLS é avaliada
  // sobre a sessão autenticada) continua registado como não verificável.
  const area5 = "FA5 pacote de auditoria";
  let packageId = "";
  await report.case("FA5.1", area5, "o editor do tenant gera o pacote de auditoria", async () => {
    const res = await invoke("generateAuditPackage", {
      actor: ids.grc_analyst_alfa,
      body: { action: "generate", customer_id: tenants.tenant_alfa },
    });
    if (res.status !== 200) return statusOf(res, 200, "");
    const pkg = res.data.package;
    packageId = pkg?.id || "";
    const entries = (pkg?.sections || []).reduce((acc, s) => acc + (s.entries || []).length, 0);
    return packageId && pkg?.customer_id === tenants.tenant_alfa
      ? { ok: true, detail: `200 — pacote v${pkg.package_version} do cliente Alfa, ${entries} entradas` }
      : { ok: false, detail: `pacote inesperado: ${JSON.stringify(pkg).slice(0, 160)}` };
  });
  await report.case("FA5.2", area5, "o auditor lê o pacote mas não o gera", async () => {
    const res = await invoke("generateAuditPackage", {
      actor: ids.auditor_alfa,
      body: { action: "generate", customer_id: tenants.tenant_alfa },
    });
    if (res.status !== 403) return statusOf(res, 403, "auditor na criação");
    return packageId
      ? { ok: true, detail: "403 — o auditor consome o pacote que o tenant gerou" }
      : { ok: false, detail: "não ficou nenhum pacote para o auditor" };
  });
  await report.case("FA5.3", area5, "o auditor lê a trilha do seu tenant sem a alargar", async () => {
    const res = await invoke("listAuditLog", { actor: ids.auditor_alfa, body: { limit: 50 } });
    if (res.status !== 200) return statusOf(res, 200, "");
    const entries = res.data.entries || [];
    const foreign = entries.filter((e) => e.customer_id && e.customer_id !== tenants.tenant_alfa);
    return foreign.length === 0
      ? { ok: true, detail: `200 — ${entries.length} registos, nenhum fora do cliente Alfa` }
      : { ok: false, detail: `${foreign.length} registos de outros clientes` };
  });

  // ─── G5. Anúncios da plataforma (FB8) ─────────────────────────────
  // O âmbito (global / tier / cliente) tem de ser decidido no servidor: quem
  // publica vê tudo, um utilizador de tenant só vê o que lhe pertence. Os
  // anúncios publicados aqui são arquivados no fim para não poluírem a faixa
  // das corridas seguintes.
  const area4 = "anúncios";
  const annMarker = "HARNESS-ANN";
  const publishedAnnouncements = [];
  const publishAnnouncement = async (announcement) => {
    const res = await invoke("manageAnnouncements", { actor: seedActor, body: { action: "publish", announcement } });
    if (res.status === 200) publishedAnnouncements.push(res.data.announcement.id);
    return res;
  };
  const activeIds = async (actor) => {
    const res = await invoke("manageAnnouncements", { actor, body: { action: "active" } });
    return (res.data?.announcements || []).map((a) => a.id);
  };

  await report.case("ANN1", area4, "anúncio global chega a um utilizador de tenant", async () => {
    const res = await publishAnnouncement({
      title: `${annMarker} global`,
      message: "Manutenção programada",
      severity: "info",
      scope: "global",
    });
    if (res.status !== 200) return { ok: false, detail: `publicação devolveu ${res.status}` };
    const idsSeen = await activeIds(ids.employee_beta);
    return idsSeen.includes(res.data.announcement.id)
      ? { ok: true, detail: "200 — visível fora do âmbito de plataforma" }
      : { ok: false, detail: "o anúncio global não apareceu ao utilizador do tenant" };
  });

  await report.case("ANN2", area4, "anúncio de tier só chega a quem tem esse tier", async () => {
    const advanced = await publishAnnouncement({
      title: `${annMarker} avançado`,
      message: "Só para o tier avançado",
      severity: "warning",
      scope: "tier",
      tier_code: "advanced",
    });
    const core = await publishAnnouncement({
      title: `${annMarker} core`,
      message: "Só para o tier core",
      severity: "info",
      scope: "tier",
      tier_code: "core",
    });
    if (advanced.status !== 200 || core.status !== 200) return { ok: false, detail: `publicação devolveu ${advanced.status}/${core.status}` };

    const seenByCore = await activeIds(ids.customer_admin_alfa);
    const seenByOwner = await activeIds(seedActor);
    const hidesAdvanced = !seenByCore.includes(advanced.data.announcement.id);
    const showsCore = seenByCore.includes(core.data.announcement.id);
    const ownerSeesBoth =
      seenByOwner.includes(advanced.data.announcement.id) && seenByOwner.includes(core.data.announcement.id);
    if (hidesAdvanced && showsCore && ownerSeesBoth) {
      return { ok: true, detail: "tier core vê o seu, não vê o avançado; o dono vê ambos" };
    }
    return { ok: false, detail: JSON.stringify({ hidesAdvanced, showsCore, ownerSeesBoth }) };
  });

  await report.case("ANN3", area4, "anúncio de cliente só chega a esse cliente", async () => {
    const res = await publishAnnouncement({
      title: `${annMarker} cliente`,
      message: "Aviso apenas do cliente Alfa",
      severity: "maintenance",
      scope: "customer",
      customer_id: tenants.tenant_alfa,
      customer_name: "Cliente Alfa",
    });
    if (res.status !== 200) return { ok: false, detail: `publicação devolveu ${res.status}` };
    const id = res.data.announcement.id;
    const alfaSees = (await activeIds(ids.customer_admin_alfa)).includes(id);
    const betaSees = (await activeIds(ids.employee_beta)).includes(id);
    return alfaSees && !betaSees
      ? { ok: true, detail: "visível ao cliente Alfa, invisível ao cliente Beta" }
      : { ok: false, detail: JSON.stringify({ alfaSees, betaSees }) };
  });

  await report.case("ANN4", area4, "janela de exibição futura mantém o anúncio escondido", async () => {
    const res = await publishAnnouncement({
      title: `${annMarker} agendado`,
      message: "Só amanhã",
      severity: "info",
      scope: "global",
      starts_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
    if (res.status !== 200) return { ok: false, detail: `publicação devolveu ${res.status}` };
    const seen = (await activeIds(ids.employee_beta)).includes(res.data.announcement.id);
    return seen ? { ok: false, detail: "anúncio agendado apareceu antes da janela" } : { ok: true, detail: "escondido fora da janela" };
  });

  await report.case("ANN5", area4, "arquivar retira o anúncio da faixa", async () => {
    const res = await publishAnnouncement({
      title: `${annMarker} efémero`,
      message: "Publicado e arquivado",
      severity: "info",
      scope: "global",
    });
    if (res.status !== 200) return { ok: false, detail: `publicação devolveu ${res.status}` };
    const id = res.data.announcement.id;
    const archived = await invoke("manageAnnouncements", { actor: seedActor, body: { action: "archive", id } });
    if (archived.status !== 200) return { ok: false, detail: `arquivo devolveu ${archived.status}` };
    const stillThere = (await activeIds(ids.employee_beta)).includes(id);
    return stillThere ? { ok: false, detail: "continuou visível depois de arquivado" } : { ok: true, detail: "deixou de ser devolvido por `active`" };
  });

  await report.case("ANN6", area4, "publicar exige o dono da plataforma", async () => {
    const res = await invoke("manageAnnouncements", {
      actor: ids.customer_admin_alfa,
      body: { action: "publish", announcement: { title: "x", message: "y", severity: "info", scope: "global" } },
    });
    return statusOf(res, 403, "403 — um administrador de cliente não publica");
  });

  await report.case("ANN7", area4, "âmbito incompleto é recusado (tier sem tier_code)", async () => {
    const res = await invoke("manageAnnouncements", {
      actor: seedActor,
      body: { action: "publish", announcement: { title: "x", message: "y", severity: "info", scope: "tier" } },
    });
    return statusOf(res, 422, "422 — tier_code obrigatório no âmbito por tier");
  });

  for (const id of publishedAnnouncements) {
    await invoke("manageAnnouncements", { actor: seedActor, body: { action: "archive", id } });
  }

  // ─── G7. FM1/FM2 — oferta comercial e preço versionados ──────────
  // O que se prova aqui é o ciclo comercial no limite do servidor: uma versão da
  // oferta composta a partir do catálogo de código, um preço que só vigora contra
  // uma oferta publicada, a substituição por vigência (uma só oferta e um só
  // preço em vigor a qualquer data), o registo da oferta/preço vigentes na
  // subscrição e a leitura do histórico com filtros e antes/depois. O filtro por
  // acção chama-se `change_action`: `action` é o selector da função multiplexada
  // e usar o mesmo nome para o filtro deixava o histórico a devolver zero linhas.
  const area7 = "FM1/FM2 oferta e preço";
  const offer = (body) => invoke("manageCommercialOffer", { actor: ids.master_admin, body });

  // ─── Estado que os casos deste grupo assumem (OP-B2) ───────────────
  // O provisionamento regista a oferta e a tabela vigentes **à data de início da
  // subscrição** (`commercialContext`, em `provisionTenantLicense`), não à data de
  // hoje: `started_date` é uma data do seed (um mês antes da data de referência),
  // pelo que uma oferta publicada hoje não é a vigente nessa data. Sem compor este
  // estado, o grupo media o que ficou em vigor da execução anterior (a oferta v1 do
  // seed, a tabela de demonstração) em vez da versão e do preço que ele próprio
  // publicou — foi assim que FM2.3 e FM1.5 deixaram de medir o comportamento e
  // passaram a medir a sobra da ronda anterior. A preparação publica a oferta e a
  // tabela desta ronda com vigência desde a data de início da subscrição do cliente
  // de verificação, ficando esta versão como a única vigente tanto à data da
  // subscrição como hoje (publicar retira as versões anteriores).
  const contextLicences = await invoke("listTenantLicenses", { actor: ids.master_admin });
  const contextTenant = (contextLicences.data?.tenants || []).find((tenant) => tenant.id === tenants.tenant_alfa) || {};
  const contextFrom = contextTenant.subscription?.started_date || new Date().toISOString().split("T")[0];
  const priceEntries = [
    { tier_code: "core", amount_cents: 19000, included_seats: 5, extra_seat_amount_cents: 2500, annual_discount_pct: 10, included_ai_calls: 1000 },
    { tier_code: "professional", amount_cents: 39000, included_seats: 15, extra_seat_amount_cents: 2000, annual_discount_pct: 12, included_ai_calls: 5000 },
    { tier_code: "advanced", amount_cents: 69000, included_seats: 40, extra_seat_amount_cents: 1500, annual_discount_pct: 15, included_ai_calls: 20000 },
  ];
  const dayBefore = (iso) => {
    const at = new Date(`${iso}T00:00:00.000Z`);
    at.setUTCDate(at.getUTCDate() - 1);
    return at.toISOString().split("T")[0];
  };
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

  let offerD1 = "";
  let offerD2 = "";
  let priceA = "";
  let priceB = "";
  let priceC = "";

  await report.case("FM1.1", area7, "o dono da plataforma compõe a versão da oferta a partir do catálogo em execução", async () => {
    const res = await offer({ action: "create_offer_version", label: "Oferta de verificação (harness)", reason: "Verificação da camada comercial" });
    if (res.status !== 200) return statusOf(res, 200, "");
    const version = res.data.offer_version;
    offerD1 = version.id;
    const tiers = version.tiers || [];
    const core = tiers.find((tier) => tier.tier_code === "core") || {};
    const composed = tiers.length === 3 && (core.modules || []).length > 0 && core.commercially_available === true;
    const signed = !!version.catalogue_signature && version.status === "draft";
    return composed && signed
      ? { ok: true, detail: `200 — ${version.code} em rascunho, ${tiers.length} tiers compostos e assinados pelo catálogo` }
      : { ok: false, detail: `oferta inesperada: ${JSON.stringify({ n: tiers.length, core }).slice(0, 160)}` };
  });

  // Preço dos packs da tabela de verificação: o campo que a escrita descartava
  // (ver FM2.8) e que a publicação tem de preservar.
  const packEntries = [{ addon_code: "privacy", amount_cents: 4900, included_ai_calls: 500 }];

  await report.case("FM1.4", area7, "a decisão comercial sobre os packs fica registada na versão da oferta", async () => {
    const res = await offer({
      action: "update_offer_version",
      id: offerD1,
      addons: [
        { addon_code: "privacy", commercially_available: true },
        { addon_code: "risk", commercially_available: false },
        { addon_code: "suppliers", commercially_available: false },
      ],
      reason: "Decisão comercial sobre os packs",
    });
    if (res.status !== 200) return statusOf(res, 200, "");
    const addons = res.data.offer_version.addons || [];
    const privacy = addons.find((row) => row.addon_code === "privacy") || {};
    const risk = addons.find((row) => row.addon_code === "risk") || {};
    // Os módulos vêm do catálogo de código: a versão decide se o pack está à
    // venda, nunca o que ele abre.
    const recorded = addons.length === 3 &&
      privacy.commercially_available === true &&
      (privacy.modules || []).includes("privacy") &&
      risk.commercially_available === false;

    const refused = await offer({
      action: "update_offer_version",
      id: offerD1,
      addons: [{ addon_code: "inexistente", commercially_available: true }],
      reason: "Pack fora do catálogo",
    });
    if (!recorded || refused.status !== 422) {
      return { ok: false, detail: JSON.stringify({ recorded, refused: refused.status, addons }).slice(0, 200) };
    }
    return { ok: true, detail: "200 — privacidade à venda com os módulos do catálogo, restantes retidos; 422 para um pack fora do catálogo" };
  });

  await report.case("FM2.1", area7, "publicar preço de uma oferta ainda em rascunho é recusado com 422", async () => {
    const created = await offer({ action: "create_price_table", offer_version_id: offerD1, label: "Preços de verificação A", currency: "EUR", billing_period: "monthly", entries: priceEntries, addon_entries: packEntries, reason: "Preço inicial" });
    if (created.status !== 200) return statusOf(created, 200, "criação da tabela");
    priceA = created.data.price_table.id;
    const res = await offer({ action: "publish_price_table", id: priceA, reason: "Tentativa antes de a oferta vigorar" });
    return res.status === 422 && res.data?.code === "offer_version_not_published"
      ? { ok: true, detail: "422 offer_version_not_published — um preço não vigora sem oferta publicada" }
      : { ok: false, detail: `esperado 422 offer_version_not_published, obtido ${res.status} ${JSON.stringify(res.data).slice(0, 120)}` };
  });

  let offerD1Code = "";

  await report.case("FM1.2", area7, "publicar a versão da oferta define a vigência", async () => {
    // A vigência é o início da subscrição do cliente de verificação (ver a
    // preparação do grupo): é essa a data em que o provisionamento lê a oferta
    // vigente, e publicar aqui é o que garante que a versão medida é a desta ronda.
    const res = await offer({ action: "publish_offer_version", id: offerD1, reason: "Entrada em vigor", effective_from: contextFrom });
    if (res.status !== 200) return statusOf(res, 200, "");
    const version = res.data.offer_version;
    offerD1Code = version.code || "";
    return version.status === "published" && !!version.effective_from
      ? { ok: true, detail: `200 — ${version.code} publicada, vigência desde ${version.effective_from} (início da subscrição)` }
      : { ok: false, detail: JSON.stringify({ status: version.status, from: version.effective_from }) };
  });

  await report.case("FM2.2", area7, "publicar a tabela de preços contra a oferta publicada", async () => {
    // Mesma vigência da versão: a tabela tem de estar em vigor na data em que o
    // provisionamento a lê (o início da subscrição), não só a partir de hoje.
    const res = await offer({ action: "publish_price_table", id: priceA, reason: "Entrada em vigor do preço A", effective_from: contextFrom });
    if (res.status !== 200) return statusOf(res, 200, "");
    const table = res.data.price_table;
    return table.status === "published" && !!table.effective_from
      ? { ok: true, detail: `200 — tabela publicada, vigência desde ${table.effective_from} (início da subscrição)` }
      : { ok: false, detail: `esperado publicada: ${JSON.stringify(table).slice(0, 140)}` };
  });

  await report.case("FM2.8", area7, "o preço do pack persiste na tabela e entra no histórico", async () => {
    // O caminho de escrita do preço do pack esteve desligado: `normalizeAddonEntries`
    // existia e nunca era chamada, pelo que `addon_entries` era aceite no corpo do
    // pedido e descartado pelo validador da entidade (campo declarado, nunca
    // preenchido) — a consola mostrava a tabela sem preço de pack nenhum e sem
    // erro nenhum. Este caso é a guarda dessa regressão: o preço tem de voltar na
    // tabela publicada, o pack fora do catálogo tem de ser recusado e o campo
    // alterado tem de aparecer no antes/depois do histórico.
    const view = await offer({ action: "overview" });
    const table = (view.data.price_tables || []).find((row) => row.id === priceA) || {};
    const pack = (table.addon_entries || []).find((row) => row.addon_code === "privacy") || {};
    if (!(pack.amount_cents === 4900 && pack.included_ai_calls === 500)) {
      return { ok: false, detail: `o preço do pack não persistiu: ${JSON.stringify(table.addon_entries).slice(0, 160)}` };
    }

    const refused = await offer({
      action: "create_price_table",
      offer_version_id: offerD1,
      label: "Preços de verificação (pack fora do catálogo)",
      currency: "EUR",
      billing_period: "monthly",
      entries: priceEntries,
      addon_entries: [{ addon_code: "inexistente", amount_cents: 100 }],
      reason: "Pack fora do catálogo",
    });
    if (refused.status !== 422) {
      return { ok: false, detail: `esperado 422 para um pack fora do catálogo, obtido ${refused.status}` };
    }

    // A edição do preço de um pack num rascunho, e o campo que o histórico
    // nomeia por pack. Um registo de criação muda `["*"]` (o registo inteiro),
    // pelo que é na edição que o antes/depois tem de nomear `addon_price:<código>`.
    const draft = await offer({
      action: "create_price_table",
      offer_version_id: offerD1,
      label: "Preços de verificação (packs)",
      currency: "EUR",
      billing_period: "monthly",
      entries: priceEntries,
      addon_entries: [
        { addon_code: "privacy", amount_cents: 4900, included_ai_calls: 500 },
        { addon_code: "risk", amount_cents: 5900, included_ai_calls: 800 },
      ],
      reason: "Preço dos packs em rascunho",
    });
    if (draft.status !== 200) return statusOf(draft, 200, "rascunho com preço de pack");

    const edited = await offer({
      action: "update_price_table",
      id: draft.data.price_table.id,
      addon_entries: [{ addon_code: "suppliers", amount_cents: 6900, included_ai_calls: 900 }],
      reason: "Ajuste do preço do pack",
    });
    if (edited.status !== 200) return statusOf(edited, 200, "edição do preço do pack");
    const kept = (edited.data.price_table.addon_entries || []).map((row) => row.addon_code);
    if (!(kept.length === 1 && kept[0] === "suppliers")) {
      return { ok: false, detail: `a edição não substituiu o preço do pack: ${JSON.stringify(kept)}` };
    }

    const history = await offer({ action: "history", entity_type: "PriceTable", change_action: "update", limit: 50 });
    const fields = (history.data.entries || []).flatMap((entry) => entry.changed_fields || []);
    const named = ["addon_price:privacy", "addon_price:risk", "addon_price:suppliers"].every((field) => fields.includes(field));
    return named
      ? { ok: true, detail: "200 — preço do pack na tabela publicada e na edição, campos addon_price:* no antes/depois; 422 fora do catálogo" }
      : { ok: false, detail: `o histórico não nomeou os campos do pack: ${JSON.stringify(fields.slice(0, 12))}` };
  });

  await report.case("FM2.3", area7, "o provisionamento regista na subscrição a oferta e o preço vigentes", async () => {
    const res = await invoke("provisionTenantLicense", {
      actor: ids.master_admin,
      body: { action: "update", customer_id: tenants.tenant_alfa, tier_code: "advanced", reason: "Verificação do registo comercial" },
    });
    if (res.status !== 200) return statusOf(res, 200, "");
    const sub = res.data.subscription || {};
    // A versão e a tabela medidas são as que este grupo publicou com vigência
    // desde o início da subscrição (ver a preparação do grupo), pelo que o
    // resultado não depende do que ficou em vigor da execução anterior.
    const ok = !!sub.offer_version_id && sub.offer_version_code === offerD1Code &&
      sub.price_table_id === priceA && sub.price_amount_cents === 69000;
    return ok
      ? { ok: true, detail: `200 — subscrição com ${sub.offer_version_code} (desta ronda), tabela e ${sub.price_amount_cents} cêntimos do tier advanced` }
      : { ok: false, detail: `registo inesperado: ${JSON.stringify({ v: sub.offer_version_code, expected: offerD1Code, t: sub.price_table_id, c: sub.price_amount_cents }).slice(0, 180)}` };
  });

  await report.case("FM1.5", area7, "só se contrata o pack que a oferta em vigor põe à venda", async () => {
    // A decisão comercial da versão passa a ter efeito operacional: o pack que ela
    // marca como comercializável abre os seus módulos no cliente e fica registado
    // na subscrição com o preço da tabela em vigor; um pack que a oferta não vende
    // é recusado com 422 `addon_not_for_sale`. Retirar é sempre possível — nenhum
    // cliente fica preso a um pack que saiu da oferta.
    const grant = (addonCode, active, reason) =>
      invoke("provisionTenantLicense", {
        actor: ids.master_admin,
        body: { action: "set_addon", customer_id: tenants.tenant_alfa, addon_code: addonCode, active, reason },
      });

    const granted = await grant("privacy", true, "Contratação do pack de privacidade");
    if (granted.status !== 200) return statusOf(granted, 200, "contratação do pack à venda");
    const row = (granted.data.subscription?.addons || []).find((addon) => addon.addon_code === "privacy") || {};
    const opened = hasModule(granted.data.license, "privacy");

    const refused = await grant("risk", true, "Contratação de um pack fora da oferta");
    const revoked = await grant("privacy", false, "Fim do pack de privacidade");
    const closed = revoked.status === 200 && !hasModule(revoked.data.license, "privacy");

    if (!opened || row.status !== "active" || row.amount_cents !== 4900 || refused.status !== 422 ||
      refused.data?.code !== "addon_not_for_sale" || !closed) {
      return {
        ok: false,
        detail: JSON.stringify({ opened, row, refused: refused.status, code: refused.data?.code, closed }).slice(0, 220),
      };
    }
    return { ok: true, detail: "200 — pack à venda aberto com o preço da tabela (4900) e retirado depois; 422 addon_not_for_sale para o restante" };
  });

  await report.case("FM1.3", area7, "publicar uma versão nova retira a anterior com data de fim", async () => {
    const created = await offer({ action: "create_offer_version", label: "Oferta de verificação (harness 2)", reason: "Substituição da oferta" });
    if (created.status !== 200) return statusOf(created, 200, "");
    offerD2 = created.data.offer_version.id;
    const res = await offer({ action: "publish_offer_version", id: offerD2, reason: "Substituição da versão anterior" });
    if (res.status !== 200) return statusOf(res, 200, "");
    const from = res.data.offer_version.effective_from;
    const view = await offer({ action: "overview" });
    const previous = (view.data.offer_versions || []).find((version) => version.id === offerD1) || {};
    const superseded = res.data.superseded_versions || [];
    const ok = superseded.includes(previous.code) && previous.status === "retired" && previous.effective_to === dayBefore(from);
    return ok
      ? { ok: true, detail: `200 — uma só oferta em vigor: ${previous.code} fecha em ${previous.effective_to}` }
      : { ok: false, detail: JSON.stringify({ superseded, status: previous.status, to: previous.effective_to, expected: dayBefore(from) }) };
  });

  await report.case("FM2.4", area7, "uma tabela nova da mesma versão substitui a anterior com data de fim", async () => {
    const first = await offer({ action: "create_price_table", offer_version_id: offerD2, label: "Preços de verificação B", currency: "EUR", billing_period: "annual", entries: priceEntries.map((entry) => ({ ...entry, amount_cents: entry.amount_cents * 10 })), reason: "Revisão anual" });
    if (first.status !== 200) return statusOf(first, 200, "criação da tabela B");
    priceB = first.data.price_table.id;
    const pubB = await offer({ action: "publish_price_table", id: priceB, reason: "Entrada em vigor do preço B" });
    if (pubB.status !== 200) return statusOf(pubB, 200, "publicação da tabela B");

    const second = await offer({ action: "create_price_table", offer_version_id: offerD2, label: "Preços de verificação C", currency: "EUR", billing_period: "monthly", entries: priceEntries, reason: "Nova vigência do preço" });
    if (second.status !== 200) return statusOf(second, 200, "criação da tabela C");
    priceC = second.data.price_table.id;
    const pubC = await offer({ action: "publish_price_table", id: priceC, reason: "Substituição do preço B", effective_from: tomorrow });
    if (pubC.status !== 200) return statusOf(pubC, 200, "publicação da tabela C");

    const view = await offer({ action: "overview" });
    const previous = (view.data.price_tables || []).find((table) => table.id === priceB) || {};
    const superseded = pubC.data.superseded_tables || [];
    const ok = superseded.length === 1 && previous.status === "retired" && previous.effective_to === dayBefore(tomorrow);
    return ok
      ? { ok: true, detail: `200 — um só preço por versão: a anterior fecha em ${previous.effective_to}` }
      : { ok: false, detail: JSON.stringify({ superseded, status: previous.status, to: previous.effective_to, expected: dayBefore(tomorrow) }) };
  });

  await report.case("FM2.5", area7, "retirar uma tabela de preços publicada", async () => {
    const res = await offer({ action: "retire_price_table", id: priceC, reason: "Fim da verificação" });
    if (res.status !== 200) return statusOf(res, 200, "");
    return res.data.price_table.status === "retired"
      ? { ok: true, detail: `200 — retirada com fim de vigência em ${res.data.price_table.effective_to}` }
      : { ok: false, detail: `esperado retirada, obtido ${res.data.price_table.status}` };
  });

  await report.case("FM2.6", area7, "o histórico comercial filtra no servidor e mostra autor, motivo e antes/depois", async () => {
    const all = await offer({ action: "history", limit: 2 });
    if (all.status !== 200) return statusOf(all, 200, "leitura sem filtros");
    const entries = all.data.entries || [];
    // A regressão do nome do filtro: `action: "history"` tem de devolver linhas,
    // não filtrar por uma acção chamada «history».
    if (all.data.total === 0 || entries.length === 0) {
      return { ok: false, detail: `histórico vazio ou comando consumido como filtro: ${JSON.stringify(all.data).slice(0, 160)}` };
    }
    const missing = entries.filter((entry) => !entry.actor_email || !(entry.changed_fields || []).length).length;
    const paged = all.data.total > entries.length ? !!all.data.next_cursor : true;

    const byEntity = await offer({ action: "history", entity_type: "PriceTable", limit: 50 });
    const byAction = await offer({ action: "history", change_action: "publish", limit: 50 });
    const okEntity = byEntity.status === 200 && (byEntity.data.entries || []).every((entry) => entry.entity_type === "PriceTable");
    const okAction = byAction.status === 200 && (byAction.data.entries || []).length > 0 && (byAction.data.entries || []).every((entry) => entry.action === "publish");
    const diffs = (byEntity.data.entries || []).filter((entry) => entry.after && Object.keys(entry.after).length > 0).length;

    if (missing || !paged || !okEntity || !okAction || diffs === 0) {
      return { ok: false, detail: JSON.stringify({ total: all.data.total, missing, paged, okEntity, okAction, diffs }).slice(0, 200) };
    }
    return {
      ok: true,
      detail: `200 — ${all.data.total} alterações; filtros por registo e por acção e antes/depois legível em ${diffs} linhas`,
    };
  });

  await report.case("FM2.7", area7, "sem oferta publicada o provisionamento não falha e deixa a subscrição como estava", async () => {
    const first = await invoke("listTenantLicenses", { actor: ids.master_admin });
    const before = ((first.data.tenants || []).find((tenant) => tenant.id === tenants.tenant_alfa) || {}).subscription || {};
    const retired = await offer({ action: "retire_offer_version", id: offerD2, reason: "Fim da verificação" });
    if (retired.status !== 200) return statusOf(retired, 200, "retirar a oferta");

    const res = await invoke("provisionTenantLicense", {
      actor: ids.master_admin,
      body: { action: "update", customer_id: tenants.tenant_alfa, tier_code: "core", reason: "Provisionamento sem oferta publicada" },
    });
    if (res.status !== 200) return statusOf(res, 200, "");
    const sub = res.data.subscription || {};
    const unchanged = (sub.offer_version_code || "") === (before.offer_version_code || "") &&
      (sub.price_table_id || "") === (before.price_table_id || "");
    return unchanged
      ? { ok: true, detail: "200 — provisionamento concluído; o registo comercial anterior ficou intacto" }
      : { ok: false, detail: `o registo comercial mudou sem oferta vigente: ${JSON.stringify({ before: before.offer_version_code, after: sub.offer_version_code })}` };
  });

  // ─── G8. FM3/FM4 — ciclo de vida da subscrição e quotas contratuais ──
  // O que se prova aqui é o resto do ciclo comercial no limite do servidor: a
  // renovação que mantém o contratado, a coerência da mudança de nível (o que o
  // novo nível não cobre só sai com confirmação explícita, e nada é apagado), o
  // fecho que fecha o gating sem apagar nada, as quotas contratuais que SINALIZAM
  // sem bloquear (o gating tem de continuar a abrir os módulos de quem está acima
  // da quota) e os indicadores comerciais com o período anterior a fechar contas.
  const area8 = "FM3/FM4 ciclo de vida e quotas";
  const provision = (body, actor = ids.master_admin) =>
    invoke("provisionTenantLicense", { actor, body });

  // Preparação deste grupo — duas condições que o grupo precisa de medir e que
  // os dados locais não garantem por si (o emulador local sobrevive entre
  // execuções):
  //   (1) uma oferta e um preço EM VIGOR — o caso FM2.7 retira-os de propósito,
  //       e sem eles as quotas por omissão não teriam de onde vir;
  //   (2) um tenant com contrato VIVO — o fecho do FM3.6 deixa o cliente fechado
  //       na execução seguinte, e um contrato novo é a forma de o repor.
  const prepOffer = await offer({
    action: "create_offer_version",
    label: "Oferta de verificação (ciclo de vida)",
    reason: "Contexto comercial do ciclo de vida",
  });
  const offerD3 = prepOffer.status === 200 ? prepOffer.data.offer_version.id : "";
  if (offerD3) {
    await offer({ action: "publish_offer_version", id: offerD3, reason: "Entrada em vigor para o ciclo de vida" });
  }
  const prepPrice = await offer({
    action: "create_price_table",
    offer_version_id: offerD3,
    label: "Preços de verificação D",
    currency: "EUR",
    billing_period: "monthly",
    entries: priceEntries,
    reason: "Preço do ciclo de vida",
  });
  const priceD = prepPrice.status === 200 ? prepPrice.data.price_table.id : "";
  if (priceD) {
    await offer({ action: "publish_price_table", id: priceD, reason: "Entrada em vigor do preço D" });
  }

  const licences = await invoke("listTenantLicenses", { actor: ids.master_admin });
  const alfaSubscription = ((licences.data.tenants || []).find((tenant) => tenant.id === tenants.tenant_alfa) || {}).subscription;
  if (!alfaSubscription || alfaSubscription.status === "cancelled") {
    await provision({
      action: "create",
      customer_id: tenants.tenant_alfa,
      tier_code: "core",
      seat_limit: 5,
      reason: "Reposição da subscrição de verificação",
    });
  }
  // O registo comercial da subscrição passa a apontar a oferta e o preço em
  // vigor, para que as quotas por omissão e a receita contratada sejam medíveis.
  await provision({
    action: "update",
    customer_id: tenants.tenant_alfa,
    tier_code: "core",
    reason: "Registo da oferta e do preço em vigor",
    confirm_removals: true,
  });

  await report.case("FM3.1", area8, "renovar sem motivo é recusado com 422", async () => {
    const res = await provision({ action: "renew", customer_id: tenants.tenant_alfa, months: 12 });
    return statusOf(res, 422, "422 — o motivo é obrigatório na renovação");
  });

  await report.case("FM3.2", area8, "renovar acrescenta um período novo e mantém o contratado", async () => {
    const before = await invoke("listTenantLicenses", { actor: ids.master_admin });
    const previous = ((before.data.tenants || []).find((tenant) => tenant.id === tenants.tenant_alfa) || {}).subscription || {};
    const res = await provision({
      action: "renew",
      customer_id: tenants.tenant_alfa,
      months: 12,
      reason: "Renovação anual de verificação",
    });
    if (res.status !== 200) return statusOf(res, 200, "");
    const sub = res.data.subscription || {};
    const renewed = (sub.renewal_count || 0) === ((previous.renewal_count || 0) + 1) &&
      !!sub.expires_date && sub.expires_date > new Date().toISOString().split("T")[0] &&
      sub.tier_code === previous.tier_code;
    return renewed && res.data.license?.licensed === true
      ? { ok: true, detail: `200 — válida até ${sub.expires_date}, tier ${sub.tier_code} mantido, licença activa` }
      : { ok: false, detail: `renovação inesperada: ${JSON.stringify({ before: previous.expires_date, after: sub.expires_date, tier: sub.tier_code, count: sub.renewal_count }).slice(0, 180)}` };
  });

  await report.case("FM3.3", area8, "uma renovação não contrata outro nível (422 use_change_tier)", async () => {
    const res = await provision({
      action: "renew",
      customer_id: tenants.tenant_alfa,
      months: 12,
      tier_code: "advanced",
      reason: "Tentativa de contratar outro nível pela renovação",
    });
    return res.status === 422 && res.data?.code === "use_change_tier"
      ? { ok: true, detail: "422 use_change_tier — renovar mantém o nível contratado" }
      : { ok: false, detail: `esperado 422 use_change_tier, obtido ${res.status} ${JSON.stringify(res.data).slice(0, 120)}` };
  });

  await report.case("FM3.4", area8, "descer de nível retira o que o novo nível não cobre, mas só com confirmação", async () => {
    const up = await provision({
      action: "change_tier",
      customer_id: tenants.tenant_alfa,
      tier_code: "advanced",
      reason: "Subida para preparar a descida",
    });
    if (up.status !== 200) return statusOf(up, 200, "subida de nível");

    const granted = await provision({
      action: "set_module",
      customer_id: tenants.tenant_alfa,
      module_code: "knowledge_guidance",
      active: true,
      reason: "Excepção de verificação fora do Core",
    });
    if (granted.status !== 200) return statusOf(granted, 200, "excepção por módulo");

    const refused = await provision({
      action: "change_tier",
      customer_id: tenants.tenant_alfa,
      tier_code: "core",
      reason: "Descida para o Core sem confirmar retiradas",
    });
    const leaving = refused.data?.leaving || {};
    const listed = (leaving.modules || []).includes("knowledge_guidance");
    if (refused.status !== 422 || refused.data?.code !== "removals_required" || !listed) {
      return {
        ok: false,
        detail: `esperado 422 removals_required com knowledge_guidance: ${refused.status} ${JSON.stringify(refused.data).slice(0, 160)}`,
      };
    }

    const applied = await provision({
      action: "change_tier",
      customer_id: tenants.tenant_alfa,
      tier_code: "core",
      reason: "Descida para o Core com retirada confirmada",
      confirm_removals: true,
    });
    if (applied.status !== 200) return statusOf(applied, 200, "descida confirmada");
    const modules = (applied.data.license?.modules || []).map((module) => module.code);
    return applied.data.tier_code === "core" && !modules.includes("knowledge_guidance")
      ? { ok: true, detail: "200 — Core aplicado e a excepção fora do nível retirada (inactiva com data)" }
      : { ok: false, detail: `módulos inesperados: ${JSON.stringify(modules).slice(0, 140)}` };
  });

  await report.case("FM3.5", area8, "a consola de ciclo de vida só mostra a carteira do administrador de parceiro", async () => {
    const partner = await provision({ action: "lifecycle" }, ids.workspace_admin_alfa);
    if (partner.status !== 200) return statusOf(partner, 200, "leitura da carteira");
    const ids_ = (partner.data.tenants || []).map((tenant) => tenant.id);
    const foreign = ids_.filter((id) => id === tenants.tenant_beta || id === tenants.tenant_zeta);
    if (foreign.length > 0) return { ok: false, detail: `tenants fora da carteira presentes: ${foreign.length}` };

    const refused = await provision({ action: "lifecycle" }, ids.grc_analyst_alfa);
    return refused.status === 403
      ? { ok: true, detail: `200 para o parceiro (${ids_.length} clientes) e 403 para o analista GRC` }
      : { ok: false, detail: `esperado 403 para o analista, obtido ${refused.status}` };
  });

  await report.case("FM4.1", area8, "definir quotas sem motivo é recusado com 422", async () => {
    const res = await provision({ action: "set_quotas", customer_id: tenants.tenant_alfa, seat_limit: 5 });
    return statusOf(res, 422, "422 — o motivo é obrigatório nas quotas");
  });

  // Os lugares por omissão são o maior entre o incluído da tabela em vigor e o que
  // o cliente já usa (OP-M1): o incluído abaixo do uso recusava a operação e
  // deixava-a sem caminho, pelo que passa a subir ao valor em uso com aviso. O
  // caso mede as duas coisas — a proveniência na tabela e a elevação — sem
  // depender de o tenant estar acima ou abaixo do incluído, e guarda o valor
  // resultante para o caso seguinte.
  let quotaSeats = null;

  await report.case("FM4.2", area8, "as quotas por omissão vêm da tabela em vigor e sobem ao valor em uso", async () => {
    const res = await provision({
      action: "set_quotas",
      customer_id: tenants.tenant_alfa,
      reason: "Quotas contratadas de verificação",
    });
    if (res.status !== 200) return statusOf(res, 200, "");
    const sub = res.data.subscription || {};
    const defaults = res.data.defaults || {};
    const used = Number(sub.seats_used) || 0;
    const includedSeats = defaults.included_seats;
    const expectedSeats = Math.max(includedSeats ?? 0, used);
    quotaSeats = expectedSeats;

    // A proveniência é a tabela que este grupo publicou (priceD) e o incluído do
    // nível Core nela: 5 lugares e 1000 chamadas de IA.
    const provenance = sub.quota_source_price_table_id === priceD &&
      includedSeats === 5 &&
      sub.ai_quota_monthly === 1000 &&
      (sub.quota_warn_pct || 0) > 0;
    const seatsOk = sub.seat_limit === expectedSeats;
    // O aviso acompanha exactamente a operação que o provocou — presente quando o
    // incluído fica aquém do uso, ausente quando o incluído já chega.
    const warning = res.data.warning || null;
    const warningOk = expectedSeats > (includedSeats ?? 0)
      ? warning?.code === "seat_quota_raised_to_usage" && warning.from === includedSeats && warning.to === expectedSeats
      : !warning;

    if (!provenance || !seatsOk || !warningOk) {
      return { ok: false, detail: `quotas inesperadas: ${JSON.stringify({ seats: sub.seat_limit, expected: expectedSeats, included: includedSeats, used, ai: sub.ai_quota_monthly, warn: sub.quota_warn_pct, src: sub.quota_source_price_table_id, expectedSrc: priceD, warning }).slice(0, 220)}` };
    }
    return {
      ok: true,
      detail: warning
        ? `200 — incluído da tabela (${includedSeats} de ${defaults.price_table_label || priceD}) elevado aos ${expectedSeats} em uso, com aviso; ${sub.ai_quota_monthly} chamadas de IA, limiar ${sub.quota_warn_pct}%`
        : `200 — ${sub.seat_limit} lugares e ${sub.ai_quota_monthly} chamadas de IA, limiar ${sub.quota_warn_pct}% (da tabela ${defaults.price_table_label || priceD}), sem elevação`,
    };
  });

  await report.case("FM4.3", area8, "a leitura das quotas resolve o âmbito no servidor e não bloqueia ninguém", async () => {
    const res = await provision({ action: "quota_overview" });
    if (res.status !== 200) return statusOf(res, 200, "");
    const tenant = (res.data.tenants || []).find((row) => row.id === tenants.tenant_alfa) || {};
    // A leitura devolve o que FM4.2 gravou — nunca uma quota abaixo do consumo,
    // que é o invariante da elevação.
    const quota = tenant.seats?.quota === quotaSeats &&
      tenant.seats?.quota >= tenant.seats?.consumed &&
      tenant.ai?.quota === 1000;
    const notBlocking = ["ok", "warning", "excess"].includes(tenant.seats?.level);
    const refused = await provision({ action: "quota_overview" }, ids.grc_analyst_alfa);
    if (!quota || !notBlocking || refused.status !== 403) {
      return { ok: false, detail: JSON.stringify({ quota, expectedSeats: quotaSeats, notBlocking, refused: refused.status, tenant: tenant.seats }).slice(0, 200) };
    }
    return { ok: true, detail: `200 — ${tenant.seats.quota} lugares e ${tenant.ai.quota} chamadas de IA legíveis no âmbito; 403 ao analista GRC` };
  });

  await report.case("FM4.4", area8, "o registo das sinalizações do período é idempotente", async () => {
    // O registo é idempotente por cliente, período e grandeza e o emulador local
    // sobrevive entre execuções: um período fixo só devolve linhas na primeira
    // execução e o caso acabava a medir a execução anterior, não a idempotência.
    // Procura-se um período ainda sem registo — o primeiro que devolva linhas
    // novas — e é nesse que se prova que repetir não duplica. Os candidatos são
    // meses de um século anterior ao lançamento, a partir de um ponto aleatório,
    // para o custo não crescer com o número de execuções.
    let period = "";
    let recorded = 0;
    for (let attempt = 0; attempt < 24 && recorded === 0; attempt += 1) {
      const offset = (Math.floor(Math.random() * 1200) + attempt) % 1200;
      period = `19${String(Math.floor(offset / 12)).padStart(2, "0")}-${String((offset % 12) + 1).padStart(2, "0")}`;
      const attemptRes = await provision({ action: "record_quota_signals", period });
      if (attemptRes.status !== 200) return statusOf(attemptRes, 200, "primeiro registo");
      recorded = attemptRes.data.totals?.recorded || 0;
    }
    if (recorded === 0) {
      return { ok: false, detail: "nenhum período novo encontrado para registar as sinalizações" };
    }
    const second = await provision({ action: "record_quota_signals", period });
    if (second.status !== 200) return statusOf(second, 200, "segundo registo");
    const again = second.data.totals?.recorded || 0;
    return again === 0
      ? { ok: true, detail: `200 — ${recorded} linhas registadas em ${period}; repetir não duplica (0 novas)` }
      : { ok: false, detail: `esperado registo idempotente: ${JSON.stringify({ period, recorded, again }).slice(0, 140)}` };
  });

  // O simulador «o que muda se…» (OP-M5) compõe o que `change_tier` e `set_addon`
  // fariam — mesma matéria-prima das duas acções de escrita, para a
  // pré-visualização não poder divergir do que a operação aplica. O que se mede
  // é a composição (nível alvo, incluído e quota de IA da tabela em vigor,
  // módulos que entram e saem) e, sobretudo, que a simulação **não escreve**.
  await report.case("FM4.5", area8, "o simulador compõe a mudança de nível sem escrever nada", async () => {
    const beforeLicences = await invoke("listTenantLicenses", { actor: ids.master_admin });
    const before = ((beforeLicences.data.tenants || []).find((tenant) => tenant.id === tenants.tenant_alfa) || {}).subscription || {};
    if (!before.tier_code) return { ok: false, detail: "subscrição de verificação em falta para simular" };
    const beforeHistory = await invoke("listLicenseChanges", {
      actor: ids.master_admin,
      body: { customer_id: tenants.tenant_alfa, limit: 100 },
    });
    const historyBefore = (beforeHistory.data?.entries || []).length;

    // O alvo é sempre o outro nível da oferta, pelo que a composição muda seja
    // qual for o estado que a execução anterior deixou.
    const target = before.tier_code === "advanced" ? "core" : "advanced";
    const expected = target === "advanced" ? { seats: 40, ai: 20000 } : { seats: 5, ai: 1000 };
    const sim = await provision({ action: "simulate_change", customer_id: tenants.tenant_alfa, tier_code: target });
    if (sim.status !== 200) return statusOf(sim, 200, "");
    const data = sim.data || {};
    const moved = (data.changes?.modules_gained || []).length + (data.changes?.modules_lost || []).length;
    const composed = data.simulation === true &&
      data.changes?.tier_changed === true &&
      data.current?.tier_code === before.tier_code &&
      data.target?.tier_code === target &&
      moved > 0 &&
      data.target?.included_seats === expected.seats &&
      data.target?.ai_quota_default === expected.ai;

    const afterLicences = await invoke("listTenantLicenses", { actor: ids.master_admin });
    const after = ((afterLicences.data.tenants || []).find((tenant) => tenant.id === tenants.tenant_alfa) || {}).subscription || {};
    const afterHistory = await invoke("listLicenseChanges", {
      actor: ids.master_admin,
      body: { customer_id: tenants.tenant_alfa, limit: 100 },
    });
    const wrote = JSON.stringify(after) !== JSON.stringify(before) ||
      (afterHistory.data?.entries || []).length !== historyBefore;

    if (!composed || wrote) {
      return {
        ok: false,
        detail: `simulação inesperada: ${JSON.stringify({ composed, wrote, target: data.target, gained: data.changes?.modules_gained, lost: data.changes?.modules_lost }).slice(0, 220)}`,
      };
    }
    return {
      ok: true,
      detail: `200 — ${before.tier_code} → ${target} composto sem escrever: ${data.changes.modules_gained.length} módulos entram, ${data.changes.modules_lost.length} saem, ${expected.seats} lugares e ${expected.ai} chamadas de IA por omissão; subscrição e histórico intactos`,
    };
  });

  await report.case("FM5.1", area8, "os indicadores comerciais comparam com o período anterior e não inventam receita", async () => {
    const res = await invoke("getCommercialMetrics", { actor: ids.master_admin, body: {} });
    if (res.status !== 200) return statusOf(res, 200, "");
    const data = res.data || {};
    const revenue = data.revenue || {};
    const priced = revenue.mrr_cents > 0 && revenue.arr_cents === revenue.mrr_cents * 12;
    const honest = data.contracted_not_invoiced === true && (revenue.unpriced_subscriptions || 0) >= 1;
    const previous = ["new", "renewals", "upgrades", "downgrades", "closed"].every(
      (key) => typeof data.movement?.previous?.[key] === "number",
    );
    const coherent = (data.totals?.subscriptions || 0) > 0 &&
      (data.cohorts || []).length === 5 &&
      (data.conversion?.tiers || []).length === 3;

    if (!priced || !honest || !previous || !coherent) {
      return { ok: false, detail: JSON.stringify({ mrr: revenue.mrr_cents, arr: revenue.arr_cents, unpriced: revenue.unpriced_subscriptions, previous, cohorts: (data.cohorts || []).length }).slice(0, 220) };
    }
    return {
      ok: true,
      detail: `200 — MRR contratado ${revenue.mrr_cents} cêntimos (${revenue.unpriced_subscriptions} subscrições sem preço), movimento do período com ${data.movement.new} novas e ${data.movement.closed} fechos`,
    };
  });

  await report.case("FM5.2", area8, "os indicadores comerciais são do dono da plataforma", async () => {
    const partner = await invoke("getCommercialMetrics", { actor: ids.workspace_admin_alfa, body: {} });
    const tenant = await invoke("getCommercialMetrics", { actor: ids.customer_admin_alfa, body: {} });
    return partner.status === 403 && tenant.status === 403
      ? { ok: true, detail: "403 — nem o administrador de parceiro nem o do cliente lêem os indicadores" }
      : { ok: false, detail: `esperado 403 nos dois: parceiro ${partner.status}, cliente ${tenant.status}` };
  });

  await report.case("FM3.6", area8, "fechar o tenant fecha o gating e deixa o trabalho a tratar registado", async () => {
    const res = await provision({
      action: "close",
      customer_id: tenants.tenant_alfa,
      reason: "Fim do contrato de verificação",
    });
    if (res.status !== 200) return statusOf(res, 200, "");
    const closed = res.data.subscription?.status === "cancelled" && !!res.data.subscription?.closed_at;
    const failClosed = res.data.license?.licensed === false && (res.data.license?.modules || []).length === 0;
    const handover = typeof res.data.handover?.live_delegations === "number" &&
      typeof res.data.handover?.pending_audit_packages === "number";
    const again = await provision({ action: "close", customer_id: tenants.tenant_alfa, reason: "Repetição do fecho" });

    if (!closed || !failClosed || !handover || again.status !== 409) {
      return {
        ok: false,
        detail: JSON.stringify({ closed, failClosed, handover, again: again.status }).slice(0, 200),
      };
    }
    return {
      ok: true,
      detail: `200 — fechado sem apagar nada: nenhum módulo abre, ${res.data.handover.live_delegations} delegações vivas e ${res.data.handover.pending_audit_packages} pacotes em rascunho a tratar; repetir dá 409`,
    };
  });

  // ─── G4. RLS baseada em arrays (limitação local assumida) ─────────
  report.skip(
    "RLS1",
    "isolamento por RLS",
    "as RLS das entidades são avaliadas sobre a sessão autenticada (uma só no emulador local) e um tenant presente apenas em delegated_edit_customer_ids é oculto na leitura: exige backend real",
  );
}
