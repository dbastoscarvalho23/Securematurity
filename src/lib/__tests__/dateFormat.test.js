import { describe, it, expect, afterEach } from 'vitest';
import { format } from '@/lib/dateFormat';

const d = new Date(2026, 9, 28);
afterEach(() => localStorage.removeItem('app_language'));

describe('format com a língua da interface', () => {
  it('em português põe o dia antes do mês', () => {
    localStorage.setItem('app_language', 'pt');
    expect(format(d, 'MMM d')).toBe('28 out');
    expect(format(d, 'MMM d, yyyy')).toBe('28 out 2026');
    expect(format(d, 'dd MMM yyyy')).toBe('28 out 2026');
  });
  it('em inglês mantém o formato original', () => {
    localStorage.setItem('app_language', 'en');
    expect(format(d, 'MMM d, yyyy')).toBe('Oct 28, 2026');
  });
});
