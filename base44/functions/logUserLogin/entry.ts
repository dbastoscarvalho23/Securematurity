import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { normalizeRole } from '../../shared/accessUtils.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Written with the service role: the AuditLog RLS only lets master_admin (or
    // the record's own customer) create an entry, so a tenant user's login audit
    // would otherwise be silently dropped.
    await base44.asServiceRole.entities.AuditLog.create({
      action: 'user_login',
      user_email: user.email,
      entity_type: 'User',
      entity_id: user.id,
      details: `User ${user.full_name || user.email} logged in`
    });

    // The stored role is canonicalised in this function, so `storedRole` mirrors
    // what the record will hold after the migration step below.
    let storedRole = user.role;

    // Auto-assign customer_id/role for previously-invited users on first login.
    // This keeps the customer "Users" panel coherent with the Settings "Users" list,
    // since Settings lists all platform users while the customer panel filters by customer_id.
    if (!user.customer_id) {
      try {
        const invites = await base44.asServiceRole.entities.InvitedUser.filter({
          email: user.email,
          status: 'inactive'
        });

        const invite = invites.find(i => i.customer_id);
        if (invite) {
          const updates = { customer_id: invite.customer_id };
          // Promote to customer_admin only if that was the intended role and the
          // current user is still a plain 'employee' (legacy spelling: 'user').
          if (normalizeRole(invite.role) === 'customer_admin' && normalizeRole(user.role) === 'employee') {
            updates.role = 'customer_admin';
            storedRole = 'customer_admin';
          }
          await base44.asServiceRole.entities.User.update(user.id, updates);
          await base44.asServiceRole.entities.InvitedUser.update(invite.id, { status: 'active' });
          await base44.asServiceRole.entities.AuditLog.create({
            action: 'customer_updated',
            user_email: user.email,
            entity_type: 'User',
            entity_id: user.id,
            details: `Auto-assigned customer ${invite.customer_id} on first login (invite activated)`
          });
        }
      } catch (inviteError) {
        // Non-fatal: login audit already succeeded. Surface in logs only.
        console.error('Failed to auto-assign invited user:', inviteError?.message || inviteError);
      }
    }

    // ─── Role migration ───────────────────────────────────────
    // The entity RLS compares `user_condition.role` by exact string and the
    // backend does not normalise roles, so an account stored with a legacy
    // spelling (`admin`, `user`, `partner_admin`) no longer satisfies the
    // canonical rules. Migrate the record lazily on login: the frontend and the
    // backend both resolve roles through normalizeRole, but only a canonical
    // stored value satisfies the RLS.
    const canonicalRole = normalizeRole(storedRole);
    if (canonicalRole !== storedRole) {
      try {
        await base44.asServiceRole.entities.User.update(user.id, { role: canonicalRole });
        await base44.asServiceRole.entities.AuditLog.create({
          action: 'user_updated',
          user_email: user.email,
          entity_type: 'User',
          entity_id: user.id,
          details: `Role migrated on login: ${storedRole} → ${canonicalRole}`
        });
      } catch (migrationError) {
        // Non-fatal: the account keeps its legacy spelling and the session
        // continues — normalizeRole still resolves it for the UI.
        console.error('Failed to migrate stored role:', migrationError?.message || migrationError);
      }
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
