import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles, ListChecks } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import AssessmentWizardMeta from './AssessmentWizardMeta';
import AssessmentWizardAI from './AssessmentWizardAI';
import AssessmentWizardManual from './AssessmentWizardManual';

const STEPS = ['mode', 'meta', 'build'];

const DEFAULT_META = {
  customer_id: '',
  title: '',
  period: '',
  frameworks: [],
};

export default function NewAssessmentDialog({ open, onOpenChange }) {
  const [step, setStep] = useState('mode');
  const [mode, setMode] = useState(null); // 'ai' | 'manual'
  const [meta, setMeta] = useState(DEFAULT_META);
  const [isSaving, setIsSaving] = useState(false);
  const queryClient = useQueryClient();

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
    enabled: open,
  });

  const { data: allFrameworks = [] } = useQuery({
    queryKey: ['frameworks'],
    queryFn: () => base44.entities.Framework.filter({ status: 'active' }),
    enabled: open,
  });

  const selectedCustomer = customers.find(c => c.id === meta.customer_id);

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setStep('mode');
      setMode(null);
      setMeta(DEFAULT_META);
    }, 300);
  };

  const handleSelectMode = (selectedMode) => {
    setMode(selectedMode);
    setStep('meta');
  };

  const handleMetaNext = (formData) => {
    setMeta(formData);
    setStep('build');
  };

  const handleFinish = async (questions) => {
    setIsSaving(true);
    const customer = customers.find(c => c.id === meta.customer_id);

    // Separate new (AI/custom written) questions from existing DB questions
    const newQuestions = questions.filter(q => q._isNew);
    const existingQuestions = questions.filter(q => !q._isNew);
    const question_ids = existingQuestions.map(q => q.id).filter(Boolean);

    // Create the assessment — store IDs of existing questions selected
    const assessment = await base44.entities.Assessment.create({
      customer_id: meta.customer_id,
      customer_name: customer?.name || '',
      title: meta.title,
      period: meta.period,
      frameworks: meta.frameworks,
      question_ids: question_ids.length > 0 ? question_ids : undefined,
      status: 'draft',
    });

    // Save new (AI-generated or custom written) questions linked to this assessment
    if (newQuestions.length > 0) {
      await base44.entities.Question.bulkCreate(
        newQuestions.map(({ _isNew, _tempId, ...q }) => ({
          ...q,
          assessment_id: assessment.id,
          is_active: true,
        }))
      );
    }

    queryClient.invalidateQueries({ queryKey: ['assessments'] });
    toast.success('Assessment created successfully');
    setIsSaving(false);
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={cn("max-w-2xl", step === 'build' && "max-w-3xl")}>
        <DialogHeader>
          <DialogTitle>
            {step === 'mode' && 'New Assessment'}
            {step === 'meta' && 'Assessment Details'}
            {step === 'build' && (mode === 'ai' ? 'AI-Generated Questionnaire' : 'Build Questionnaire')}
          </DialogTitle>
        </DialogHeader>

        {/* Step: Mode selection */}
        {step === 'mode' && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">How would you like to build the questionnaire for this assessment?</p>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleSelectMode('ai')}
                className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-left"
              >
                <Sparkles className="w-8 h-8 text-primary" />
                <div>
                  <p className="font-semibold text-sm">AI-Generated</p>
                  <p className="text-xs text-muted-foreground mt-1">Let AI create a tailored questionnaire based on the customer's sector and selected frameworks.</p>
                </div>
              </button>
              <button
                onClick={() => handleSelectMode('manual')}
                className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-left"
              >
                <ListChecks className="w-8 h-8 text-primary" />
                <div>
                  <p className="font-semibold text-sm">Manual</p>
                  <p className="text-xs text-muted-foreground mt-1">Pick questions from the question bank or write your own custom questions for this assessment.</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Step: Meta */}
        {step === 'meta' && (
          <AssessmentWizardMeta
            customers={customers}
            allFrameworks={allFrameworks}
            initialMeta={meta}
            onBack={() => setStep('mode')}
            onNext={handleMetaNext}
          />
        )}

        {/* Step: Build */}
        {step === 'build' && mode === 'ai' && (
          <AssessmentWizardAI
            meta={meta}
            selectedCustomer={selectedCustomer}
            onBack={() => setStep('meta')}
            onFinish={handleFinish}
            isSaving={isSaving}
          />
        )}

        {step === 'build' && mode === 'manual' && (
          <AssessmentWizardManual
            meta={meta}
            selectedCustomer={selectedCustomer}
            onBack={() => setStep('meta')}
            onFinish={handleFinish}
            isSaving={isSaving}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}