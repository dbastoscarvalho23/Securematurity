import { invokeFn } from '@/lib/invokeFn';

/** Escritas de ativos e ferramentas: passam sempre pela função «assets» (tenant, validação e histórico no servidor). */
export const assetsCall = (payload) => invokeFn('assets', payload);

export const saveAsset = (customerId, asset, id) => assetsCall({ action: 'asset_save', customer_id: customerId, id, asset });
export const deleteAsset = (customerId, id) => assetsCall({ action: 'asset_delete', customer_id: customerId, id });
export const saveComponent = (customerId, component, id) => assetsCall({ action: 'component_save', customer_id: customerId, id, component });
export const deleteComponent = (customerId, id) => assetsCall({ action: 'component_delete', customer_id: customerId, id });

/** Importação em lotes de 200 linhas; devolve os totais somados. */
export async function importAssets(customerId, assets, tools, onProgress) {
  const total = { created: 0, updated: 0, unchanged: 0, tools: 0, failed: [] };
  const size = 200;
  const steps = Math.max(Math.ceil(assets.length / size), Math.ceil(tools.length / size), 1);
  for (let i = 0; i < steps; i += 1) {
    const r = await assetsCall({
      action: 'import', customer_id: customerId,
      assets: assets.slice(i * size, (i + 1) * size), tools: tools.slice(i * size, (i + 1) * size),
    });
    total.created += r.created; total.updated += r.updated; total.unchanged += r.unchanged; total.tools += r.tools;
    total.failed.push(...(r.failed || []));
    onProgress?.((i + 1) / steps);
  }
  return total;
}
