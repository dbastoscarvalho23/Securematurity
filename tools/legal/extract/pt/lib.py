import json, re, collections

MARK = re.compile(r'^(\d+\.(?:\d+\.)*\s|\d+[a-z]?\)\s|[a-z]{1,2}\)\s|[ivxl]+\)\s|\(\d+\)\s|[—–•-]\s)')
CLITICS = {'se','lo','la','los','las','lhe','lhes','o','a','os','as','nos','vos','me','te','no','na','ne'}
FNREF = re.compile(r'\s?\((?:⁣\d)+\)')

def clean_inline(s):
    s = FNREF.sub('', s)
    s = re.sub(r'⁣\d', '', s)
    s = s.replace('⁣', '')
    s = s.replace('\xad', '')
    s = s.replace('ºs', 'os').replace('ªs', 'as')
    s = re.sub(r'[ \t]+', ' ', s)
    return s.strip()

def page_label(pg, kind):
    for l in pg['lines']:
        if l['zone'] != 'hf':
            continue
        t = l['t']
        if kind == 'oj_old':
            m = re.search(r'L 333/(\d+)', t)
            if m:
                return 'L 333/' + m.group(1)
        else:
            m = re.search(r'(?:^|\s)(\d+/\d+)(?:\s|$)', t)
            if m and 'ELI' in t:
                return m.group(1)
    return str(pg['i'])

def load(name, kind):
    pages = json.load(open(name))
    vocab = collections.Counter()
    for pg in pages:
        for l in pg['lines']:
            for w in re.findall(r"[\wÀ-ÿ]+(?:-[\wÀ-ÿ]+)*", l['t'][:-1] if l['t'].endswith('-') else l['t']):
                vocab[w.lower()] += 1
    out = []
    for pg in pages:
        lab = page_label(pg, kind)
        for l in pg['lines']:
            if l['zone'] != 'body':
                continue
            l = dict(l)
            l['page'] = lab
            l['pi'] = pg['i']
            l['t'] = l['t'].replace('⁣', '⁣')
            out.append(l)
    return out, vocab

def join_hyphen(a, b, vocab):
    # a ends with '-'
    left = re.search(r'([\wÀ-ÿ-]+)-$', a)
    right = re.match(r'([\wÀ-ÿ]+)', b)
    if not left or not right:
        return a + b
    L, R = left.group(1), right.group(1)
    if R[0].isupper() or R.isdigit() or L[-1:].isdigit():
        return a + b
    if R.lower() in CLITICS:
        return a + b
    hy = (L + '-' + R).lower()
    joined = (L.split('-')[-1] + R).lower()
    if vocab.get(hy, 0) > 0 and vocab.get(joined, 0) == 0:
        return a + b
    return a[:-1] + b

def is_heading(l):
    return l['b'] > 0.6 or (l['it'] > 0.6 and l['x0'] > 120) or (l['size'] < 9.2 and l['x0'] > 150)

def blocks(lines, vocab):
    """Group lines into blocks (paragraphs/items/headings)."""
    res = []
    cur = None
    prev = None
    for l in lines:
        t = l['t']
        head = is_heading(l) or re.match(r'^(S\s?e\s?c\s?ç|SECÇÃO|CAP[IÍ]TULO|T[IÍ]TULO|Artigo \d)', t.strip()) and l['x0'] > 100
        new = True
        if cur is not None and prev is not None and not head and not cur['head']:
            if prev['pi'] == l['pi']:
                gap = l['top'] - prev['bot']
                new = gap > 3.5 or bool(MARK.match(t))
            else:
                pt = cur['text'].rstrip()
                new = bool(MARK.match(t)) or (pt[-1:] in '.:;' and t[:1].isupper())
        elif cur is not None and head and cur['head'] and prev is not None and prev['pi'] == l['pi'] and (l['top'] - prev['bot']) < 3.5 and not re.match(r'^(Artigo|CAP|Sec|S e|SEC|T[IÍ]T)', t.strip()) and not re.match(r'^(Artigo|CAP|Sec|S e|SEC|T[IÍ]T)', cur['text']):
            new = False  # multi-line heading
        if new:
            cur = {'text': t, 'page': l['page'], 'pi': l['pi'], 'head': bool(head), 'x0': l['x0'], 'b': l['b'], 'it': l['it'], 'size': l['size']}
            res.append(cur)
        else:
            ct = cur['text'].rstrip()
            if ct.endswith('\xad'):
                cur['text'] = ct[:-1] + t
            elif ct.endswith('-') and t.startswith('-'):
                cur['text'] = ct + t[1:]
            elif ct.endswith('-'):
                cur['text'] = join_hyphen(ct, t, vocab)
            else:
                cur['text'] = cur['text'] + ' ' + t
        prev = l
    for b in res:
        b['text'] = clean_inline(b['text'])
    return [b for b in res if b['text'] and not re.fullmatch(r'[º\d\s]*', b['text'])]

def structure(bl):
    """Parse blocks into articles with chapter/section context."""
    arts = []
    pre = []
    ctx = {'title': None, 'chapter': None, 'section': None}
    i = 0
    cur = None
    pending = None
    while i < len(bl):
        b = bl[i]
        t = b['text']
        m = re.match(r'^(T[IÍ]TULO [IVX]+)$', t)
        mc = re.match(r'^(CAP[IÍ]TULO [IVX]+)$', t)
        ms = re.match(r'^(S\s?e\s?c\s?ç\s?ã\s?o|SECÇÃO)\s+([IVX\d]+)$', t)
        ma = re.match(r'^Artigo (\d+\.º(?:-[A-Z])?)$', t)
        if (m or mc or ms) and b['head']:
            nxt = bl[i + 1] if i + 1 < len(bl) else None
            ttl = None
            if nxt and nxt['head'] and not re.match(r'^(Artigo|CAP|T[IÍ]T|S\s?e\s?c|SEC)', nxt['text']):
                ttl = nxt['text']
                i += 1
            if m:
                ctx['title'] = m.group(1).replace('TITULO', 'TÍTULO') + (' — ' + ttl if ttl else '')
                ctx['chapter'] = None; ctx['section'] = None
            elif mc:
                ctx['chapter'] = mc.group(1).replace('CAPITULO', 'CAPÍTULO') + (' — ' + ttl if ttl else '')
                ctx['section'] = None
            else:
                ctx['section'] = 'Secção ' + ms.group(2) + (' — ' + ttl if ttl else '')
            cur = None
            i += 1
            continue
        if ma and b['head']:
            nxt = bl[i + 1] if i + 1 < len(bl) else None
            ttl = None
            if nxt and nxt['head'] and nxt['b'] > 0.6:
                ttl = nxt['text']
                i += 1
            cur = {'number': ma.group(1), 'title': ttl, 'titulo': ctx['title'], 'chapter': ctx['chapter'], 'section': ctx['section'], 'page': b['page'], 'pages': [b['page']], 'paras': []}
            arts.append(cur)
            i += 1
            continue
        if cur is None:
            pre.append(b)
        else:
            cur['paras'].append(b['text'])
            cur.setdefault('ppages', []).append(b['page'])
            if b['page'] not in cur['pages']:
                cur['pages'].append(b['page'])
        i += 1
    for a in arts:
        a['text'] = '\n'.join(a['paras'])
    return pre, arts
