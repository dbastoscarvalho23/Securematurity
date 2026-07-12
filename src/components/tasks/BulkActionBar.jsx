import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, CheckCircle2 } from 'lucide-react';

export default function BulkActionBar({ selectedCount, onBulkUpdate, onClear }) {
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');

  const handleApply = () => {
    const updates = {};
    if (status) updates.status = status;
    if (priority) updates.priority = priority;
    if (Object.keys(updates).length === 0) return;
    onBulkUpdate(updates);
    setStatus('');
    setPriority('');
  };

  return (
    <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg border border-primary/20 bg-primary/5">
      <div className="flex items-center gap-2 text-sm font-medium">
        <CheckCircle2 className="w-4 h-4 text-primary" />
        <span>{selectedCount} selected</span>
      </div>
      <div className="h-4 w-px bg-border" />
      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger className="w-36 h-8">
          <SelectValue placeholder="Set status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todo">To-Do</SelectItem>
          <SelectItem value="in_progress">In Progress</SelectItem>
          <SelectItem value="blocked">Blocked</SelectItem>
          <SelectItem value="done">Done</SelectItem>
        </SelectContent>
      </Select>
      <Select value={priority} onValueChange={setPriority}>
        <SelectTrigger className="w-36 h-8">
          <SelectValue placeholder="Set priority" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="critical">Critical</SelectItem>
          <SelectItem value="high">High</SelectItem>
          <SelectItem value="medium">Medium</SelectItem>
          <SelectItem value="low">Low</SelectItem>
        </SelectContent>
      </Select>
      <Button size="sm" className="h-8" onClick={handleApply} disabled={!status && !priority}>
        Apply
      </Button>
      <Button size="sm" variant="ghost" className="h-8 ml-auto" onClick={onClear}>
        <X className="w-4 h-4 mr-1" />Clear
      </Button>
    </div>
  );
}