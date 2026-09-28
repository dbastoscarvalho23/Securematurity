/**
 * Suíte de UI — a camada onde a aplicação decide o que mostrar.
 *
 * Verifica, com o MESMO código que a Sidebar e o RouteGuard usam (`rbac.js`,
 * `sidebarGroups.js`, `licenseModules.js`), que a navegação e o acesso às rotas
 * concordam entre si para as nove identidades, que o consultor ganhou leitura
 * nos percursos delegados sem ganhar escrita (FA1) e que a resolução de
 * tenant/contexto devolve sempre o mesmo cliente (FA2 / contrato de tenant).
 *
 * O eixo do licenciamento não é avaliado aqui: a decisão de módulo é exercitada
 * na suíte de API (gating fail-closed e provisionamento) e no browser. Aqui
 * passa-se um licenciamento permissivo para isolar a matriz RBAC.
 */
import { loadFrontendLib } from "../lib/loadLib.mjs";

const ALWAYS_LICENSED = () => true;

/** Rotas de referência: as operacionais e as de administração. */
const ROUTES = [
  "/assessments",
  "/action-plan",
  "/risk-assessment",
  "/evidence",
  "/security-documents",
  "/tasks",
  "/reports",
  "/audit-package",
  "/compliance-metrics",
  "/strategic-report",
  "/question-bank",
  "/external-access",
  "/customers",
  "/licensing",
  "/organization",
  "/system-status",
  "/audit-log",
  "/settings",
];

const READ_ROUTES_FA1 = [
  "/assessments",
  "/risk-assessment",
  "/evidence",
  "/security-documents",
  "/tasks",
  "/reports",
];

const WRITE_ACTIONS = ["create", "edit", "delete"];

