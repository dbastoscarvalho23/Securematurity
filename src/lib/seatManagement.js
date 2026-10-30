import { invokeFn } from '@/lib/invokeFn';
import { base44 } from '@/api/base44Client';
import { sendEmail } from '@/lib/mail';

export const MIN_SEAT_LIMIT = 5;

/**
 * When a seat count changes, generates an audit-log record (the "report")
 * and sends an email notification to platform admins + customer admins
 * so they can adjust finance/billing information.
 *
 * @param {object} customer  - the customer BEFORE the update
 * @param {'user_seat_limit'|'user_seat_addon_count'} field
 * @param {number} oldValue
 * @param {number} newValue
 * @param {string} changedBy - email of the user who made the change
 */
export async function notifySeatChange({ customer, field, oldValue, newValue, changedBy }) {
  const delta = newValue - oldValue;
  if (delta === 0) return;

  const direction = delta > 0 ? 'aumentado' : 'reduzido';
  const fieldLabel = field === 'user_seat_addon_count' ? 'Lugares adicionais' : 'Limite base de lugares';

  const baseLimit = field === 'user_seat_limit'
    ? newValue
    : (customer.user_seat_limit ?? MIN_SEAT_LIMIT);
  const addon = field === 'user_seat_addon_count'
    ? newValue
    : (customer.user_seat_addon_count ?? 0);
  const totalSeats = baseLimit + addon;

  // 1. Audit log — the permanent report record
  try {
    await invokeFn('audit', {
      op: 'record',
      action: 'settings_changed',
      entity_type: 'Customer',
      entity_id: customer.id,
      customer_id: customer.id,
      details: `${fieldLabel} ${direction} de ${oldValue} para ${newValue} (${delta > 0 ? '+' : ''}${delta}) em «${customer.name}». Total: ${totalSeats} lugares.`,
    });
  } catch (e) {
    console.warn('Seat-change audit log failed:', e);
  }

  // 2. Email notification to platform admins + customer admins
  try {
    const [admins, customerAdmins] = await Promise.all([
      base44.entities.User.filter({ role: 'admin' }),
      base44.entities.User.filter({ role: 'customer_admin', customer_id: customer.id }),
    ]);

    const recipients = [...admins, ...customerAdmins]
      .filter(u => u.email)
      .map(u => u.email)
      .filter((email, idx, arr) => arr.indexOf(email) === idx); // dedupe

    if (recipients.length === 0) return;

    const subject = `[Lugares] ${customer.name} — ${fieldLabel} ${direction}`;
    const body =
`Foi alterado o número de lugares de utilizador do cliente «${customer.name}».

Cliente:        ${customer.name}
Alterado por:   ${changedBy || 'desconhecido'}
Alteração:      ${fieldLabel} ${direction} de ${oldValue} para ${newValue} (${delta > 0 ? '+' : ''}${delta})
Total:          ${totalSeats} lugares (base: ${baseLimit}, adicionais: ${addon})

Atualize a faturação, se for o caso.

AnkoraOne`;

    await Promise.all(
      recipients.map(email =>
        sendEmail({ to: email, subject, html: body, customerId: customer.id, entityType: 'Customer', entityId: customer.id })
      )
    );

    // O registo «email_sent» é feito pela função sendEmail, um por envio.

  } catch (e) {
    console.warn('Seat-change email notification failed:', e);
  }
}