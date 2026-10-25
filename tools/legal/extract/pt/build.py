import json, re, datetime, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from lib import load, blocks, structure
from oblig_spec import SPEC

BASE = os.path.join(os.path.dirname(__file__), '..')
W = lambda f: os.path.join(BASE, 'work', f)
issues = []

def parse(name, kind):
    ls, v = load(W(name + '.l.json'), kind)
    pre, arts = structure(blocks(ls, v))
    for a in arts:
        # cortar a fórmula final do ato (não faz parte do artigo)
        if 'O presente regulamento é obrigatório em todos os seus elementos' in a['text']:
            idx = a['paras'].index(next(p for p in a['paras'] if p.startswith('O presente regulamento é obrigatório em todos os seus elementos')))
            a['paras'] = a['paras'][:idx]
            a['ppages'] = a['ppages'][:idx]
            a['text'] = '\n'.join(a['paras'])
    return pre, arts

def split_paras(a):
    out = []; cur = None
    for t, pg in zip(a['paras'], a['ppages']):
        m = re.match(r'^(\d+)\.\s', t)
        if m or cur is None:
            cur = {'n': m.group(1) if m else None, 'lines': [t], 'page': pg}
            out.append(cur)
        else:
            cur['lines'].append(t)
    for o in out:
        o['text'] = '\n'.join(o['lines'])
    return out

def alinea(lines, letter):
    """devolve o texto da alínea <letter>) e parágrafos finais que lhe façam referência"""
    res = []; on = False
    letters = 'abcdefghijklmnopqrstu'
    for i, l in enumerate(lines):
        m = re.match(r'^([a-z])\) ', l)
        if m and m.group(1) in letters and not re.match(r'^(i|v|x)\) ', l) or (m and m.group(1) == letter):
            on = (m.group(1) == letter)
            if on:
                res.append(l); continue
        elif on and re.match(r'^[ivx]+\) ', l):
            res.append(l); continue
        elif on and not re.match(r'^[a-z]\) ', l):
            on = False
    for l in lines:
        if re.search(r'alínea %s\)' % letter, l) and l.startswith('Para efeitos do primeiro parágrafo'):
            res.append(l)
    return '\n'.join(res)

def nref(ns):
    if not ns:
        return ''
    if len(ns) == 1:
        return ', n.º ' + ns[0]
    return ', n.os ' + ', '.join(ns[:-1]) + ' e ' + ns[-1]

# ------------------------------------------------------------------ DORA
dpre, darts = parse('dora', 'oj_old')
assert len(darts) == 64, len(darts)
A = {a['number']: a for a in darts}

dora_articles = []
for a in darts:
    dora_articles.append({
        'number': a['number'], 'title': a['title'], 'chapter': a['chapter'], 'section': a['section'],
        'page': a['page'], 'pages': a['pages'], 'ref': 'DORA, art. %s' % a['number'], 'text': a['text']})

# âmbito
P2 = {p['n']: p for p in split_paras(A['2.º'])}
ent_lines = P2['1']['lines']
dora_scope = {
    'ref': 'DORA, art. 2.º, n.º 1',
    'page': P2['1']['page'],
    'entities_text': P2['1']['text'],
    'entities': [l for l in ent_lines if re.match(r'^[a-u]\) ', l)],
    'financial_entities_definition_text': P2['2']['text'],
    'financial_entities_definition_ref': 'DORA, art. 2.º, n.º 2',
    'exclusions_text': P2['3']['text'] + '\n' + P2['4']['text'],
    'exclusions_ref': 'DORA, art. 2.º, n.os 3 e 4',
    'proportionality_text': A['4.º']['text'],
    'proportionality_ref': 'DORA, art. 4.º',
    'simplified_framework_text': split_paras(A['16.º'])[0]['lines'][0],
    'simplified_framework_ref': 'DORA, art. 16.º, n.º 1, primeiro parágrafo',
}
assert len(dora_scope['entities']) == 21

