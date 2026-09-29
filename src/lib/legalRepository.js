/**
 * Repositório legal (Layer 1) — leitura e apresentação.
 *
 * O repositório tem três entidades — `CompetentAuthority`, `FrameworkProfile` e
 * `LegalDocumentVersion` — legíveis por qualquer utilizador autenticado e sem
 * nenhum caminho de escrita no browser (a escrita é só de
 * `manageLegalRepository`). Este ficheiro é o único sítio onde a linha temporal,
 * a frescura e a vigência são calculadas; as páginas e os componentes leem
 * daqui e não decidem nada por si.
 */
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { FRAMEWORK_CATALOGUE, FRAMEWORK_BY_CODE, frameworkName } from './frameworkCatalogue';

/** Chave do ciclo de revisão quando a ficha ainda não existe. */
const DEFAULT_REVIEW_CYCLE_MONTHS = 12;

/** Lê as três entidades do repositório de uma vez. */
export function useLegalRepository() {
  const profiles = useQuery({
    queryKey: ['legal-framework-profiles'],
    queryFn: () => base44.entities.FrameworkProfile.list('-created_date', 200),
  });
  const versions = useQuery({
    queryKey: ['legal-document-versions'],
    queryFn: () => base44.entities.LegalDocumentVersion.list('-created_date', 500),
  });
  const authorities = useQuery({
    queryKey: ['legal-competent-authorities'],
    queryFn: () => base44.entities.CompetentAuthority.list('name', 200),
  });

  return {
    profiles: profiles.data || [],
    versions: versions.data || [],
    authorities: authorities.data || [],
    isLoading: profiles.isLoading || versions.isLoading || authorities.isLoading,
    isError: profiles.isError || versions.isError || authorities.isError,
    refetch: () => {
      profiles.refetch();
      versions.refetch();
      authorities.refetch();
    },
  };
}

/** Ficha de um framework (a ativa, quando há mais do que uma linha). */
export function profileFor(profiles, frameworkCode) {
  const rows = (profiles || []).filter(p => p.framework_code === frameworkCode);
  if (!rows.length) return null;
  return rows.find(p => p.is_active !== false) || rows[0];
}

/** Todas as versões de um framework, da mais recente para a mais antiga. */
export function versionsFor(versions, frameworkCode) {
  return (versions || [])
    .filter(v => v.framework_code === frameworkCode)
    .sort((a, b) => String(b.effective_from).localeCompare(String(a.effective_from)));
}

/**
 * Linha temporal: a versão em vigor (a mais recente com `current`), as
 * substituídas, os rascunhos e as futuras (vigência ainda no futuro).
 * As retiradas ficam com as substituídas — são histórico.
 */
export function buildTimeline(versions) {
  const now = Date.now();
  const current = [];
  const superseded = [];
  const drafts = [];
  const future = [];

  (versions || []).forEach(version => {
    const starts = version.effective_from ? new Date(version.effective_from).getTime() : NaN;
    const isFuture = !Number.isNaN(starts) && starts > now;
    if (version.status === "draft") drafts.push(version);
    else if (version.status === "withdrawn") superseded.push(version);
    else if (version.status === "superseded") superseded.push(version);
    else if (isFuture) future.push(version);
    else current.push(version);
  });

  return { current, superseded, drafts, future };
}

/** Versão principal: a mais recente em vigor. */
export function primaryVersion(versions) {
  const { current } = buildTimeline(versions);
  return current[0] || null;
}

/** Ciclo de revisão da ficha (meses), com recurso ao valor por omissão. */
export function reviewCycleMonths(profile) {
  return Number(profile?.review_cycle_months) || DEFAULT_REVIEW_CYCLE_MONTHS;
}

/**
 * Frescura de uma ficha ou versão: `fresh` (verificada e dentro do ciclo),
 * `due` (revisão vencida) ou `unverified` (nunca verificada).
 */
export function freshnessOf(record, now = Date.now()) {
  const verified = record?.verified_at ? new Date(record.verified_at).getTime() : NaN;
  if (Number.isNaN(verified)) return 'unverified';
  const due = record?.review_due_at ? new Date(record.review_due_at).getTime() : NaN;
  if (!Number.isNaN(due) && due < now) return 'due';
  return 'fresh';
}

/** Vigência legível: `2025-12-04 → —` ou `2021-07-30 → 2025-12-04`. */
export function formatLegalDate(value) {
  if (!value) return '—';
  const text = String(value);
  // Datas de precisão anual (ex. "2019") são gravadas como o próprio ano.
  if (/^\d{4}$/.test(text)) return text;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return date.toLocaleDateString('pt-PT', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

/** Data completa com hora, para as linhas de verificação. */
export function formatVerifiedAt(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('pt-PT', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

/** Entidades competentes de uma ficha, pela ordem dos códigos. */
export function authoritiesFor(authorities, codes) {
  const wanted = codes || [];
  return wanted
    .map(code => (authorities || []).find(a => a.code === code))
    .filter(Boolean);
}

/**
 * Catálogo apresentado na grelha: sempre os sete frameworks do catálogo único,
 * com a ficha e as versões que existirem (um framework sem ficha continua a
 * aparecer, para o repositório não parecer completo quando não está).
 */
export function buildRepositoryCards({ profiles, versions, authorities }, lang = 'pt') {
  return FRAMEWORK_CATALOGUE.map(entry => {
    const profile = profileFor(profiles, entry.code);
    const frameworkVersions = versionsFor(versions, entry.code);
    const version = primaryVersion(frameworkVersions);
    const authorityCodes = profile?.competent_authority_codes?.length
      ? profile.competent_authority_codes
      : entry.authority_codes;
    return {
      code: entry.code,
      catalogueEntry: entry,
      name: profile?.[lang === 'en' ? 'display_name_en' : 'display_name'] || frameworkName(entry.code, lang),
      acronym: profile?.acronym || entry.acronym,
      profile,
      version,
      versions: frameworkVersions,
      authorities: authoritiesFor(authorities, authorityCodes),
      freshness: version ? freshnessOf(version) : 'unverified',
      reviewDueAt: version?.review_due_at || null,
    };
  });
}

/** Nome legível de um framework, a partir da ficha quando existe. */
export function displayNameFor(profile, frameworkCode, lang = 'pt') {
  if (profile) {
    const key = lang === 'en' ? 'display_name_en' : 'display_name';
    if (profile[key]) return profile[key];
  }
  return frameworkName(frameworkCode, lang);
}

/** A definição do catálogo de um framework (com recurso ao objeto vazio). */
export function catalogueEntryFor(frameworkCode) {
  return FRAMEWORK_BY_CODE[frameworkCode] || null;
}
