import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

const FRAMEWORKS = [
  { code: 'NIS2', name: 'NIS2 / DL 125/2025' },
  { code: 'ISO27001', name: 'ISO/IEC 27001' },
  { code: 'NIST_CSF', name: 'NIST Cybersecurity Framework' },
  { code: 'CIS_V8', name: 'CIS Controls v8' },
  { code: 'GDPR', name: 'GDPR' },
];

export default function NewAssessmentDialog({ open, onOpenChange }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    customer_id: '',
    title: '',
    period: '',
    frameworks: [],
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const selectedCustomer = customers.find(c => c.id === form.customer_id);
  const availableFrameworks = selectedCustomer?.allowed_frameworks?.length
    ? FRAMEWORKS.filter(fw => selectedCustomer.allowed_frameworks.includes(fw.code))
    : FRAMEWORKS;

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const customer = customers.find(c => c.id === data.customer_id);
      return base44.entities.Assessment.create({
        ...data,
        customer_name: customer?.name || '',
        status: 'draft',
      });
    },
    onSuccess: (newAssessment) => {
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      onOpenChange(false);
      navigate(`/assessments/${newAssessment.id}`);
    },
  });

  // When customer changes, pre-select their allowed frameworks
  const handleCustomerChange = (customerId) => {
    const customer = customers.find(c => c.id === customerId);
    const frameworks = customer?.allowed_frameworks?.length
      ? customer.allowed_frameworks
      : FRAMEWORKS.map(f => f.code);
    setForm(prev => ({ ...prev, customer_id: customerId, frameworks }));
  };

  const toggleFramework = (code) => {
    setForm(prev => ({
      ...prev,
      frameworks: prev.frameworks.includes(code)
        ? prev.frameworks.filter(f => f !== code)
        : [...prev.frameworks, code],
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Assessment</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Customer *</Label>
            <Select value={form.customer_id} onValueChange={handleCustomerChange}>
              <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
              <SelectContent>
                {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Title *</Label>
            <Input
              value={form.title}
              onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
              placeholder="e.g. Q1 2025 Assessment"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label>Period *</Label>
            <Input
              value={form.period}
              onChange={e => setForm(prev => ({ ...prev, period: e.target.value }))}
              placeholder="e.g. 2025-Q1"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Frameworks</Label>
            {!form.customer_id && (
              <p className="text-xs text-muted-foreground">Select a customer to see their allowed frameworks.</p>
            )}
            <div className="space-y-2">
              {availableFrameworks.map(fw => (
                <div key={fw.code} className="flex items-center gap-2">
                  <Checkbox
                    checked={form.frameworks.includes(fw.code)}
                    onCheckedChange={() => toggleFramework(fw.code)}
                  />
                  <span className="text-sm">{fw.name}</span>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending || !form.customer_id}>
              {createMutation.isPending ? 'Creating...' : 'Create Assessment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}