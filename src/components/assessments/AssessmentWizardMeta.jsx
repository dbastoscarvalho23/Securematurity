import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

export default function AssessmentWizardMeta({ customers, allFrameworks, initialMeta, onBack, onNext }) {
  const [form, setForm] = useState(initialMeta);

  const selectedCustomer = customers.find(c => c.id === form.customer_id);
  const activeFrameworks = allFrameworks.filter(fw => fw.status === 'active');
  const availableFrameworks = selectedCustomer?.allowed_frameworks?.length
    ? activeFrameworks.filter(fw => selectedCustomer.allowed_frameworks.includes(fw.code))
    : activeFrameworks;

  const handleCustomerChange = (customerId) => {
    const customer = customers.find(c => c.id === customerId);
    const frameworks = customer?.allowed_frameworks?.length
      ? customer.allowed_frameworks
      : allFrameworks.map(f => f.code);
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

  const canProceed = form.customer_id && form.title && form.period && form.frameworks.length > 0;

  return (
    <div className="space-y-4 py-2">
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
        />
      </div>

      <div className="space-y-1.5">
        <Label>Period *</Label>
        <Input
          value={form.period}
          onChange={e => setForm(prev => ({ ...prev, period: e.target.value }))}
          placeholder="e.g. 2025-Q1"
        />
      </div>

      <div className="space-y-2">
        <Label>Frameworks *</Label>
        {!form.customer_id && (
          <p className="text-xs text-muted-foreground">Select a customer first to see their allowed frameworks.</p>
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

      <div className="flex justify-between pt-4 border-t">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <Button onClick={() => onNext(form)} disabled={!canProceed}>
          Next: Build Questionnaire →
        </Button>
      </div>
    </div>
  );
}