# obrigações
obligations = []
for s in SPEC:
    a = A['%d.º' % s['art']]
    paras = split_paras(a)
    if s.get('n') is None:
        text = a['text']; page = a['page']; ref = 'DORA, art. %d.º' % s['art']
    else:
        sel = [p for p in paras if p['n'] in s['n']]
        assert len(sel) == len(s['n']), (s['id'], [p['n'] for p in paras])
        page = sel[0]['page']
        ref = 'DORA, art. %d.º%s' % (s['art'], nref(s['n']))
        if s.get('al'):
            text = alinea(sel[0]['lines'], s['al'])
            assert text, s['id']
            ref += ', alínea %s)' % s['al']
        else:
            text = '\n'.join(p['text'] for p in sel)
    obligations.append({
        'id': s['id'], 'pillar': s['pillar'], 'title_pt': s['title'], 'ref': ref, 'page': page,
        'article_title': a['title'],
        'applies_to': s.get('applies', ['entidade_financeira']),
        'scope_notes': s.get('exc', []),
        'deadline': s.get('deadline'),
        'text': text, 'summary_pt': s['summary'], 'related': s.get('related', [])})
ids = [o['id'] for o in obligations]
assert len(ids) == len(set(ids))

# ------------------------------------------------------------------ RTS 2025/301
p301, a301 = parse('r301', 'n')
R = {a['number']: a for a in a301}
P5 = {p['n']: p for p in split_paras(R['5.º'])}
l1 = P5['1']['lines']
def li(prefix):
    return next(l for l in l1 if l.startswith(prefix))
ia, ib, ic = li('a) '), li('b) '), li('c) ')
def must(sub, txt):
    assert sub in txt, (sub, txt)
    return sub
common_alt = [
    {'text': P5['3']['text'], 'rule': 'impossibilidade_cumprir_prazo', 'ref': 'RTS 2025/301, art. 5.º, n.º 3', 'page': P5['3']['page']},
]
weekend = {'text': P5['4']['text'], 'rule': 'fim_de_semana_feriado', 'value': None, 'unit': None,
           'from': 'meio-dia do dia útil seguinte', 'ref': 'RTS 2025/301, art. 5.º, n.º 4', 'page': P5['4']['page']}
