import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const ALLOWED_PROVIDERS = ['base44', 'google_drive', 'one_drive'];

// Lets a customer admin change the storage provider of their own customer only.
// Uses the service role so the Customer record itself stays locked down: this
// endpoint can never touch any other field, or any other customer.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const isAdmin = user.role === 'admin';
    const isCustomerAdmin = user.role === 'customer_admin';
    if (!isAdmin && !isCustomerAdmin) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const provider = body.provider;
    if (!ALLOWED_PROVIDERS.includes(provider)) {
      return Response.json({ error: 'Invalid storage provider' }, { status: 400 });
    }

    const ownCustomerId = user.customer_id || (user.data && user.data.customer_id);
    const customerId = isAdmin ? (body.customer_id || ownCustomerId) : ownCustomerId;

    if (!customerId) {
      return Response.json({ error: 'No customer linked to this account' }, { status: 400 });
    }
    if (!isAdmin && body.customer_id && body.customer_id !== ownCustomerId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    await base44.asServiceRole.entities.Customer.update(customerId, { storage_provider: provider });

    return Response.json({ success: true, provider });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}