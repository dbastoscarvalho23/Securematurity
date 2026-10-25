import os
import sys, json, re
sys.path.insert(0, '.')
from eulib import *
T=os.path.join(os.environ.get('LEGAL_WORKDIR', 'work'), 'txt/NIS2-2022-2555.txt')
HDR=[r'^\s*(?P<oj>L 333/\d+)\s+PT\s+Jornal Oficial da União Europeia\s+27\.12\.2022\s*$',
     r'^\s*27\.12\.2022\s+PT\s+Jornal Oficial da União Europeia\s+(?P<oj>L 333/\d+)\s*$']
pages, fn = load_pages(T, HDR, landscape_pages=set(range(64,71)))
for p in pages:
    print(p['n'], p['oj'], len(p['lines']), sorted(p['footnotes'])[:1], sorted(p['footnotes'])[-1:], (p['lines'][0][:60] if p['lines'] else ''))
