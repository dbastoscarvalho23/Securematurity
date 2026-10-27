import { format as fnsFormat } from 'date-fns';
import { pt, enUS } from 'date-fns/locale';

/** Língua ativa da interface (a mesma que o LanguageContext guarda). */
function currentLanguage() {
  try { return localStorage.getItem('app_language') || 'en'; } catch { return 'en'; }
}

// Padrões norte-americanos convertidos para a ordem portuguesa (dia antes do mês).
const PT_PATTERNS = { 'MMM d, yyyy': 'd MMM yyyy', 'MMM d': 'd MMM' };

/** format() do date-fns com a língua da interface: «28 out» em português, «Oct 28» em inglês. */
export function format(date, pattern, options = {}) {
  const isPt = currentLanguage() === 'pt';
  return fnsFormat(date, isPt ? (PT_PATTERNS[pattern] || pattern) : pattern, { locale: isPt ? pt : enUS, ...options });
}
