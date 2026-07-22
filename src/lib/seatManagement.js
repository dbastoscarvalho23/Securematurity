import { base44 } from '@/api/base44Client';

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

  const direction = delta > 0 ? 'increased' : 'decreased';
  const fieldLabel = field === 'user_seat_addon_count' ? 'Add-on seats' : 'Base seat limit';

  const baseLimit = field === 'user_seat_limit'
    ? newValue
    : (customer.user_seat_limit ?? MIN_SEAT_LIMIT);
  const addon = field === 'user_seat_addon_count'
    ? newValue
    : (customer.user_seat_addon_count ?? 0);
  const totalSeats = baseLimit + addon;

  // 1. Audit log — the permanent report record
  try {
    await base44.entities.AuditLog.create({
      action: 'settings_changed',
      entity_type: 'Customer',
      entity_id: customer.id,
      customer_id: customer.id,
      details: `${fieldLabel} ${direction} from ${oldValue} to ${newValue} (${delta > 0 ? '+' : ''}${delta}) for "${customer.name}". Total seats now: ${totalSeats}.`,
      user_email: changedBy || 'unknown',
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

    const subject = `[Seat Adjustment] ${customer.name} — ${fieldLabel} ${direction}`;
    const body =
`Hello,

The user seat allocation for "${customer.name}" has been changed. Please adjust your finance records accordingly.

Customer:       ${customer.name}
Changed by:     ${changedBy || 'unknown'}
Change:         ${fieldLabel} ${direction} from ${oldValue} to ${newValue} (${delta > 0 ? '+' : ''}${delta})
Total seats:    ${totalSeats}  (base: ${baseLimit}, add-on: ${addon})

Please review and update billing as needed.

Best regards,
CyberGovern Platform`;

    await Promise.all(
      recipients.map(email =>
        base44.integrations.Core.SendEmail({ to: email, subject, body })
      )
    );

    // Log each email to the audit trail so it appears in the Email Report
    try {
      await base44.entities.AuditLog.create({
        action: 'email_sent',
        user_email: changedBy || 'unknown',
        entity_type: 'Customer',
        entity_id: customer.id,
        customer_id: customer.id,
        details: `Seat adjustment notification sent to ${recipients.join(', ')} for customer: ${customer.name} (${fieldLabel} ${direction} from ${oldValue} to ${newValue})`,
      });
    } catch (e) {
      console.warn('Seat-change email_sent audit log failed:', e);
    }
  } catch (e) {
    console.warn('Seat-change email notification failed:', e);
  }
}