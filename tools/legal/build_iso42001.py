"""
Gera src/data/legal/iso42001.json — guia ISO/IEC 42001:2023 (sistema de gestão da inteligência artificial) da AnkoraOne.

Estrutura (cláusulas 4 a 10, os 38 controlos do Anexo A em 9 domínios, objetivos e fontes de risco do Anexo C) conferida
com o texto oficial ISO/IEC 42001:2023 (1.ª edição, 2023-12) a 26/10/2026. Títulos, descrições e evidências sugeridas
são texto próprio da AnkoraOne (paráfrase); a norma é protegida por direitos de autor e não está incluída.

Ligações à ISO/IEC 27001:2022 (ids de src/data/legal/iso27001.json): controlos ou cláusulas da 27001 que servem de base
ao requisito da 42001, numa leitura de sistema integrado (as cláusulas 4 a 10 seguem a mesma estrutura harmonizada).
Lista vazia = requisito próprio da IA, sem equivalente na 27001. As ligações são orientação da AnkoraOne, não fazem
parte de nenhuma das normas.
"""
import json, os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# (ref, título, descrição, evidência, ligações à 27001)
CLAUSES = [
 ("4", "Contexto da organização", [
  ("4.1", "Compreender a organização e o seu contexto", "Identificar as questões internas e externas relevantes para o desenvolvimento, fornecimento ou utilização de IA e o papel da organização face a cada sistema de IA (por exemplo fornecedor, produtor, cliente ou utilizador).", "Análise de contexto com as questões de IA e o papel da organização em cada sistema.", ["C.4.1"]),
  ("4.2", "Partes interessadas e os seus requisitos", "Identificar as partes interessadas no sistema de gestão da IA (por exemplo pessoas afetadas pelas decisões, titulares de dados, fornecedores de modelos, clientes, autoridades) e os requisitos de cada uma que serão tratados.", "Registo de partes interessadas e requisitos, com os que entram no sistema de gestão.", ["C.4.2"]),
  ("4.3", "Âmbito do sistema de gestão da IA", "Definir os limites do sistema de gestão: que sistemas de IA, atividades, locais e papéis ficam incluídos, tendo em conta o contexto e as partes interessadas.", "Declaração de âmbito documentada e aprovada.", ["C.4.3"]),
  ("4.4", "Sistema de gestão da IA", "Estabelecer, implementar, manter e melhorar o sistema de gestão da IA e os processos de que precisa.", "Descrição dos processos do sistema de gestão e das suas interações.", ["C.4.4"]),
 ]),
 ("5", "Liderança", [
  ("5.1", "Liderança e compromisso", "A gestão de topo garante a política e os objetivos de IA, a integração dos requisitos nos processos do negócio, os recursos necessários e a melhoria contínua.", "Decisões e atas da gestão de topo sobre IA; recursos atribuídos.", ["C.5.1"]),
  ("5.2", "Política de IA", "Política de IA aprovada pela gestão de topo, adequada ao propósito da organização, com enquadramento para os objetivos e compromisso de cumprir os requisitos aplicáveis e de melhorar; comunicada e disponível às partes interessadas.", "Política de IA aprovada, divulgada e com registo de revisões.", ["C.5.2"]),
  ("5.3", "Funções, responsabilidades e autoridades", "Atribuir e comunicar as responsabilidades no sistema de gestão da IA, incluindo quem assegura a conformidade e reporta o desempenho à gestão de topo.", "Matriz de funções e responsabilidades de IA comunicada.", ["C.5.3"]),
 ]),
 ("6", "Planeamento", [
  ("6.1.1", "Ações para tratar riscos e oportunidades", "Determinar os riscos e oportunidades do sistema de gestão considerando o contexto, o domínio de aplicação e a utilização prevista dos sistemas de IA; definir critérios que distinguem riscos aceitáveis de não aceitáveis.", "Critérios de risco de IA aprovados e plano de ações.", ["C.6.1.1"]),
  ("6.1.2", "Avaliação de riscos de IA", "Definir e aplicar um processo de avaliação de riscos de IA que identifica, analisa (incluindo consequências para a organização, para pessoas e para a sociedade) e avalia os riscos, com resultados comparáveis e repetíveis.", "Metodologia de avaliação de riscos de IA e relatório de avaliação.", ["C.6.1.2"]),
  ("6.1.3", "Tratamento de riscos de IA e Declaração de Aplicabilidade", "Escolher as opções de tratamento, determinar os controlos (do Anexo A ou próprios), compará-los com o Anexo A, elaborar a Declaração de Aplicabilidade com a justificação de inclusões e exclusões e obter aprovação do plano de tratamento e dos riscos residuais.", "Plano de tratamento aprovado e Declaração de Aplicabilidade da ISO/IEC 42001 (separada da 27001).", ["C.6.1.3"]),
  ("6.1.4", "Avaliação de impacto dos sistemas de IA", "Definir um processo para avaliar as consequências potenciais dos sistemas de IA para pessoas, grupos de pessoas e a sociedade, considerando o contexto técnico e social e as jurisdições onde são usados; os resultados entram na avaliação de riscos.", "Procedimento de avaliação de impacto e avaliações por sistema de IA.", []),
  ("6.2", "Objetivos de IA e planeamento para os atingir", "Definir objetivos de IA mensuráveis e coerentes com a política, monitorizá-los e comunicá-los; planear o que será feito, com que recursos, por quem, até quando e como se avaliam os resultados.", "Objetivos de IA com indicadores, responsáveis e prazos.", ["C.6.2"]),
  ("6.3", "Planeamento de alterações", "Fazer as alterações ao sistema de gestão da IA de forma planeada.", "Registo de alterações planeadas e aprovadas.", ["C.6.3"]),
 ]),
 ("7", "Suporte", [
  ("7.1", "Recursos", "Determinar e disponibilizar os recursos necessários ao sistema de gestão da IA.", "Orçamento e plano de recursos aprovados.", ["C.7.1"]),
  ("7.2", "Competência", "Determinar as competências necessárias, incluindo em IA, garantir que as pessoas as têm por formação ou experiência e guardar evidência.", "Matriz de competências e registos de formação.", ["C.7.2"]),
  ("7.3", "Consciencialização", "As pessoas conhecem a política de IA, o seu contributo para o sistema de gestão e as implicações de não cumprir os requisitos.", "Plano e registos de sensibilização sobre IA.", ["C.7.3"]),
  ("7.4", "Comunicação", "Definir o que comunicar sobre o sistema de gestão da IA, quando, a quem e como, interna e externamente.", "Plano de comunicação.", ["C.7.4"]),
  ("7.5", "Informação documentada", "Criar, atualizar e controlar a informação documentada exigida pela norma e a que a organização considerar necessária.", "Procedimento de controlo documental comum aos sistemas de gestão.", ["C.7.5"]),
 ]),
 ("8", "Operação", [
  ("8.1", "Planeamento e controlo operacional", "Planear, implementar e controlar os processos necessários, incluindo os controlos escolhidos; controlar alterações planeadas e processos, produtos ou serviços externos.", "Procedimentos operacionais e registos que mostram que os processos correram como planeado.", ["C.8.1"]),
  ("8.2", "Avaliação de riscos de IA (operação)", "Realizar avaliações de riscos de IA a intervalos planeados e quando há alterações significativas.", "Resultados das avaliações de riscos de IA.", ["C.8.2"]),
  ("8.3", "Tratamento de riscos de IA (operação)", "Executar o plano de tratamento, verificar a sua eficácia e rever o plano quando surgem novos riscos.", "Resultados do tratamento de riscos e verificação de eficácia.", ["C.8.3"]),
  ("8.4", "Avaliação de impacto dos sistemas de IA (operação)", "Realizar avaliações de impacto a intervalos planeados e quando há alterações significativas.", "Resultados das avaliações de impacto.", []),
 ]),
 ("9", "Avaliação do desempenho", [
  ("9.1", "Monitorização, medição, análise e avaliação", "Definir o que monitorizar e medir, como, quando e por quem, e avaliar o desempenho e a eficácia do sistema de gestão da IA.", "Indicadores e relatórios de desempenho.", ["C.9.1"]),
  ("9.2", "Auditoria interna", "Realizar auditorias internas planeadas, com critérios, âmbito e auditores imparciais; pode ser um programa único com a 27001.", "Programa de auditorias e relatórios.", ["C.9.2"]),
  ("9.3", "Revisão pela gestão", "A gestão de topo revê o sistema de gestão da IA a intervalos planeados, com as entradas definidas pela norma; pode ser a mesma revisão da 27001, com ordem de trabalhos própria para IA.", "Atas da revisão pela gestão com decisões.", ["C.9.3"]),
 ]),
 ("10", "Melhoria", [
  ("10.1", "Melhoria contínua", "Melhorar continuamente a adequação e a eficácia do sistema de gestão da IA.", "Registo de ações de melhoria.", ["C.10.1"]),
  ("10.2", "Não conformidades e ações corretivas", "Tratar as não conformidades, analisar as causas, aplicar ações corretivas e verificar a sua eficácia.", "Registo de não conformidades e ações corretivas.", ["C.10.2"]),
 ]),
]

