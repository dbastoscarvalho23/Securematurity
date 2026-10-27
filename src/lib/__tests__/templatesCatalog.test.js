import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { TEMPLATE_PACKS, templateUrl } from '@/lib/legal/templatesCatalog';

describe('Modelos por referencial', () => {
  it('cada ficheiro do catálogo existe em public/modelos e em docs/modelos', () => {
    for (const p of TEMPLATE_PACKS) {
      for (const f of p.files) {
        expect(fs.existsSync(path.join(process.cwd(), 'public', templateUrl(f)))).toBe(true);
        expect(fs.existsSync(path.join(process.cwd(), 'docs', 'modelos', p.id, f.name))).toBe(true);
      }
    }
  });
  it('tem um pacote Word e Excel por referencial', () => {
    expect(TEMPLATE_PACKS.map((p) => p.id)).toEqual(['rjc-qnrcs', 'nis2', 'dora', 'iso27001', 'iso42001', 'tisax']);
    for (const p of TEMPLATE_PACKS) expect(p.files.map((f) => f.kind).sort()).toEqual(['docx', 'xlsx']);
  });
});
