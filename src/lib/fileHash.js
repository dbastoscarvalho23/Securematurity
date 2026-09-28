/**
 * Client-side file hashing — SHA-256 of a File, hex encoded.
 *
 * The hash is stored with the evidence at upload time so an auditor can confirm
 * that the file has not changed since it was collected. Returns an empty string
 * when the browser cannot compute it, so upload never fails because of hashing.
 */
export async function sha256File(file) {
  try {
    if (!file || !globalThis.crypto?.subtle) return '';
    const buffer = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return '';
  }
}