ANNEX = [
 ("2", "Políticas relativas à IA", [
  ("2.2", "Política de IA", "Política documentada para o desenvolvimento ou a utilização de sistemas de IA.", "Política de IA aprovada.", ["A.5.1", "C.5.2"]),
  ("2.3", "Alinhamento com outras políticas", "Identificar as políticas internas (segurança, privacidade, qualidade, compras) que se aplicam aos sistemas de IA ou que são afetadas pelos objetivos de IA.", "Lista de políticas relacionadas e pontos de alinhamento.", ["A.5.1"]),
  ("2.4", "Revisão da política de IA", "Rever a política de IA a intervalos planeados e sempre que necessário, para se manter adequada e eficaz.", "Registo de revisões da política.", ["A.5.1"]),
 ]),
 ("3", "Organização interna", [
  ("3.2", "Funções e responsabilidades de IA", "Definir e atribuir as responsabilidades de IA de acordo com as necessidades da organização.", "Matriz de responsabilidades de IA.", ["A.5.2", "C.5.3"]),
  ("3.3", "Comunicação de preocupações", "Processo para qualquer pessoa reportar preocupações sobre o papel da organização num sistema de IA, ao longo de todo o ciclo de vida.", "Canal de reporte e registo dos casos tratados.", ["A.6.8"]),
 ]),
 ("4", "Recursos dos sistemas de IA", [
  ("4.2", "Documentação dos recursos", "Identificar e documentar os recursos necessários em cada fase do ciclo de vida e nas restantes atividades de IA.", "Inventário de sistemas de IA com os recursos de cada um.", ["A.5.9"]),
  ("4.3", "Recursos de dados", "Documentar os dados usados por cada sistema de IA.", "Fichas dos conjuntos de dados (origem, finalidade, categorias, conservação).", ["A.5.9", "A.5.12"]),
  ("4.4", "Recursos de ferramentas", "Documentar as ferramentas usadas (algoritmos, bibliotecas, plataformas de treino e de avaliação).", "Lista de ferramentas e versões.", ["A.5.9"]),
  ("4.5", "Recursos de sistema e de computação", "Documentar a infraestrutura e a capacidade de computação usadas, incluindo serviços de nuvem.", "Descrição da infraestrutura e dos serviços contratados.", ["A.5.9", "A.5.23", "A.8.6"]),
  ("4.6", "Recursos humanos", "Documentar as pessoas e as competências envolvidas no desenvolvimento, implementação, operação, manutenção, verificação e desativação.", "Matriz de competências da equipa de IA.", ["C.7.2", "A.6.3"]),
 ]),
 ("5", "Avaliação de impactos dos sistemas de IA", [
  ("5.2", "Processo de avaliação de impacto", "Processo para avaliar as consequências potenciais para pessoas, grupos de pessoas e a sociedade ao longo do ciclo de vida do sistema.", "Procedimento de avaliação de impacto aprovado.", ["C.6.1.2"]),
  ("5.3", "Documentação das avaliações de impacto", "Documentar os resultados das avaliações de impacto e conservá-los durante um período definido.", "Relatórios de avaliação de impacto com prazo de conservação.", []),
  ("5.4", "Impacto em pessoas ou grupos de pessoas", "Avaliar e documentar os impactos potenciais em pessoas ou grupos de pessoas ao longo do ciclo de vida (por exemplo equidade, privacidade, segurança física).", "Avaliação de impacto individual por sistema de IA.", ["A.5.34"]),
  ("5.5", "Impactos na sociedade", "Avaliar e documentar os impactos potenciais dos sistemas de IA na sociedade.", "Secção de impacto societal da avaliação.", []),
 ]),
 ("6", "Ciclo de vida dos sistemas de IA", [
  ("6.1.2", "Objetivos de desenvolvimento responsável", "Definir objetivos que orientam o desenvolvimento responsável e integrá-los nas medidas do ciclo de desenvolvimento.", "Objetivos documentados e evidência da sua aplicação nos projetos.", ["A.8.25"]),
  ("6.1.3", "Processos de conceção e desenvolvimento responsáveis", "Definir e documentar os processos específicos de conceção e desenvolvimento responsáveis.", "Procedimento de desenvolvimento de IA.", ["A.8.25", "A.8.27"]),
  ("6.2.2", "Requisitos e especificação", "Especificar e documentar os requisitos de novos sistemas de IA ou de melhorias relevantes.", "Documento de requisitos aprovado.", ["A.8.26"]),
  ("6.2.3", "Documentação da conceção e do desenvolvimento", "Documentar a conceção e o desenvolvimento com base nos objetivos, requisitos e critérios definidos.", "Documentação de arquitetura, do modelo e das decisões de conceção.", ["A.8.25"]),
  ("6.2.4", "Verificação e validação", "Definir e documentar as medidas de verificação e validação e os critérios para as usar.", "Plano e relatórios de testes, com métricas de desempenho.", ["A.8.29"]),
  ("6.2.5", "Entrada em produção", "Documentar o plano de entrada em produção e confirmar que os requisitos são cumpridos antes de avançar.", "Plano e aprovação da entrada em produção.", ["A.8.31", "A.8.32"]),
  ("6.2.6", "Operação e monitorização", "Definir o necessário para operar o sistema, no mínimo monitorização do sistema e do desempenho, reparações, atualizações e suporte.", "Procedimentos de operação e registos de monitorização.", ["A.8.6", "A.8.16"]),
  ("6.2.7", "Documentação técnica", "Determinar a documentação técnica de que cada categoria de partes interessadas precisa (utilizadores, parceiros, autoridades) e disponibilizá-la na forma adequada.", "Documentação técnica por destinatário.", ["A.5.37"]),
  ("6.2.8", "Registo de eventos", "Determinar em que fases do ciclo de vida se registam eventos, no mínimo enquanto o sistema está em utilização.", "Configuração e amostras dos registos de eventos.", ["A.8.15"]),
 ]),
 ("7", "Dados para sistemas de IA", [
  ("7.2", "Dados para desenvolvimento e melhoria", "Definir, documentar e aplicar processos de gestão dos dados usados no desenvolvimento dos sistemas de IA.", "Procedimento de gestão de dados de IA.", ["A.5.12", "A.5.34"]),
  ("7.3", "Aquisição de dados", "Documentar como os dados são obtidos e escolhidos.", "Registo das fontes de dados, licenças e fundamentos de utilização.", ["A.5.31", "A.5.32", "A.5.34"]),
  ("7.4", "Qualidade dos dados", "Definir requisitos de qualidade dos dados e garantir que os dados de desenvolvimento e de operação os cumprem.", "Critérios de qualidade e relatórios de verificação.", []),
  ("7.5", "Proveniência dos dados", "Definir um processo para registar a proveniência dos dados ao longo do ciclo de vida dos dados e do sistema.", "Registos de proveniência e linhagem dos dados.", ["A.5.33"]),
  ("7.6", "Preparação dos dados", "Definir critérios para escolher a preparação dos dados e os métodos a usar.", "Descrição dos métodos de preparação (limpeza, anotação, anonimização).", ["A.8.11"]),
 ]),
 ("8", "Informação para partes interessadas", [
  ("8.2", "Documentação e informação para utilizadores", "Determinar e fornecer aos utilizadores a informação de que precisam sobre o sistema de IA.", "Manual ou aviso ao utilizador.", []),
  ("8.3", "Reporte externo", "Dar às partes interessadas meios para reportar impactos adversos do sistema de IA.", "Canal externo de reporte e registo das comunicações recebidas.", []),
  ("8.4", "Comunicação de incidentes", "Definir e documentar um plano para comunicar incidentes aos utilizadores do sistema de IA.", "Plano de comunicação de incidentes de IA.", ["A.5.24", "A.5.26"]),
  ("8.5", "Informação para partes interessadas", "Determinar e documentar as obrigações de reportar informação sobre o sistema de IA às partes interessadas.", "Registo das obrigações de reporte (contratuais e legais).", ["A.5.31"]),
 ]),
 ("9", "Utilização de sistemas de IA", [
  ("9.2", "Processos de utilização responsável", "Definir e documentar os processos para a utilização responsável de sistemas de IA.", "Procedimento de utilização de IA.", ["A.5.10"]),
  ("9.3", "Objetivos de utilização responsável", "Definir e documentar objetivos que orientam a utilização responsável de sistemas de IA.", "Objetivos de utilização documentados.", ["A.5.10"]),
  ("9.4", "Utilização prevista", "Garantir que o sistema de IA é usado de acordo com a utilização prevista e com a documentação que o acompanha.", "Registos de monitorização da utilização face à finalidade prevista.", ["A.5.10"]),
 ]),
 ("10", "Relações com terceiros e clientes", [
  ("10.2", "Repartição de responsabilidades", "Repartir as responsabilidades do ciclo de vida do sistema de IA entre a organização, parceiros, fornecedores, clientes e terceiros.", "Matriz de responsabilidades partilhadas e cláusulas contratuais.", ["A.5.19", "A.5.20"]),
  ("10.3", "Fornecedores", "Processo para garantir que os serviços, produtos ou materiais dos fornecedores estão alinhados com a abordagem responsável da organização.", "Avaliação de fornecedores de IA e requisitos contratuais.", ["A.5.19", "A.5.21", "A.5.22"]),
  ("10.4", "Clientes", "Garantir que a abordagem responsável ao desenvolvimento e à utilização de IA tem em conta as expectativas e necessidades dos clientes.", "Requisitos dos clientes registados e refletidos nos sistemas.", ["A.5.31"]),
 ]),
]

