import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Folder created inside the connected Google Drive / OneDrive account.
const FOLDER_NAME = 'AnkoraOne';

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

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const fileUrl = body.file_url;
    const fileName = safeFileName(body.file_name);
    const customerId = body.customer_id || user.customer_id || (user.data && user.data.customer_id);

    if (!fileUrl || !/^https:\/\//i.test(fileUrl)) {
      return Response.json({ error: 'A valid file_url is required' }, { status: 400 });
    }

    let provider = 'base44';
    if (customerId) {
      let customer = null;
      try {
        customer = await base44.asServiceRole.entities.Customer.get(customerId);
      } catch (_) {
        customer = null;
      }
      provider = (customer && customer.storage_provider) || 'base44';
    }

    if (provider === 'base44') {
      return Response.json({ url: fileUrl, provider: 'base44' });
    }

    const fileRes = await fetch(fileUrl);
    if (!fileRes.ok) {
      return Response.json({ error: 'Could not read the uploaded file' }, { status: 502 });
    }
    const bytes = await fileRes.arrayBuffer();
    const contentType = fileRes.headers.get('content-type') || 'application/octet-stream';

    if (provider === 'google_drive') {
      const { accessToken } = await base44.asServiceRole.connectors.getConnection('googledrive');
      const url = await uploadToDrive(accessToken, bytes, contentType, fileName);
      return Response.json({ url, provider: 'google_drive' });
    }

    if (provider === 'one_drive') {
      const { accessToken } = await base44.asServiceRole.connectors.getConnection('one_drive');
      const url = await uploadToOneDrive(accessToken, bytes, contentType, fileName);
      return Response.json({ url, provider: 'one_drive' });
    }

    return Response.json({ url: fileUrl, provider: 'base44' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}