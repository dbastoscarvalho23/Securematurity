import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';
import { createSelfHostedClient } from './selfHostedClient';
import { withActiveCustomer } from '@/lib/activeCustomer';

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

// Consultores (acesso delegado): os pedidos às funções levam o cliente ativo quando não indicam outro. Só há cliente
// ativo guardado para consultores (ver src/lib/activeCustomer.js e AuthContext).
if (base44?.functions?.invoke) {
  const invoke = base44.functions.invoke.bind(base44.functions);
  base44.functions.invoke = (name, payload, ...rest) => invoke(name, withActiveCustomer(payload ?? {}), ...rest);
}