# Anexo C (informativo): objetivos e fontes de risco de referência. Descrições próprias, curtas.
OBJECTIVES = [
 ("C.2.1", "Responsabilização", "A IA pode alterar quem responde pelas decisões; é preciso manter claro quem é responsável."),
 ("C.2.2", "Competência em IA", "Equipas com competências multidisciplinares para avaliar, desenvolver e implementar IA."),
 ("C.2.3", "Disponibilidade e qualidade dos dados de treino e teste", "Sistemas de aprendizagem automática dependem de dados de treino, validação e teste adequados."),
 ("C.2.4", "Impacto ambiental", "A IA pode ter efeitos positivos e negativos no ambiente."),
 ("C.2.5", "Equidade", "Decisões automatizadas mal aplicadas podem ser injustas para pessoas ou grupos."),
 ("C.2.6", "Manutenibilidade", "Capacidade de corrigir e adaptar o sistema a novos requisitos."),
 ("C.2.7", "Privacidade", "O uso indevido ou a divulgação de dados pessoais pode prejudicar os titulares."),
 ("C.2.8", "Robustez", "Desempenho comparável com dados novos e com os dados de operação habituais."),
 ("C.2.9", "Segurança física (safety)", "O sistema não deve pôr em perigo a vida, a saúde, os bens ou o ambiente."),
 ("C.2.10", "Segurança (security)", "Ameaças próprias da IA, para além da segurança clássica da informação."),
 ("C.2.11", "Transparência e explicabilidade", "Informação compreensível sobre a organização, o sistema e os fatores que influenciam os resultados."),
]
RISK_SOURCES = [
 ("C.3.1", "Complexidade do ambiente", "Ambientes com muitas situações possíveis tornam o desempenho incerto."),
 ("C.3.2", "Falta de transparência e explicabilidade", "Não conseguir explicar o sistema afeta a confiança e a responsabilização."),
 ("C.3.3", "Nível de automação", "Mais automação pode afetar a segurança física, a equidade ou a segurança."),
 ("C.3.4", "Aprendizagem automática", "A qualidade e a recolha dos dados de treino podem afetar a robustez e a segurança (por exemplo envenenamento de dados)."),
 ("C.3.5", "Hardware", "Erros de hardware ou na transferência de modelos entre sistemas."),
 ("C.3.6", "Ciclo de vida", "Falhas de conceção, implementação, manutenção ou desativação."),
 ("C.3.7", "Maturidade da tecnologia", "Tecnologia pouco madura (limites desconhecidos, desvio de desempenho) ou excesso de confiança na madura."),
]

