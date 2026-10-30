import os
import sys, json, re, os
sys.path.insert(0, '.')
from eulib import *
from parse_articles import parse_articles
from recitals import parse_recitals
from annex_nis2 import parse_annexes
OUT = os.path.join(os.environ.get('LEGAL_WORKDIR', 'work'), 'data')
os.makedirs(OUT, exist_ok=True)
TXT = os.path.join(os.environ.get('LEGAL_WORKDIR', 'work'), 'txt/')

def fix(s):
    return s.replace('2.odo anexo', '2.ºdo anexo')

def para_groups(paras):
    """split article paragraphs into {n: [paras]} by numbered paragraphs 'N. '"""
    g = {}; cur = '0'
    for p in paras:
        m = re.match(r'^(\d+)\. ', p)
        if m: cur = m.group(1)
        g.setdefault(cur, []).append(p)
    return g

def alinea(paras, letter):
    out = []; on = False
    for p in paras:
        m = re.match(r'^([a-z])\) ', p)
        if m:
            if on: break
            if m.group(1) == letter: on = True
        elif on and not re.match(r'^([ivx]+)\) ', p):
            break
        if on: out.append(p)
    return out

def strip_marker(p):
    return re.sub(r'^[a-z]\) ', '', p)

def clean_art(a, ojmap, footsrc, label):
    a['text'] = fix(a['text']); a['paragraphs'] = [fix(p) for p in a['paragraphs']]
    fns = {}
    for pg in sorted(set(a.get('_pages', [])), key=int):
        for k, v in footsrc.get(str(pg), {}).items():
            if re.search(r'\(%d\)' % k, a['text']): fns[str(k)] = v
    pages = sorted(set(a.get('_pages', [int(a['page'])])), key=int)
    return {'number': a['number'], 'title': a['title'], 'chapter': (a['chapter'] + ' — ' + a['chapter_title']) if a.get('chapter') else None,
            'ref': '%s, art. %s' % (label, a['number']), 'page': a['page'],
            'page_end': str(pages[-1]), 'oj_page': ojmap.get(a['page']),
            'text': a['text'], 'footnotes': fns}

def make_locator(pages, label=None):
    norm = [(str(p['n']), re.sub(r'\s+', ' ', join_lines(p['lines']))) for p in pages]
    def loc(text, minp=0):
        t = re.sub(r'^(\d+\.|[a-z]\)|\([a-z]+\))\s*', '', text.split('\n')[0]).strip()
        for L in (60, 40, 25):
            frag = t[:L]
            hits = [n for n, x in norm if frag in x and int(n) >= minp]
            if hits: return hits[0]
        return None
    return loc
# ---------------- NIS2 ----------------
HDR=[r'^\s*(?P<oj>L 333/\d+)\s+PT\s+Jornal Oficial da União Europeia\s+27\.12\.2022\s*$',
     r'^\s*27\.12\.2022\s+PT\s+Jornal Oficial da União Europeia\s+(?P<oj>L 333/\d+)\s*$']
pages, fn = load_pages(TXT + 'NIS2-2022-2555.txt', HDR, landscape_pages=set(range(64, 71)))
OJ = {str(p['n']): p['oj'] for p in pages}
FOOT = {str(p['n']): p['footnotes'] for p in pages}
flat = flatten(pages, 1, 63)
k = [i for i, (p, l) in enumerate(flat) if 'ADOTARAM A PRESENTE DIRETIVA' in l][0]
raw_arts = parse_articles(flat[k+1:])
for a in raw_arts:
    a['_pages'] = [int(x) for x in a.get('_pages', [a['page']])]
arts = [clean_art(a, OJ, FOOT, 'Diretiva NIS2') for a in raw_arts]
A = {a['number']: a for a in arts}
P = {a['number']: [fix(p) for p in r['paragraphs']] for a, r in zip(arts, raw_arts)}
rec = parse_recitals(flat, r'Considerando o seguinte:', r'ADOTARAM A PRESENTE')
for r in rec: r['text'] = fix(r['text'])
R = {r['n']: r for r in rec}
issues_n = []

# art 21 measures
g21 = para_groups(P['21.º'])
measures = []
for L in 'abcdefghij':
    t = alinea(g21['2'], L)
    measures.append({'letter': L, 'text': strip_marker('\n'.join(t)), 'ref': 'Diretiva NIS2, art. 21.º, n.º 2, alínea %s)' % L, 'page': A['21.º']['page']})
