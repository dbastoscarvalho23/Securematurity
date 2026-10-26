import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { json, getAuthenticatedUser, isStaffRole } from '../../shared/http.ts';
import { connectedAccount } from '../../shared/storage.ts';

// Estado das ligações da plataforma ao Google Drive e ao OneDrive (uma ligação de cada, com a conta da empresa).
// Devolve { status: { google_drive: bool, one_drive: bool }, accounts: { google_drive: 'conta', one_drive: 'conta' } }.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await getAuthenticatedUser(base44);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    if (!isStaffRole(user)) return json({ error: 'Forbidden' }, 403);

    const status = {};
    const accounts = {};
    for (const provider of ['google_drive', 'one_drive']) {
      const { connected, account } = await connectedAccount(base44, provider);
      status[provider] = connected;
      accounts[provider] = account;
    }

    return json({ status, accounts });
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
}
