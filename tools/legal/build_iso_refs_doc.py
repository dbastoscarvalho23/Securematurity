"""
Gera docs/legal/referencias-iso.md a partir de src/data/legal/iso-references.json (registo das fontes usadas para
conferir os guias ISO/IEC 27001 e 42001). Só metadados: os documentos não são alojados no repositório nem na app.
"""
import json, os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
d = json.load(open(os.path.join(ROOT, 'src/data/legal/iso-references.json')))
VERDICT = {'referencia_normativa': 'Texto oficial', 'atual': 'Atual', 'atual_com_reservas': 'Atual, com reservas',
           'uso_limitado': 'Uso limitado', 'erros_detetados': 'Erros detetados', 'desatualizado': 'Desatualizado',
           'fora_de_ambito': 'Fora de âmbito'}
KIND = {'texto_oficial': 'Texto oficial da norma', 'guia': 'Guia', 'modelo': 'Modelo', 'lista_verificacao': 'Lista de verificação',
        'matriz_correspondencias': 'Matriz de correspondências', 'relatorio_exemplo': 'Relatório de exemplo', 'artigo': 'Artigo'}
order = list(VERDICT)
docs = sorted(d['documents'], key=lambda x: (order.index(x['verdict']), x['title']))
L = ['# Fontes de referência ISO/IEC 27001 e 42001', '',
     f"Registo gerado por `tools/legal/build_iso_refs_doc.py` a partir de `src/data/legal/iso-references.json` ({d['generated']}). Não editar à mão.", '',
     'Estes documentos foram fornecidos para conferir os guias ISO da Biblioteca Legal. **Nenhum está alojado** neste repositório '
     'nem na aplicação: as normas e os guias de terceiros são protegidos por direitos de autor. Ficam registados o título, o '
     'autor, a versão da norma que tratam, a impressão digital (SHA-256) do ficheiro recebido e o que se encontrou em cada um.', '',
     '## Resultado', '',
     '- **ISO/IEC 27001:2022**: cláusulas 4 a 10 e os 93 controlos do Anexo A conferidos com o texto oficial (EN ISO/IEC 27001:2023). '
     'Numeração completa, sem falhas nem excedentes. Corrigido o título de A.8.34; acrescentada a nota das alterações climáticas em 4.2 '
     '(emenda 1:2024); assinalada a informação documentada obrigatória.',
     '- **ISO/IEC 42001:2023**: guia novo (`src/data/legal/iso42001.json`), com cláusulas 4 a 10 (incluindo a avaliação de impacto em '
     '6.1.4 e 8.4), os 38 controlos do Anexo A (A.2 a A.10) e o Anexo C, conferidos com o texto oficial. Ligações à 27001 para um '
     'sistema integrado; 5 controlos não têm equivalente na 27001.',
     '- **Guias de terceiros**: dois têm erros factuais face aos textos oficiais (integração 42001/27001 e guia DORA); nove tratam '
     'edições já substituídas da 27001 (2005 ou 2013); um ficheiro com o nome «ISO42001» é um artigo académico e não a norma.',
     '- **Práticas incorporadas na aplicação**: Declaração de Aplicabilidade com método de implementação; análise de lacunas com '
     'sistema de gestão e controlos em separado; filtro de informação documentada obrigatória; uma Declaração de Aplicabilidade por '
     'norma num sistema integrado.', '',
     '## Documentos', '']
for x in docs:
    L += [f"### {x['title']}", '',
          f"- **Autor ou editor:** {x['publisher']} ({x['year']})",
          f"- **Tipo:** {KIND.get(x['kind'], x['kind'])} · **Trata:** {x['covers']}",
          f"- **Avaliação:** {VERDICT[x['verdict']]}",
          f"- **Ficheiro recebido:** `{x['file']}` · SHA-256 `{x['sha256']}` · não alojado"]
    L += [f"- {f}" for f in x['findings']]
    L += [f"- **Uso na plataforma:** {x['used_for']}", '']
open(os.path.join(ROOT, 'docs/legal/referencias-iso.md'), 'w').write('\n'.join(L))
print(len(docs), 'documentos')
