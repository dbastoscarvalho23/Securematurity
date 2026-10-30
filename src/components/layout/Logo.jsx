import React from 'react';
import { cn } from '@/lib/utils';
import officialLogo from '@/assets/logo-official.png';

export default function Logo({ size = 28, className, rounded = 'rounded-lg' }) {
  return (
    <img
      src={officialLogo}
      alt="AnkoraOne"
      height={size}
      className={cn('flex-shrink-0 object-contain bg-white p-0.5 h-auto', rounded, className)}
      style={{ height: size, width: 'auto' }}
    />
  );
}
