"""Monta os ficheiros da biblioteca legal (src/data/legal/) a partir dos dados extraídos dos documentos oficiais.

Entradas (diretório DATA):
  qnrcs.json      — tools/legal/parse_qnrcs.py   (Regulamento n.º 756/2026, Anexo I)
  measures.json   — tools/legal/parse_measures.py (Regulamento n.º 756/2026, Anexos III e IV)
  rjc.json, reg756.json, nis2.json, regexec2690.json, dora.json,
  isa6.json, isa2027.json, isa_changes.json, enx_nis2_isa6.json, tisax.json — extração assistida, revista

Uso: python3 tools/legal/build_data.py <DATA> src/data/legal
"""
import json, os, re, sys

DATA, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)

def load(name):
    p = os.path.join(DATA, name)
    return json.load(open(p, encoding='utf-8')) if os.path.exists(p) else None

def save(name, obj):
    with open(os.path.join(OUT, name), 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, separators=(',', ':'))
    print(f'{name}: {os.path.getsize(os.path.join(OUT, name)) // 1024} KB')

LEVELS = ['basico', 'substancial', 'elevado']

# ── QNRCS + medidas mínimas (Anexos I, III e IV) ─────────────────────────────
q = load('qnrcs.json')
m = load('measures.json')
by_ctl = {}
for r in m['rows']:
    if r['annex'] == 'III':
        by_ctl.setdefault(r['control_id'], {})[r['level']] = {
            'measure': r['measure'], 'verification': r['verification'], 'page': r['page']}

objectives = []
for o in q['objectives']:
    cats = []
    for c in o['categories']:
        ctls = []
        for k in c['controls']:
            meas = by_ctl.get(k['id'], {})
            first = next((lv for lv in LEVELS if lv in meas), None)
            ctls.append({
                'id': k['id'], 'statement': k['statement'], 'description': k.get('description', ''),
                'page': k['page'], 'references': k['references'],
                'measures': meas,
                # nível de conformidade a partir do qual o controlo passa a ser medida mínima obrigatória
                'min_level': first,
            })
        cats.append({'id': c['id'], 'number': c['number'], 'name': c['name'], 'description': c.get('description', ''), 'page': c['page'], 'controls': ctls})
    objectives.append({'code': o['code'], 'number': o['number'], 'name': o['name'], 'description': o.get('description', ''), 'page': o['page'], 'categories': cats})

save('qnrcs.json', {
    'source': {
        'title': 'Quadro Nacional de Referência para a Cibersegurança (QNRCS)',
        'ref': 'Regulamento n.º 756/2026, Anexo I (controlos) e Anexo III (medidas mínimas por nível de conformidade)',
        'url': 'https://files.diariodarepublica.pt/2s/2026/06/118000000/0003200120.pdf',
        'note': 'Texto oficial. Referências cruzadas tal como publicadas; gralhas evidentes corrigidas e listadas em reference_corrections.',
    },
    'levels': [
        {'id': 'basico', 'name': 'Básico'}, {'id': 'substancial', 'name': 'Substancial'}, {'id': 'elevado', 'name': 'Elevado'}],
    'cumulative_rule': {'ref': 'Regulamento n.º 756/2026, art. 30.º, n.º 2',
                        'text': 'As entidades essenciais e importantes sujeitas aos níveis de conformidade substancial e elevado asseguram, ainda, a aplicação das medidas de cibersegurança mínimas dos níveis de conformidade respetivamente inferiores.'},
    'objectives': objectives,
    'reference_corrections': q.get('reference_corrections', []),
})

epr = {'group_B': [], 'group_A': []}
for r in m['rows']:
    if r['annex'] == 'IV':
        epr['group_' + r['level'].split('_')[1]].append({
            'code': r['control_id'], 'code_as_printed': r.get('code_as_printed'), 'area': r['control_text'],
            'measure': r['measure'], 'verification': r['verification'], 'page': r['page']})
