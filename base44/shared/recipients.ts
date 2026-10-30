import { userCustomerId, delegatedCustomerIds } from './http.ts';

/**
 * Destinatários autorizados de um cliente — duas camadas, com níveis de confiança diferentes.
 *
 * Internos (sempre incluídos): nunca escritos por um utilizador final fora do próprio registo —
 *  - colaboradores registados do cliente e administradores da plataforma (entram por convite);
 *  - contactos do registo Customer (contact_email, permanent_contact_email, cybersecurity_manager_email),
 *    que só a administração da plataforma pode criar ou alterar (ver RLS de Customer).
 *
 * Externos (só para administradores): contactos de fornecedores, formandos e questionários. Estes registos são
 * criados e editados por qualquer colega do cliente (RLS por customer_id) e os campos são texto livre. Servir
 * esta lista a quem a escreve transformava a plataforma num relay de email para estranhos em nome da AnkoraOne
 * (spam/phishing e queima da reputação do domínio de envio). Por isso só entram quando quem pede é administrador
 * da plataforma ou do cliente (`includeExternal`), o mesmo grau de confiança já exigido para additional_recipients.
 *
 * Duas utilizações:
 *  - sendEmail: destinatários escolhidos na interface por um utilizador de cliente.
 *  - Avisos automáticos (tarefas, riscos, documentos): os campos que escolhem o destinatário
 *    (Task.assigned_to, RiskItem.owner_email, SecurityDocument.owner_email) são texto livre escrito pelo
 *    utilizador. Sem esta verificação, quem cria o registo transformava a plataforma num relay de email para
 *    qualquer endereço externo, em nome da AnkoraOne.
 */
export async function allowedRecipients(base44, customerId, { includeExternal = false } = {}) {
  const db = base44.asServiceRole.entities;
  const [users, customer, external] = await Promise.all([
    db.User.list().catch(() => []),
    customerId ? db.Customer.get(customerId).catch(() => null) : null,
    includeExternal && customerId
      ? Promise.all([
          db.Supplier.filter({ customer_id: customerId }, '-created_date', 500).catch(() => []),
          db.TrainingEnrollment.filter({ customer_id: customerId }, '-created_date', 1000).catch(() => []),
          db.SupplierQuestionnaire.filter({ customer_id: customerId }, '-created_date', 500).catch(() => []),
        ])
      : null,
  ]);
  const out = new Set();
  const add = (value) => {
    const email = String(value || '').trim().toLowerCase();
    if (email) out.add(email);
  };
  // Colegas do mesmo cliente e administradores da plataforma (avisos internos).
  for (const u of users) {
    // Consultores com acesso delegado a este cliente também são da equipa (ex.: responsáveis por tarefas).
    if (u.role === 'admin' || (customerId && (userCustomerId(u) === customerId || delegatedCustomerIds(u).includes(String(customerId))))) add(u.email);
  }
  if (customer) {
    add(customer.contact_email);
    add(customer.permanent_contact_email);
    add(customer.cybersecurity_manager_email);
  }
  if (external) {
    const [suppliers, enrollments, questionnaires] = external;
    for (const s of suppliers) add(s.contact_email);
    for (const e of enrollments) add(e.user_email);
    for (const q of questionnaires) add(q.supplier_email);
  }
  return out;
}

/** O endereço consta nos contactos registados do cliente? (endereços vazios nunca contam) */
export async function isAllowedRecipient(base44, customerId, email, options = {}) {
  const address = String(email || '').trim().toLowerCase();
  if (!address) return false;
  return (await allowedRecipients(base44, customerId, options)).has(address);
}

/** Memoriza a lista por cliente durante o pedido (automações que percorrem registos de vários clientes). */
export function recipientLookup(base44, options = {}) {
  const cache = new Map();
  return (customerId) => {
    const key = String(customerId || '');
    if (!cache.has(key)) cache.set(key, allowedRecipients(base44, customerId, options));
    return cache.get(key);
  };
}