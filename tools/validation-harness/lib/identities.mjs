/**
 * Identidades de teste do harness.
 *
 * No alvo **local** o backend mantém uma única sessão autenticada e ignora
 * escritas na entidade `User`, pelo que as identidades não são criadas na base
 * de dados: são objectos de teste enviados em cada invocação
 * (`x-base44-dev-actor`) e aplicados pelo backend no limite da invocação.
 *
 * No alvo **cloud** não há injecção nenhuma: cada identidade é uma conta real e
 * o seu email vem do ficheiro de tokens (`cloudAccount`); quem decide o papel e
 * o âmbito é a própria sessão dessa conta.
 *
 * Quem semeia a topologia é a identidade com o email da sessão do CLI (local) ou
 * a conta do master_admin (cloud), porque os cenários de delegação ficam
 * associados ao utilizador que os cria — e é esse mesmo email que a identidade
 * de consultor usa para os encontrar.
 */
import { env, isCloud, cloudAccount } from "./client.mjs";

/** Identidade usada para semear e para os cenários de delegação. */
export function seedIdentity(realId) {
  if (isCloud()) {
    const account = cloudAccount("master_admin");
    return { key: "master_admin", role: "master_admin", email: account.email };
  }
  return { role: "master_admin", email: env().email, ...(realId ? { id: realId } : {}) };
}

/**
 * As nove identidades canónicas, ligadas à topologia semeada.
 *
 * Cada uma leva a sua `key`: é por ela (ou pelo papel, quando só existe uma
 * conta por papel) que o alvo cloud encontra o token correspondente em
 * `/run/base44/harness-tokens.json`.
 *
 * @param {object} topology - `test_conditions` devolvido por seedTestEnvironment
 * @param {string} delegatedEmail - email titular das delegações semeadas
 */
export function buildIdentities(topology, delegatedEmail) {
  const t = topology.tenants;
  const p = topology.partners;

  const identities = {
    master_admin: { key: "master_admin", role: "master_admin", email: "dev.master@local.test" },

    // Administrador de parceiro: sem cliente próprio, mas com a carteira do
    // workspace que administra (Alfa) — e por isso sem acesso à carteira Beta.
    workspace_admin_alfa: {
      key: "workspace_admin_alfa",
      role: "workspace_admin",
      email: "dev.partner.alfa@local.test",
      workspace_id: p.partner_alfa,
    },
    workspace_admin_beta: {
      key: "workspace_admin_beta",
      role: "workspace_admin",
      email: "dev.partner.beta@local.test",
      workspace_id: p.partner_beta,
    },

    customer_admin_alfa: {
      key: "customer_admin_alfa",
      role: "customer_admin",
      email: "dev.cadmin.alfa@local.test",
      customer_id: t.tenant_alfa,
    },
    grc_analyst_alfa: {
      key: "grc_analyst_alfa",
      role: "grc_analyst",
      email: "dev.grc.alfa@local.test",
      customer_id: t.tenant_alfa,
    },
    control_owner_beta: {
      key: "control_owner_beta",
      role: "control_owner",
      email: "dev.owner.beta@local.test",
      customer_id: t.tenant_beta,
    },
    executive_alfa: {
      key: "executive_alfa",
      role: "executive",
      email: "dev.exec.alfa@local.test",
      customer_id: t.tenant_alfa,
    },
    auditor_alfa: {
      key: "auditor_alfa",
      role: "auditor",
      email: "dev.auditor.alfa@local.test",
      customer_id: t.tenant_alfa,
    },
    employee_beta: {
      key: "employee_beta",
      role: "employee",
      email: "dev.employee.beta@local.test",
      customer_id: t.tenant_beta,
    },

    // Consultor: sem cliente próprio — todo o acesso vem da delegação.
    consultant: { key: "consultant", role: "consultant", email: delegatedEmail },
  };

  if (!isCloud()) return identities;

  // Alvo cloud: a identidade é a conta real — só o email a liga ao token.
  for (const identity of Object.values(identities)) {
    identity.email = cloudAccount(identity).email;
  }
  return identities;
}
