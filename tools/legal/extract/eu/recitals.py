import re
from eulib import *
def parse_recitals(flat, start_re, end_re):
    out = []; cur = None; on = False; nxt = 1
    for pg, l in flat:
        if not on:
            if re.search(start_re, l): on = True
            continue
        if l != PB and re.search(end_re, l): break
        m = re.match(r'^ {3,8}\((\d+)\)\s+\S', l) if l != PB else None
        if m and int(m.group(1)) == nxt:
            if cur: out.append(cur)
            cur = {'n': nxt, 'page': str(pg), 'lines': [re.sub(r'^\s*\(\d+\)\s+', '            ', l, 1)]}
            nxt += 1
            continue
        if cur: cur['lines'].append(l)
    if cur: out.append(cur)
    for r in out:
        r['text'] = '\n'.join(join_lines(p) for p in paragraphs(r.pop('lines')))
    return out