save('epr-measures.json', {
    'source': {'title': 'Medidas de Cibersegurança Mínimas para Entidades Públicas Relevantes',
               'ref': 'Regulamento n.º 756/2026, Anexo IV',
               'url': 'https://files.diariodarepublica.pt/2s/2026/06/118000000/0003200120.pdf'},
    'cumulative_rule': {'ref': 'Regulamento n.º 756/2026, art. 30.º, n.º 3',
                        'text': 'As entidades públicas relevantes sujeitas às medidas de cibersegurança previstas para o Grupo A, nos termos definidos no Anexo IV do presente Regulamento, asseguram, igualmente, a aplicação das medidas de cibersegurança mínimas definidas para o Grupo B do mesmo anexo.'},
    'note': 'No Grupo A, o código T.PPT surge duas vezes no texto oficial (proteção de postos de trabalho; perfil de trabalho nos dispositivos móveis).',
    **epr,
})

# ── Correspondências oficiais (grafo) ────────────────────────────────────────
# Arestas: QNRCS → referenciais citados no próprio Anexo I do Regulamento n.º 756/2026.
FW = {'iso27001': 'ISO27001_CL', 'iso27002': 'ISO27002', 'nist_csf2': 'NIST_CSF2', 'nist80053': 'NIST_80053',
      'cis81': 'CIS', 'cyfun2025': 'CYFUN'}
edges = []
for o in objectives:
    for c in o['categories']:
        for k in c['controls']:
            for fw, ids in k['references'].items():
                for i in ids:
                    tgt = i
                    if fw == 'cis81':
                        tgt = f'CIS-{i}'
                    edges.append({'a': ['QNRC', k['id']], 'b': [FW[fw], tgt], 's': 'reg756'})

def nis2_id(ref):
    """'NIS2 Article 21 (2) a)' -> 'NIS2-21.2.a'; 'NIS2 Article 20 (1)' -> 'NIS2-20.1'."""
    m = re.match(r'NIS2 Article (\d+)\s*\((\d+)\)\s*(?:([a-j])\))?$', (ref or '').strip())
    if not m:
        return None
    return 'NIS2-' + '.'.join(x for x in m.groups() if x)

enx = load('enx_nis2_isa6.json')
if enx:
    for row in enx.get('mapping', []):
        nid = nis2_id(row['nis2_ref'])
        if not nid:
            continue
        for c in row.get('isa6_controls', []) or []:
            edges.append({'a': ['NIS2', nid], 'b': ['ISA6', c], 's': 'enx_nis2_isa6'})

# Reg. Exec. 2024/2690: cada secção do Anexo indica a alínea do art. 21.º, n.º 2, da NIS2 que concretiza
rx0 = load('regexec2690.json')
if rx0:
    sec_letters = {s['id']: s.get('nis2_letters') or [] for s in rx0['annex_sections']}
    for r in rx0['annex_requirements']:
        for letter in sec_letters.get(r['id'].split('.')[0], []):
            edges.append({'a': ['EU_2024_2690', r['id']], 'b': ['NIS2', f'NIS2-21.2.{letter}'], 's': 'regexec2690'})

save('mappings.json', {
    'sources': {
        'reg756': 'Regulamento n.º 756/2026, Anexo I — campo «Referências» de cada controlo do QNRCS',
        'enx_nis2_isa6': 'ENX Association — Fulfilment of NIS2 through VDA ISA 6 (julho de 2025)',
        'regexec2690': 'Regulamento de Execução (UE) 2024/2690, Anexo — alínea do art. 21.º, n.º 2, da NIS2 indicada em cada secção',
    },
    'equivalences': [
        {'a': 'ISO27002', 'b': 'ISO27001', 'rule': 'Controlo n.m da ISO/IEC 27002:2022 = controlo A.n.m do Anexo A da ISO/IEC 27001:2022',
         'note': 'Equivalência estrutural das normas (o Anexo A da ISO/IEC 27001:2022 lista os controlos da ISO/IEC 27002:2022), usada para ligar às perguntas ISO 27001 da aplicação.'},
    ],
    'edges': edges,
})
print('arestas', len(edges))