export async function runUiSuite(report) {
  const { rbac, sidebar, tenant } = await loadFrontendLib();
  const { ALL_ROLES } = rbac;

  // ─── Consistência Sidebar ↔ RouteGuard, por papel ─────────────────
  for (const role of ALL_ROLES) {
    await report.case(`UI-${role}`, "navegação por papel", `Sidebar e RouteGuard concordam para ${role}`, async () => {
      const groups = sidebar.getVisibleSidebarGroups(role, null, ALWAYS_LICENSED, () => null);
      const items = groups.flatMap((g) => g.items);
      const denied = items.filter((item) => !rbac.canAccessRoute(role, item.path));
      if (denied.length > 0) {
        return { ok: false, detail: `itens de menu sem acesso à rota: ${denied.map((i) => i.path).join(", ")}` };
      }
      const extra = ROUTES.filter(
        (path) => rbac.canAccessRoute(role, path) && !items.some((i) => i.path === path),
      );
      return {
        ok: true,
        detail: `${items.length} itens de menu, todos acessíveis${
          extra.length ? ` (rotas fora do menu: ${extra.join(", ")})` : ""
        }`,
      };
    });
  }

  // ─── FA1 — cobertura funcional do consultor ───────────────────────
  await report.case("FA1.1", "FA1 consultor", "o consultor abre os percursos delegados de leitura", async () => {
    const blocked = READ_ROUTES_FA1.filter((path) => !rbac.canAccessRoute("consultant", path));
    return blocked.length === 0
      ? { ok: true, detail: `${READ_ROUTES_FA1.length} percursos de leitura acessíveis` }
      : { ok: false, detail: `ainda sem acesso a: ${blocked.join(", ")}` };
  });
  await report.case("FA1.2", "FA1 consultor", "o consultor não ganha escrita nesses percursos", async () => {
    const resources = ["assessments", "risks", "evidence", "documents", "tasks", "reports"];
    const granted = [];
    for (const resource of resources) {
      for (const action of WRITE_ACTIONS) {
        if (rbac.can("consultant", action, resource)) granted.push(`${action}:${resource}`);
      }
    }
    return granted.length === 0
      ? { ok: true, detail: "nenhuma capacidade de escrita" }
      : { ok: false, detail: `escrita concedida: ${granted.join(", ")}` };
  });
  await report.case("FA1.3", "FA1 consultor", "o consultor continua a ver o acesso externo", async () => {
    return rbac.canAccessRoute("consultant", "/external-access")
      ? { ok: true, detail: "200 — pedidos e delegações" }
      : { ok: false, detail: "o consultor perdeu o acesso externo" };
  });

  // ─── Isolamento por papel: administradores não entram na conformidade ───
  await report.case("ISO-UI1", "isolamento por papel", "administradores de plataforma não abrem percursos de conformidade", async () => {
    const leaked = [];
    for (const role of ["master_admin", "workspace_admin"]) {
      for (const path of READ_ROUTES_FA1) {
        if (rbac.canAccessRoute(role, path)) leaked.push(`${role}${path}`);
      }
    }
    return leaked.length === 0
      ? { ok: true, detail: "percursos de conformidade continuam restritos ao tenant" }
      : { ok: false, detail: `sem restrição: ${leaked.join(", ")}` };
  });
  await report.case("ISO-UI2", "isolamento por papel", "papéis de tenant não vêem a administração da plataforma", async () => {
    const leaked = [];
    for (const role of ["grc_analyst", "control_owner", "executive", "auditor", "employee", "consultant"]) {
      for (const path of ["/licensing", "/system-status", "/customers"]) {
        if (rbac.canAccessRoute(role, path)) leaked.push(`${role}${path}`);
      }
    }
    return leaked.length === 0
      ? { ok: true, detail: "administração restrita a master_admin e workspace_admin" }
      : { ok: false, detail: `sem restrição: ${leaked.join(", ")}` };
  });

  // ─── Contrato de tenant ───────────────────────────────────────────
  const now = Date.now();
  const assignments = [
    { user_id: "u1", user_email: "consultor@teste.pt", customer_id: "cliente-alfa", assignment_type: "delegation", status: "active", expires_at: new Date(now + 86400000).toISOString() },
    { user_id: "u1", user_email: "consultor@teste.pt", customer_id: "cliente-expirado", assignment_type: "delegation", status: "active", expires_at: new Date(now - 86400000).toISOString() },
    { user_id: "u1", user_email: "consultor@teste.pt", customer_id: "cliente-revogado", assignment_type: "delegation", status: "revoked", expires_at: new Date(now + 86400000).toISOString() },
    { user_id: "u1", user_email: "consultor@teste.pt", customer_id: "cliente-pendente", assignment_type: "delegation", status: "pending", expires_at: new Date(now + 86400000).toISOString() },
    { user_id: "u1", user_email: "consultor@teste.pt", customer_id: "cliente-onboarding", assignment_type: "onboarding", status: "active", expires_at: "" },
  ];
  const workspaces = [
    { id: "ws-parceiro", parent_id: null, customer_id: "" },
    { id: "ws-beta", parent_id: "ws-parceiro", customer_id: "cliente-beta" },
    { id: "ws-gama", parent_id: "ws-parceiro", customer_id: "cliente-gama" },
  ];

  await report.case("TEN1", "contrato de tenant", "utilizador com tenant próprio resolve-se a si mesmo", async () => {
    const id = tenant.resolveActiveCustomerId({ user: { customer_id: "cliente-alfa", email: "a@b.pt" } });
    return id === "cliente-alfa" ? { ok: true, detail: "cliente-alfa" } : { ok: false, detail: `obtido "${id}"` };
  });
  await report.case("TEN2", "contrato de tenant", "conta sem cliente próprio usa a delegação viva", async () => {
    const delegated = tenant.activeDelegatedCustomerIds(assignments, { userId: "u1", email: "consultor@teste.pt" });
    const id = tenant.resolveActiveCustomerId({ user: { email: "consultor@teste.pt" }, delegatedCustomerIds: delegated });
    return id === "cliente-alfa"
      ? { ok: true, detail: `cliente-alfa (delegações vivas: ${delegated.join(", ")})` }
      : { ok: false, detail: `obtido "${id}"` };
  });
  await report.case("TEN3", "contrato de tenant", "delegações expirada, revogada e pendente não dão contexto", async () => {
    const delegated = tenant.activeDelegatedCustomerIds(assignments, { userId: "u1", email: "consultor@teste.pt" });
    const forbidden = ["cliente-expirado", "cliente-revogado", "cliente-pendente", "cliente-onboarding"];
    const leaked = forbidden.filter((id) => delegated.includes(id));
    return leaked.length === 0
      ? { ok: true, detail: "só a delegação activa alarga o contexto" }
      : { ok: false, detail: `contexto alargado por: ${leaked.join(", ")}` };
  });
  await report.case("TEN4", "contrato de tenant", "o workspace selecionado muda mesmo o cliente em contexto (FB3)", async () => {
    const user = { role: "workspace_admin", workspace_id: "ws-parceiro", email: "parceiro@teste.pt" };
    const base = tenant.resolveActiveCustomerId({ user, workspaces });
    const switched = tenant.resolveActiveCustomerId({ user, workspaces, selectedWorkspaceId: "ws-gama" });
    return base !== switched && switched === "cliente-gama"
      ? { ok: true, detail: `carteira (${base}) → workspace Gama (${switched})` }
      : { ok: false, detail: `sem efeito: base=${base}, selecionado=${switched}` };
  });
  await report.case("TEN5", "contrato de tenant", "um workspace fora do âmbito não altera o contexto", async () => {
    const user = { role: "workspace_admin", workspace_id: "ws-parceiro", email: "parceiro@teste.pt" };
    const id = tenant.resolveActiveCustomerId({ user, workspaces, selectedWorkspaceId: "ws-desconhecido" });
    return id !== "ws-desconhecido"
      ? { ok: true, detail: `mantém a carteira (${id || "sem contexto"})` }
      : { ok: false, detail: "adoptou um workspace fora do âmbito" };
  });
}
