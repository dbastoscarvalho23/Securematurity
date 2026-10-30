import { describe, it, expect } from 'vitest';
import { sanitizeHtml } from '../../../base44/shared/sanitizeHtml.ts';

describe('sanitizeHtml (emails de utilizadores de cliente)', () => {
  it('remove scripts, atributos de evento e estilos', () => {
    expect(sanitizeHtml('<p onclick="x()">Olá <b>mundo</b></p><script>alert(1)</script>')).toBe('<p>Olá <b>mundo</b></p>');
    expect(sanitizeHtml('<style>b{}</style><div style="x">t</div>')).toBe('<div>t</div>');
  });
  it('só mantém ligações https e mailto', () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">x</a>')).toBe('<a>x</a>');
    expect(sanitizeHtml('<a href="http://ex.pt">x</a>')).toBe('<a>x</a>');
    expect(sanitizeHtml('<a href="https://ex.pt/a">y</a>')).toBe('<a href="https://ex.pt/a" rel="noopener noreferrer">y</a>');
    expect(sanitizeHtml('<a href=mailto:a@b.pt>m</a>')).toContain('href="mailto:a@b.pt"');
  });
  it('retira imagens, formulários e iframes', () => {
    expect(sanitizeHtml('<img src=https://t.pt/p.gif><form action=x><input name=p></form><iframe src=x></iframe>ok')).toBe('ok');
  });
  it('escapa «<» solto', () => {
    expect(sanitizeHtml('3 < 4')).toBe('3 &lt; 4');
  });
});