# ── Conjuntos extraídos por agentes (revistos) ───────────────────────────────
def strip_issues(d):
    """Mantém as notas de revisão num campo próprio para auditoria."""
    if isinstance(d, dict) and 'issues' in d:
        d['review_notes'] = d.pop('issues')
    return d

rjc = strip_issues(load('rjc.json'))
reg756 = strip_issues(load('reg756.json'))
nis2 = strip_issues(load('nis2.json'))
rx = strip_issues(load('regexec2690.json'))
dora = strip_issues(load('dora.json'))
isa6 = strip_issues(load('isa6.json'))
isa27 = strip_issues(load('isa2027.json'))
isach = strip_issues(load('isa_changes.json'))
enx = strip_issues(load('enx_nis2_isa6.json'))
tisax = strip_issues(load('tisax.json'))

DL_URL = 'https://files.diariodarepublica.pt/1s/2025/12/23400/0000400068.pdf'
REG_URL = 'https://files.diariodarepublica.pt/2s/2026/06/118000000/0003200120.pdf'
for i in rjc['instruments']:
    i['official_url'] = i.get('official_url') or DL_URL
reg756['instrument']['official_url'] = reg756['instrument'].get('official_url') or REG_URL

save('rjc.json', rjc)
save('reg756.json', reg756)
save('nis2.json', nis2)
save('regexec2690.json', rx)
save('dora.json', dora)

# VDA ISA: CC BY-ND 4.0 + secção 9 — redistribuição literal com atribuição e licença.
for d in (isa6, isa27):
    d['instrument']['notice_pt'] = ('Reproduzido literalmente do catálogo oficial VDA ISA, © ENX Association (separador Data Protection © VDA), '
                                    'sob licença Creative Commons Atribuição-SemDerivações 4.0 com os direitos adicionais da secção 9. '
                                    'Organização em formato de dados pela AnkoraOne: versão modificada não aprovada pelo licenciante; sem logótipos nem marcas.')
save('isa6.json', isa6)
save('isa2027.json', isa27)
# Alterações: só identificadores e campos alterados (o texto completo está nos próprios catálogos)
save('isa-changes.json', {
    'compares': isach.get('compares'),
    'counts': isach.get('counts'),
    'summary': [{k: v for k, v in c.items() if k in ('id', 'change', 'catalogue', 'isa6_id', 'isa2027_id', 'changed_fields', 'editorial_only')} for c in isach['summary']],
    'review_notes': isach.get('review_notes', []),
})

# ENX (documento «All rights reserved»): só factos — referência NIS2 e identificadores ISA 6.
# O texto da NIS2 mostrado vem da própria Diretiva (EUR-Lex), não do documento da ENX.
letter_text = {m['letter']: m['text'] for m in nis2['art21_measures']}
def nis2_official_text(ref):
    m = re.search(r'21\s*\(2\)\s*([a-j])\)', ref or '')
    return letter_text.get(m.group(1)) if m else None
save('enx-nis2-isa6.json', {
    'instrument': {k: enx['instrument'].get(k) for k in ('id', 'title', 'date', 'issuer', 'language')},
    'notice_pt': 'Correspondências (identificadores) retiradas do documento da ENX Association; o texto do documento não é reproduzido (todos os direitos reservados). Texto da NIS2: Diretiva (UE) 2022/2555, EUR-Lex.',
    'mapping': [{'section': m.get('section'), 'nis2_ref': m['nis2_ref'], 'nis2_text': nis2_official_text(m['nis2_ref']),
                 'isa6_controls': m.get('isa6_controls') or []} for m in enx['mapping']],
})

