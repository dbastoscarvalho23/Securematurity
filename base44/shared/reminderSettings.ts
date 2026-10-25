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

/** [primary, ...additional_recipients from settings], deduplicated. */
export function buildRecipients(primary, settings) {
  const list = primary ? [primary] : [];
  (settings?.additional_recipients || '')
    .split(',')
    .map(e => e.trim())
    .filter(Boolean)
    .forEach(e => {
      if (!list.includes(e)) list.push(e);
    });
  return list;
}
