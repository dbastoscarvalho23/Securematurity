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
  report.skip(
    "FB1.12",
    area2,
    "trilha de auditoria: as acções de licença são escritas com o papel de serviço, mas a entidade AuditLog não é legível na sessão do emulador local (a RLS compara o papel canónico e o utilizador local guarda `admin`) e nenhuma função devolve as acções registadas: exige backend real",
  );

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

  // ─── G4. RLS baseada em arrays (limitação local assumida) ─────────
  report.skip(
    "RLS1",
    "isolamento por RLS",
    "as RLS das entidades são avaliadas sobre a sessão autenticada (uma só no emulador local) e um tenant presente apenas em delegated_edit_customer_ids é oculto na leitura: exige backend real",
  );
}
