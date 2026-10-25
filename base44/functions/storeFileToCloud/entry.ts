import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { json, readJson, getAuthenticatedUser, userCustomerId, isPlatformAdmin } from '../../shared/http.ts';

// Folder created inside the connected Google Drive / OneDrive account.
const FOLDER_NAME = 'AnkoraOne';

// ── SSRF protection ──────────────────────────────────────────────────────────
// file_url must point at the application's own storage (the app's own host or a
// base44.com storage host) and must resolve to a public IP. Internal network
// targets (loopback / private ranges / cloud metadata) are rejected before any
// fetch is performed.

function isPrivateIp(ip) {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
    const parts = ip.split('.').map(Number);
    if (parts.some(n => n > 255)) return true;
    const [a, b] = parts;
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) || // CGNAT
      (a === 169 && b === 254) ||           // link-local + cloud metadata
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224                              // multicast / reserved / broadcast
    );
  }
  const h = ip.toLowerCase();
  if (h.startsWith('::ffff:')) return isPrivateIp(h.slice(7)); // IPv4-mapped IPv6
  return (
    h === '::' || h === '::1' ||
    /^(fe[89ab]|f[cd]|ff)/.test(h) // link-local, unique-local, multicast
  );
}

async function resolvesToPublicIp(hostname) {
  if (typeof Deno.resolveDns !== 'function') return true; // resolver unavailable — allowlist still gates the host
  let addresses = [];
  for (const type of ['A', 'AAAA']) {
    try {
      const records = await Deno.resolveDns(hostname, type);
      addresses = addresses.concat(records.map(r => (typeof r === 'string' ? r : r.ip)));
    } catch {
      // No records of this type (or resolver unavailable) — not fatal by itself.
    }
  }
  if (addresses.length === 0) return false; // fail closed when unresolvable
  return addresses.every(addr => !isPrivateIp(addr));
}

function isAllowedStorageHost(hostname, requestHost) {
  const h = String(hostname || '').toLowerCase().replace(/\.$/, '');
  const own = String(requestHost || '').toLowerCase().replace(/\.$/, '').split(':')[0];
  return h === own || h === 'base44.com' || h.endsWith('.base44.com');
}

function safeFileName(name) {
  const cleaned = String(name || 'file').replace(/[^\w.\- ]+/g, '_').trim();
  return (cleaned || 'file').slice(0, 180);
}

async function findOrCreateDriveFolder(accessToken) {
  const auth = { Authorization: `Bearer ${accessToken}` };
  const q = encodeURIComponent(
    `mimeType='application/vnd.google-apps.folder' and name='${FOLDER_NAME}' and trashed=false`
  );
  const listRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`,
    { headers: auth }
  );
  if (listRes.ok) {
    const list = await listRes.json();
    if (list.files && list.files.length > 0) return list.files[0].id;
  }

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
  });
  const created = await createRes.json();
  return created && created.id ? created.id : null;
}

async function uploadToDrive(accessToken, bytes, contentType, fileName) {
  const auth = { Authorization: `Bearer ${accessToken}` };
  const folderId = await findOrCreateDriveFolder(accessToken);

  const boundary = `ankoraone-${Date.now()}`;
  const metadata = {
    name: fileName,
    mimeType: contentType,
    ...(folderId ? { parents: [folderId] } : {}),
  };

  const encoder = new TextEncoder();
  const head = encoder.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}` +
    `\r\n--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`
  );
  const tail = encoder.encode(`\r\n--${boundary}--`);
  const payload = new Uint8Array(head.length + bytes.byteLength + tail.length);
  payload.set(head, 0);
  payload.set(new Uint8Array(bytes), head.length);
  payload.set(tail, head.length + bytes.byteLength);

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
    {
      method: 'POST',
      headers: { ...auth, 'Content-Type': `multipart/related; boundary=${boundary}` },
      body: payload,
    }
  );
  const uploaded = await uploadRes.json();
  if (!uploaded || !uploaded.id) {
    throw new Error('Google Drive upload failed');
  }

  // Let anyone with the link view the file, so app users can open it.
  await fetch(`https://www.googleapis.com/drive/v3/files/${uploaded.id}/permissions`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  });

  return uploaded.webViewLink || `https://drive.google.com/file/d/${uploaded.id}/view`;
}

async function uploadToOneDrive(accessToken, bytes, contentType, fileName) {
  const auth = { Authorization: `Bearer ${accessToken}` };
  const itemPath = encodeURIComponent(`${FOLDER_NAME}/${fileName}`);

  const uploadRes = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/root:/${itemPath}:/content`,
    { method: 'PUT', headers: { ...auth, 'Content-Type': contentType }, body: bytes }
  );
  const uploadText = await uploadRes.text();
  const item = uploadText ? JSON.parse(uploadText) : null;
  if (!uploadRes.ok || !item || !item.id) {
    throw new Error('OneDrive upload failed');
  }

  // Prefer a link that works for anyone; fall back to the item url.
  const linkRes = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/items/${item.id}/createLink`,
    {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'view', scope: 'anonymous' }),
    }
  );
  const linkText = await linkRes.text();
  if (linkRes.ok && linkText) {
    const link = JSON.parse(linkText);
    if (link && link.link && link.link.webUrl) return link.link.webUrl;
  }

  return item.webUrl;
}

// ── SSRF guard ───────────────────────────────────────────────────────────────
// file_url must be a public https URL: never localhost, a private/reserved IP
// literal, or any hostname that resolves into a private network, so the server
// cannot be used to fetch internal services and republish their content.

