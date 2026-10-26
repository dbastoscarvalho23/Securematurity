import { describe, expect, it } from 'vitest';
import { COLUMNS, parseAssetRows, parseToolRows, checkAsset, article32Rows, inventoryRows } from '@/lib/assets';
import { TOOL_CATALOG } from '@/lib/legal/toolCatalog';

const header = COLUMNS.map(([h, , req]) => (req ? `${h} *` : h));
const row = (over = {}) => {
  const base = {
    asset_code: 'ATV-001', name: 'Portal', asset_type: 'Software ou aplicação', service: 'Atendimento', owner: 'DSI',
    internet_exposed: 'Sim', ip_address: '203.0.113.10', fqdn: 'portal.exemplo.pt', confidentiality: '3 - Alto', integrity: '4',
    authenticity: '3', availability: '4', criticality: 'Crítica', lifecycle: 'Em produção', last_review: '20/10/2026',
  };
  const d = { ...base, ...over };
  return COLUMNS.map(([, f]) => d[f] ?? '');
};

describe('parseAssetRows', () => {
  it('lê uma linha válida e converte enumerações, escalas e datas', () => {
    const { items, missingHeaders } = parseAssetRows([header, row()]);
    expect(missingHeaders).toEqual([]);
    expect(items[0].errors).toEqual([]);
    expect(items[0].data).toMatchObject({ asset_type: 'software', criticality: 'critical', lifecycle: 'production', internet_exposed: true, confidentiality: 3, last_review: '2026-10-20' });
  });
  it('ignora a linha da base legal e a linha de exemplo do modelo', () => {
    const legal = header.map(() => 'Reg. 756/2026, art. 32.º');
    const example = row({ notes: 'Linha de exemplo: substituir ou apagar' });
    expect(parseAssetRows([header, legal, example]).items).toHaveLength(0);
  });
  it('assinala erros de validação e IDs repetidos', () => {
    const { items } = parseAssetRows([header, row({ ip_address: '999.1.1.1', last_review: '2026-13-01' }), row()]);
    expect(items[0].errors).toEqual(expect.arrayContaining(['Endereço IP inválido', 'Data da última revisão: data inválida (use AAAA-MM-DD)']));
    expect(items[1].errors.some((e) => e.startsWith('ID repetido'))).toBe(true);
  });
  it('marca para atualização os IDs já existentes', () => {
    expect(parseAssetRows([header, row()], new Set(['ATV-001'])).items[0].update).toBe(true);
  });
});

describe('checkAsset e exportações', () => {
  it('exige IP ou FQDN só como aviso e recusa IDs duplicados', () => {
    const d = parseAssetRows([header, row({ ip_address: '', fqdn: '' })]).items[0].data;
    const r = checkAsset(d, new Set(['ATV-001']));
    expect(r.errors).toContain('Já existe um ativo com este ID');
    expect(r.warnings).toHaveLength(1);
  });
  it('a lista do art. 32.º inclui só ativos expostos e não abatidos', () => {
    const a = [{ asset_code: 'A', name: 'x', internet_exposed: true, lifecycle: 'production' }, { asset_code: 'B', internet_exposed: false }, { asset_code: 'C', internet_exposed: true, lifecycle: 'retired' }];
    expect(article32Rows(a)).toHaveLength(2);
  });
  it('o inventário exportado volta a ser importável', () => {
    const d = parseAssetRows([header, row()]).items[0].data;
    const again = parseAssetRows(inventoryRows([d]));
    expect(again.items[0].errors).toEqual([]);
    expect(again.items[0].data).toMatchObject({ asset_code: 'ATV-001', criticality: 'critical' });
  });
});

describe('parseToolRows', () => {
  it('associa a categoria do catálogo às alíneas da NIS2', () => {
    const rows = [['Categoria *', 'Produto / ferramenta *', 'Ativos abrangidos (IDs) *'], ['Autenticação multifator (MFA)', 'Produto MFA', 'ATV-001; ATV-404']];
    const { items } = parseToolRows(rows, TOOL_CATALOG, new Set(['ATV-001']));
    expect(items[0].data).toMatchObject({ category: 'mfa', nis2_letters: ['j'], asset_codes: ['ATV-001', 'ATV-404'] });
    expect(items[0].warnings[0]).toContain('ATV-404');
  });
});
