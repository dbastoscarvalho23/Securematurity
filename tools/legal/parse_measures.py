"""Extrai as tabelas dos Anexos III e IV do Regulamento n.º 756/2026 (medidas mínimas e critérios de verificação)."""
import json, re, sys
import pdfplumber

PDF, OUT = sys.argv[1], sys.argv[2]
pdf = pdfplumber.open(PDF)

HEADINGS = {'Básico': ('III', 'basico'), 'Substancial': ('III', 'substancial'), 'Elevado': ('III', 'elevado'),
            'Grupo A': ('IV', 'grupo_A'), 'Grupo B': ('IV', 'grupo_B')}
CODE = r'(?:(?:GR|ID|PR|DE|RS|RC)\.[A-Z]{2}-\d+|[OTH][.-] ?[A-Z]{2,5})'
CTL_RE = re.compile(r'^(' + CODE + r')\s*[—-]\s*(.*)$', re.S)
CODE_START = re.compile(r'^' + CODE + r'\s*[—-]')

def clean(t):
    if t is None:
        return ''
    t = t.replace('­', '')
    t = re.sub(r'(\w)-\n(\w)', lambda m: m.group(1) + m.group(2) if m.group(2).islower() else m.group(1) + '-' + m.group(2), t)
    t = re.sub(r'\s*\n\s*', ' ', t)
    t = re.sub(r'\b([A-Z]{2})\. ([A-Z]{2})\b', r'\1.\2', t)
    return re.sub(r'\s+', ' ', t).strip()

rows_out, issues = [], []
annex, level = None, None
start_page = next(i for i, p in enumerate(pdf.pages) if 'ANEXO III' in (p.extract_text() or ''))
for pi in range(start_page, len(pdf.pages)):
    page = pdf.pages[pi]
    pno = pi + 1
    words = page.extract_words(keep_blank_chars=True)
    text = page.extract_text() or ''
    if 'ANEXO IV' in text:
        annex_iv_top = next((w['top'] for w in words if w['text'].strip().startswith('ANEXO IV')), None)
    else:
        annex_iv_top = None
    # títulos de nível (linha isolada) e respetiva posição vertical
    marks = []
    for line in page.extract_text_lines():
        s = line['text'].strip()
        if s in HEADINGS:
            marks.append((line['top'], HEADINGS[s]))
    if annex_iv_top is not None:
        marks.append((annex_iv_top, ('IV', None)))
    marks.sort()
    tables = page.find_tables(dict(vertical_strategy='lines', horizontal_strategy='lines'))
    # ignorar o texto vertical da margem ("Regulamento n.º 756/2026")
    all_words = [w for w in page.extract_words(use_text_flow=False, keep_blank_chars=False, extra_attrs=['upright']) if w['upright']]
    for tb in tables:
        tx0, ttop, tx1, tbot = tb.bbox
        for row in tb.rows:
            top, bottom = row.bbox[1], row.bbox[3]
            for mtop, (an, lv) in marks:
                if mtop <= top + 1:
                    annex = an
                    if lv:
                        level = lv
            band_all = [w for w in all_words if w['top'] >= top - 1 and w['bottom'] <= bottom + 1]
            # Linhas sem separador horizontal: dividir a faixa onde a 1.ª coluna começa um novo código
            col0_lines = {}
            for w in band_all:
                if w['x0'] < tx0 - 2:
                    col0_lines.setdefault(round(w['top']), []).append(w)
            starts = sorted(t for t, ws in col0_lines.items()
                            if CODE_START.match(' '.join(x['text'] for x in sorted(ws, key=lambda x: x['x0']))))
            cuts = [top - 1] + [t - 1 for t in starts if t - 1 > top + 2] + [bottom + 1]
            sub_bands = [[w for w in band_all if a <= w['top'] < b] for a, b in zip(cuts, cuts[1:])]
            for band in sub_bands:
              cols = [[], [], []]
              for w in band:
                ci = 0 if w['x0'] < tx0 - 2 else (1 if w['x0'] < tx1 - 2 else 2)
                cols[ci].append(w)
              def as_text(ws):
                  ws = sorted(ws, key=lambda w: (round(w['top']), w['x0']))
                  lines, cur, cur_top = [], [], None
                  for w in ws:
                      if cur_top is None or abs(w['top'] - cur_top) > 3:
                          if cur: lines.append(' '.join(cur))
                          cur, cur_top = [w['text']], w['top']
                      else:
                          cur.append(w['text'])
                  if cur: lines.append(' '.join(cur))
                  return clean('\n'.join(lines))
              c0, c1, c2 = (as_text(c) for c in cols)
              if c0.startswith('Controlo de Cibersegurança') or c0 == 'Área' or c1.startswith('Medida de Cibersegurança') or c1.startswith('Medidas de Cibersegurança'):
                  continue
              if not (c0 or c1 or c2):
                  continue
              m = CTL_RE.match(c0)
              if m:
                  kind = 'area' if m.group(1)[:1] in 'OTH' and not m.group(1)[:2].isalpha() else 'control'
                  rows_out.append({'annex': annex, 'level': level, 'kind': kind, 'control_id': re.sub(r'[ -]', '.', m.group(1)).replace('..', '.') if kind == 'area' else m.group(1),
                                   'code_as_printed': m.group(1), 'control_text': m.group(2),
                                   'measure': c1, 'verification': c2, 'page': pno})
              elif rows_out:
                  prev = rows_out[-1]
                  if c0: prev['control_text'] = (prev['control_text'] + ' ' + c0).strip()
                  prev['measure'] = (prev['measure'] + ' ' + c1).strip()
                  prev['verification'] = (prev['verification'] + ' ' + c2).strip()
                  prev.setdefault('continued_on', []).append(pno)
              else:
                  issues.append(f'p{pno}: linha não reconhecida: {[c0, c1, c2]}')

summary = {}
for r in rows_out:
    summary.setdefault(f"{r['annex']}/{r['level']}", 0)
    summary[f"{r['annex']}/{r['level']}"] += 1
json.dump({'source': 'Regulamento n.º 756/2026, Anexos III e IV', 'rows': rows_out, 'summary': summary, 'issues': issues},
          open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print(summary); print('issues', len(issues)); print('\n'.join(issues[:20]))
