import pdfplumber, sys, json, collections
src, out = sys.argv[1], sys.argv[2]
pages=[]
with pdfplumber.open(src) as p:
    for i,pg in enumerate(p.pages):
        chars=pg.chars
        H=pg.height
        minx=min((c['x0'] for c in chars if c['size']>=9 and 80<c['top']<H-60),default=0)
        fn_top=None
        for k,c in enumerate(chars[:-1]):
            n=chars[k+1]
            if c['text']=='(' and 8<c['size']<9.2 and n['size']<6 and n['text'].isdigit() and c['x0']<minx+15:
                if fn_top is None or c['top']<fn_top: fn_top=c['top']
        for ch in chars:
            if ch['size']<6:
                t=ch['text']
                if t=='o': ch['text']='º'
                elif t=='a': ch['text']='ª'
                elif t.isdigit(): ch['text']='⁣'+t
        lines=[]
        for l in pg.extract_text_lines(return_chars=True, x_tolerance=1.5):
            cs=[c for c in l['chars'] if c['text'].strip()]
            if not cs: continue
            fc=collections.Counter(c['fontname'] for c in cs)
            sz=collections.Counter(round(c['size'],1) for c in cs).most_common(1)[0][0]
            bold=sum(v for f,v in fc.items() if 'Bold' in f)/len(cs)
            ital=sum(v for f,v in fc.items() if 'Ital' in f)/len(cs)
            zone='body'
            if fn_top is not None and l['top']>=fn_top-1: zone='fn'
            if l['top']<75 or l['top']>H-40: zone='hf'
            lines.append({'t':l['text'],'x0':round(l['x0'],1),'top':round(l['top'],1),'bot':round(l['bottom'],1),'size':sz,'b':round(bold,2),'it':round(ital,2),'zone':zone})
        pages.append({'i':i+1,'h':H,'lines':lines})
json.dump(pages,open(out,'w'),ensure_ascii=False)
