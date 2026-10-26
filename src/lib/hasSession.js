import { base44 } from '@/api/base44Client';

/**
 * Existe sessão para consultar?
 *
 * O SDK não usa cookies: a autenticação segue no cabeçalho `Authorization`, com o
 * token guardado no browser. Sem token, `base44.auth.me()` responde sempre 401 e o
 * SDK registava esse pedido falhado na consola em cada visita anónima (por exemplo,
 * no ecrã de início de sessão). Os contextos que só querem o perfil do utilizador
 * perguntam primeiro aqui.
 */
export function hasSession() {
  if (base44.auth.hasToken?.()) return true;
  try {
    return Boolean(window.localStorage.getItem('base44_access_token') || window.localStorage.getItem('token'));
  } catch (_) {
    return false;
  }
}
