import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import {
  json,
  readJson,
  getAuthenticatedUser,
  isStaffRole,
  isPlatformAdmin,
  userCustomerId,
} from '../../shared/http.ts';

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

  const currentUser = await getAuthenticatedUser(base44);
  if (!isStaffRole(currentUser)) {
    return json({ error: 'Forbidden: Admin or Customer Admin access required' }, 403);
  }

  const body = await readJson(req);

  const { userId, data } = body;
  if (!userId) {
    return json({ error: 'userId is required' }, 400);
  }

  const platformAdmin = isPlatformAdmin(currentUser);

  // For customer_admin: verify target user belongs to their customer
  if (!platformAdmin) {
    const targetUser = await base44.asServiceRole.entities.User.get(userId).catch(() => null);
    if (!targetUser || targetUser.customer_id !== userCustomerId(currentUser)) {
      return json({ error: 'Forbidden: You can only edit users in your customer' }, 403);
    }
  }

  let { role, full_name, ...restData } = data;

  // For customer_admin: only allow name change
  if (!platformAdmin) {
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
  if (role !== undefined && platformAdmin) {
    const result = await safeUpdate(() =>
      base44.asServiceRole.entities.User.update(userId, { role })
    );
    if (!result.ok) roleError = result.error;
  }

  if (profileError && !roleError) {
    return json({ error: profileError }, 500);
  }

  return json({ success: true, roleError });
});