import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const FRAMEWORKS = [
  { code: 'NIS2', name: 'NIS2 / DL 125/2025', domains: ['Governance', 'Risk Management', 'Incident Response', 'Business Continuity', 'Supply Chain', 'Access Control', 'Cryptography', 'Physical Security', 'Vulnerability Management'] },
  { code: 'ISO27001', name: 'ISO/IEC 27001', domains: ['Information Security Policies', 'Organization of Information Security', 'Human Resource Security', 'Asset Management', 'Access Control', 'Cryptography', 'Physical Security', 'Operations Security', 'Communications Security', 'System Acquisition', 'Supplier Relationships', 'Incident Management', 'Business Continuity', 'Compliance'] },
  { code: 'NIST_CSF', name: 'NIST CSF', domains: ['Identify', 'Protect', 'Detect', 'Respond', 'Recover'] },
  { code: 'CIS_V8', name: 'CIS Controls v8', domains: ['Inventory & Control', 'Data Protection', 'Secure Configuration', 'Account Management', 'Access Control', 'Vulnerability Management', 'Audit Log Management', 'Email & Web Browser', 'Malware Defenses', 'Network Infrastructure', 'Data Recovery', 'Network Monitoring', 'Security Awareness', 'Service Provider Management', 'Application Security', 'Incident Response', 'Penetration Testing'] },
];

const EMPTY_FORM = {
  framework_code: '',
  domain: '',
  control_id: '',
  question_text: '',
  question_text_pt: '',
  guidance: '',
  guidance_pt: '',
  weight: 1,
  order_index: 0,
  is_active: true,
};

export default function QuestionFormDialog({ open, onOpenChange, question }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    if (question) {
      setForm({ ...EMPTY_FORM, ...question });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [question, open]);

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const selectedFw = FRAMEWORKS.find(f => f.code === form.framework_code);
  const domainOptions = selectedFw?.domains || [];

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (question?.id) {
        return base44.entities.Question.update(question.id, data);
      } else {
        return base44.entities.Question.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions'] });
      onOpenChange(false);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    saveMutation.mutate(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{question ? 'Edit Question' : 'New Question'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Framework *</Label>
              <Select value={form.framework_code} onValueChange={v => { set('framework_code', v); set('domain', ''); }}>
                <SelectTrigger><SelectValue placeholder="Select framework" /></SelectTrigger>
                <SelectContent>
                  {FRAMEWORKS.map(fw => <SelectItem key={fw.code} value={fw.code}>{fw.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Domain *</Label>
              {domainOptions.length > 0 ? (
                <Select value={form.domain} onValueChange={v => set('domain', v)}>
                  <SelectTrigger><SelectValue placeholder="Select domain" /></SelectTrigger>
                  <SelectContent>
                    {domainOptions.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={form.domain} onChange={e => set('domain', e.target.value)} placeholder="Domain name" required />
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Control ID</Label>
              <Input value={form.control_id} onChange={e => set('control_id', e.target.value)} placeholder="e.g. A.5.1" />
            </div>
            <div className="space-y-1.5">
              <Label>Weight (1–5)</Label>
              <Input type="number" min={1} max={5} value={form.weight} onChange={e => set('weight', Number(e.target.value))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Question Text (EN) *</Label>
              <Textarea
                value={form.question_text}
                onChange={e => set('question_text', e.target.value)}
                placeholder="Enter the question in English..."
                rows={3}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Question Text (PT)</Label>
              <Textarea
                value={form.question_text_pt}
                onChange={e => set('question_text_pt', e.target.value)}
                placeholder="Insira a questão em Português..."
                rows={3}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Guidance (EN)</Label>
              <Textarea
                value={form.guidance}
                onChange={e => set('guidance', e.target.value)}
                placeholder="Optional guidance in English..."
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Guidance (PT)</Label>
              <Textarea
                value={form.guidance_pt}
                onChange={e => set('guidance_pt', e.target.value)}
                placeholder="Orientação opcional em Português..."
                rows={2}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Order Index</Label>
            <Input type="number" value={form.order_index} onChange={e => set('order_index', Number(e.target.value))} placeholder="0" />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : question ? 'Update Question' : 'Create Question'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}