import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Storage provider id -> connector integration type (they are not the same string).
const THIRD_PARTY_PROVIDERS = { google_drive: 'googledrive', one_drive: 'one_drive' };

// Reports which third-party storage providers the platform is actually connected to,
// so an administrator can see the state of every connection in one place.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const status = {};
    for (const provider of Object.keys(THIRD_PARTY_PROVIDERS)) {
      try {
        const connection = await base44.asServiceRole.connectors.getConnection(THIRD_PARTY_PROVIDERS[provider]);
        status[provider] = Boolean(connection && connection.accessToken);
      } catch (err) {
        status[provider] = false;
      }
    }

    return Response.json({ status });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}