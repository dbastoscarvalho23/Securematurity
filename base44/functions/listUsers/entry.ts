import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const currentUser = await base44.auth.me().catch(() => null);

    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'customer_admin')) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const allUsers = await base44.asServiceRole.entities.User.list();

    let users;
    if (currentUser.role === 'admin') {
      users = allUsers;
    } else {
      // customer_admin: only users in their customer
      users = allUsers.filter(u => u.customer_id === currentUser.customer_id);
    }

    return Response.json({ users });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});