art21_chapeau = g21['2'][0]

# art 23 reporting
g23 = para_groups(P['23.º'])
n4 = g23['4']
def al(L): return '\n'.join(alinea(n4, L))
derog = [p for p in n4 if p.startswith('Em derrogação')][0]
n1 = g23['1'][0]
sent_dest = [s for s in re.split(r'(?<=\.) (?=[A-Z])', n1) if 'destinatários dos seus serviços' in s][0]
pg23 = A['23.º']['page']; pg23e = A['23.º']['page_end']
rep = [
 {'phase': 'aviso_previo', 'designation_literal': 'alerta rápido',
  'deadline': {'text': 'Sem demora injustificada e, em qualquer caso, no prazo de 24 horas depois de terem tomado conhecimento do incidente significativo', 'value': 24, 'unit': 'horas', 'from': 'tomada de conhecimento do incidente significativo'},
  'content_text': al('a'), 'ref': 'Diretiva NIS2, art. 23.º, n.º 4, primeiro parágrafo, alínea a)'},
 {'phase': 'notificacao', 'designation_literal': 'notificação de incidente',
  'deadline': {'text': 'Sem demora injustificada e, em qualquer caso, no prazo de 72 horas depois de terem tomado conhecimento do incidente significativo', 'value': 72, 'unit': 'horas', 'from': 'tomada de conhecimento do incidente significativo'},
  'content_text': al('b'), 'ref': 'Diretiva NIS2, art. 23.º, n.º 4, primeiro parágrafo, alínea b)'},
 {'phase': 'notificacao', 'designation_literal': 'notificação (prestador de serviços de confiança — derrogação da alínea b))', 'applies_to': ['outro:prestadores de serviços de confiança'],
  'deadline': {'text': 'sem demora injustificada e, em qualquer caso, no prazo de 24 horas após ter tomado conhecimento do incidente significativo', 'value': 24, 'unit': 'horas', 'from': 'tomada de conhecimento do incidente significativo'},
  'content_text': derog, 'ref': 'Diretiva NIS2, art. 23.º, n.º 4, segundo parágrafo'},
 {'phase': 'relatorio_intercalar', 'designation_literal': 'relatório intercalar',
  'deadline': {'text': 'A pedido de uma CSIRT ou, se aplicável, da autoridade competente', 'value': None, 'unit': None, 'from': 'pedido da CSIRT ou da autoridade competente'},
  'content_text': al('c'), 'ref': 'Diretiva NIS2, art. 23.º, n.º 4, primeiro parágrafo, alínea c)'},
 {'phase': 'relatorio_final', 'designation_literal': 'relatório final',
  'deadline': {'text': 'O mais tardar um mês após a apresentação da notificação de incidente mencionada na alínea b)', 'value': 1, 'unit': 'meses', 'from': 'apresentação da notificação de incidente (alínea b))'},
  'content_text': al('d'), 'ref': 'Diretiva NIS2, art. 23.º, n.º 4, primeiro parágrafo, alínea d)'},
 {'phase': 'relatorio_progresso', 'designation_literal': 'relatório intercalar (incidente em curso no momento do relatório final)',
  'deadline': {'text': 'Em caso de incidente em curso no momento da apresentação do relatório final referido na alínea d), [...] um relatório intercalar nessa altura', 'value': None, 'unit': None, 'from': 'momento previsto para a apresentação do relatório final (alínea d))'},
  'content_text': al('e'), 'ref': 'Diretiva NIS2, art. 23.º, n.º 4, primeiro parágrafo, alínea e)'},
 {'phase': 'relatorio_final', 'designation_literal': 'relatório final (incidente que estava em curso)',
  'deadline': {'text': 'um relatório final no prazo de um mês após terem resolvido o incidente', 'value': 1, 'unit': 'meses', 'from': 'resolução do incidente'},
  'content_text': al('e'), 'ref': 'Diretiva NIS2, art. 23.º, n.º 4, primeiro parágrafo, alínea e)'},
 {'phase': 'informacao_destinatarios', 'designation_literal': 'notificação dos destinatários dos serviços (incidente significativo)',
  'deadline': {'text': 'sem demora injustificada', 'value': None, 'unit': None, 'from': 'incidente significativo suscetível de afetar negativamente a prestação dos serviços'},
  'content_text': sent_dest, 'ref': 'Diretiva NIS2, art. 23.º, n.º 1, primeiro parágrafo'},
 {'phase': 'informacao_destinatarios', 'designation_literal': 'comunicação aos destinatários dos serviços (ciberameaça significativa)',
  'deadline': {'text': 'sem demora injustificada', 'value': None, 'unit': None, 'from': 'ciberameaça significativa que possa afetar os destinatários'},
  'content_text': '\n'.join(g23['2']), 'ref': 'Diretiva NIS2, art. 23.º, n.º 2'},
]
for r in rep:
    r['page'] = pg23 if r['ref'].endswith(('n.º 1, primeiro parágrafo', 'n.º 2')) else pg23e
    assert r['deadline']['text'].replace('[...] ', '').split(' [...]')[0][:40].lower().replace('em caso', 'em caso') in (r['content_text'].lower() + ' ' + '\n'.join(P['23.º']).lower()), r['phase']
