import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { json, readJson, getAuthenticatedUser, isPlatformAdmin, isStaffRole, userCustomerId } from '../../shared/http.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const currentUser = await getAuthenticatedUser(base44);

    if (!isStaffRole(currentUser)) {
      return json({ error: 'Forbidden' }, 403);
    }

    const body = await readJson(req);
    const page = Number.isInteger(body.page) && body.page >= 0 ? body.page : null;
    const pageSize = Number.isInteger(body.pageSize) && body.pageSize > 0 && body.pageSize <= 200 ? body.pageSize : null;

    let users;
    let total;

    if (isPlatformAdmin(currentUser)) {
      if (page !== null && pageSize !== null) {
        total = await base44.asServiceRole.entities.User.count({});
        users = await base44.asServiceRole.entities.User.list('-created_date', pageSize, page * pageSize);
      } else {
        users = await base44.asServiceRole.entities.User.list();
      }
    } else {
      // customer_admin: only users in their customer
      const query = { customer_id: userCustomerId(currentUser) };
      if (page !== null && pageSize !== null) {
        total = await base44.asServiceRole.entities.User.count(query);
        users = await base44.asServiceRole.entities.User.filter(query, '-created_date', pageSize, page * pageSize);
      } else {
        const allUsers = await base44.asServiceRole.entities.User.list();
        users = allUsers.filter(u => u.customer_id === userCustomerId(currentUser));
      }
    }

    if (page !== null && pageSize !== null) {
      return json({ users, total });
    }
    return json({ users });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
});