# TISAX (Handbook «All rights reserved»): só factos estruturais e resumos próprios em português.
save('tisax.json', {
    'instrument': {k: tisax['instrument'].get(k) for k in ('id', 'title', 'version', 'date', 'issuer', 'language', 'official_url')},
    'assessment_levels': [{'code': a['code']} for a in tisax.get('assessment_levels', [])],
    'assessment_objectives': [{k: o.get(k) for k in ('id', 'name', 'assessment_level', 'isa_catalogues')} for o in tisax.get('assessment_objectives', [])],
    'label_validity_years': 3,
    'process_steps': [{'step': s.get('step'), 'name': s.get('name'), 'summary_pt': s.get('summary_pt')} for s in tisax.get('process_steps', [])],
    'sga_summary_pt': tisax.get('sga_summary_pt'),
})

# ── Catálogo ─────────────────────────────────────────────────────────────────
def inst(base, **extra):
    keep = ('id', 'short', 'title', 'type', 'number', 'date', 'publication', 'issuer', 'official_url', 'language')
    out = {k: base.get(k) for k in keep if base.get(k) is not None}
    out.update(extra)
    return out

dl125 = next(i for i in rjc['instruments'] if i['id'] == 'dl125')
rjc_i = next(i for i in rjc['instruments'] if i['id'] == 'rjc')
dora_i = {i['id']: i for i in dora['instruments']}
EURLEX = lambda celex: f'https://eur-lex.europa.eu/legal-content/PT/TXT/?uri=CELEX%3A{celex}'