function isPrivateIPv4(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(p => Number.isNaN(p) || p < 0 || p > 255)) return true;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;                       // this-host, private, loopback
  if (a === 169 && b === 254) return true;                                 // link-local / cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;                        // private
  if (a === 192 && b === 168) return true;                                 // private
  if (a === 192 && b === 0) return true;                                   // protocol assignments
  if (a === 198 && (b === 18 || b === 19)) return true;                     // benchmarking
  if (a >= 224) return true;                                               // multicast / reserved
  return false;
}

function isPrivateIPv6(addr) {
  const a = addr.toLowerCase();
  if (a === '::' || a === '::1') return true;                              // unspecified / loopback
  if (a.startsWith('fc') || a.startsWith('fd')) return true;              // unique local
  if (a.startsWith('fe8') || a.startsWith('fe9') || a.startsWith('fea') || a.startsWith('feb')) return true; // link-local
  if (a.startsWith('::ffff:')) return isPrivateIPv4(a.slice(7));           // IPv4-mapped
  return false;
}

async function urlPointsToPrivateNetwork(fileUrl) {
  let url;
  try {
    url = new URL(fileUrl);
  } catch {
    return true;
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    return true;
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return isPrivateIPv4(host);
  if (typeof Deno !== 'undefined' && typeof Deno.resolveDns === 'function') {
    try {
      for (const r of (await Deno.resolveDns(host, 'A')) || []) {
        if (isPrivateIPv4(r)) return true;
      }
      for (const r of (await Deno.resolveDns(host, 'AAAA')) || []) {
        if (isPrivateIPv6(r)) return true;
      }
    } catch {
      return true; // unresolvable hosts are rejected
    }
  }
  return false;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await getAuthenticatedUser(base44);
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const body = await readJson(req);
    const fileUrl = body.file_url;
    const fileName = safeFileName(body.file_name);
    // Non-admin callers cannot target another customer's storage account.
    const ownCustomerId = userCustomerId(user);
    const customerId = isPlatformAdmin(user) ? (body.customer_id || ownCustomerId) : ownCustomerId;

    // SSRF guard: only fetch files hosted in the app's own storage (Base44).
    // Never fetch arbitrary or internal URLs from the server.
    if (!fileUrl || !/^https:\/\//i.test(fileUrl)) {
      return json({ error: 'A valid file_url is required' }, 400);
    }

    // SSRF gate: the URL must belong to the application's own storage and must
    // not resolve into the internal network. This runs before any fetch.
    let parsedUrl;
    try {
      parsedUrl = new URL(fileUrl);
    } catch {
      return json({ error: 'A valid file_url is required' }, 400);
    }
    if (parsedUrl.protocol !== 'https:' || parsedUrl.username || parsedUrl.password) {
      return json({ error: 'A valid file_url is required' }, 400);
    }
    const requestHost = req.headers.get('host') || '';
    if (!isAllowedStorageHost(parsedUrl.hostname, requestHost)) {
      return json({ error: 'file_url must point at application storage' }, 400);
    }
    if (!(await resolvesToPublicIp(parsedUrl.hostname))) {
      return json({ error: 'file_url host is not resolvable to a public address' }, 400);
    }

    // SSRF guard: only fetch public https URLs, and never follow redirects
    // (a redirect could bounce the request to an internal host).
    if (await urlPointsToPrivateNetwork(fileUrl)) {
      return json({ error: 'file_url is not allowed' }, 400);
    }

    // Which third-party providers are enabled platform-wide. A disabled provider
    // always falls back to app storage, whatever a customer or the default says.
    let enabledProviders = null;
    let defaultProvider = 'base44';
    try {
      const settings = await base44.asServiceRole.entities.StorageSettings.list();
      const config = settings[0] || null;
      defaultProvider = (config && config.provider) || 'base44';
      enabledProviders = config && config.enabled_providers && config.enabled_providers.length
        ? config.enabled_providers
        : null;
    } catch (_) {
      enabledProviders = null;
    }
    const isEnabled = (id) => id === 'base44' || !enabledProviders || enabledProviders.includes(id);

    // A customer pointed at an external provider overrides the app-wide default
    // configured in Settings; otherwise the application default applies.
    let provider = null;
    if (customerId) {
      let customer = null;
      try {
        customer = await base44.asServiceRole.entities.Customer.get(customerId);
      } catch (_) {
        customer = null;
      }
      const customerProvider = customer && customer.storage_provider;
      if (customerProvider && customerProvider !== 'base44' && isEnabled(customerProvider)) {
        provider = customerProvider;
      }
    }
    if (!provider && isEnabled(defaultProvider)) provider = defaultProvider;
    if (!provider) provider = 'base44';

    if (provider === 'base44') {
      return json({ url: fileUrl, provider: 'base44' });
    }

    const fileRes = await fetch(fileUrl, { redirect: 'error' });
    if (!fileRes.ok) {
      return json({ error: 'Could not read the uploaded file' }, 502);
    }
    const bytes = await fileRes.arrayBuffer();
    const contentType = fileRes.headers.get('content-type') || 'application/octet-stream';

    if (provider === 'google_drive') {
      const { accessToken } = await base44.asServiceRole.connectors.getConnection('googledrive');
      const url = await uploadToDrive(accessToken, bytes, contentType, fileName);
      return json({ url, provider: 'google_drive' });
    }

    if (provider === 'one_drive') {
      const { accessToken } = await base44.asServiceRole.connectors.getConnection('one_drive');
      const url = await uploadToOneDrive(accessToken, bytes, contentType, fileName);
      return json({ url, provider: 'one_drive' });
    }

    return json({ url: fileUrl, provider: 'base44' });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
}