# verify deadline literals
for r in rep:
    for frag in r['deadline']['text'].split(' [...] '):
        assert frag.lower() in '\n'.join(P['23.º']).lower(), frag
loc = make_locator(pages)
for r in rep: r['page'] = loc(r['content_text'], int(pg23)) or r['page']
for m_ in measures: m_['page'] = loc(m_['text'], int(A['21.º']['page'])) or m_['page']
sig = '\n'.join(g23['3'])
lex = [{'ref': 'Diretiva NIS2, art. 4.º', 'page': A['4.º']['page'], 'text': A['4.º']['text']}]
for num, a in A.items():
    for n, ps in para_groups(P[num]).items():
        t = '\n'.join(ps)
        if '2022/2554' in t:
            lex.append({'ref': 'Diretiva NIS2, art. %s, n.º %s' % (num, n) if n != '0' else 'Diretiva NIS2, art. %s' % num, 'page': a['page'], 'text': t})
for n in [r['n'] for r in rec if re.search(r'2022/2554|atos? jurídicos? setoria', r['text'])]:
    lex.append({'ref': 'Diretiva NIS2, considerando (%d)' % n, 'page': R[n]['page'], 'oj_page': OJ[R[n]['page']], 'text': R[n]['text']})
for x in lex:
    if 'considerando' not in x['ref']: x['page'] = loc(x['text'], int(A[x['ref'].split('art. ')[1].split(',')[0]]['page'])) or x['page']
g2 = para_groups(P['2.º']); g3 = para_groups(P['3.º'])
size_text = '\n'.join(g2['1'])
size_rules = [{'ref': 'Diretiva NIS2, art. 2.º, n.º 1', 'page': A['2.º']['page'], 'text': size_text}]
for L in 'ac':
    size_rules.append({'ref': 'Diretiva NIS2, art. 3.º, n.º 1, alínea %s)' % L, 'page': A['3.º']['page'], 'text': '\n'.join(alinea(g3['1'], L))})
size_rules.append({'ref': 'Diretiva NIS2, art. 3.º, n.º 2', 'page': A['3.º']['page'], 'text': '\n'.join(g3['2'])})
for x in size_rules: x['page'] = loc(x['text'], 29) or x['page']
for r in rec:
    if '2003/361' in r['text']:
        size_rules.append({'ref': 'Diretiva NIS2, considerando (%d)' % r['n'], 'page': r['page'], 'oj_page': OJ[r['page']], 'text': r['text']})
# annexes
raw = open(TXT + 'NIS2-2022-2555.txt', encoding='utf-8').read().split('\f')
p64 = raw[63].split('\n'); kk = [i for i, l in enumerate(p64) if l.strip() == 'ANEXO I'][0]
ax = parse_annexes([(64, p64[kk:])] + [(n, raw[n-1].split('\n')) for n in range(65, 71)])
annexes = []
for a in ax:
    rows = []
    for r in a['rows']:
        rows.append({'setor': r['setor'], 'setor_n': r['setor_n'], 'subsetor': r['subsetor'], 'subsetor_letra': r['subsetor_letra'],
                     'tipo_entidade': r['tipo_entidade'],
                     'ref': 'Diretiva NIS2, Anexo %s, ponto %s%s' % (a['id'], r['setor_n'], (', alínea %s)' % r['subsetor_letra']) if r['subsetor_letra'] else '')})
    annexes.append({'id': a['id'], 'title': a['title'].capitalize() if False else a['title'], 'ref': 'Diretiva NIS2, Anexo %s' % a['id'],
                    'pages': a['pages'], 'oj_pages': ['L 333/%d' % (79 + int(p)) for p in a['pages']], 'rows': rows, 'footnotes': a['footnotes']})
