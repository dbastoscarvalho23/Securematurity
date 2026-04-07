import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { userId, data } = await req.json();

    if (!userId) {
      return Response.json({ error: 'userId is required' }, { status: 400 });
    }

    const { role, full_name, ...restData } = data;

    // Build non-role update (display_name, customer_id, customer_name, etc.)
    const profileUpdate = { ...restData };
    if (full_name !== undefined) {
      profileUpdate.display_name = full_name;
    }

    // Step 1: update profile fields (always safe)
    if (Object.keys(profileUpdate).length > 0) {
      await base44.asServiceRole.entities.User.update(userId, profileUpdate);
    }

    // Step 2: update role separately (may fail for app owner — handle gracefully)
    let roleError = null;
    if (role !== undefined) {
      try {
        await base44.asServiceRole.entities.User.update(userId, { role });
      } catch (err) {
        roleError = err.message || 'Could not update role (platform restriction)';
      }
    }

    return Response.json({ success: true, roleError });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});