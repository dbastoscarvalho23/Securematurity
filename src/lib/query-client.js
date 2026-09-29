import { QueryClient } from '@tanstack/react-query';

/**
 * Política de cache por família de dados (OP-F3).
 *
 * Antes havia uma só regra para tudo (`refetchOnWindowFocus: false`, `retry: 1`),
 * pelo que cada navegação voltava a pedir o mesmo: o catálogo e a configuração
 * (quase estáticos) e as listas operacionais (mudam depressa) pagavam o mesmo
 * preço. Aqui a família decide o `staleTime` — catálogo/configuração fica fresco
 * 15 minutos, listas operacionais 1 minuto — a partir do primeiro elemento da
 * chave da query, sem obrigar as páginas a repetir a regra.
 *
 * O `gcTime` é um valor único porque as opções por omissão do cliente só aceitam
 * um número (o `staleTime` é o que decide o refetch repetido a cada navegação).
 */
export const CACHE_POLICIES = {
  estatico: { staleTime: 15 * 60 * 1000, gcTime: 30 * 60 * 1000 },
  operacional: { staleTime: 60 * 1000, gcTime: 30 * 60 * 1000 },
};

/** Chaves de catálogo e configuração: mudam por ação administrativa, não por uso. */
const STATIC_KEYS = new Set([
  'frameworks',
  'questions',
  'questions-global',
  'legal-framework-profiles',
  'legal-document-versions',
  'legal-competent-authorities',
  'knowledge-articles',
  'storage-settings',
  'my-customer-storage',
  'reminderSettings',
  'maintenance-window',
]);

/** A família de cache de uma chave de query (primeiro elemento). */
export function cacheFamilyFor(queryKey) {
  const [first] = Array.isArray(queryKey) ? queryKey : [];
  return STATIC_KEYS.has(first) ? 'estatico' : 'operacional';
}

export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 1,
			staleTime: (query) => CACHE_POLICIES[cacheFamilyFor(query.queryKey)].staleTime,
			gcTime: CACHE_POLICIES.estatico.gcTime,
		},
	},
});
