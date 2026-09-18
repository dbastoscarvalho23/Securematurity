import { base44 } from '@/api/base44Client';

/**
 * Uploads a file and stores it in the customer's configured cloud storage
 * provider (Google Drive or OneDrive). Falls back to the app's own storage
 * when no provider is configured, or if the cloud upload fails.
 *
 * @param {File} file - the file to upload
 * @param {string} [customerId] - customer whose storage setting applies;
 *   defaults to the signed-in user's own customer
 * @returns {Promise<{file_url: string, provider: string}>}
 */
export async function uploadFile(file, customerId) {
  const { file_url } = await base44.integrations.Core.UploadFile({ file });

  try {
    const response = await base44.functions.invoke('storeFileToCloud', {
      file_url,
      file_name: file.name,
      customer_id: customerId,
    });
    return {
      file_url: response.data?.url || file_url,
      provider: response.data?.provider || 'base44',
    };
  } catch {
    return { file_url, provider: 'base44' };
  }
}