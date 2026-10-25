"""Extrai o QNRCS (Anexo I do Regulamento n.º 756/2026) a partir do texto oficial (pdftotext -layout)."""
import json, re, sys

SRC, OUT = sys.argv[1], sys.argv[2]
lines = open(SRC, encoding='utf-8').read().split('\n')

start = next(i for i, l in enumerate(lines) if l.strip() == 'ANEXO I')
end = next(i for i, l in enumerate(lines) if l.strip() == 'ANEXO II')
body = lines[start:end]

NOISE = [
    re.compile(r'^\d+/89$'), re.compile(r'^2\.ª série$'), re.compile(r'^N\.º 118$'),
    re.compile(r'^22-06-2026$'), re.compile(r'^Regulamento n\.º 756/2026$'),
]
page = None
clean = []  # (text, page)
for raw in body:
    s = raw.strip()
    m = re.match(r'^(\d+)/89$', s)
    if m:
        page = int(m.group(1))
        continue
    if any(p.match(s) for p in NOISE):
        continue
    # "GR. SP-1" -> "GR.SP-1"; "PR. AA-03" -> "PR.AA-03"
    s = re.sub(r'\b([A-Z]{2})\. ([A-Z]{2})\b', r'\1.\2', s)
    # Um controlo que começa a meio de uma linha (ex.: depois das referências do anterior)
    parts = re.split(r'\s+(?=(?:GR|ID|PR|DE|RS|RC)\.[A-Z]{2}-\d+ ?[—-] )', s)
    # Várias referências na mesma linha
    expanded = []
    for part in parts:
        expanded.extend(re.split(r'\s+(?=(?:ISO/IEC 2700[12]:2022|NIST SP-? ?800-53|NIST CSF 2\.0|CIS CSC v8\.1|CyFun 2025)\b)', part))
    for part in expanded:
        clean.append((part, page))

def join(parts):
    text = ''
    for p in parts:
        if not p:
            continue
        if text.endswith('-') and not text.endswith(' -') and p[:1].islower():
            text = text[:-1] + p
        else:
            text = (text + ' ' + p) if text else p
    return re.sub(r'\s+', ' ', text).strip()

OBJ_RE = re.compile(r'^(\d+) — (Gerir|Identificar|Proteger|Detetar|Responder|Recuperar):?$')
CAT_RE = re.compile(r'^(\d+\.\d+) ?[—-] ?([A-Z]{2}\.[A-Z]{2}) ?[—-]? ?(.+?):?$')
CTL_RE = re.compile(r'^([A-Z]{2}\.[A-Z]{2})-(\d+) ?[—-]? ?(.+)$')
REF_RE = re.compile(r'^(ISO/IEC 2700[12]:2022|NIST SP-? ?800-53 Rev\. ?5|NIST CSF 2\.0|CIS CSC v8\.1|CyFun 2025)\s*[—-]?\s*(.*)$')

OBJ_CODES = {'Gerir': 'GR', 'Identificar': 'ID', 'Proteger': 'PR', 'Detetar': 'DE', 'Responder': 'RS', 'Recuperar': 'RC'}

objectives, intro = [], []
obj = cat = ctl = None
mode = None  # 'intro' | 'objdesc' | 'catdesc' | 'stmt' | 'desc' | 'refs'
buf = []
issues = []

def flush():
    global buf
    text = join(buf)
    buf = []
    if not text:
        return
    if mode == 'intro':
        intro.append(text)
    elif mode == 'objdesc':
        obj['description'] = (obj.get('description', '') + ' ' + text).strip()
    elif mode == 'catdesc':
        cat['description'] = (cat.get('description', '') + ' ' + text).strip()
    elif mode == 'stmt':
        ctl['statement'] = (ctl['statement'] + ' ' + text).strip()
    elif mode == 'desc':
        ctl['description'] = (ctl.get('description', '') + ' ' + text).strip()

def add_ref(line):
    m = REF_RE.match(line)
    if not m:
        if ctl['references']:
            ctl['references'][-1]['raw'] += ' ' + line
        else:
            issues.append(f"{ctl['id']}: referência não reconhecida: {line}")
        return
    ctl['references'].append({'framework': m.group(1), 'raw': line})

mode = 'intro'
for s, pg in clean:
    if s == 'ANEXO I':
        continue
    mo, mc, mt = OBJ_RE.match(s), CAT_RE.match(s), CTL_RE.match(s)
    if mo:
        flush()
        obj = {'number': int(mo.group(1)), 'name': mo.group(2), 'code': OBJ_CODES[mo.group(2)], 'page': pg, 'categories': []}
        objectives.append(obj); cat = ctl = None; mode = 'objdesc'; continue
    if mc and obj is not None and mc.group(2)[:2] == obj['code']:
        flush()
        cat = {'number': mc.group(1), 'id': mc.group(2), 'name': mc.group(3).strip(' :'), 'page': pg, 'controls': []}
        obj['categories'].append(cat); ctl = None; mode = 'catdesc'; continue
    if mt and cat is not None and mt.group(1) == cat['id']:
        flush()
        ctl = {'id': f"{mt.group(1)}-{mt.group(2)}", 'statement': mt.group(3).strip(), 'page': pg, 'references': []}
        cat['controls'].append(ctl); mode = 'stmt'; continue
    if s == 'Descrição' and ctl is not None:
        flush(); mode = 'desc'; continue
    if s == 'Referências' and ctl is not None:
        flush(); mode = 'refs'; continue
    if mode == 'refs':
        if s:
            add_ref(s)
        continue
    if not s:
        if mode in ('stmt',):
            flush(); mode = 'stmt_done'
        else:
            buf.append('')  # paragraph break kept as space
        continue
    if mode == 'stmt_done':
        # texto depois do enunciado e antes de "Descrição" (raro) — tratar como descrição
        mode = 'desc'
    buf.append(s)
