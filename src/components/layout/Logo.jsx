import React from 'react';
import { cn } from '@/lib/utils';

const LOGO_URL = 'https://media.base44.com/images/public/6a7dd3d9b6d28b77a65c0b59/685127c35_ankoraone-logo.svg';

export default function Logo({ size = 28, className, rounded = 'rounded-lg', variant = 'full' }) {
  // 'full' — lockup completo (ícone + wordmark + tagline), object-contain.
  // 'icon' — recorte do topo da imagem (ícone A1), para sidebar colapsada.
  const isIcon = variant === 'icon';
  return (
    <img
      src={LOGO_URL}
      alt="AnkoraOne — GRC AI Platform"
      className={cn('flex-shrink-0 object-contain', className)}
      style={isIcon
        ? { width: size, height: size, objectPosition: 'top', objectFit: 'cover', borderRadius: '0.5rem' }
        : { width: size, height: 'auto' }
      }
    />
  );
}
