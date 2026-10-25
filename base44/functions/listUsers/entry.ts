import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { json, getAuthenticatedUser, isStaffRole, userCustomerId } from '../../shared/http.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const currentUser = await getAuthenticatedUser(base44);

    if (!isStaffRole(currentUser)) {
      return json({ error: 'Forbidden' }, 403);
    }

    const allUsers = await base44.asServiceRole.entities.User.list();

    let users;
    if (currentUser.role === 'admin') {
      users = allUsers;
    } else {
      // customer_admin: only users in their customer
      users = allUsers.filter(u => u.customer_id === userCustomerId(currentUser));
    }

    return json({ users });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
});
