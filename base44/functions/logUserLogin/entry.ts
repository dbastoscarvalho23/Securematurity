import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await base44.entities.AuditLog.create({
      action: 'user_login',
      user_email: user.email,
      entity_type: 'User',
      entity_id: user.id,
      details: `User ${user.full_name || user.email} logged in`
    });

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
          // current user is still a plain platform 'user'.
          if (invite.role === 'customer_admin' && user.role === 'user') {
            updates.role = 'customer_admin';
          }
          await base44.asServiceRole.entities.User.update(user.id, updates);
          await base44.asServiceRole.entities.InvitedUser.update(invite.id, { status: 'active' });
          await base44.entities.AuditLog.create({
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

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});