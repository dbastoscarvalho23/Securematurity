import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || (user.role !== 'admin' && user.role !== 'customer_admin')) {
      return Response.json({ error: 'Forbidden: Admin or Customer Admin access required' }, { status: 403 });
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { userId } = body;
    if (!userId) {
      return Response.json({ error: 'userId is required' }, { status: 400 });
    }

    // For customer_admin: verify target user belongs to their customer
    if (user.role === 'customer_admin') {
      const targetUser = await base44.asServiceRole.entities.User.get(userId).catch(() => null);
      if (!targetUser || targetUser.customer_id !== user.customer_id) {
        return Response.json({ error: 'Forbidden: You can only delete users in your customer' }, { status: 403 });
      }
    }

    await base44.asServiceRole.entities.User.delete(userId);
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});