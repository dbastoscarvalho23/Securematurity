#!/usr/bin/env python3
"""Gera base44/shared/legalPack.ts: os textos oficiais que as funções aiDraft e aiQuestionnaire podem citar.

Fonte única: src/data/legal/*.json (Biblioteca Legal). Volte a correr depois de atualizar esses ficheiros:
    python3 tools/legal/build_ai_pack.py
"""
import json, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
L = ROOT / 'src' / 'data' / 'legal'
load = lambda n: json.loads((L / n).read_text(encoding='utf-8'))

qnrcs, epr, rjc, reg756, nis2, r2690, dora = (load(n) for n in ['qnrcs.json', 'epr-measures.json', 'rjc.json', 'reg756.json', 'nis2.json', 'regexec2690.json', 'dora.json'])

controls = {}
for o in qnrcs['objectives']:
    for c in o['categories']:
        for k in c['controls']:
            controls[k['id']] = {
                'objective': f"{o['code']} — {o['name']}", 'category': f"{c['id']} — {c['name']}",
                'statement': k['statement'], 'description': k.get('description', ''),
                'measures': {lv: {'measure': m['measure'], 'verification': m.get('verification', '')} for lv, m in (k.get('measures') or {}).items()},
            }

def arts(doc, numbers):
    return {a['number']: {'title': a['title'], 'text': a['text']} for a in doc['articles'] if a['number'] in numbers}

pack = {
    'levels': ['basico', 'substancial', 'elevado'],
    'controls': controls,
    'epr': {g: [{'code': m['code'], 'area': m['area'], 'measure': m['measure'], 'verification': m.get('verification', '')} for m in epr[f'group_{g}']] for g in ['A', 'B']},
    # Todos os artigos: a jornada de conformidade cita artigos variados do RJC e do Regulamento.
    'rjc': {a['number']: {'title': a['title'], 'text': a['text']} for a in rjc['articles']},
    'reg756': {a['number']: {'title': a['title'], 'text': a['text']} for a in reg756['articles']},
    'nis2_art21': [{'letter': m['letter'], 'text': m['text']} for m in nis2['art21_measures']],
    'r2690': [{'id': r['id'], 'section': r['section'], 'text': r['text']} for r in r2690['annex_requirements']],
    'r2690_letters': {s['id']: s.get('nis2_letters', []) for s in r2690['annex_sections']},
    # DORA (Reg. (UE) 2022/2554): obrigações por pilar, com a referência e o texto oficial (questionários de avaliação).
    'dora': [{'id': o['id'], 'pillar': o['pillar'], 'title': o['title_pt'], 'ref': o['ref'], 'text': o['text']} for o in dora['obligations']],
}
out = ROOT / 'base44' / 'shared' / 'legalPack.ts'
out.write_text('// GERADO por tools/legal/build_ai_pack.py a partir de src/data/legal — não editar à mão.\n'
               f'export const LEGAL_PACK = {json.dumps(pack, ensure_ascii=False)};\n', encoding='utf-8')
print(out, out.stat().st_size, 'bytes;', len(controls), 'controlos;', len(pack['r2690']), 'requisitos 2690;', len(pack['dora']), 'obrigações DORA')