DOCUMENTED = {"4.3", "5.2", "6.1.2", "6.1.3", "6.1.4", "6.2", "7.2", "7.5", "8.1", "8.2", "8.3", "8.4", "9.1", "9.2", "9.3", "10.2"}

iso27 = json.load(open(os.path.join(ROOT, 'src/data/legal/iso27001.json')))
ids27 = {i['id'] for i in iso27['items']}

items = []
for num, name, rows in CLAUSES:
    for cid, title, desc, ev, rel in rows:
        items.append({"id": f"C.{cid}", "kind": "clause", "group": num, "group_name": name, "ref": cid, "title": title,
                      "description": desc, "evidence": ev, "iso27001": rel, "documented": cid in DOCUMENTED, "order": len(items) + 1})
for num, name, rows in ANNEX:
    for cid, title, desc, ev, rel in rows:
        items.append({"id": f"A.{cid}", "kind": "control", "group": num, "group_name": name, "ref": cid, "title": title,
                      "description": desc, "evidence": ev, "iso27001": rel, "order": len(items) + 1})

controls = [i for i in items if i['kind'] == 'control']
clauses = [i for i in items if i['kind'] == 'clause']
assert len(controls) == 38, len(controls)
assert len(clauses) == 27, len(clauses)
assert len({i['id'] for i in items}) == len(items)
for i in items:
    for r in i['iso27001']:
        assert r in ids27, (i['id'], r)