issues_n += [
 'Paginação: o PDF não tem numeração "N/73"; "page" = número da página do PDF (1–73) e "oj_page" = paginação impressa do JO (L 333/80 a L 333/152). As páginas 64–70 (anexos I e II) estão em formato paisagem e não têm cabeçalho legível na extração; oj_page dos anexos calculado (página PDF + 79).',
 'Indicadores ordinais em expoente extraídos como ".o"/".os"/"°" foram normalizados para "º"/"ºs" (ex.: "artigo 21.º", "n.º", "n.ºs"); hifenizações de fim de linha (hífen condicional U+00AD) removidas; duplicação do hífen em quebra de linha ("Estados-/-Membros") resolvida para "Estados-Membros".',
 'Art. 3.º, n.º 1, alínea c): o texto oficial (PDF, p. 31) tem "artigo 2.ºdo anexo" sem espaço — mantido literalmente.',
 'Art. 13.º, n.º 4: o texto oficial contém a gralha "anos termos do Regulamento (UE) 2022/2554" — mantida literalmente.',
 'Art. 23.º, n.º 4, alínea a): a designação oficial em PT é "alerta rápido" (não "aviso prévio"); a fase foi mapeada para "aviso_previo" conforme o esquema pedido. A alínea e) gera duas entradas (relatorio_progresso = relatório intercalar nessa altura; relatorio_final = no prazo de um mês após a resolução), ambas com o mesmo content_text.',
 'Art. 23.º, n.º 4, segundo parágrafo (prestadores de serviços de confiança: 24 horas em vez de 72 horas para a notificação) incluído como fase "notificacao" com applies_to próprio.',
 'Notas de rodapé: removidas do corpo dos artigos/considerandos e guardadas em "footnotes" (apenas as referenciadas pelo marcador "(N)" no texto do artigo); os marcadores "(N)" mantêm-se no texto.',
 'Anexo I, ponto 5 (Saúde): o texto oficial refere "Regulamento (UE) …/…" (laboratórios de referência da UE) — mantido literalmente; a nota de rodapé (19) identifica o Regulamento (UE) 2022/2371.',
 'Anexo I/II: "setor", "subsetor" e "tipo_entidade" sem os números/letras de ordenação e sem o travessão inicial, que constam em "setor_n" e "subsetor_letra". Notas de rodapé dos anexos em "footnotes" (numeração própria de cada anexo). Algumas notas de rodapé do Anexo I usam grafia pré-AO ("Directiva", "Março") e "n.°" — mantidas, exceto o ordinal normalizado.',
 'Anexo III (tabela de correspondência) não extraído (fora do âmbito pedido).',
 'lex_specialis: inclui art. 4.º, todos os números de artigos que citam o Regulamento (UE) 2022/2554 e os considerandos que mencionam o Regulamento (UE) 2022/2554 ou "atos jurídicos setoriais"; o termo "DORA" não ocorre no texto da diretiva.',
]
art44 = A['44.º']['text']; art41 = '\n'.join(para_groups(P['41.º'])['1'])
instrument = {
 'id': 'nis2', 'short': 'Diretiva NIS2 (Diretiva SRI 2)',
 'title': 'Diretiva (UE) 2022/2555 do Parlamento Europeu e do Conselho de 14 de dezembro de 2022 relativa a medidas destinadas a garantir um elevado nível comum de cibersegurança na União que altera o Regulamento (UE) n.º 910/2014 e a Diretiva (UE) 2018/1972 e revoga a Diretiva (UE) 2016/1148 (Diretiva SRI 2)',
 'type': 'diretiva-ue', 'number': '2022/2555', 'date': '2022-12-14',
 'publication': 'JO L 333 de 27.12.2022, p. 80–152', 'issuer': 'Parlamento Europeu e Conselho da União Europeia',
 'official_url': 'https://eur-lex.europa.eu/legal-content/PT/TXT/?uri=CELEX%3A32022L2555', 'celex': '32022L2555', 'language': 'pt',
 'entry_into_force': A['45.º']['text'] + ' [publicação: 27.12.2022 → entrada em vigor calculada: 2023-01-16]',
 'transposition_deadline': {'text': 'Os Estados-Membros devem adotar e publicar, até 17 de outubro de 2024, as disposições necessárias para dar cumprimento à presente diretiva.', 'date': '2024-10-17', 'ref': 'Diretiva NIS2, art. 41.º, n.º 1, primeiro parágrafo'},
 'application_date': {'text': 'Os Estados-Membros devem aplicar essas disposições a partir de 18 de outubro de 2024.', 'date': '2024-10-18', 'ref': 'Diretiva NIS2, art. 41.º, n.º 1, segundo parágrafo'},
 'effects': [art41, art44],
 'revokes': ['Diretiva (UE) 2016/1148 — "%s" (art. 44.º)' % art44.split('\n')[0]],
 'amends': ['Regulamento (UE) n.º 910/2014 (art. 42.º)', 'Diretiva (UE) 2018/1972 (art. 43.º)'],
 'transposes': [], 'regulates': [], 'page_count': 73,
 'counts': {'articles': len(arts), 'recitals': len(rec)},
}
for t in (instrument['transposition_deadline']['text'], instrument['application_date']['text']):
    assert t in art41
