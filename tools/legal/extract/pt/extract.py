import pdfplumber, sys, json, collections
src, out = sys.argv[1], sys.argv[2]
pages=[]
with pdfplumber.open(src) as p:
    for i,pg in enumerate(p.pages):
        chars=pg.chars
        body=9.6
        # footnote start: '(' size~8.5 followed by small digit, near left margin
        fn_top=None
        minx=min((c['x0'] for c in chars if c['size']>=9 and 80<c['top']<pg.height-60),default=0)
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
        def keep(o):
            if o.get('object_type')!='char': return True
            if fn_top is not None and o['top']>=fn_top-1:
                # keep footer (ELI line) area chars of body size
                return o['size']>=9.0 and o['top']>pg.height-60
            return True
        f=pg.filter(keep)
        txt=f.extract_text(x_tolerance=1.5) or ''
        fn=''
        if fn_top is not None and fn_top-1 < pg.height-61:
            fn=pg.crop((0,fn_top-1,pg.width,pg.height-60)).extract_text() or ''
        pages.append({'i':i+1,'text':txt,'footnotes':fn})
json.dump(pages,open(out,'w'),ensure_ascii=False,indent=1)
