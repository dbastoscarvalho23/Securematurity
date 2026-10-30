import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { json, readJson, getAuthenticatedUser, isPlatformAdmin, isStaffRole, userCustomerId, resolveCustomer, delegatedCustomerIds } from '../../shared/http.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const currentUser = await getAuthenticatedUser(base44);

    if (!currentUser) return json({ error: 'Unauthorized' }, 401);
    // Utilizadores comuns só recebem nome e email dos colegas do mesmo cliente (para escolher responsáveis).
    // Consultores: os colegas de um cliente delegado (o pedido ou o único), mais os consultores com acesso a ele.
    const body = await readJson(req);
    if (!isStaffRole(currentUser)) {
      const own = resolveCustomer(currentUser, body.customer_id)?.customerId || null;
      if (!own) return json({ error: 'Forbidden' }, 403);
      const all = await base44.asServiceRole.entities.User.list();
      const colleagues = (all || [])
        .filter((u) => String(userCustomerId(u) || '') === own || delegatedCustomerIds(u).includes(own))
        .map((u) => ({ id: u.id, email: u.email, full_name: u.full_name, display_name: u.display_name, customer_id: own }));
      return json({ users: colleagues });
    }

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
      // customer_admin: only users in their customer (none when the caller has no customer)
      const callerCustomerId = userCustomerId(currentUser);
      if (!callerCustomerId) return json({ error: 'Forbidden' }, 403);
      const query = { customer_id: callerCustomerId };
      if (page !== null && pageSize !== null) {
        total = await base44.asServiceRole.entities.User.count(query);
        users = await base44.asServiceRole.entities.User.filter(query, '-created_date', pageSize, page * pageSize);
      } else {
        const allUsers = await base44.asServiceRole.entities.User.list();
        users = allUsers.filter(u => userCustomerId(u) === callerCustomerId);
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


