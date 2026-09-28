import React from 'react';
import { cn } from '@/lib/utils';

const LOGO_LIGHT = 'https://media.base44.com/images/public/6ab5373e7f8f586c80cb9ed8/ef04d314c_a1-logo-light.svg';
const LOGO_DARK = 'https://media.base44.com/images/public/6ab5373e7f8f586c80cb9ed8/7904d3a81_a1-logo-dark.svg';

export default function Logo({ size = 28, className, rounded = 'rounded-lg', variant = 'full' }) {
  // 'full' — lockup completo (ícone + wordmark + tagline), object-contain.
  // 'icon' — recorte do topo da imagem (ícone A1), para sidebar colapsada.
  const isIcon = variant === 'icon';
  const imgStyle = isIcon
    ? { width: size, height: size, objectPosition: 'top', objectFit: 'cover', borderRadius: '0.5rem' }
    : { width: size, height: 'auto' };

  return (
    <>
      <img
        src={LOGO_LIGHT}
        alt="AnkoraOne — GRC AI Platform"
        className={cn('flex-shrink-0 object-contain block dark:hidden', className)}
        style={imgStyle}
      />
      <img
        src={LOGO_DARK}
        alt="AnkoraOne — GRC AI Platform"
        className={cn('flex-shrink-0 object-contain hidden dark:block', className)}
        style={imgStyle}
      />
    </>
  );
}
