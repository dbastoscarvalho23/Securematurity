import re, collections
from eulib import *
JUNK = re.compile(r'^(PT|Jornal Oficial da União Europeia|L 333/\d+|27\.12\.2022)$')
def segs(line):
    line = re.sub(r'(?<=\S) — ', '  — ', line)
    out = []
    for m in re.finditer(r'\S+(?: \S+)*', line):
        out.append([m.start(), m.group()])
    # merge "1." with following
    res = []
    for s in out:
        if res and re.match(r'^\d+\.$', res[-1][1]):
            res[-1][1] += ' ' + s[1]
        else:
            res.append(s)
    return res

def parse_annexes(raw_pages):
    """raw_pages: list of (n, text lines). returns dict annex_id -> {title, rows, footnotes}"""
    annexes = collections.OrderedDict(); cur = None
    for n, lines in raw_pages:
        body = []
        for l in lines:
            st = l.strip()
            if not st or JUNK.match(st): continue
            m = re.match(r'^ANEXO (I+)$', st)
            if m:
                cur = {'id': m.group(1), 'title': None, 'setores': [], 'rows': [], 'footnotes': {}, 'pages': [], '_fn': None}
                annexes[cur['id']] = cur; continue
            if cur is None: continue
            if cur['title'] is None and st.isupper():
                cur['title'] = st; continue
            if re.match(r'^Setor\s+Subsetor\s+Tipo de entidade$', st): continue
            body.append((n, l))
        if cur is None or not body: continue
        cur['pages'].append(n)
        data = []
        for pg, l in body:
            m = re.match(r'^\((\d+)\) (.*)$', l)
            if m or (cur['_fn'] is not None and re.match(r'^ {3,6}\S', l)):
                if m:
                    cur['_fn'] = int(m.group(1)); cur['footnotes'][cur['_fn']] = [m.group(2)]
                else:
                    cur['footnotes'][cur['_fn']].append(l)
                continue
            data.append(l)
        allsegs = [segs(l) for l in data]
        subcols = [s[0] for ss in allsegs for s in ss if re.match(r'^[a-z]\) ', s[1])]
        S_sub = min(subcols) if subcols else None
        cnt = collections.Counter(s[0] for ss in allsegs for s in ss if s[0] > 20 and not re.match(r'^[a-z]\) ', s[1]))
        if not cnt: continue
        S_tipo = min(c for c, k in cnt.items() if k >= max(cnt.values()) * 0.5)
        dash = [s[0] for ss in allsegs for s in ss if s[1].startswith('—')]
        if dash: S_tipo = min(S_tipo, min(dash))
        for ss in allsegs:
            for col, txt in ss:
                if col >= S_tipo - 3 and not (S_sub is not None and abs(col - S_sub) <= 3 and re.match(r'^[a-z]\) ', txt)):
                    kind = 'tipo'
                elif S_sub is not None and col >= S_sub - 1:
                    kind = 'sub'
                else:
                    kind = 'setor'
                if kind == 'setor':
                    if re.match(r'^\d+\. ', txt):
                        cur['setores'].append({'name': [txt], 'subs': []}); cur['_cursub'] = None; cur['_lastrow'] = None
                    else:
                        cur['setores'][-1]['name'].append(txt)
                elif kind == 'sub':
                    st = cur['setores'][-1]
                    if re.match(r'^[a-z]\) ', txt):
                        sub = {'name': [txt]}; st['subs'].append(sub); cur['_cursub'] = sub; cur['_lastrow'] = None
                    else:
                        cur['_cursub']['name'].append(txt)
                else:
                    if txt.startswith('— ') or cur['_lastrow'] is None:
                        row = {'setor': cur['setores'][-1], 'sub': cur['_cursub'], 'tipo': [txt]}
                        cur['rows'].append(row); cur['_lastrow'] = row
                    else:
                        cur['_lastrow']['tipo'].append(txt)
    out = []
    for a in annexes.values():
        rows = []
        for r in a['rows']:
            setor = join_lines(r['setor']['name'])
            m = re.match(r'^(\d+)\. (.*)$', setor)
            sub = join_lines(r['sub']['name']) if r['sub'] else None
            sm = re.match(r'^([a-z])\) (.*)$', sub) if sub else None
            tipo = join_lines(r['tipo'])
            dashed = tipo.startswith('— ')
            rows.append({'setor_n': m.group(1), 'setor': m.group(2), 'subsetor_letra': sm.group(1) if sm else None,
                         'subsetor': sm.group(2) if sm else None, 'tipo_entidade': tipo[2:] if dashed else tipo})
        out.append({'id': a['id'], 'title': a['title'], 'pages': [str(p) for p in a['pages']], 'rows': rows,
                    'footnotes': {str(k): join_lines(v) for k, v in a['footnotes'].items()}})
    return out