weekend_excl = {'text': P5['5']['text'], 'rule': 'exclusao_regra_fim_de_semana', 'ref': 'RTS 2025/301, art. 5.º, n.º 5', 'page': P5['5']['page']}
weekend_auth = {'text': P5['6']['text'], 'rule': 'decisao_autoridade_exclusao_fim_de_semana', 'ref': 'RTS 2025/301, art. 5.º, n.º 6', 'page': P5['6']['page']}
P19 = {p['n']: p for p in split_paras(A['19.º'])}
p19_4 = P19['4']['lines']
incident_reporting = [
    {'phase': 'notificacao_inicial',
     'deadline': {'text': must('no prazo de quatro horas a contar da classificação do incidente relacionado com as TIC como sendo um incidente de caráter severo relacionado com as TIC', ia),
                  'value': 4, 'unit': 'horas', 'from': 'classificação do incidente como incidente de caráter severo relacionado com as TIC'},
     'alt_deadlines': [
         {'text': must('o mais tardar 24 horas a contar do momento em que a entidade financeira tomou conhecimento do incidente relacionado com as TIC', ia),
          'rule': 'prazo_maximo', 'value': 24, 'unit': 'horas', 'from': 'momento em que a entidade financeira tomou conhecimento do incidente', 'ref': 'RTS 2025/301, art. 5.º, n.º 1, alínea a)'},
         {'text': P5['2']['text'], 'rule': 'classificacao_tardia', 'value': 4, 'unit': 'horas',
          'from': 'classificação do incidente como de caráter severo (quando ocorrida após 24 horas da tomada de conhecimento)', 'ref': 'RTS 2025/301, art. 5.º, n.º 2', 'page': P5['2']['page']},
     ] + common_alt + [weekend, weekend_excl, weekend_auth],
     'provision_text': ia,
     'dora_text': next(l for l in p19_4 if l.startswith('a) ')),
     'content_ref': 'RTS 2025/301, arts. 1.º e 2.º',
     'content_text': R['1.º']['text'] + '\n' + R['2.º']['text'],
     'ref': 'RTS 2025/301, art. 5.º, n.º 1, alínea a); DORA, art. 19.º, n.º 4, alínea a)', 'page': P5['1']['page']},
    {'phase': 'relatorio_intercalar',
     'deadline': {'text': must('o mais tardar no prazo de 72 horas a contar da apresentação da notificação inicial', ib),
                  'value': 72, 'unit': 'horas', 'from': 'apresentação da notificação inicial'},
     'alt_deadlines': [
         {'text': must('As entidades financeiras devem apresentar um relatório intercalar atualizado sem demora injustificada e, em qualquer caso, quando as atividades regulares tiverem sido repostas', ib),
          'rule': 'relatorio_intercalar_atualizado', 'value': None, 'unit': None, 'from': 'reposição das atividades regulares', 'ref': 'RTS 2025/301, art. 5.º, n.º 1, alínea b)'},
     ] + common_alt + [weekend, weekend_excl, weekend_auth],
     'provision_text': ib,
     'dora_text': next(l for l in p19_4 if l.startswith('b) ')),
     'content_ref': 'RTS 2025/301, arts. 1.º e 3.º',
     'content_text': R['1.º']['text'] + '\n' + R['3.º']['text'],
     'ref': 'RTS 2025/301, art. 5.º, n.º 1, alínea b); DORA, art. 19.º, n.º 4, alínea b)', 'page': P5['1']['page']},
    {'phase': 'relatorio_final',
     'deadline': {'text': must('o mais tardar um mês após a apresentação do relatório intercalar ou, se for o caso, após o último relatório intercalar atualizado', ic),
                  'value': 1, 'unit': 'meses', 'from': 'apresentação do relatório intercalar ou do último relatório intercalar atualizado'},
     'alt_deadlines': common_alt + [weekend],
     'provision_text': ic,
     'dora_text': next(l for l in p19_4 if l.startswith('c) ')),
     'content_ref': 'RTS 2025/301, arts. 1.º e 4.º',
     'content_text': R['1.º']['text'] + '\n' + R['4.º']['text'],
     'ref': 'RTS 2025/301, art. 5.º, n.º 1, alínea c); DORA, art. 19.º, n.º 4, alínea c)', 'page': P5['1']['page']},
    {'phase': 'notificacao_voluntaria_ameaca',
     'deadline': None,
     'alt_deadlines': [],
     'note_pt': 'Notificação voluntária: nem o DORA (art. 19.º, n.º 2) nem o RTS 2025/301 (art. 6.º) fixam prazo.',
     'provision_text': P19['2']['text'],
     'content_ref': 'RTS 2025/301, art. 6.º',
     'content_text': R['6.º']['text'],
     'ref': 'RTS 2025/301, art. 6.º; DORA, art. 19.º, n.º 2', 'page': R['6.º']['page']},
]
issues.append('RTS 2025/301, art. 5.º, n.º 1, alínea a): o texto oficial PT diz literalmente «Para o relatório inicial», embora o n.º 1 e o art. 19.º, n.º 4, alínea a), do DORA se refiram à «notificação inicial»; mantido literal.')

