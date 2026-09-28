/**
 * Semelhança de perguntas — normalização, Jaccard e deteção de duplicados.
 *
 * Esta lógica nasceu dentro do `AIQuestionGeneratorDialog` (comparar as
 * perguntas sugeridas com as que já existem antes de as guardar) e passou a ser
 * partilhada quando a importação de bases de perguntas precisou do mesmo
 * veredicto: um ficheiro externo tem de ser marcado com os mesmos critérios com
 * que o gerador por IA bloqueia duplicados. O backend tem o espelho em
 * `base44/shared/questionImport.ts` (o Deno não importa de `src/`), pelo que
 * qualquer alteração aos limiares ou à normalização tem de ser feita nos dois.
 */

/** Acima deste valor a pergunta é considerada duplicado (bloqueada no gerador). */
export const DUPLICATE_THRESHOLD = 0.75;
/** Acima deste valor a pergunta é assinalada como semelhante (exige revisão). */
export const SIMILAR_THRESHOLD = 0.45;

/** Texto normalizado para comparação (sem acentos, pontuação ou espaços duplos). */
export function normalizeQuestionText(str) {
  return String(str ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Palavras significativas de uma pergunta (o Jaccard ignora as curtas). */
export function questionTokens(str) {
  return new Set(normalizeQuestionText(str).split(' ').filter(w => w.length > 3));
}

/** Jaccard entre dois textos de pergunta (0–1). */
export function questionSimilarity(a, b) {
  const setA = questionTokens(a);
  const setB = questionTokens(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}

/**
 * Chave lógica de uma pergunta no catálogo partilhado:
 * framework + controlo + texto normalizado.
 */
export function questionKey(question) {
  return [question?.framework_code, question?.control_id, question?.question_text]
    .map(normalizeQuestionText)
    .join('|');
}

/**
 * Veredicto de uma pergunta face às existentes.
 * Devolve `isDuplicate`, `isSimilar`, `similarity` e a pergunta que coincidiu.
 */
export function inspectQuestion(candidate, existingQuestions = []) {
  let best = { isDuplicate: false, isSimilar: false, similarity: 0, matchedQuestion: null };
  for (const existing of existingQuestions) {
    const simEn = questionSimilarity(candidate?.question_text, existing?.question_text);
    const simPt = candidate?.question_text_pt && existing?.question_text_pt
      ? questionSimilarity(candidate.question_text_pt, existing.question_text_pt)
      : 0;
    const similarity = Math.max(simEn, simPt);
    if (similarity >= DUPLICATE_THRESHOLD) {
      return { isDuplicate: true, isSimilar: false, similarity, matchedQuestion: existing };
    }
    if (similarity >= SIMILAR_THRESHOLD && similarity > best.similarity) {
      best = { isDuplicate: false, isSimilar: true, similarity, matchedQuestion: existing };
    }
  }
  return best;
}
