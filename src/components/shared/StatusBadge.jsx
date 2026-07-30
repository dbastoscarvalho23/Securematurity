import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const DEFAULT_STATUS_MAP = {
  active: 'bg-accent/10 text-accent border-accent/20',
  inactive: 'bg-muted text-muted-foreground border-border',
  draft: 'bg-muted text-muted-foreground border-border',
  in_progress: 'bg-chart-3/10 text-chart-3 border-chart-3/20',
  completed: 'bg-accent/10 text-accent border-accent/20',
  archived: 'bg-muted text-muted-foreground border-border',
  open: 'bg-muted text-muted-foreground border-border',
  remediated: 'bg-accent/10 text-accent border-accent/20',
  verified: 'bg-accent/10 text-accent border-accent/20',
  accepted_risk: 'bg-chart-4/10 text-chart-4 border-chart-4/20',
  false_positive: 'bg-muted text-muted-foreground border-border',
  received: 'bg-primary/10 text-primary border-primary/20',
  identity_verification: 'bg-chart-3/10 text-chart-3 border-chart-3/20',
  rejected: 'bg-destructive/10 text-destructive border-destructive/20',
  withdrawn: 'bg-muted text-muted-foreground border-border',
  detected: 'bg-chart-4/10 text-chart-4 border-chart-4/20',
  investigating: 'bg-chart-3/10 text-chart-3 border-chart-3/20',
  contained: 'bg-primary/10 text-primary border-primary/20',
  resolved: 'bg-accent/10 text-accent border-accent/20',
  closed: 'bg-muted text-muted-foreground border-border',
  pending: 'bg-muted text-muted-foreground border-border',
  done: 'bg-accent/10 text-accent border-accent/20',
  todo: 'bg-muted text-muted-foreground border-border',
  blocked: 'bg-destructive/10 text-destructive border-destructive/20',
  in_treatment: 'bg-chart-3/10 text-chart-3 border-chart-3/20',
  accepted: 'bg-chart-4/10 text-chart-4 border-chart-4/20',
  sent: 'bg-primary/10 text-primary border-primary/20',
};

const SEVERITY_MAP = {
  critical: 'bg-destructive/10 text-destructive border-destructive/20',
  high: 'bg-chart-4/10 text-chart-4 border-chart-4/20',
  medium: 'bg-chart-3/10 text-chart-3 border-chart-3/20',
  low: 'bg-accent/10 text-accent border-accent/20',
};

/**
 * Centralized status badge so every module uses the same color tokens per status.
 * Props:
 *  - status: string (the status value)
 *  - label: string (localized label; falls back to status)
 *  - variant: 'status' (default) | 'severity'
 *  - map: object override { statusValue: className }
 *  - className: string
 */
export default function StatusBadge({ status, label, variant = 'status', map, className }) {
  const baseMap = variant === 'severity' ? SEVERITY_MAP : DEFAULT_STATUS_MAP;
  const resolved = { ...baseMap, ...(map || {}) };
  const cls = resolved[status] || 'bg-muted text-muted-foreground border-border';
  return (
    <Badge variant="outline" className={cn('text-xs border', cls, className)}>
      {label || status}
    </Badge>
  );
}