# ------------------------------------------------------------------ RTS 2024/1772
p1772, a1772 = parse('r1772', 'n')
C = {a['number']: a for a in a1772}
P9 = {p['n']: p for p in split_paras(C['9.º'])}
crit = [
    ('clientes_contrapartes_transacoes', 'Clientes, contrapartes financeiras e transações', '1.º', '1', 'a'),
    ('reputacao', 'Impacto em termos de reputação', '2.º', '2', 'a'),
    ('duracao_indisponibilidade', 'Duração e tempo de indisponibilidade do serviço', '3.º', '3', 'b'),
    ('distribuicao_geografica', 'Distribuição geográfica', '4.º', '4', 'c'),
    ('perdas_dados', 'Perdas de dados', '5.º', '5', 'd'),
    ('criticalidade_servicos', 'Criticalidade dos serviços afetados', '6.º', None, 'e'),
    ('impacto_economico', 'Impacto económico', '7.º', '6', 'f'),
]
P18 = {p['n']: p for p in split_paras(A['18.º'])}
criteria = []
for cid, name, art, thr, dal in crit:
    a = C[art]
    assert a['title'] == name, (a['title'], name)
    criteria.append({
        'id': cid, 'name': a['title'], 'ref': 'RTS 2024/1772, art. %s' % art, 'page': a['page'], 'text': a['text'],
        'dora_ref': 'DORA, art. 18.º, n.º 1, alínea %s)' % dal,
        'dora_text': next(l for l in P18['1']['lines'] if l.startswith(dal + ') ')),
        'thresholds_ref': ('RTS 2024/1772, art. 9.º, n.º %s' % thr) if thr else 'RTS 2024/1772, art. 8.º, n.º 1',
        'thresholds_text': P9[thr]['text'] if thr else split_paras(C['8.º'])[0]['text'],
        'mandatory_condition': thr is None,
    })
P8 = {p['n']: p for p in split_paras(C['8.º'])}
major_incident_classification = {
    'rule_ref': 'RTS 2024/1772, art. 8.º, n.º 1',
    'rule_text': P8['1']['text'],
    'recurring_rule_ref': 'RTS 2024/1772, art. 8.º, n.º 2',
    'recurring_rule_text': P8['2']['text'],
    'rule_summary_pt': 'Um incidente é de caráter severo se afetar serviços críticos (art. 6.º) e se for atingido o limiar de perdas de dados do art. 9.º, n.º 5, alínea b), ou dois ou mais dos outros limiares de materialidade do art. 9.º, n.os 1 a 6.',
    'criteria': criteria,
    'significant_cyber_threat_ref': 'RTS 2024/1772, art. 10.º; DORA, art. 18.º, n.º 2',
    'significant_cyber_threat_text': C['10.º']['text'],
    'other_member_states_relevance_ref': 'RTS 2024/1772, art. 11.º',
    'other_member_states_relevance_text': C['11.º']['text'],
    'rts_1772_articles': [{'number': a['number'], 'title': a['title'], 'chapter': a['chapter'], 'page': a['page'], 'text': a['text']} for a in a1772],
}

# ------------------------------------------------------------------ RTS 2024/1774
p1774, a1774 = parse('r1774', 'n')
assert len(a1774) == 42
def norm_sec(s):
    return s.replace('SECÇÃO', 'Secção') if s else s
rts1774 = {
    'articles': [{'number': a['number'], 'title': a['title'], 'titulo': a['titulo'], 'chapter': a['chapter'],
                  'section': norm_sec(a['section']), 'page': a['page'], 'ref': 'RTS 2024/1774, art. %s' % a['number'], 'text': a['text']} for a in a1774],
}
simp = [a for a in a1774 if a['titulo'] and a['titulo'].startswith('TÍTULO III')]
rts1774['title_iii_simplified_heading'] = simp[0]['titulo']
rts1774['title_ii_simplified'] = ['Artigo %s — %s' % (a['number'], a['title']) for a in simp]
rts1774['title_ii_heading'] = next(a['titulo'] for a in a1774 if a['titulo'] and a['titulo'].startswith('TÍTULO II '))
issues.append('RTS 2024/1774: o quadro simplificado de gestão do risco TIC (art. 16.º do DORA) consta do TÍTULO III (arts. 28.º a 41.º), e não do Título II (que respeita ao art. 15.º do DORA). O campo «title_ii_simplified» foi mantido com o nome pedido mas lista os artigos do Título III; o cabeçalho literal está em «title_iii_simplified_heading».')
issues.append('RTS 2024/1774, título oficial: o texto PT publicado diz «no que respeito às normas técnicas de regulamentação» (gralha no original; os outros atos usam «no que respeita»); mantido literal.')

