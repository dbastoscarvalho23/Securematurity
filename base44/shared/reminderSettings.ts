import { isPlatformAdmin, userCustomerId, customerRole } from './http.ts';

/**
 * Shared ReminderSettings lookup + recipient resolution.
 *
 * ReminderSettings rows are customer-scoped (customer_id) with a single
 * global row (no customer_id). Customer-specific settings win, then global,
 * then the defaults below.
 */
export const REMINDER_DEFAULTS = {
  notify_on_assignment: true,
  notify_on_status_change: true,
  notify_on_document_review: true,
  notify_on_document_approval: true,
  due_date_reminders_enabled: true,
  reminder_days_before: [7, 3, 1],
  additional_recipients: '',
};

/** Fetches the effective settings for a customer (or the global row). */
export async function getReminderSettings(base44ServiceRole, customerId) {
  try {
    const all = await base44ServiceRole.entities.ReminderSettings.list();
    const specific = customerId ? all.find(s => s.customer_id === customerId) : null;
    const global = all.find(s => !s.customer_id);
    return specific || global || { ...REMINDER_DEFAULTS };
  } catch {
    return { ...REMINDER_DEFAULTS };
  }
}

/**
 * [primary, ...additional_recipients from settings], deduplicated.
 *
 * Os destinatários adicionais são endereços externos escolhidos nas configurações, por isso só entram quando
 * `allowAdditional` é verdadeiro — ver canUseAdditionalRecipients(). Sem isso, quem desencadeia o aviso
 * transformava a plataforma num relay de mensagens para estranhos em nome da AnkoraOne.
 */
export function buildRecipients(primary, settings, allowAdditional = false) {
  const list = primary ? [primary] : [];
  if (!allowAdditional) return list;
  (settings?.additional_recipients || '')
    .split(',')
    .map(e => e.trim())
    .filter(Boolean)
    .forEach(e => {
      if (!list.includes(e)) list.push(e);
    });
  return list;
}

/**
 * Quem pode usar os destinatários adicionais das ReminderSettings: o administrador da plataforma, o administrador
 * do cliente a que o aviso pertence, ou uma automação agendada (que já passou a verificação de administrador e
 * usa `allowAdditional` diretamente). Qualquer outro utilizador do cliente só faz chegar o aviso ao destinatário
 * principal, retirado do registo na base de dados.
 */
export function canUseAdditionalRecipients(user, customerId) {
  if (!user) return false;
  if (isPlatformAdmin(user)) return true;
  // Quem administra o cliente: customer_admin próprio ou consultor com delegação de nível admin.
  return Boolean(customerId) && customerRole(user, customerId) === 'admin';
}