instruments = [
    inst(dl125, group='national', status='em_vigor', valid_from='2026-04-03',
         entry_into_force_short='120 dias após a publicação (art. 11.º) — 3 de abril de 2026 (data calculada)',
         effects_short='Arts. 27.º, n.os 1 e 2, 28.º a 30.º e 33.º do RJC: 24 meses após a regulamentação dos arts. 8.º, 14.º, 26.º, 31.º, 32.º e 83.º (art. 10.º, n.º 2) — essa regulamentação é o Reg. 756/2026 (art. 1.º), pelo que a data calculada é 22 de junho de 2028',
         relations=[{'type': 'transposes', 'target': 'Diretiva (UE) 2022/2555 (NIS2)', 'ref': 'art. 1.º'},
                    {'type': 'revokes', 'target': 'Lei n.º 46/2018, de 13 de agosto (regime jurídico da segurança do ciberespaço)', 'ref': 'art. 9.º'},
                    {'type': 'revokes', 'target': 'Decreto-Lei n.º 65/2021, de 30 de julho', 'ref': 'art. 9.º'}]),
    inst(rjc_i, group='national', status='em_vigor', valid_from='2026-04-03', short='Regime Jurídico da Cibersegurança (RJC)',
         entry_into_force_short='Com o DL 125/2025 — 3 de abril de 2026 (data calculada)',
         note='Aprovado em anexo ao Decreto-Lei n.º 125/2025. Anexos I e II: setores; Anexo III: categorias de empresas.'),
    inst(reg756['instrument'], group='national', status='em_vigor', valid_from='2026-06-23',
         entry_into_force_short='Dia seguinte ao da publicação (art. 34.º) — 23 de junho de 2026',
         effects_short='Disposições que dependem de instruções técnicas do CNCS produzem efeitos com a publicação destas (art. 35.º, n.º 2)',
         relations=[{'type': 'regulates', 'target': 'RJC — arts. 8.º, 14.º, 20.º, 26.º, 29.º a 33.º, 40.º, 45.º, 72.º e 83.º', 'ref': 'art. 1.º'}],
         note='Anexo I: QNRCS · Anexo II: Matriz de risco · Anexo III: medidas mínimas (Básico, Substancial, Elevado) · Anexo IV: entidades públicas relevantes (Grupos A e B).'),
    inst(nis2['instrument'], group='eu', status='aplicavel', official_url=EURLEX('32022L2555'),
         entry_into_force_short='16 de janeiro de 2023 (vigésimo dia seguinte ao da publicação)',
         effects_short='Transposição até 17 de outubro de 2024; aplicação a partir de 18 de outubro de 2024 (art. 41.º)',
         relations=[{'type': 'revokes', 'target': 'Diretiva (UE) 2016/1148', 'ref': 'art. 44.º'},
                    {'type': 'lex_specialis', 'target': 'Atos setoriais com requisitos equivalentes, como o Regulamento (UE) 2022/2554 (DORA)', 'ref': 'art. 4.º'}]),
    inst(rx['instrument'], group='eu', status='aplicavel', official_url=EURLEX('32024R2690'),
         relations=[{'type': 'regulates', 'target': 'Diretiva NIS2 — art. 21.º, n.º 5, e art. 23.º, n.º 11', 'ref': 'considerandos'}],
         note='Aplica-se a prestadores de serviços digitais (DNS, TLD, nuvem, centros de dados, CDN, serviços geridos e de segurança geridos, mercados em linha, motores de pesquisa, redes sociais, serviços de confiança). Cada secção do Anexo indica a alínea do art. 21.º, n.º 2, da NIS2 que concretiza.'),
    inst(dora_i['dora'], group='eu', status='aplicavel', official_url=EURLEX('32022R2554'),
         effects_short='Aplicável a partir de 17 de janeiro de 2025 (art. 64.º)',
         relations=[{'type': 'lex_specialis', 'target': 'Diretiva (UE) 2022/2555 (NIS2), para as entidades financeiras', 'ref': 'NIS2, art. 4.º; DORA, considerando 16'}]),
    inst(dora_i['rts2024_1774'], group='eu', status='aplicavel', official_url=EURLEX('32024R1774'),
         relations=[{'type': 'regulates', 'target': 'DORA — arts. 15.º e 16.º, n.º 3', 'ref': 'preâmbulo'}]),
    inst(dora_i['rts2024_1772'], group='eu', status='aplicavel', official_url=EURLEX('32024R1772'),
         relations=[{'type': 'regulates', 'target': 'DORA — art. 18.º, n.º 4', 'ref': 'preâmbulo'}]),
    inst(dora_i['rts2025_301'], group='eu', status='aplicavel', official_url=EURLEX('32025R0301'),
         relations=[{'type': 'regulates', 'target': 'DORA — art. 20.º', 'ref': 'preâmbulo'}]),
    inst(dora_i['its2024_2956'], group='eu', status='aplicavel', official_url=EURLEX('32024R2956'),
         relations=[{'type': 'regulates', 'target': 'DORA — art. 28.º, n.º 9', 'ref': 'preâmbulo'}]),
    {'id': 'qnrcs', 'group': 'framework', 'short': 'QNRCS — Quadro Nacional de Referência para a Cibersegurança',
     'title': 'Anexo I do Regulamento n.º 756/2026: 6 objetivos, 22 categorias, 107 controlos, com referências a ISO/IEC 27001 e 27002:2022, NIST CSF 2.0, NIST SP 800-53 Rev. 5, CIS CSC v8.1 e CyFun 2025',
     'type': 'referencial-nacional', 'issuer': 'Centro Nacional de Cibersegurança', 'official_url': REG_URL, 'language': 'pt', 'status': 'em_vigor',
     'publication': 'Diário da República, 2.ª série, n.º 118, 2026-06-22',
     'note': 'Atualizado, pelo menos, de cinco em cinco anos (RJC, art. 14.º, n.º 2).'},
    {'id': 'cis812', 'group': 'framework', 'short': 'CIS Critical Security Controls v8.1.2',
     'title': '18 controlos e 153 salvaguardas, em três grupos de implementação (IG1, IG2, IG3)', 'type': 'referencial-privado',
     'issuer': 'Center for Internet Security, Inc.', 'date': '2025-03', 'official_url': 'https://www.cisecurity.org/controls/v8-1', 'language': 'en',
     'status': 'em_vigor', 'license': 'CC BY-NC-ND 4.0 — uso comercial sujeito a autorização prévia do CIS',
     'note': 'A AnkoraOne inclui apenas identificadores; o texto é importado por cada cliente a partir do ficheiro oficial.'},
    inst(isa6['instrument'], group='framework', status='em_vigor', short='VDA ISA 6.0.3 (TISAX)',
         license='CC BY-ND 4.0 + direitos adicionais (secção 9)'),
    inst(isa27['instrument'], group='framework', status='futuro', short='VDA ISA 2027.1 (TISAX)',
         license='CC BY-ND 4.0 + direitos adicionais (secção 9)',
         note='Nenhum dos documentos oficiais fixa a data a partir da qual passa a ser obrigatório: aplica-se a versão do ISA em vigor quando a avaliação inicial é encomendada (TISAX Participant Handbook).'),
    {'id': 'tisax', 'group': 'framework', 'short': 'TISAX — Participant Handbook', 'title': tisax['instrument'].get('title'),
     'type': 'referencial-privado', 'issuer': 'ENX Association', 'date': tisax['instrument'].get('date'), 'language': 'en',
     'official_url': tisax['instrument'].get('official_url'), 'status': 'em_vigor',
     'note': f"Versão {tisax['instrument'].get('version')}. Níveis de avaliação AL1–AL3; rótulos válidos por 3 anos. Documento com todos os direitos reservados: apenas factos estruturais na aplicação."},
]