# ------------------------------------------------------------------ ITS 2024/2956
pi, ai = parse('i2956', 'n')
I = {a['number']: a for a in ai}
lst = json.load(open(W('its_list.json')))
layout = open(os.path.join(BASE, 'txt', 'DORA-ITS-2024-2956.txt')).read()
pages = layout.split('\f')
heads = {}
for pn, ptxt in enumerate(pages, start=1):
    for m in re.finditer(r'Instruções de preenchimento do modelo (B_\d\d\.\d\d) — (.+)', ptxt):
        heads[m.group(1)] = ('%d/43' % pn, re.sub(r'\s+', ' ', m.group(2)).strip())
templates = []
for t in lst:
    desc = ' '.join(t['desc'])
    desc = re.sub(r'\s+', ' ', desc).strip()
    templates.append({'code': t['code'], 'name': re.sub(r'\s+', ' ', t['name']).strip(), 'ref': 'ITS 2024/2956, Anexo I, Parte 1 («Lista dos modelos»)',
                      'page': t['page'], 'description': desc,
                      'instructions_heading': heads[t['code']][1], 'instructions_ref': 'ITS 2024/2956, Anexo I, Parte 2',
                      'instructions_page': heads[t['code']][0]})
assert len(templates) == 15 and all(t['code'] in heads for t in lst)
its_articles = []
for a in ai:
    txt = a['text']
    if a['number'] == '7.º':
        txt = txt.split('\nANEXO I')[0]
    its_articles.append({'number': a['number'], 'title': a['title'], 'page': a['page'], 'ref': 'ITS 2024/2956, art. %s' % a['number'], 'text': txt})

# ------------------------------------------------------------------ relações NIS2 / lex specialis
relations = []
for b in dpre:
    m = re.match(r'^\((\d+)\) ', b['text'])
    if m and ('2022/2555' in b['text'] or 'lex specialis' in b['text']):
        relations.append({'ref': 'DORA, considerando (%s)' % m.group(1), 'page': b['page'],
                          'kind': 'lex_specialis' if 'lex specialis' in b['text'] else 'referencia_nis2', 'text': b['text']})
for a in darts:
    if '2022/2555' not in a['text'] and '2022/2555' not in (a['title'] or ''):
        continue
    if a['number'] == '3.º':
        for t, pg in zip(a['paras'], a['ppages']):
            m = re.match(r'^(\d+)\) ', t)
            if m and '2022/2555' in t:
                relations.append({'ref': 'DORA, art. 3.º, ponto %s)' % m.group(1), 'page': pg, 'kind': 'definicao_remissiva', 'text': t})
        continue
    for p in split_paras(a):
        if '2022/2555' in p['text'] or ('2022/2555' in (a['title'] or '') and p is split_paras(a)[0]):
            ref = 'DORA, art. %s%s' % (a['number'], (', n.º ' + p['n']) if p['n'] else '')
            kind = 'ato_setorial' if (a['number'] == '1.º' and p['n'] == '2') else 'cooperacao_autoridades' if a['number'] in ('47.º', '19.º', '22.º', '32.º', '35.º', '42.º', '55.º') else 'referencia_nis2'
            relations.append({'ref': ref, 'article_title': a['title'], 'page': p['page'], 'kind': kind, 'text': p['text']})
# RTS 2025/301 também remete para a NIS2 (exclusão da regra de fim de semana)
relations.append({'ref': 'RTS 2025/301, art. 5.º, n.º 5', 'page': P5['5']['page'], 'kind': 'referencia_nis2', 'text': P5['5']['text']})
rec301 = [b for b in p301 if b['text'].startswith('(1) ')]
if rec301 and '2022/2555' in rec301[0]['text']:
    relations.append({'ref': 'RTS 2025/301, considerando (1)', 'page': rec301[0]['page'], 'kind': 'referencia_nis2', 'text': rec301[0]['text']})
