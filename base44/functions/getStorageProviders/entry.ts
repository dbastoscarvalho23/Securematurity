import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { json, getAuthenticatedUser, isStaffRole } from '../../shared/http.ts';

// Storage provider id -> connector integration type (they are not the same string).
const THIRD_PARTY_PROVIDERS = { google_drive: 'googledrive', one_drive: 'one_drive' };

// Reports which third-party storage providers the platform is actually connected to,
// so an administrator can see the state of every connection in one place.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await getAuthenticatedUser(base44);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    if (!isStaffRole(user)) return json({ error: 'Forbidden' }, 403);

    const status = {};
    for (const provider of Object.keys(THIRD_PARTY_PROVIDERS)) {
      try {
        const connection = await base44.asServiceRole.connectors.getConnection(THIRD_PARTY_PROVIDERS[provider]);
        status[provider] = Boolean(connection && connection.accessToken);
      } catch (err) {
        status[provider] = false;
      }
    }

    return json({ status });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
}