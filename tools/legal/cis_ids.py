"""Gera a lista de identificadores dos CIS Controls v8.1.2 (controlos, salvaguardas e grupos de implementação).

Licença: os CIS Controls estão sob CC BY-NC-ND 4.0; o uso comercial exige autorização prévia do CIS.
Por isso este ficheiro guarda APENAS identificadores e a pertença aos grupos de implementação (factos),
nunca títulos nem descrições. O texto completo é importado por cada cliente a partir do seu ficheiro
oficial (Definições → Biblioteca legal → Importar CIS), ficando no seu próprio espaço.

Uso: python3 tools/legal/cis_ids.py <CIS_Controls_Version_8.1.2.xlsx> src/data/legal/cis-ids.json
"""
import json, sys
import openpyxl

src, out = sys.argv[1], sys.argv[2]
ws = openpyxl.load_workbook(src, read_only=True, data_only=True)['Controls v8.1.2']
controls, current, seq = [], None, 0
for row in ws.iter_rows(min_row=2, values_only=True):
    ctrl, sg = row[0], row[1]
    if ctrl is None:
        continue
    n = int(str(ctrl).replace('\xa0', '').strip())
    if sg is None:
        current = {'id': f'CIS-{n}', 'number': n, 'safeguards': []}
        controls.append(current)
        seq = 0
        continue
    # A folha guarda "4.10" como o número 4.1 — a numeração é sequencial dentro de cada controlo.
    seq += 1
    ig = [g for g, v in zip(('IG1', 'IG2', 'IG3'), row[6:9]) if v]
    current['safeguards'].append({'id': f'CIS-{n}.{seq}', 'number': f'{n}.{seq}', 'ig': ig})

json.dump({
    'framework': 'CIS Critical Security Controls v8.1.2 (março de 2025)',
    'license': 'CC BY-NC-ND 4.0 — uso comercial sujeito a autorização prévia do Center for Internet Security, Inc.',
    'url': 'https://www.cisecurity.org/controls/v8-1',
    'note': 'Apenas identificadores e grupos de implementação. Texto oficial importado por cada cliente.',
    'controls': controls,
}, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(controls), 'controlos,', sum(len(c['safeguards']) for c in controls), 'salvaguardas')