framework_domains = {
    'QNRC': [f"{c['id']} — {c['name']}" for o in objectives for c in o['categories']],
    'NIS2': [f"Art. 21.º, n.º 2, alínea {m['letter']})" for m in nis2['art21_measures']],
    'EU_2024_2690': [f"{s['id']}. {s['title']}" for s in rx['annex_sections']],
    'DORA': ['Governação', 'Gestão do risco TIC', 'Incidentes', 'Testes de resiliência operacional digital', 'Risco de terceiros TIC', 'Partilha de informação'],
    'TISAX_ISA6': sorted({c['chapter'] for c in isa6['controls']}, key=lambda s: int(s.split()[0])),
    'TISAX_ISA2027': sorted({c['chapter'] for c in isa27['controls']}, key=lambda s: int(s.split()[0])),
}

save('catalog.json', {
    'generated_from': 'tools/legal/build_data.py — documentos oficiais em docs/legal/',
    'instruments': instruments,
    'framework_domains': framework_domains,
})

# ── Regimes de notificação de incidentes (texto literal por número) ─────────
def article(arts, number):
    return next(a for a in arts if a['number'] == number)

def paragraph(text, n):
    """Devolve o n.º n de um artigo (formato «N — …»), incluindo as alíneas seguintes."""
    parts = re.split(r'\n(?=\d+ — )', '\n' + text.strip())
    for p in parts:
        p = p.strip()
        if p.startswith(f'{n} — '):
            return p
    raise KeyError(n)

