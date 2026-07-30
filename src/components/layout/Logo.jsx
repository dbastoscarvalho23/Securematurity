import React from 'react';
import { cn } from '@/lib/utils';

const LOGO_URL = 'https://media.base44.com/images/public/69ca8d95ddfd46a45ba76ea6/d1d427ae1_generated_image.png';

export default function Logo({ size = 28, className, rounded = 'rounded-lg' }) {
  return (
    <img
      src={LOGO_URL}
      alt="AnkoraOne"
      width={size}
      height={size}
      className={cn('flex-shrink-0 object-contain bg-white p-0.5', rounded, className)}
      style={{ width: size, height: size }}
    />
  );
}