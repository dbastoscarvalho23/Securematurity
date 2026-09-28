/**
 * Identidades de teste do harness.
 *
 * O backend local mantém uma única sessão autenticada e ignora escritas na
 * entidade `User`, pelo que as identidades não são criadas na base de dados:
 * são objectos de teste enviados em cada invocação (`x-base44-dev-actor`) e
 * aplicados pelo backend no limite da invocação.
 *
 * Quem semeia a topologia é a identidade com o email da sessão do CLI, porque
 * os cenários de delegação ficam associados ao utilizador que os cria — e é
 * esse mesmo email que a identidade de consultor usa para os encontrar.
 */
import { env } from "./client.mjs";

/** Identidade usada para semear e para os cenários de delegação. */
export function seedIdentity(realId) {
  return { role: "master_admin", email: env().email, ...(realId ? { id: realId } : {}) };
}

/**
 * As nove identidades canónicas, ligadas à topologia semeada.
 *
 * @param {object} topology - `test_conditions` devolvido por seedTestEnvironment
 * @param {string} delegatedEmail - email titular das delegações semeadas
 */
export function buildIdentities(topology, delegatedEmail) {
  const t = topology.tenants;
  const p = topology.partners;

  return {
    master_admin: { role: "master_admin", email: "dev.master@local.test" },

    // Administrador de parceiro: sem cliente próprio, mas com a carteira do
    // workspace que administra (Alfa) — e por isso sem acesso à carteira Beta.
    workspace_admin_alfa: {
      role: "workspace_admin",
      email: "dev.partner.alfa@local.test",
      workspace_id: p.partner_alfa,
    },
    workspace_admin_beta: {
      role: "workspace_admin",
      email: "dev.partner.beta@local.test",
      workspace_id: p.partner_beta,
    },

    customer_admin_alfa: { role: "customer_admin", email: "dev.cadmin.alfa@local.test", customer_id: t.tenant_alfa },
    grc_analyst_alfa: { role: "grc_analyst", email: "dev.grc.alfa@local.test", customer_id: t.tenant_alfa },
    control_owner_beta: { role: "control_owner", email: "dev.owner.beta@local.test", customer_id: t.tenant_beta },
    executive_alfa: { role: "executive", email: "dev.exec.alfa@local.test", customer_id: t.tenant_alfa },
    auditor_alfa: { role: "auditor", email: "dev.auditor.alfa@local.test", customer_id: t.tenant_alfa },
    employee_beta: { role: "employee", email: "dev.employee.beta@local.test", customer_id: t.tenant_beta },

    // Consultor: sem cliente próprio — todo o acesso vem da delegação.
    consultant: { role: "consultant", email: delegatedEmail },
  };
}
