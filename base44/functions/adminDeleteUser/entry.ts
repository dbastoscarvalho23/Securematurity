import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { json, readJson, getAuthenticatedUser, isStaffRole, userCustomerId } from '../../shared/http.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await getAuthenticatedUser(base44);
    if (!isStaffRole(user)) {
      return json({ error: 'Forbidden: Admin or Customer Admin access required' }, 403);
    }

    const { userId } = await readJson(req);
    if (!userId) {
      return json({ error: 'userId is required' }, 400);
    }

    // For customer_admin: verify target user belongs to their customer
    if (user.role === 'customer_admin') {
      const targetUser = await base44.asServiceRole.entities.User.get(userId).catch(() => null);
      if (!targetUser || targetUser.customer_id !== userCustomerId(user)) {
        return json({ error: 'Forbidden: You can only delete users in your customer' }, 403);
      }
    }

    await base44.asServiceRole.entities.User.delete(userId);
    return json({ success: true });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
});