issues.append('DORA, considerando (16): no PDF oficial faltam os pontos finais após «Diretiva (UE) 2022/2555» antes de «Por conseguinte» e de «Ao mesmo tempo» (verificado ao nível dos caracteres do PDF); mantido literal.')

issues.append('DORA, art. 64.º: no PDF não existe cabeçalho de secção após a «Secção II — Alterações» do capítulo IX, pelo que o art. 64.º (Entrada em vigor e aplicação) fica formalmente nessa secção; o campo «section» reflete a estrutura do PDF.')
issues.append('Normalização tipográfica: os ordinais em expoente do PDF foram convertidos para «º»/«ª» (ex.: «artigo 6.º», «n.º») e «n.os» mantido; alguns ordinais aparecem no original com o sinal de grau «°» (ex.: DORA, art. 13.º, n.º 3, «27.°»; art. 16.º, n.º 1, «15.°»; art. 24.º, n.º 2, «26.°») e foram mantidos literalmente.')
issues.append('DORA, arts. 15.º e 20.º: as obrigações associadas aos arts. 15.º e 20.º são disposições habilitantes (normas técnicas das AES), incluídas para cobertura e ligadas aos atos delegados que as concretizam.')
# ------------------------------------------------------------------ instrumentos
def plus20(d):
    return (d + datetime.timedelta(days=20)).isoformat()
def pre_text(pre, start):
    return next(b['text'] for b in pre if b['text'].startswith(start))
def empower(pre):
    t = pre_text(pre, 'Tendo em conta o Regulamento (UE) 2022/2554')
    return t[t.index('nomeadamente'):].rstrip(',')
def full_title(pre):
    return ' '.join(b['text'] for b in pre[:3])
ENTRY = 'O presente regulamento entra em vigor no vigésimo dia seguinte ao da sua publicação no Jornal Oficial da União Europeia.'
for arts in (darts, a1774, a1772, a301, ai):
    assert ENTRY in arts[-1]['text'] or ENTRY in I['7.º']['text']
