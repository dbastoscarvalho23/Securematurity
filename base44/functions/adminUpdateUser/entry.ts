import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

async function safeUpdate(fn) {
  try {
    await fn();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || 'Unknown error' };
  }
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const user = await safeUpdate(() => base44.auth.me());
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

  const { userId, data } = body;
  if (!userId) {
    return Response.json({ error: 'userId is required' }, { status: 400 });
  }

  const isPlatformAdmin = currentUser.role === 'admin';

  // For customer_admin: verify target user belongs to their customer
  if (!isPlatformAdmin) {
    const targetUser = await base44.asServiceRole.entities.User.get(userId).catch(() => null);
    if (!targetUser || targetUser.customer_id !== currentUser.customer_id) {
      return Response.json({ error: 'Forbidden: You can only edit users in your customer' }, { status: 403 });
    }
  }

  let { role, full_name, ...restData } = data;

  // For customer_admin: only allow name change
  if (!isPlatformAdmin) {
    restData = {};
  }

  // Build profile update (no role)
  const profileUpdate = { ...restData };
  if (full_name !== undefined) {
    profileUpdate.display_name = full_name;
  }

  let profileError = null;
  let roleError = null;

  // Step 1: update profile fields (customer_id, customer_name, display_name)
  if (Object.keys(profileUpdate).length > 0) {
    const result = await safeUpdate(() =>
      base44.asServiceRole.entities.User.update(userId, profileUpdate)
    );
    if (!result.ok) profileError = result.error;
  }

  // Step 2: update role separately (platform blocks for app owner — we ignore gracefully)
  if (role !== undefined && isPlatformAdmin) {
    const result = await safeUpdate(() =>
      base44.asServiceRole.entities.User.update(userId, { role })
    );
    if (!result.ok) roleError = result.error;
  }

  if (profileError && !roleError) {
    return Response.json({ error: profileError }, { status: 500 });
  }

  return Response.json({ success: true, roleError });
});