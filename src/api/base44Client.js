import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';
import { createSelfHostedClient } from './selfHostedClient';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

// VITE_BACKEND_MODE=selfhosted -> servidor próprio (pasta server/).
// Qualquer outro valor (ou nenhum) -> plataforma Base44, como até aqui.
export const isSelfHosted = import.meta.env.VITE_BACKEND_MODE === 'selfhosted';

export const base44 = isSelfHosted
  ? createSelfHostedClient({ serverUrl: import.meta.env.VITE_API_URL || '', token })
  : createClient({
    appId,
    token,
    functionsVersion,
    serverUrl: '',
    requiresAuth: false,
    appBaseUrl
  });