dtitle_blocks = [b['text'] for b in dpre[3:6]]
instruments = [
    {'id': 'dora', 'short': 'DORA', 'title': ' '.join(dtitle_blocks), 'type': 'regulamento-ue', 'number': '2022/2554',
     'date': '2022-12-14', 'publication': 'JO L 333 de 27.12.2022, p. 1', 'publication_date': '2022-12-27',
     'issuer': 'Parlamento Europeu e Conselho', 'official_url': 'http://data.europa.eu/eli/reg/2022/2554/oj', 'language': 'pt',
     'entry_into_force': ENTRY + ' (calculado: %s)' % plus20(datetime.date(2022, 12, 27)), 'entry_into_force_date': plus20(datetime.date(2022, 12, 27)),
     'date_of_application': 'O presente regulamento é aplicável a partir de 17 de janeiro de 2025.', 'date_of_application_iso': '2025-01-17',
     'effects': ['O presente regulamento é aplicável a partir de 17 de janeiro de 2025.'],
     'revokes': [], 'amends': ['Regulamento (CE) n.º 1060/2009 (art. 59.º)', 'Regulamento (UE) n.º 648/2012 (art. 60.º)', 'Regulamento (UE) n.º 909/2014 (art. 61.º)', 'Regulamento (UE) n.º 600/2014 (art. 62.º)', 'Regulamento (UE) 2016/1011 (art. 63.º)'],
     'transposes': [], 'regulates': [], 'related_acts': ['Diretiva (UE) 2022/2556 (diretiva complementar referida no considerando (102))'],
     'ref': 'DORA, art. 64.º', 'page_count': 79, 'pages_oj': 'L 333/1 a L 333/79'},
]
for iid, short, pre, typ, num, date, pubd, eli, pc, arts in [
    ('rts2024_1774', 'RTS 2024/1774', p1774, 'regulamento-delegado-ue', '2024/1774', '2024-03-13', datetime.date(2024, 6, 25), 'http://data.europa.eu/eli/reg_del/2024/1774/oj', 37, a1774),
    ('rts2024_1772', 'RTS 2024/1772', p1772, 'regulamento-delegado-ue', '2024/1772', '2024-03-13', datetime.date(2024, 6, 25), 'http://data.europa.eu/eli/reg_del/2024/1772/oj', 9, a1772),
    ('rts2025_301', 'RTS 2025/301', p301, 'regulamento-delegado-ue', '2025/301', '2024-10-23', datetime.date(2025, 2, 20), 'http://data.europa.eu/eli/reg_del/2025/301/oj', 5, a301),
    ('its2024_2956', 'ITS 2024/2956', pi, 'regulamento-execucao-ue', '2024/2956', '2024-11-29', datetime.date(2024, 12, 2), 'http://data.europa.eu/eli/reg_impl/2024/2956/oj', 43, ai)]:
    last = [a for a in arts if a['title'] == 'Entrada em vigor'][0]
    emp = empower(pre)
    regs = {'rts2024_1774': ['DORA, art. 15.º, quarto parágrafo', 'DORA, art. 16.º, n.º 3, quarto parágrafo'],
            'rts2024_1772': ['DORA, art. 18.º, n.º 4, terceiro parágrafo'],
            'rts2025_301': ['DORA, art. 20.º, terceiro parágrafo'],
            'its2024_2956': ['DORA, art. 28.º, n.º 9, segundo parágrafo']}[iid]
    instruments.append({
        'id': iid, 'short': short, 'title': full_title(pre), 'type': typ, 'number': num, 'date': date,
        'publication': 'JO L, %s, %s' % (num, '%d.%d.%d' % (pubd.day, pubd.month, pubd.year)), 'publication_date': pubd.isoformat(),
        'issuer': 'Comissão Europeia', 'official_url': eli, 'language': 'pt',
        'entry_into_force': ENTRY + ' (calculado: %s)' % plus20(pubd), 'entry_into_force_date': plus20(pubd),
        'date_of_application': None, 'effects': [], 'revokes': [], 'amends': [], 'transposes': [],
        'supplements': 'DORA', 'regulates': regs, 'empowerment_text': 'Tendo em conta o Regulamento (UE) 2022/2554 [...], ' + emp,
        'ref': '%s, art. %s' % (short, last['number']), 'page_count': pc})
    assert all(r.split(', ', 1)[1].split(' ', 1)[1].split(',')[0] in emp for r in regs), (iid, emp)

out = {
    'meta': {'generated': datetime.date.today().isoformat(), 'sources': ['CELEX_32022R2554_PT_TXT.pdf', 'OJ_L_202401774_PT_TXT.pdf', 'OJ_L_202401772_PT_TXT.pdf', 'OJ_L_202500301_PT_TXT.pdf', 'OJ_L_202402956_PT_TXT.pdf'],
             'notes': 'Textos literais extraídos dos PDF oficiais (EUR-Lex/JO, versão PT). Cabeçalhos/rodapés e notas de rodapé do JO removidos; marcadores de nota de rodapé removidos do corpo. Páginas: DORA com a paginação do JO («L 333/N»); restantes atos com a paginação «N/M» impressa no rodapé.'},
    'instruments': instruments,
    'dora_articles': dora_articles,
    'dora_scope': dora_scope,
    'obligations': obligations,
    'incident_reporting': incident_reporting,
    'major_incident_classification': major_incident_classification,
    'rts_1774': rts1774,
    'its_2956_articles': its_articles,
    'its_2956_templates': templates,
    'relations': relations,
    'issues': issues,
}
os.makedirs(os.path.join(BASE, 'data'), exist_ok=True)
json.dump(out, open(os.path.join(BASE, 'data', 'dora.json'), 'w'), ensure_ascii=False, indent=2)
print('ok', len(dora_articles), len(obligations), len(relations), len(templates), len(rts1774['articles']))