out = {
  "source": {
    "title": "ISO/IEC 42001:2023 — guia AnkoraOne",
    "edition": "ISO/IEC 42001:2023, 1.ª edição (2023-12)",
    "ref": "Estrutura das cláusulas 4 a 10, dos 38 controlos do Anexo A e dos objetivos e fontes de risco do Anexo C. Títulos, descrições e evidências sugeridas escritos pela AnkoraOne; não reproduzem a norma.",
    "links_ref": "Ligações à ISO/IEC 27001:2022: controlos e cláusulas que servem de base num sistema integrado (orientação AnkoraOne; não fazem parte das normas). Sem ligação = requisito próprio da IA.",
    "url": "https://www.iso.org/standard/81230.html",
    "validation": "estrutura_validada",
    "validated_on": "2026-10-26",
    "validation_note": "Cláusulas 4 a 10, os 38 controlos do Anexo A (domínios A.2 a A.10) e o Anexo C conferidos com o texto oficial ISO/IEC 42001:2023. O Anexo B (orientação de implementação) é normativo e não está reproduzido.",
    "note": "A norma é protegida por direitos de autor e não está incluída. Para certificação, a entidade deve usar o texto oficial e uma entidade certificadora acreditada."
  },
  "groups": [{"kind": "clause", "code": n, "name": nm} for n, nm, _ in CLAUSES] + [{"kind": "control", "code": n, "name": nm} for n, nm, _ in ANNEX],
  "items": items,
  "objectives": [{"id": i, "title": t, "description": d} for i, t, d in OBJECTIVES],
  "risk_sources": [{"id": i, "title": t, "description": d} for i, t, d in RISK_SOURCES],
}
json.dump(out, open(os.path.join(ROOT, 'src/data/legal/iso42001.json'), 'w'), ensure_ascii=False, indent=1)
print(len(items), 'itens;', len(clauses), 'cláusulas;', len(controls), 'controlos;',
      sum(1 for i in controls if i['iso27001']), 'controlos com base na 27001;',
      sum(1 for i in controls if not i['iso27001']), 'próprios da IA;', len(OBJECTIVES), 'objetivos;', len(RISK_SOURCES), 'fontes de risco')