nis2 = {'instrument': instrument, 'articles': arts, 'art21_measures': measures, 'art21_chapeau': art21_chapeau,
        'art23_reporting': rep, 'significant_incident_text': sig, 'significant_incident_ref': 'Diretiva NIS2, art. 23.º, n.º 3',
        'art20_governance': A['20.º']['text'], 'art20_ref': 'Diretiva NIS2, art. 20.º',
        'lex_specialis': lex, 'annexes': annexes, 'size_rules_text': size_text, 'size_rules_ref': 'Diretiva NIS2, art. 2.º, n.º 1',
        'size_rules': size_rules, 'issues': issues_n}
json.dump(nis2, open(OUT + '/nis2.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=2)

# ---------------- Reg. Exec. 2024/2690 ----------------
HDR2=[r'^\s*ELI: http://data\.europa\.eu/eli/reg_impl/2024/2690/oj\s+(?P<oj>\d+/34)\s*$',
     r'^\s*(?P<oj>\d+/34)\s+ELI: http://data\.europa\.eu/eli/reg_impl/2024/2690/oj\s*$',
     r'^\s*PT\s+JO L de 18\.10\.2024\s*$', r'^\s*JO L de 18\.10\.2024\s+PT\s*$',
     r'^\s*Jornal Oficial\s+PT\s*$', r'^\s*da União Europeia\s+Série L\s*$', r'^\s*2024/2690\s+18\.10\.2024\s*$']
pages2, _ = load_pages(TXT + 'REGEXEC-2024-2690.txt', HDR2)
OJ2 = {str(p['n']): p['oj'] for p in pages2}
FOOT2 = {str(p['n']): p['footnotes'] for p in pages2}
flat2 = flatten(pages2, 1, 34)
k = [i for i, (p, l) in enumerate(flat2) if 'ADOTOU O PRESENTE REGULAMENTO' in l][0]
ka = [i for i, (p, l) in enumerate(flat2) if l.strip() == 'ANEXO'][0]
raw2 = parse_articles(flat2[k+1:ka], stop_re=r'^\s*O presente regulamento é obrigatório em todos')
LBL = 'Reg. Exec. 2024/2690'
arts2 = []
for a in raw2:
    a['_pages'] = [int(x) for x in a.get('_pages', [a['page']])]
    c = clean_art(a, OJ2, FOOT2, LBL)
    c['page'] = OJ2[c['page']]; c['page_end'] = OJ2[c['page_end']]; c.pop('oj_page'); c['pdf_page'] = a['page']
    arts2.append(c)
A2 = {a['number']: a for a in arts2}; P2 = {a['number']: r['paragraphs'] for a, r in zip(arts2, raw2)}
art1 = A2['1.º']['text']
m = re.search(r'no que diz respeito (.*) \(«entidades pertinentes»\)', art1)
lst = m.group(1)
parts = re.split(r', (?=aos? )| e (?=aos prestadores de serviços de confiança)', lst)
scope = [re.sub(r'^(aos|ao|às|à) ', '', p) for p in parts]
crit = []
for num in ['%d.º' % i for i in range(3, 15)]:
    a = A2[num]
    ent = None
    mm = re.match(r'Incidentes significativos relacionados com (.*)$', a['title'])
    if mm: ent = mm.group(1)
    cur_n = None; chapeau = None
    for p in P2[num]:
        m1 = re.match(r'^(\d+)\. ', p); m2 = re.match(r'^([a-z])\) (.*)', p, re.S)
        if m1:
            cur_n = m1.group(1); chapeau = p
            crit.append({'ref': '%s, art. %s, n.º %s' % (LBL, num, cur_n), 'kind': 'chapeau', 'entity_type': ent, 'page': a['page'], 'text': p})
        elif m2:
            crit.append({'ref': '%s, art. %s%s, alínea %s)' % (LBL, num, (', n.º %s' % cur_n) if cur_n else '', m2.group(1)), 'kind': 'criterio', 'entity_type': ent, 'page': a['page'], 'text': p})
        else:
            crit.append({'ref': '%s, art. %s%s' % (LBL, num, (', n.º %s' % cur_n) if cur_n else ''), 'kind': 'chapeau', 'entity_type': ent, 'page': a['page'], 'text': p})
loc2 = make_locator(pages2)
for c in crit:
    pp = loc2(c['text'], 8); c['page'] = OJ2[pp] if pp else c['page']
# annex
ann = flat2[ka+1:]
items = []; cur = None
for pg, l in ann:
    if l == PB:
        if cur: cur['lines'].append(l)
        continue
    m = re.match(r'^(\s*)(\d+(?:\.\d+)*)\.\s+(\S.*)$', l)
    if m and len(m.group(1)) <= 9:
        cur = {'id': m.group(2), 'page': OJ2[str(pg)], 'pdf_page': str(pg), 'lines': [' ' * 15 + m.group(3)]}
        items.append(cur); continue
    if cur is None:
        if l.strip(): items.append({'id': None, 'lines': [l]})
        continue
    cur['lines'].append(l)
annex_sub = None
reqs = []; section = subsection = None; sec_ref = None; letters = []
sections = []
for it in items:
    ps = [join_lines(p) for p in paragraphs(it['lines'])]
    if it['id'] is None:
        annex_sub = ps[0]; continue
    lev = len(it['id'].split('.'))
    if lev == 1:
        mm = re.match(r'^(.*?) \[(artigo 21\.º.*?)\]$', ps[0])
        section = '%s. %s' % (it['id'], mm.group(1)); sec_ref = mm.group(2)
        lm = re.search(r'alíneas? (.*?), da Diretiva', sec_ref)
        letters = re.findall(r'([a-j])\)', lm.group(1))
        subsection = None
        sections.append({'id': it['id'], 'title': mm.group(1), 'nis2_ref': sec_ref, 'nis2_letters': letters, 'page': it['page']})
        assert len(ps) == 1
        continue
    if lev == 2 and not re.search(r'[.:;]$', ps[0]):
        subsection = '%s. %s' % (it['id'], ps[0])
        if len(ps) == 1: continue
        text = '\n'.join(ps[1:]); rid = it['id']; sub_here = subsection
    else:
        text = '\n'.join(ps); rid = it['id']
        sub_here = subsection if lev == 3 else None
        if lev == 2: subsection = None
    reqs.append({'id': rid, 'section': section, 'subsection': sub_here, 'text': text,
                 'nis2_letter': letters[0] if len(letters) == 1 else ','.join(letters), 'nis2_letters': letters,
                 'nis2_ref_literal': sec_ref, 'ref': '%s, Anexo, ponto %s' % (LBL, rid), 'page': it['page'], 'pdf_page': it['pdf_page']})
issues_r = [
 'Paginação: "page" = número impresso "N/34" do JO; "pdf_page" = página do PDF (coincidem).',
 'Indicadores ordinais em expoente extraídos como ".o"/"°" normalizados para "º" (o texto oficial usa "9.° a 14.°" com sinal de grau no art. 3.º, n.º 3 e "14.°" no art. 3.º, n.º 1, alínea g) — normalizado para "º"); no art. 3.º, n.º 1, o "o" em expoente de "n.º 3" aparecia numa linha isolada na extração e foi reposto. Hifenizações de fim de linha (hífen condicional) removidas.',
 'nis2_letter: a secção do Anexo indica a(s) alínea(s) do art. 21.º, n.º 2, da Diretiva NIS2 entre parênteses retos no título. Quando a secção indica várias alíneas (secção 11: i) e j); secção 13: c), e) e i)), "nis2_letter" contém as letras separadas por vírgula ("i,j"; "c,e,i") e "nis2_letters" a lista.',
 'Pontos de nível 2 sem subdivisão (7.1–7.3 e 9.1–9.3) são requisitos diretos: subsection = null. As subsecções 5.2 e 12.5 têm título e texto sem numeração de 3.º nível: o texto foi registado como requisito com id "5.2"/"12.5".',
 'scope_entity_types: lista literal do art. 1.º; o texto agrupa "prestadores de serviços de mercados em linha, de motores de pesquisa em linha e de plataformas de serviços de redes sociais" num único elemento — mantido assim.',
 'O Anexo usa alíneas "(a)", "(b)"… e subalíneas "i)", "ii)"…; mantidas literalmente, uma por linha ("\\n") dentro de "text".',
 'significant_incident_criteria: uma entrada por número/proémio ("chapeau") e uma por alínea (critério), arts. 3.º a 14.º; "entity_type" deriva do título do artigo (arts. 5.º–14.º).',
]
instrument2 = {
 'id': 'regexec2690', 'short': 'Reg. Exec. 2024/2690',
 'title': 'Regulamento de Execução (UE) 2024/2690 da Comissão de 17 de outubro de 2024 que estabelece regras de execução da Diretiva (UE) 2022/2555 relativamente aos requisitos técnicos e metodológicos das medidas de gestão dos riscos de cibersegurança e especifica mais pormenorizadamente os casos em que se considera que um incidente é significativo no que respeita aos prestadores de serviços de DNS, aos registos de nomes de TLD, aos prestadores de serviços de computação em nuvem, aos prestadores de serviços de centro de dados, aos fornecedores de redes de distribuição de conteúdos, aos prestadores de serviços geridos, aos prestadores de serviços de segurança geridos, aos prestadores de serviços de mercados em linha, de motores de pesquisa em linha e de plataformas de serviços de redes sociais e aos prestadores de serviços de confiança',
 'type': 'regulamento-execucao-ue', 'number': '2024/2690', 'date': '2024-10-17',
 'publication': 'JO L, 2024/2690, 18.10.2024', 'issuer': 'Comissão Europeia',
 'official_url': 'http://data.europa.eu/eli/reg_impl/2024/2690/oj', 'celex': '32024R2690', 'language': 'pt',
 'entry_into_force': A2['16.º']['text'] + ' [publicação: 18.10.2024 → entrada em vigor calculada: 2024-11-07]',
 'effects': [A2['16.º']['text']],
 'revokes': ['Regulamento de Execução (UE) 2018/151 da Comissão (art. 15.º)'], 'amends': [], 'transposes': [],
 'regulates': ['Diretiva (UE) 2022/2555, artigo 21.º, n.º 5, primeiro parágrafo, e artigo 23.º, n.º 11, segundo parágrafo'],
 'page_count': 34,
}
# check title literal vs text
hdr = join_lines([l for l in open(TXT + 'REGEXEC-2024-2690.txt').read().split('\n')[5:15]])
rx = {'instrument': instrument2, 'articles': arts2, 'scope_entity_types': scope, 'scope_ref': '%s, art. 1.º' % LBL,
      'significant_incident_criteria': crit, 'annex_title': annex_sub, 'annex_sections': sections,
      'annex_requirements': reqs, 'issues': issues_r}
json.dump(rx, open(OUT + '/regexec2690.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print('nis2 arts', len(arts), 'recitals', len(rec), 'measures', len(measures), 'rep', len(rep), 'lex', len(lex), 'annexI', len(annexes[0]['rows']), 'annexII', len(annexes[1]['rows']))
print('rx arts', len(arts2), 'scope', scope, 'crit', len(crit), 'reqs', len(reqs), 'sections', len(sections))
print(hdr)
