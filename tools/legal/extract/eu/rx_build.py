import sys, json, re
sys.path.insert(0, '.')
exec(open('rx_pages.py').read())
from parse_articles import parse_articles, indent
flat = flatten(pages, 1, 34)
k = [i for i,(p,l) in enumerate(flat) if 'ADOTOU O PRESENTE REGULAMENTO' in l][0]
ka = [i for i,(p,l) in enumerate(flat) if l.strip() == 'ANEXO'][0]
arts = parse_articles(flat[k+1:ka], stop_re=r'^\s*O presente regulamento é obrigatório em todos')
for a in arts: a['oj_page'] = OJ[a['page']]
# annex
ann = flat[ka+1:]
items = []  # each: id, level, page, lines
cur = None
def valid_next(prev_ids, cand):
    return True
for pg, l in ann:
    if l == PB:
        if cur: cur['lines'].append(l)
        continue
    m = re.match(r'^(\s*)(\d+(?:\.\d+)*)\.\s+(\S.*)$', l)
    if m and len(m.group(1)) <= 9:
        cur = {'id': m.group(2), 'page': str(pg), 'lines': [' ' * 15 + m.group(3)]}
        items.append(cur); continue
    if cur is None:
        # annex subtitle
        if l.strip(): items.append({'id': None, 'page': str(pg), 'lines': [l]})
        continue
    cur['lines'].append(l)
for it in items:
    ps = paragraphs(it['lines'])
    it['paragraphs'] = [join_lines(p) for p in ps]
json.dump({'arts': arts, 'annex': items}, open('rx.tmp.json', 'w'), ensure_ascii=False, indent=1)
for a in arts: print(a['number'], a['page'], a['oj_page'], '|', a['title'], len(a['paragraphs']))
ids = [it['id'] for it in items]
print(len(ids), ids[:5])
# gap check
def key(i): return tuple(int(x) for x in i.split('.'))
prev = None
for it in items:
    i = it['id']
    if i is None: print('NOID', it['paragraphs']); continue
    t = key(i)
    if prev is not None:
        ok = False
        # child
        if t == prev + (1,): ok = True
        # sibling or ancestor sibling
        for d in range(len(prev), 0, -1):
            if t == prev[:d-1] + (prev[d-1] + 1,): ok = True
        if not ok: print('GAP/ORDER', '.'.join(map(str, prev)), '->', i, it['paragraphs'][0][:80])
    prev = t
