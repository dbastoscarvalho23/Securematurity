import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Check, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import QuestionCard from '@/components/assessments/QuestionCard';
import AssessmentResults from '@/components/assessments/AssessmentResults';
import { cn } from '@/lib/utils';

export default function AssessmentDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const assessmentId = window.location.pathname.split('/').pop();
  const queryClient = useQueryClient();
  const [activeFramework, setActiveFramework] = useState(null);
  const [activeDomain, setActiveDomain] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [language, setLanguage] = useState('en');

  const { data: assessment } = useQuery({
    queryKey: ['assessment', assessmentId],
    queryFn: () => base44.entities.Assessment.list().then(list => list.find(a => a.id === assessmentId)),
    enabled: !!assessmentId,
  });

  const { data: questions = [] } = useQuery({
    queryKey: ['questions'],
    queryFn: () => base44.entities.Question.list('-order_index', 500),
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
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['responses', assessmentId] });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      setIsAnalyzing(true);
      // Calculate scores
      const frameworkScores = [];
      const fw_codes = assessment?.frameworks || [];
      let totalScore = 0;
      let totalCount = 0;

      for (const fc of fw_codes) {
        const fwResponses = responses.filter(r => r.framework_code === fc);
        const domains = [...new Set(fwResponses.map(r => r.domain).filter(Boolean))];
        const domainScores = domains.map(d => {
          const dResponses = fwResponses.filter(r => r.domain === d);
          const avg = dResponses.reduce((s, r) => s + (r.maturity_level || 0), 0) / (dResponses.length || 1);
          return { domain: d, score: Math.round(avg * 10) / 10 };
        });
        const fwAvg = fwResponses.length > 0
          ? fwResponses.reduce((s, r) => s + (r.maturity_level || 0), 0) / fwResponses.length
          : 0;
        frameworkScores.push({ framework_code: fc, score: Math.round(fwAvg * 10) / 10, domain_scores: domainScores });
        totalScore += fwAvg;
        totalCount++;
      }

      const overallScore = totalCount > 0 ? Math.round((totalScore / totalCount) * 10) / 10 : 0;

      await base44.entities.Assessment.update(assessmentId, {
        status: 'completed',
        overall_score: overallScore,
        framework_scores: frameworkScores,
        completed_date: new Date().toISOString().split('T')[0],
      });

      // Generate AI recommendations
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
Return 5-8 prioritized recommendations.`,
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
      }

      setIsAnalyzing(false);
      queryClient.invalidateQueries({ queryKey: ['assessment', assessmentId] });
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
    },
  });

  // Group questions by framework and domain
  const frameworkQuestions = useMemo(() => {
    if (!assessment?.frameworks) return {};
    const map = {};
    assessment.frameworks.forEach(fc => {
      const fqs = questions.filter(q => q.framework_code === fc);
      const domains = {};
      fqs.forEach(q => {
        const d = q.domain || 'General';
        if (!domains[d]) domains[d] = [];
        domains[d].push(q);
      });
      map[fc] = domains;
    });
    return map;
  }, [questions, assessment]);

  const responseMap = useMemo(() => {
    const map = {};
    responses.forEach(r => { map[r.question_id] = r; });
    return map;
  }, [responses]);

  if (!assessment) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;
  }

  const currentFw = activeFramework || assessment.frameworks?.[0];
  const domains = frameworkQuestions[currentFw] || {};
  const domainKeys = Object.keys(domains);
  const currentDomain = activeDomain && domains[activeDomain] ? activeDomain : domainKeys[0];

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
          <div className="flex rounded-md border border-border overflow-hidden text-sm">
            <button
              onClick={() => setLanguage('en')}
              className={cn("px-3 py-1.5 font-medium transition-colors", language === 'en' ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
            >EN</button>
            <button
              onClick={() => setLanguage('pt')}
              className={cn("px-3 py-1.5 font-medium transition-colors", language === 'pt' ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
            >PT</button>
          </div>
          <div className="text-right mr-2">
            <p className="text-xs text-muted-foreground">Progress</p>
            <p className="text-sm font-semibold">{answeredQuestions}/{totalQuestions}</p>
          </div>
          <div className="w-32">
            <Progress value={progressPct} className="h-2" />
          </div>
          <Button
            onClick={() => completeMutation.mutate()}
            disabled={completeMutation.isPending || isAnalyzing || answeredQuestions === 0}
            className="gap-2"
          >
            {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {isAnalyzing ? 'Analyzing...' : 'Complete & Analyze'}
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
        <div className="col-span-3 space-y-1">
          {domainKeys.map(d => {
            const domainQs = domains[d] || [];
            const answered = domainQs.filter(q => responseMap[q.id]).length;
            return (
              <button
                key={d}
                onClick={() => setActiveDomain(d)}
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center justify-between",
                  d === currentDomain
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <span className="truncate">{d}</span>
                <span className="text-xs flex-shrink-0 ml-2">
                  {answered}/{domainQs.length}
                </span>
              </button>
            );
          })}
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
            />
          ))}
          {(!domains[currentDomain] || domains[currentDomain].length === 0) && (
            <div className="text-center py-12 text-muted-foreground">
              No questions available for this domain. Add questions in Settings.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}