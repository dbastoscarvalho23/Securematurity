import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { json, getAuthenticatedUser, userCustomerId } from '../../shared/http.ts';
import { logAudit } from '../../shared/audit.ts';

const TENANT_ROLES = ['user', 'customer_admin'];

/**
 * An invite is trusted only if its (server-set) creator may add users to that customer.
 * Returns the target Customer when trusted, otherwise null.
 */
async function trustedInviteCustomer(base44, invite) {
  if (!invite?.customer_id || !TENANT_ROLES.includes(invite.role) || !invite.created_by_id) return null;
  const customer = await base44.asServiceRole.entities.Customer.get(invite.customer_id).catch(() => null);
  if (!customer) return null;
  const creator = await base44.asServiceRole.entities.User.get(invite.created_by_id).catch(() => null);
  if (!creator) return null;
  if (creator.role === 'admin') return customer;
  return creator.role === 'customer_admin' && userCustomerId(creator) === invite.customer_id ? customer : null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await getAuthenticatedUser(base44);

    if (!user) {
      return json({ error: 'Unauthorized' }, 401);
    }

    await logAudit(base44, 'user_login', {
      user_email: user.email,
      entity_type: 'User',
      entity_id: user.id,
      details: `User ${user.full_name || user.email} logged in`,
    });

    // Auto-assign customer_id/role for previously-invited users on first login.
    // This keeps the customer "Users" panel coherent with the Settings "Users" list,
    // since Settings lists all platform users while the customer panel filters by customer_id.
    //
    // Security (tenant isolation): an invite only grants membership of a customer when
    //  - it targets an existing customer and asks for a tenant role (user | customer_admin), and
    //  - it was created (server-set created_by_id, never the client-set invited_by) by a platform
    //    admin or by a customer_admin of that same customer.
    // Anything else is ignored and audited, so a customer_admin cannot place users in other tenants.
    if (!userCustomerId(user)) {
      try {
        const invites = await base44.asServiceRole.entities.InvitedUser.filter({
          email: user.email,
          status: 'inactive'
        });

        let invite = null;
        let customer = null;
        for (const candidate of invites) {
          customer = await trustedInviteCustomer(base44, candidate);
          if (customer) { invite = candidate; break; }
          await logAudit(base44, 'invite_rejected', {
            user_email: user.email,
            entity_type: 'InvitedUser',
            entity_id: candidate.id,
            details: `Convite ignorado no primeiro login: criador ou cliente inválido (cliente ${candidate.customer_id || '—'})`,
          });
        }

        if (invite) {
          const updates = { customer_id: invite.customer_id, customer_name: customer.name || '' };
          // Promote to customer_admin only if that was the intended role and the
          // current user is still a plain platform 'user'.
          if (invite.role === 'customer_admin' && user.role === 'user') {
            updates.role = 'customer_admin';
          }
          await base44.asServiceRole.entities.User.update(user.id, updates);
          await base44.asServiceRole.entities.InvitedUser.update(invite.id, { status: 'active' });
          await logAudit(base44, 'customer_updated', {
            user_email: user.email,
            entity_type: 'User',
            entity_id: user.id,
            details: `Auto-assigned customer ${invite.customer_id} on first login (invite activated)`,
          });
        }
      } catch (inviteError) {
        // Non-fatal: login audit already succeeded. Surface in logs only.
        console.error('Failed to auto-assign invited user:', inviteError?.message || inviteError);
      }
    }

    return json({ success: true });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
});
