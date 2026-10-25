import os
import sys, json, re
sys.path.insert(0, '.')
from eulib import *
T=os.path.join(os.environ.get('LEGAL_WORKDIR', 'work'), 'txt/REGEXEC-2024-2690.txt')
HDR=[r'^\s*ELI: http://data\.europa\.eu/eli/reg_impl/2024/2690/oj\s+(?P<oj>\d+/34)\s*$',
     r'^\s*(?P<oj>\d+/34)\s+ELI: http://data\.europa\.eu/eli/reg_impl/2024/2690/oj\s*$',
     r'^\s*PT\s+JO L de 18\.10\.2024\s*$', r'^\s*JO L de 18\.10\.2024\s+PT\s*$',
     r'^\s*Jornal Oficial\s+PT\s*$', r'^\s*da União Europeia\s+Série L\s*$', r'^\s*2024/2690\s+18\.10\.2024\s*$']
pages, fn = load_pages(T, HDR)
OJ={str(p['n']):p['oj'] for p in pages}
