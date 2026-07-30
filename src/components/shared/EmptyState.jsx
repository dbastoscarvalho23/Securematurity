import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Consistent empty state for tables, grids and lists.
 * Props:
 *  - icon: LucideIcon component (optional)
 *  - title: string
 *  - description: string (optional)
 *  - action: ReactNode (optional)
 *  - className: string
 *  - compact: boolean (optional, smaller padding)
 */
export default function EmptyState({ icon: Icon, title, description, action, className, compact = false }) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center text-center',
      compact ? 'py-8' : 'py-16',
      className
    )}>
      {Icon && (
        <div className="mb-3 w-12 h-12 rounded-full bg-muted flex items-center justify-center">
          <Icon className="w-6 h-6 text-muted-foreground" />
        </div>
      )}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}