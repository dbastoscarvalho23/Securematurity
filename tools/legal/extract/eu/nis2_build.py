import os
import sys, json, re
sys.path.insert(0, '.')
from eulib import *
from parse_articles import parse_articles
T=os.path.join(os.environ.get('LEGAL_WORKDIR', 'work'), 'txt/NIS2-2022-2555.txt')
HDR=[r'^\s*(?P<oj>L 333/\d+)\s+PT\s+Jornal Oficial da União Europeia\s+27\.12\.2022\s*$',
     r'^\s*27\.12\.2022\s+PT\s+Jornal Oficial da União Europeia\s+(?P<oj>L 333/\d+)\s*$']
pages, fn = load_pages(T, HDR, landscape_pages=set(range(64,71)))
OJ={str(p['n']):p['oj'] for p in pages}
flat = flatten(pages, 1, 63)
k = [i for i,(p,l) in enumerate(flat) if 'ADOTARAM A PRESENTE DIRETIVA' in l][0]
arts = parse_articles(flat[k+1:])
for a in arts: a['oj_page']=OJ[a['page']]
json.dump(arts, open(os.path.join(os.environ.get('LEGAL_WORKDIR', 'work'), 'scripts/nis2_arts.tmp.json'),'w'), ensure_ascii=False, indent=1)
for a in arts: print(a['number'], a['page'], a['oj_page'], a['chapter'], '|', a['chapter_title'], '|', a['title'], len(a['paragraphs']))
