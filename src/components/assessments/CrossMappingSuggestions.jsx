import React, { useState } from 'react';
import { getCrossMappings } from '@/lib/frameworkMappings';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GitCompare, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/LanguageContext';

const MATURITY_COLORS = [
  'text-muted-foreground',
  'text-chart-4',
  'text-chart-3',
  'text-chart-1',
  'text-chart-2',
  'text-accent',
];

const MATURITY_KEYS = [
  'maturity_non_existent',
  'maturity_initial',
  'maturity_developing',
  'maturity_defined',
  'maturity_managed',
  'maturity_optimized',
];

/**
 * Shows cross-framework mapping suggestions on a QuestionCard.
 *
 * Props:
 *   question        – the current Question entity
 *   currentFramework – e.g. "ISO27001"
 *   allQuestions    – full list of questions loaded in this assessment
 *   responseMap     – { questionId: AssessmentResponse }
 *   onApplySuggestion(maturity_level, evidence_notes, attachments) – callback to apply a peer answer
 */
export default function CrossMappingSuggestions({
  question,
  currentFramework,
  allQuestions,
  responseMap,
  onApplySuggestion,
}) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const [applied, setApplied] = useState(false);

  const mapping = getCrossMappings(currentFramework, question.control_id);
  if (!mapping) return null;

  // Find peer questions that have already been answered
  const answeredPeers = mapping.peers
    .map(peer => {
      const peerQ = allQuestions.find(
        q => q.framework_code === peer.framework && q.control_id === peer.id
      );
      if (!peerQ) return null;
      const peerResp = responseMap[peerQ.id];
      if (!peerResp || peerResp.maturity_level == null) return null;
      return { peer, question: peerQ, response: peerResp };
    })
    .filter(Boolean);

  if (answeredPeers.length === 0) return null;

  const handleApply = (peerData) => {
    onApplySuggestion(
      peerData.response.maturity_level,
      peerData.response.evidence_notes || '',
      peerData.response.attachments || []
    );
    setApplied(true);
    setTimeout(() => setApplied(false), 2000);
  };

  return (
    <div className="mt-3 rounded-lg border border-chart-1/20 bg-chart-1/5 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-chart-1 hover:bg-chart-1/10 transition-colors"
      >
        <GitCompare className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="flex-1 text-left">
          {answeredPeers.length} {answeredPeers.length > 1 ? t('cross_map_matches') : t('cross_map_match')} · {mapping.group}
        </span>
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {expanded && (
        <div className="divide-y divide-chart-1/10 border-t border-chart-1/10">
          {answeredPeers.map(({ peer, question: peerQ, response: peerResp }) => {
            const level = peerResp.maturity_level;
            return (
              <div key={`${peer.framework}::${peer.id}`} className="px-3 py-2.5 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs font-mono">
                    {peer.framework}
                  </Badge>
                  <span className="text-xs font-mono text-muted-foreground">{peer.id}</span>
                  <span className={cn('text-xs font-semibold ml-auto', MATURITY_COLORS[level] || '')}>
                    {t('cross_map_level')} {level} — {t(MATURITY_KEYS[level] || '')}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{peerQ.question_text}</p>
                {peerResp.evidence_notes && (
                  <p className="text-xs text-foreground/70 italic line-clamp-2">
                    "{peerResp.evidence_notes}"
                  </p>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-xs gap-1 mt-1 text-chart-1 border-chart-1/30 hover:bg-chart-1/10"
                  onClick={() => handleApply({ peer, question: peerQ, response: peerResp })}
                >
                  {applied ? (
                    <><Check className="w-3 h-3" /> {t('cross_map_applied')}</>
                  ) : (
                    <><Copy className="w-3 h-3" /> {t('cross_map_apply')}</>
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}