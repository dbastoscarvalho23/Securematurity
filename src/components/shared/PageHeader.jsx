import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Consistent page header with optional description and right-aligned actions.
 * Props:
 *  - title: string
 *  - description: string (optional, muted)
 *  - actions: ReactNode (optional, right-aligned)
 *  - className: string (optional)
 */
export default function PageHeader({ title, description, actions, className }) {
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between', className)}>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  );
}