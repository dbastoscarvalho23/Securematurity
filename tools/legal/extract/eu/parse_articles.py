import re
from eulib import *

def indent(l):
    return len(l) - len(l.lstrip())

def parse_articles(flat, stop_re=r'^\s*Feito em ', heading_indent=20):
    """flat: list of (page, line). Returns list of articles"""
    arts = []
    chapter = None; chap_title = []; section = None
    i = 0
    cur = None
    mode = None
    n = len(flat)
    while i < n:
        pg, l = flat[i]
        st = l.strip()
        if l != PB and re.match(stop_re, l):
            break
        if l != PB and indent(l) >= heading_indent and re.match(r'^CAPÍTULO [IVXL]+$', st):
            chapter = st; chap_title = []; mode = 'chap'
            if cur: arts.append(cur); cur = None
            i += 1; continue
        if l != PB and indent(l) >= heading_indent and re.match(r'^SECÇÃO [IVXL\d]+$', st):
            section = st; mode = 'sec'
            if cur: arts.append(cur); cur = None
            i += 1; continue
        m = re.match(r'^Artigo (\d+)\.\s*[o°º]$', st) if l != PB else None
        if m and indent(l) >= heading_indent:
            if cur: arts.append(cur)
            cur = {'number': m.group(1) + '.º', 'title_lines': [], 'chapter': chapter, 'chapter_title': ' '.join(chap_title) if chapter else None,
                   'page': str(pg), 'body': []}
            mode = 'title'
            i += 1; continue
        if mode == 'chap':
            if l != PB and st:
                chap_title.append(st)
            i += 1; continue
        if mode == 'title':
            if l == PB or not st:
                if cur['title_lines'] and l != PB:
                    # blank after title: maybe more title lines? check next nonblank
                    j = i + 1
                    while j < n and (flat[j][1] == PB or not flat[j][1].strip()): j += 1
                    if j < n and indent(flat[j][1]) >= heading_indent and not MARKER.match(flat[j][1].strip()) and not re.match(r'^(Artigo|CAPÍTULO)', flat[j][1].strip()):
                        # centered continuation of title? only if title doesn't look complete -- accept
                        pass
                    mode = 'body'
                i += 1; continue
            if (indent(l) >= 10 or not cur['title_lines']) and not MARKER.match(st):
                cur['title_lines'].append(st); i += 1; continue
            mode = 'body'
        if mode == 'body' and cur is not None:
            cur['body'].append(l)
            if l != PB and l.strip(): cur.setdefault('_pages', []).append(pg)
        i += 1
    if cur: arts.append(cur)
    for a in arts:
        a['title'] = join_lines(a.pop('title_lines'))
        paras = paragraphs(a['body'])
        a['paragraphs'] = [join_lines(p) for p in paras]
        a['text'] = '\n'.join(a['paragraphs'])
        a['_raw'] = a.pop('body')
    return arts
