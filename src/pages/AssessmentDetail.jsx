import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, ChevronRight, Check, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import QuestionCard from '@/components/assessments/QuestionCard';
import AssessmentResults from '@/components/assessments/AssessmentResults';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/LanguageContext';
import { translateDomain } from '@/lib/domainTranslations';
import LoadingState from '@/components/shared/LoadingState';

export default function AssessmentDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const assessmentId = window.location.pathname.split('/').pop();
  const queryClient = useQueryClient();
  const [activeFramework, setActiveFramework] = useState(null);
  const [activeDomain, setActiveDomain] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showPartialDialog, setShowPartialDialog] = useState(false);
  const { language: globalLanguage, t } = useLanguage();
  const [language, setLanguage] = useState(globalLanguage);

  // Sync local language with global language setting
  useEffect(() => {
    setLanguage(globalLanguage);
  }, [globalLanguage]);

  const { data: assessment } = useQuery({
    queryKey: ['assessment', assessmentId],
    queryFn: () => base44.entities.Assessment.list().then(list => list.find(a => a.id === assessmentId)),
    enabled: !!assessmentId,
  });

  const { data: questions = [] } = useQuery({
    queryKey: ['questions', assessmentId, assessment?.question_ids],
    queryFn: async () => {
      // Load assessment-specific questions (AI-generated or custom written)
      const specific = await base44.entities.Question.filter({ assessment_id: assessmentId }, 'order_index', 500);

      if (specific.length > 0) {
        // AI mode: all questions were created specifically for this assessment
        return specific;
      }

      // Manual mode: load the specific existing questions by their saved IDs
      const questionIds = assessment?.question_ids;
      if (questionIds?.length > 0) {
        const allGlobal = await base44.entities.Question.filter({ is_active: true }, 'order_index', 500);
        const idSet = new Set(questionIds);
        return allGlobal.filter(q => idSet.has(q.id));
      }

      return [];
    },
    enabled: !!assessmentId && !!assessment,
  });

  const { data: responses = [] } = useQuery({
    queryKey: ['responses', assessmentId],
    queryFn: () => base44.entities.AssessmentResponse.filter({ assessment_id: assessmentId }, '-created_date', 500),
    enabled: !!assessmentId,
  });

  const saveMutation = useMutation({
    mutationFn: async ({ questionId, data }) => {
      const existing = responses.find(r => r.question_id === questionId);
      if (existing) {
        return base44.entities.AssessmentResponse.update(existing.id, data);
      } else {
        return base44.entities.AssessmentResponse.create({
          ...data,
          assessment_id: assessmentId,
          customer_id: assessment?.customer_id,
          question_id: questionId,
          // Weight snapshot, so the methodology stays interpretable if the
          // shared question catalogue changes later.
          question_weight: questions.find(q => q.id === questionId)?.weight ?? 1,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['responses', assessmentId] });
    },
  });

  /**
   * Optional AI suggestions. They are generated AFTER the server has already
   * completed the assessment, so a failing AI service never blocks the Core
   * journey — recommendations can be created manually instead.
   */
  const generateRecommendations = async () => {
    try {
      const responseSummary = responses.map(r => ({
        framework: r.framework_code,
        domain: r.domain,
        control: r.control_id,
        level: r.maturity_level,
        target: r.target_level || 4,
      }));

      const aiResult = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a cybersecurity compliance expert. Analyze these assessment responses and generate actionable recommendations.

Assessment data: ${JSON.stringify(responseSummary)}

For each significant gap (current level < target level), provide a recommendation. Focus on the most impactful improvements.
Return 5-8 prioritized recommendations.
IMPORTANT: For any ISO 27001 controls, strictly follow the ISO/IEC 27001:2022 Annex A structure (Organizational Controls, People Controls, Physical Controls, Technological Controls). Do NOT use the 2013 version's domain structure.`,
        response_json_schema: {
          type: "object",
          properties: {
            recommendations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  framework_code: { type: "string" },
                  domain: { type: "string" },
                  control_id: { type: "string" },
                  priority: { type: "string", enum: ["critical", "high", "medium", "low"] },
                  title: { type: "string" },
                  description: { type: "string" },
                  current_level: { type: "number" },
                  target_level: { type: "number" },
                  effort: { type: "string", enum: ["low", "medium", "high"] },
                  timeline: { type: "string", enum: ["immediate", "short_term", "medium_term", "long_term"] },
                }
              }
            }
          }
        }
      });

      if (aiResult?.recommendations) {
        await base44.entities.Recommendation.bulkCreate(
          aiResult.recommendations.map(r => ({
            ...r,
            assessment_id: assessmentId,
            customer_id: assessment?.customer_id,
            status: 'pending',
          }))
        );
        queryClient.invalidateQueries({ queryKey: ['recommendations', assessmentId] });
      }
    } catch (error) {
      // The assessment is already completed — only the optional suggestions failed.
      console.error('Recommendation generation failed', error);
      toast.warning(t('assessment_complete_ai_unavailable'));
    }
  };

  /**
   * Completion runs on the server (completeAssessment): it authorizes the actor,
   * checks the licensed module, applies the coverage rules and recomputes the
   * scores from the persisted responses.
   */
  const completeMutation = useMutation({
    mutationFn: async (confirmPartial = false) => {
      setIsAnalyzing(true);
      return base44.functions.invoke('completeAssessment', {
        action: 'complete',
        assessment_id: assessmentId,
        confirm_partial: confirmPartial,
      });
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['assessment', assessmentId] });
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      toast.success(t('assessment_complete_success'));
      await generateRecommendations();
      setIsAnalyzing(false);
    },
    onError: (error) => {
      setIsAnalyzing(false);
      const code = error?.response?.data?.code || error?.data?.code;
      if (code === 'incomplete_coverage') {
        setShowPartialDialog(true);
        return;
      }
      toast.error(error?.response?.data?.error || error?.data?.error || error?.message || t('assessment_complete_error'));
    },
  });

  // Group questions by framework and domain
  const frameworkQuestions = useMemo(() => {
    if (!assessment?.frameworks) return {};
    const map = {};
    const generalLabel = language === 'pt' ? t('common_general') : 'General';
    assessment.frameworks.forEach(fc => {
      const fqs = questions.filter(q => q.framework_code === fc);
      const domains = {};
      fqs.forEach(q => {
        const d = (language === 'pt') ? (q.domain_pt || translateDomain(q.domain, 'pt') || generalLabel) : (q.domain || generalLabel);
        if (!domains[d]) domains[d] = [];
        domains[d].push(q);
      });
      map[fc] = domains;
    });
    return map;
  }, [questions, assessment, language, t]);

  const responseMap = useMemo(() => {
    const map = {};
    responses.forEach(r => { map[r.question_id] = r; });
    return map;
  }, [responses]);

  if (!assessment) {
    return <LoadingState label={t('common_loading')} fullHeight className="h-64" />;
  }

  const currentFw = activeFramework || assessment.frameworks?.[0];
  const domains = frameworkQuestions[currentFw] || {};
  const domainKeys = Object.keys(domains);
  const currentDomain = activeDomain && domains[activeDomain] ? activeDomain : domainKeys[0];
  const hasPtTranslations = questions.some(q => q.question_text_pt);

  // Calculate progress
  const totalQuestions = questions.filter(q => assessment.frameworks?.includes(q.framework_code)).length;
  const answeredQuestions = responses.length;
  const progressPct = totalQuestions > 0 ? (answeredQuestions / totalQuestions) * 100 : 0;

  if (assessment.status === 'completed') {
    return <AssessmentResults assessment={assessment} responses={responses} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/assessments">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{assessment.title}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {assessment.customer_name} · {assessment.period}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-md border border-border overflow-hidden text-sm" title={!hasPtTranslations ? t('assessment_detail_pt_unavailable') : undefined}>
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={cn("px-3 py-1.5 font-medium transition-colors", language === 'en' ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
            >EN</button>
            <button
              type="button"
              onClick={() => !hasPtTranslations ? null : setLanguage('pt')}
              disabled={!hasPtTranslations}
              className={cn(
                "px-3 py-1.5 font-medium transition-colors",
                !hasPtTranslations ? "opacity-40 cursor-not-allowed text-muted-foreground" :
                language === 'pt' ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              )}
            >PT</button>
          </div>
          <div className="text-right mr-2">
            <p className="text-xs text-muted-foreground">{t('assessment_detail_progress')}</p>
            <p className="text-sm font-semibold">{answeredQuestions}/{totalQuestions}</p>
          </div>
          <div className="w-32">
            <Progress value={progressPct} className="h-2" />
          </div>
          <Button
            onClick={() => completeMutation.mutate(false)}
            disabled={completeMutation.isPending || isAnalyzing || answeredQuestions === 0}
            className="gap-2"
          >
            {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {isAnalyzing ? t('assessment_detail_analyzing') : t('assessment_detail_complete')}
          </Button>
        </div>
      </div>

      {/* Framework tabs */}
      <Tabs value={currentFw} onValueChange={(v) => { setActiveFramework(v); setActiveDomain(null); }}>
        <TabsList>
          {(assessment.frameworks || []).map(fc => (
            <TabsTrigger key={fc} value={fc}>{fc.replace('_', ' ')}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Domain sidebar + Questions */}
      <div className="grid grid-cols-12 gap-6">
        {/* Domain list */}
        <div className="col-span-3">
          <Card className="p-4 sticky top-20">
            <h3 className="font-semibold text-sm mb-3 text-foreground">{t('assessment_detail_domains')}</h3>
            {/* Overall framework progress */}
            {domainKeys.length > 0 && (
              <div className="mb-4 pb-3 border-b border-border">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-muted-foreground font-medium">{currentFw?.replace('_', ' ')}</span>
                  <span className="text-xs font-semibold">
                    {domainKeys.reduce((s, d) => s + (domains[d] || []).filter(q => responseMap[q.id]).length, 0)}
                    /
                    {domainKeys.reduce((s, d) => s + (domains[d] || []).length, 0)}
                  </span>
                </div>
                <Progress
                  value={
                    domainKeys.reduce((s, d) => s + (domains[d] || []).filter(q => responseMap[q.id]).length, 0) /
                    Math.max(1, domainKeys.reduce((s, d) => s + (domains[d] || []).length, 0)) * 100
                  }
                  className="h-1.5"
                />
              </div>
            )}
            <div className="space-y-1.5">
              {domainKeys.map(d => {
                const domainQs = domains[d] || [];
                const answered = domainQs.filter(q => responseMap[q.id]).length;
                const isComplete = answered === domainQs.length && domainQs.length > 0;
                const domainPct = domainQs.length > 0 ? (answered / domainQs.length) * 100 : 0;
                return (
                  <button
                    key={d}
                    onClick={() => setActiveDomain(d)}
                    className={cn(
                      "w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all border",
                      d === currentDomain
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : isComplete
                        ? "border-accent/20 bg-accent/5 text-foreground hover:border-accent/40"
                        : "border-muted text-muted-foreground hover:text-foreground hover:border-muted-foreground/40 hover:bg-muted/30"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {isComplete && <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-accent" />}
                        <span className="truncate">{d}</span>
                      </div>
                      <Badge
                        variant={d === currentDomain ? "secondary" : "outline"}
                        className={cn(
                          "text-xs flex-shrink-0 ml-2",
                          d === currentDomain && "bg-primary-foreground text-primary"
                        )}
                      >
                        {answered}/{domainQs.length}
                      </Badge>
                    </div>
                    {/* Per-domain progress bar */}
                    <div className="h-1 w-full rounded-full bg-muted/50 overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-300",
                          d === currentDomain
                            ? "bg-primary-foreground/70"
                            : isComplete
                            ? "bg-accent"
                            : "bg-primary/60"
                        )}
                        style={{ width: `${domainPct}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Questions */}
        <div className="col-span-9 space-y-4">
          {(domains[currentDomain] || []).map((q, i) => (
            <QuestionCard
              key={q.id}
              question={q}
              index={i + 1}
              language={language}
              response={responseMap[q.id]}
              onSave={(data) => saveMutation.mutate({
                questionId: q.id,
                data: { ...data, framework_code: currentFw, domain: currentDomain, control_id: q.control_id },
              })}
              isSaving={saveMutation.isPending}
              currentFramework={currentFw}
              allQuestions={questions}
              responseMap={responseMap}
            />
          ))}
          {(!domains[currentDomain] || domains[currentDomain].length === 0) && (
            <div className="text-center py-12 text-muted-foreground">
              {t('assessment_detail_no_questions')}
            </div>
          )}
        </div>
      </div>

      {/* Partial completion — only reachable when the server reports pending questions */}
      <AlertDialog open={showPartialDialog} onOpenChange={setShowPartialDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('assessment_partial_title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('assessment_partial_desc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common_cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowPartialDialog(false);
                completeMutation.mutate(true);
              }}
            >
              {t('assessment_partial_confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}