flush()

# Normalizar referências: separar identificadores
def split_ids(fw, raw):
    rest = re.sub(r'^' + re.escape(fw), '', raw)
    rest = re.sub(r'^(\s*[—-]\s*)', '', rest).strip()
    rest = rest.replace('Rev.5', '').strip()
    ids = [x.strip(' .;') for x in re.split(r',\s*', rest) if x.strip(' .;')]
    return ids

def dehyphen(t):
    return re.sub(r'([a-zà-úç])- ([a-zà-úç])', r'\1\2', t)

ID_PATTERNS = {
    'nist_csf2': re.compile(r'^[A-Z]{2}\.[A-Z]{2}-\d{2}$'),
    'cyfun2025': re.compile(r'^[A-Z]{2}\.[A-Z]{2}-\d{2}$'),
    'cis81': re.compile(r'^\d{1,2}(\.\d{1,2})?$'),
    'nist80053': re.compile(r'^[A-Z]{2}-\d{1,2}(\(\d+\))?$'),
}

FW_KEY = {'ISO/IEC 27001:2022': 'iso27001', 'ISO/IEC 27002:2022': 'iso27002', 'NIST CSF 2.0': 'nist_csf2', 'CIS CSC v8.1': 'cis81', 'CyFun 2025': 'cyfun2025'}
count = 0
corrections = []
for o in objectives:
    for c in o['categories']:
        for k in c['controls']:
            count += 1
            refs = {}
            for r in k['references']:
                fw = r['framework']
                key = FW_KEY.get(fw) or ('nist80053' if fw.startswith('NIST SP') else fw)
                raw = re.sub(r'\s+', ' ', r['raw'])
                if key == 'nist80053':
                    rest = re.sub(r'^NIST SP-? ?800-53 Rev\. ?5\s*[—-]?\s*', '', raw)
                    ids = [re.sub(r'\s*[—-]\s*', '-', x.strip()).replace(' ', '') for x in re.split(r',\s*', rest) if x.strip()]
                else:
                    ids = split_ids(fw, raw)
                if key == 'cis81':
                    ids = [i.lstrip('-').strip() for i in ids]
                if key in ('nist_csf2', 'cyfun2025'):
                    ids = [i.lstrip('-—').strip() for i in ids]
                if key in ('iso27001', 'iso27002'):
                    rest = re.sub(r'^ISO/IEC 2700[12]:2022\s*[—-]?\s*', '', raw)
                    ids = re.findall(r'Anexo A(?: \(27002\))?|\d+(?:\.\d+)*', rest)
                if key == 'cis81':
                    ids = [x for i in ids for x in re.split(r'[,\s]+', i) if x]
                # Gralhas evidentes no texto oficial (corrigidas e registadas em "corrections")
                CORR = {
                    ('nist80053', 'AT-2eAT-3'): ['AT-2', 'AT-3'],
                    ('nist80053', '2(2)'): ['CP-2(2)'],
                    ('nist_csf2', 'GR.OV-3'): ['GV.OV-03'],
                    ('cyfun2025', 'PR-AT-02'): ['PR.AT-02'],
                    ('cyfun2025', 'PR.PS01'): ['PR.PS-01'],
                    ('cyfun2025', 'DE.AE- 06'): ['DE.AE-06'],
                    ('nist_csf2', 'RS.M1-01'): ['RS.MI-01'],
                    ('cyfun2025', 'RS.M1-01'): ['RS.MI-01'],
                }
                ids2 = []
                for i in ids:
                    if (key, i) in CORR:
                        corrections.append({'control': k['id'], 'framework': key, 'official_text': raw, 'as_printed': i, 'corrected_to': CORR[(key, i)]})
                        ids2.extend(CORR[(key, i)])
                    else:
                        ids2.append(i)
                ids = ids2
                fixed = []
                for i in ids:
                    pat = ID_PATTERNS.get(key)
                    if pat and not pat.match(i):
                        cand = re.sub(r'-O(\d)$', r'-0\1', i)            # letra O em vez de zero
                        cand = re.sub(r'-(\d)$', r'-0\1', cand) if key in ('nist_csf2', 'cyfun2025') else cand
                        if pat.match(cand):
                            corrections.append({'control': k['id'], 'framework': key, 'official_text': raw, 'as_printed': i, 'corrected_to': [cand]})
                            i = cand
                        else:
                            issues.append(f"{k['id']}: referência {key} '{i}' não reconhecida (texto oficial: {raw})")
                    fixed.append(i)
                refs.setdefault(key, []).extend(fixed)
            k['references'] = refs
            k['references_raw'] = [re.sub(r'\s+', ' ', r['raw']) for r in k_raw] if (k_raw := k.get('_raw')) else None
            k.pop('references_raw', None)
            k['statement'] = dehyphen(k['statement'])
            if 'description' in k:
                k['description'] = dehyphen(k['description'])
            if 'description' not in k:
                issues.append(f"{k['id']}: sem descrição")

json.dump({'source': 'Regulamento n.º 756/2026, Anexo I', 'intro': intro, 'objectives': objectives, 'reference_corrections': corrections, 'issues': issues},
          open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print('objetivos', len(objectives), 'categorias', sum(len(o['categories']) for o in objectives), 'controlos', count)
for o in objectives:
    print(o['code'], o['name'], [(c['id'], len(c['controls'])) for c in o['categories']])
print('correções', len(corrections)); print('issues', len(issues)); print('\n'.join(issues[:30]))
