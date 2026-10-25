import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { json, readJson, getAuthenticatedUser, isStaffRole, isPlatformAdmin, userCustomerId } from '../../shared/http.ts';

const ALLOWED_PROVIDERS = ['base44', 'google_drive', 'one_drive'];

// Lets a customer admin change the storage provider of their own customer only.
// Uses the service role so the Customer record itself stays locked down: this
// endpoint can never touch any other field, or any other customer.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await getAuthenticatedUser(base44);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    if (!isStaffRole(user)) return json({ error: 'Forbidden' }, 403);

    const isAdmin = isPlatformAdmin(user);
    const body = await readJson(req);
    const provider = body.provider;
    if (!ALLOWED_PROVIDERS.includes(provider)) {
      return json({ error: 'Invalid storage provider' }, 400);
    }

    const ownCustomerId = userCustomerId(user);
    const customerId = isAdmin ? (body.customer_id || ownCustomerId) : ownCustomerId;

    if (!customerId) {
      return json({ error: 'No customer linked to this account' }, 400);
    }
    if (!isAdmin && body.customer_id && body.customer_id !== ownCustomerId) {
      return json({ error: 'Forbidden' }, 403);
    }

    await base44.asServiceRole.entities.Customer.update(customerId, { storage_provider: provider });

    return json({ success: true, provider });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
}