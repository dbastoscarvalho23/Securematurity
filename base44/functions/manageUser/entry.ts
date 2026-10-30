import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { userCustomerId } from '../../shared/http.ts';

/**
 * manageUser — single backend entry point for all User entity mutations.
 *
 * Actions:
 *  - { action: 'update', userId, data }  — updates whitelisted profile fields and (admin only) role
 *  - { action: 'delete', userId }        — deletes the user
 *
 * Access:
 *  - admin: any user, any field, any delete.
 *  - customer_admin: only users in their own customer; profile fields (name, customer_id)
 *    and non-platform role changes; delete restricted to standard 'user' accounts.
 */
const ALLOWED_UPDATE_FIELDS = ['customer_id', 'customer_name', 'display_name'];
// 'consultant': sem acesso global; chega aos clientes só por atribuições aprovadas por eles (acesso delegado).
const NON_PLATFORM_ROLES = ['user', 'customer_admin', 'consultant'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const currentUser = await base44.auth.me().catch(() => null);

    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'customer_admin')) {
      return Response.json({ error: 'Forbidden: Admin or Customer Admin access required' }, { status: 403 });
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { action, userId, data } = body;
    if (!userId || (action !== 'update' && action !== 'delete')) {
      return Response.json({ error: 'action (update|delete) and userId are required' }, { status: 400 });
    }

    const isPlatformAdmin = currentUser.role === 'admin';

    const targetUser = await base44.asServiceRole.entities.User.get(userId).catch(() => null);
    if (!targetUser) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    // customer_admin: must itself belong to a customer, and the target must belong to that same customer
    const callerCustomerId = userCustomerId(currentUser);
    if (!isPlatformAdmin && (!callerCustomerId || userCustomerId(targetUser) !== callerCustomerId)) {
      return Response.json({ error: 'Forbidden: You can only manage users in your customer' }, { status: 403 });
    }

    if (action === 'delete') {
      // customer_admin: only standard 'user' accounts can be deleted
      if (!isPlatformAdmin && targetUser.role !== 'user') {
        return Response.json({ error: 'Forbidden: You can only delete standard user accounts' }, { status: 403 });
      }
      await base44.asServiceRole.entities.User.delete(userId);
      return Response.json({ success: true });
    }

    // action === 'update'
    const role = data?.role;
    const fullName = data?.full_name;
    let restData = {};
    for (const key of ALLOWED_UPDATE_FIELDS) {
      if (data && data[key] !== undefined) restData[key] = data[key];
    }

    // customer_admin: no role changes (platform blocks them anyway); profile fields only
    if (!isPlatformAdmin) {
      restData = {};
    } else if (role !== undefined && !NON_PLATFORM_ROLES.includes(role) && role !== 'admin') {
      return Response.json({ error: 'Invalid role' }, { status: 400 });
    }

    const profileUpdate = { ...restData };
    if (fullName !== undefined) {
      profileUpdate.display_name = fullName;
    }

    let roleError = null;

    if (Object.keys(profileUpdate).length > 0) {
      try {
        await base44.asServiceRole.entities.User.update(userId, profileUpdate);
      } catch (err) {
        if (!isPlatformAdmin || role === undefined) {
          return Response.json({ error: err?.message || 'Update failed' }, { status: 500 });
        }
        roleError = err?.message || 'Update failed';
      }
    }

    if (role !== undefined && isPlatformAdmin && role !== targetUser.role) {
      try {
        await base44.asServiceRole.entities.User.update(userId, { role });
      } catch (err) {
        roleError = err?.message || 'Role update failed';
      }
    }

    return Response.json({ success: true, roleError });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

