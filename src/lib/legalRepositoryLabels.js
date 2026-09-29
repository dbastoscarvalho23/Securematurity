/**
 * Rótulos das versões do repositório legal — o valor gravado e a chave de
 * tradução da interface.
 *
 * O espelho dos enums está em `base44/shared/legalRepository.ts`
 * (`VERSION_TYPES` / `VERSION_STATUSES`): acrescentar um tipo ou um estado é
 * acrescentar nos dois sítios, aqui com a chave `repo_type_*` / `repo_status_*`
 * das famílias `translations-*.js`. Nenhum rótulo se escreve à mão nos
 * componentes (`FrameworkEditor` desenha os `SelectItem` a partir destes mapas).
 */

export const VERSION_TYPE_LABELS = {
  original: 'repo_type_original',
  transposicao: 'repo_type_transposicao',
  consolidada: 'repo_type_consolidada',
  emenda: 'repo_type_emenda',
  norma_tecnica: 'repo_type_norma_tecnica',
};

export const VERSION_STATUS_LABELS = {
  current: 'repo_status_current',
  superseded: 'repo_status_superseded',
  draft: 'repo_status_draft',
  withdrawn: 'repo_status_withdrawn',
};
