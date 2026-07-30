import React from 'react';
import { cn } from '@/lib/utils';

const LOGO_URL = 'https://media.base44.com/images/public/69ca8d95ddfd46a45ba76ea6/ab0505102_generated_image.png';

export default function Logo({ size = 28, className, rounded = 'rounded-lg' }) {
  return (
    <img
      src={LOGO_URL}
      alt="AnkoraOne"
      width={size}
      height={size}
      className={cn('flex-shrink-0 object-contain', rounded, className)}
      style={{ width: size, height: size }}
    />
  );
}