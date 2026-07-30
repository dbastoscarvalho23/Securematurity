import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Consistent loading state.
 * Props:
 *  - label: string (optional)
 *  - className: string
 *  - fullHeight: boolean (optional, center within available space)
 */
export default function LoadingState({ label, className, fullHeight = false }) {
  return (
    <div className={cn(
      'flex items-center justify-center gap-2 text-sm text-muted-foreground',
      fullHeight && 'h-full min-h-[200px]',
      className
    )}>
      <Loader2 className="w-4 h-4 animate-spin" />
      {label && <span>{label}</span>}
    </div>
  );
}