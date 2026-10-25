import re

SHY = '­'
PB = '<<PB>>'

def ordinals(s):
    # superscript ordinals rendered by pdftotext as ".o"/".os" ; degree sign used as ordinal
    s = re.sub(r'\b([nN])\.\s?[o°](s?)(?!\w)', lambda m: m.group(1) + '.º' + m.group(2), s)
    s = re.sub(r'(\d)\.[o°](s?)(?!\w)', lambda m: m.group(1) + '.º' + m.group(2), s)
    s = re.sub(r'(\d)\.°', r'\1.º', s)
    s = re.sub(r'(\d)\.a\b', r'\1.ª', s)
    return s

MARKER = re.compile(r'^(\d+\.(\d+\.)*\s|\d+\)\s|[a-z]\)\s|\([a-z]{1,4}\)\s|[ivx]+\)\s|\(\d+\)\s|—\s|-\s)')

def join_lines(lines):
    """join wrapped lines of one paragraph"""
    out = ''
    for l in lines:
        if l == PB:
            continue
        l = l.strip()
        if not l:
            continue
        if not out:
            out = l
        elif (out.endswith('-') and l.startswith('-')) or (out.endswith('/') and l.startswith('/')):
            out = out + l[1:]
        elif out.endswith(SHY):
            out = out[:-1] + l
        elif re.search(r'\w-$', out) and l[:1].isalpha():
            out = out + l
        elif re.search(r'\d/$', out):
            out = out + l
        else:
            out = out + ' ' + l
    out = out.replace(SHY, '')
    out = re.sub(r'(?<=\S) {2,}', ' ', out)
    return ordinals(out)

def paragraphs(lines, ends_ok=r'[.;:]$|\b(e|ou)$'):
    """lines: raw lines ('' blank, PB page break). New paragraph after a blank line, at a marker line
    when the previous line ends an item, or at a page break when previous ends a sentence."""
    paras = []
    cur = []
    state = 'blank'
    for l in lines:
        if l == PB:
            if state != 'blank':
                state = 'pb'
            continue
        if not l.strip():
            state = 'blank'
            continue
        st = l.strip()
        newp = False
        prev = cur[-1].strip() if cur else ''
        if state == 'blank' or not cur:
            newp = True
        elif state == 'pb':
            if re.search(r'[.;:]$', prev) and (st[:1].isupper() or MARKER.match(st) or st[:1] in '«"('):
                newp = True
        elif MARKER.match(st) and (re.search(ends_ok, prev) or (prev.endswith(',') and re.match(r'^(\(?[ivx]+\)|—)\s', st))):
            newp = True
        if newp and cur:
            paras.append(cur)
            cur = []
        cur.append(l)
        state = 'text'
    if cur:
        paras.append(cur)
    return paras

def load_pages(path, header_res, footnote_start=1, landscape_pages=()):
    """returns pages: list of dicts {n, oj, lines, footnotes:{num:text}}"""
    raw = open(path, encoding='utf-8').read().split('\f')
    pages = []
    fn = footnote_start
    for i, pg in enumerate(raw, 1):
        lines = pg.split('\n')
        oj = None
        body = []
        for l in lines:
            hit = False
            for hr in header_res:
                m = re.match(hr, l)
                if m:
                    hit = True
                    if m.groupdict().get('oj'):
                        oj = m.group('oj')
                    break
            if not hit:
                body.append(l.rstrip())
        # orphan superscript 'o' lines (ordinal indicator split onto its own line)
        fixed = []
        for l in body:
            if re.match(r'^\s*o(\s+o)*\s*$', l) and fixed:
                kk = len(l.split())
                j = len(fixed) - 1
                while j >= 0 and not fixed[j].strip():
                    j -= 1
                new, c = re.subn(r'(\bn|\d)\.(?= \d| ,)', r'\1.º', fixed[j], count=kk)
                if c:
                    fixed[j] = new.replace('.º ,', '.º,')
                    continue
            fixed.append(l)
        body = fixed
        footnotes = {}
        if i not in landscape_pages:
            for k, l in enumerate(body):
                m = re.match(r'^ {3,8}\((\d+)\) \S', l)
                if m and int(m.group(1)) == fn:
                    fl = body[k:]
                    body = body[:k]
                    cur = None
                    for x in fl:
                        mm = re.match(r'^ {3,8}\((\d+)\) (.*)', x)
                        if mm and int(mm.group(1)) == fn:
                            cur = fn
                            footnotes[cur] = [mm.group(2)]
                            fn += 1
                        elif x.strip():
                            footnotes[cur].append(x)
                    footnotes = {kk: join_lines(v) for kk, v in footnotes.items()}
                    break
        while body and not body[-1].strip():
            body.pop()
        while body and not body[0].strip():
            body.pop(0)
        pages.append({'n': i, 'oj': oj, 'lines': body, 'footnotes': footnotes})
    return pages, fn

def flatten(pages, start_page=1, end_page=10**6):
    out = []  # (page, line)
    for p in pages:
        if p['n'] < start_page or p['n'] > end_page:
            continue
        if out:
            out.append((p['n'], PB))
        for l in p['lines']:
            out.append((p['n'], l))
    return out