A = rjc['articles']
incident_regimes = [
    {
        'id': 'rjc', 'name': 'Regime Jurídico da Cibersegurança (DL 125/2025) e Regulamento n.º 756/2026',
        'applies_to': 'Entidades essenciais, importantes e públicas relevantes (RJC, art. 40.º, n.º 1)',
        'recipient': 'Autoridade de cibersegurança competente, através da plataforma eletrónica (RJC, art. 40.º, n.º 6; Reg. 756/2026, art. 20.º)',
        'phases': [
            {'id': 'initial', 'name': 'Notificação inicial', 'value': 24, 'unit': 'horas', 'from': 'verificação de que existe, ou pode vir a existir, um incidente significativo',
             'ref': 'RJC, art. 42.º, n.º 1', 'text': paragraph(article(A, '42.º')['text'], 1)},
            {'id': 'update', 'name': 'Atualização da notificação inicial (quando necessário)', 'value': 72, 'unit': 'horas', 'from': 'verificação do incidente significativo',
             'ref': 'RJC, art. 42.º, n.º 3', 'text': paragraph(article(A, '42.º')['text'], 3)},
            {'id': 'end_of_impact', 'name': 'Notificação do fim de impacto significativo', 'value': 24, 'unit': 'horas', 'from': 'fim do impacto',
             'ref': 'RJC, art. 43.º, n.º 1', 'text': paragraph(article(A, '43.º')['text'], 1)},
            {'id': 'final', 'name': 'Relatório final', 'value': 30, 'unit': 'dias úteis', 'from': 'notificação do fim de impacto significativo',
             'ref': 'RJC, art. 44.º, n.º 1', 'text': paragraph(article(A, '44.º')['text'], 1)},
            {'id': 'interim', 'name': 'Relatório intercalar (a pedido)', 'value': 7, 'unit': 'dias', 'from': 'periodicidade semanal, a pedido, se o incidente continuar em curso findo o prazo do relatório final',
             'ref': 'RJC, art. 44.º, n.º 3', 'text': paragraph(article(A, '44.º')['text'], 3)},
        ],
        'rules': [
            {'ref': 'RJC, art. 41.º, n.º 2', 'text': paragraph(article(A, '41.º')['text'], 2)},
            {'ref': 'RJC, art. 40.º, n.º 3', 'text': paragraph(article(A, '40.º')['text'], 3)},
            {'ref': 'Reg. 756/2026, art. 20.º, n.º 3', 'text': paragraph(article(reg756['articles'], '20.º')['text'], 3)},
        ],
    },
    {
        'id': 'nis2', 'name': 'Diretiva (UE) 2022/2555 (NIS2), art. 23.º',
        'applies_to': 'Referência europeia. Em Portugal aplicam-se os prazos do RJC, que transpõe a Diretiva.',
        'recipient': 'CSIRT ou, se aplicável, autoridade competente (art. 23.º, n.º 1)',
        'phases': [{'id': p['phase'], 'name': p.get('designation_literal') or p['phase'].replace('_', ' '),
                    'value': (p.get('deadline') or {}).get('value'), 'unit': (p.get('deadline') or {}).get('unit'),
                    'from': (p.get('deadline') or {}).get('from'), 'ref': p['ref'], 'text': p.get('content_text')} for p in nis2['art23_reporting']],
        'rules': [{'ref': nis2.get('significant_incident_ref') or 'Diretiva NIS2, art. 23.º, n.º 3', 'text': nis2['significant_incident_text']}],
    },
    {
        'id': 'dora', 'name': 'DORA — Regulamento (UE) 2022/2554, art. 19.º, e Regulamento Delegado (UE) 2025/301',
        'applies_to': 'Entidades financeiras (DORA, art. 2.º) — incidentes de caráter severo relacionados com as TIC',
        'recipient': 'Autoridade competente nos termos do DORA, art. 19.º, n.º 1',
        'phases': [{'id': p['phase'], 'name': p['phase'].replace('_', ' ').capitalize(),
                    'value': (p.get('deadline') or {}).get('value'), 'unit': (p.get('deadline') or {}).get('unit'),
                    'from': (p.get('deadline') or {}).get('from'), 'ref': p['ref'],
                    'text': (p.get('deadline') or {}).get('text'),
                    'alt': [a.get('text') for a in p.get('alt_deadlines') or []]} for p in dora['incident_reporting']],
        'rules': [{'ref': 'RTS 2024/1772, art. 8.º', 'text': dora['major_incident_classification']['rule_text']}],
    },
]

# Obrigações com prazo (RJC + Reg. 756/2026), para a vista «Obrigações e prazos»
deadlines = []
for src, data in (('RJC / DL 125/2025', rjc), ('Reg. 756/2026', reg756)):
    for o in data['obligations']:
        if o.get('deadline'):
            deadlines.append({k: o.get(k) for k in ('id', 'title_pt', 'ref', 'page', 'applies_to', 'deadline', 'text', 'summary_pt')} | {'source': src})

save('obligations.json', {'incident_regimes': incident_regimes, 'deadlines': deadlines})
print('prazos', len(deadlines))
