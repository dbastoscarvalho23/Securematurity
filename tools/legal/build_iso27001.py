"""
Gera src/data/legal/iso27001.json — guia ISO/IEC 27001:2022 da AnkoraOne.

Os títulos, descrições e evidências sugeridas são texto próprio da AnkoraOne (paráfrase), não o texto da norma,
que é protegida por direitos de autor. As ligações ao QNRCS vêm das referências oficiais do Regulamento do CNCS
n.º 756/2026, Anexo I (src/data/legal/qnrcs.json). Estado: «por validar com a norma».
"""
import json, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

CLAUSES = [
 ("4", "Contexto da organização", [
  ("4.1", "Compreender a organização e o seu contexto", "Identificar as questões internas e externas que afetam a segurança da informação, incluindo os efeitos das alterações climáticas (emenda de 2024).", "Análise de contexto (por exemplo SWOT ou PESTEL) aprovada e revista."),
  ("4.2", "Partes interessadas e os seus requisitos", "Identificar as partes interessadas, os requisitos relevantes de cada uma e quais serão tratados pelo sistema de gestão.", "Lista de partes interessadas com os respetivos requisitos legais, contratuais e de negócio."),
  ("4.3", "Âmbito do sistema de gestão", "Definir e documentar os limites do sistema de gestão: atividades, locais, sistemas e interfaces com terceiros.", "Documento de âmbito do SGSI aprovado."),
  ("4.4", "Sistema de gestão da segurança da informação", "Estabelecer, implementar, manter e melhorar o sistema de gestão e os processos de que precisa.", "Mapa de processos do SGSI e respetivas interligações."),
 ]),
 ("5", "Liderança", [
  ("5.1", "Liderança e compromisso", "A gestão de topo garante a política, os objetivos, os recursos e a integração da segurança nos processos da organização.", "Atas da gestão, aprovação de recursos e comunicação do compromisso."),
  ("5.2", "Política de segurança da informação", "Ter uma política adequada ao propósito da organização, com objetivos ou o quadro para os definir, comunicada e disponível.", "Política aprovada pela gestão, com registo de divulgação."),
  ("5.3", "Funções, responsabilidades e autoridades", "Atribuir e comunicar as responsabilidades pela segurança da informação e pelo reporte do desempenho do sistema.", "Organograma de segurança, nomeações e descrições de funções."),
 ]),
 ("6", "Planeamento", [
  ("6.1.1", "Ações para tratar riscos e oportunidades", "Planear como tratar os riscos e oportunidades que afetam os resultados do sistema de gestão.", "Plano de ações para riscos e oportunidades."),
  ("6.1.2", "Avaliação de riscos de segurança da informação", "Definir e aplicar um processo de avaliação de riscos com critérios de aceitação, que produza resultados consistentes.", "Metodologia de avaliação de riscos e registo de riscos."),
  ("6.1.3", "Tratamento de riscos e Declaração de Aplicabilidade", "Escolher as opções de tratamento, comparar os controlos com o Anexo A e justificar inclusões e exclusões na Declaração de Aplicabilidade.", "Plano de tratamento de riscos e Declaração de Aplicabilidade aprovada pelos donos dos riscos."),
  ("6.2", "Objetivos de segurança da informação", "Definir objetivos mensuráveis, coerentes com a política, e planear como os atingir.", "Objetivos com indicadores, responsáveis e prazos."),
  ("6.3", "Planeamento de alterações", "Fazer alterações ao sistema de gestão de forma planeada.", "Registo de alterações ao SGSI com análise de impacto."),
 ]),
 ("7", "Suporte", [
  ("7.1", "Recursos", "Disponibilizar os recursos necessários ao sistema de gestão.", "Orçamento e meios afetos à segurança da informação."),
  ("7.2", "Competência", "Garantir a competência de quem trabalha no sistema de gestão e guardar prova dessa competência.", "Matriz de competências, certificados e registos de formação."),
  ("7.3", "Consciencialização", "As pessoas conhecem a política, o seu contributo e as consequências de não cumprir.", "Ações de sensibilização com presenças e materiais."),
  ("7.4", "Comunicação", "Definir o que comunicar, quando, a quem e por quem, interna e externamente.", "Plano de comunicação do SGSI."),
  ("7.5", "Informação documentada", "Criar, atualizar e controlar a informação documentada exigida pela norma e pela própria organização.", "Procedimento de controlo de documentos e registos, com versões e aprovações."),
 ]),
 ("8", "Operação", [
  ("8.1", "Planeamento e controlo operacional", "Planear, executar e controlar os processos necessários, incluindo os subcontratados.", "Procedimentos operacionais e registos de controlo."),
  ("8.2", "Avaliação de riscos de segurança da informação", "Realizar avaliações de riscos em intervalos planeados e quando há alterações significativas.", "Relatórios de avaliação de riscos datados."),
  ("8.3", "Tratamento de riscos de segurança da informação", "Executar o plano de tratamento de riscos.", "Registo do estado das ações de tratamento."),
 ]),
 ("9", "Avaliação do desempenho", [
  ("9.1", "Monitorização, medição, análise e avaliação", "Definir o que medir, como, quando e por quem, e avaliar o desempenho e a eficácia do sistema.", "Indicadores e relatórios de desempenho."),
  ("9.2", "Auditoria interna", "Realizar auditorias internas planeadas, com critérios, âmbito e auditores imparciais.", "Programa de auditorias, relatórios e evidência das conclusões."),
  ("9.3", "Revisão pela gestão", "A gestão de topo revê o sistema em intervalos planeados, com as entradas definidas pela norma.", "Atas da revisão pela gestão com decisões e ações."),
 ]),
 ("10", "Melhoria", [
  ("10.1", "Melhoria contínua", "Melhorar continuamente a adequação e a eficácia do sistema de gestão.", "Registo de oportunidades de melhoria e respetivo seguimento."),
  ("10.2", "Não conformidades e ações corretivas", "Tratar as não conformidades, analisar as causas e verificar a eficácia das ações corretivas.", "Registo de não conformidades, análise de causas e ações corretivas."),
 ]),
]

ANNEX = [
 ("5", "Controlos organizacionais", [
  ("5.1", "Políticas de segurança da informação", "Política geral e políticas temáticas aprovadas, comunicadas e revistas.", "Políticas aprovadas, data de revisão e registo de divulgação."),
  ("5.2", "Funções e responsabilidades", "Responsabilidades de segurança definidas e atribuídas.", "Matriz de responsabilidades (RACI) e nomeações."),
  ("5.3", "Segregação de funções", "Funções incompatíveis separadas para reduzir erro e fraude.", "Matriz de incompatibilidades e revisão de perfis."),
  ("5.4", "Responsabilidades da gestão", "A gestão exige que todos cumpram as políticas e procedimentos.", "Comunicações da gestão e cláusulas de cumprimento."),
  ("5.5", "Contacto com autoridades", "Contactos com autoridades (por exemplo CNCS, CNPD, PJ) definidos e mantidos.", "Lista de contactos de autoridades atualizada."),
  ("5.6", "Contacto com grupos de interesse especial", "Participação em fóruns e associações de segurança.", "Registo de participação em grupos e fontes de informação."),
  ("5.7", "Informação sobre ameaças", "Recolher e analisar informação sobre ameaças relevantes.", "Fontes de ameaças subscritas e relatórios de análise."),
  ("5.8", "Segurança na gestão de projetos", "Requisitos de segurança integrados em todos os projetos.", "Modelo de projeto com avaliação de segurança."),
  ("5.9", "Inventário de informação e ativos", "Inventário de informação e ativos associados, com responsável.", "Inventário de ativos atualizado com donos e classificação."),
  ("5.10", "Utilização aceitável", "Regras de utilização aceitável da informação e dos ativos.", "Política de utilização aceitável assinada pelos colaboradores."),
  ("5.11", "Devolução de ativos", "Ativos devolvidos no fim do vínculo ou do contrato.", "Registos de devolução na saída de colaboradores."),
  ("5.12", "Classificação da informação", "Informação classificada pela confidencialidade, integridade, disponibilidade e requisitos das partes interessadas.", "Esquema de classificação e exemplos aplicados."),
  ("5.13", "Rotulagem da informação", "Procedimentos para rotular a informação segundo a classificação.", "Procedimento de rotulagem e amostras."),
  ("5.14", "Transferência de informação", "Regras e acordos para transferir informação, interna e externamente.", "Política de transferência e acordos com terceiros."),
  ("5.15", "Controlo de acessos", "Regras de acesso físico e lógico com base nos requisitos de negócio e de segurança.", "Política de controlo de acessos."),
  ("5.16", "Gestão de identidades", "Ciclo de vida completo das identidades.", "Procedimento de criação, alteração e remoção de contas."),
  ("5.17", "Informação de autenticação", "Atribuição e gestão controladas de credenciais.", "Política de palavras-passe e de autenticação multifator."),
  ("5.18", "Direitos de acesso", "Atribuição, revisão periódica e remoção de direitos de acesso.", "Revisões de acessos datadas e assinadas."),
  ("5.19", "Segurança nas relações com fornecedores", "Processos para gerir os riscos dos produtos e serviços de fornecedores.", "Política de fornecedores e avaliação de risco por fornecedor."),
  ("5.20", "Segurança nos acordos com fornecedores", "Requisitos de segurança acordados com cada fornecedor.", "Contratos e anexos de segurança assinados."),
  ("5.21", "Cadeia de abastecimento das TIC", "Gestão dos riscos da cadeia de abastecimento de produtos e serviços TIC.", "Avaliação da cadeia de abastecimento TIC."),
  ("5.22", "Monitorização dos serviços de fornecedores", "Acompanhar, rever e gerir alterações nos serviços de fornecedores.", "Relatórios de níveis de serviço e reuniões de acompanhamento."),
  ("5.23", "Serviços de nuvem", "Processos para adquirir, usar, gerir e sair de serviços de nuvem.", "Política de nuvem e avaliação dos prestadores."),
  ("5.24", "Planeamento da gestão de incidentes", "Processos, funções e responsabilidades de gestão de incidentes definidos.", "Plano de resposta a incidentes aprovado."),
  ("5.25", "Avaliação de eventos de segurança", "Avaliar eventos e decidir se são incidentes.", "Critérios de classificação e registo de triagem."),
  ("5.26", "Resposta a incidentes", "Responder aos incidentes segundo os procedimentos.", "Registos de incidentes e ações tomadas."),
  ("5.27", "Aprendizagem com os incidentes", "Usar o conhecimento dos incidentes para reforçar os controlos.", "Relatórios pós-incidente com lições aprendidas."),
  ("5.28", "Recolha de evidências", "Procedimentos para identificar, recolher e preservar evidências.", "Procedimento forense e cadeia de custódia."),
  ("5.29", "Segurança durante disrupções", "Manter a segurança da informação em situações de disrupção.", "Plano de continuidade com requisitos de segurança."),
  ("5.30", "Prontidão das TIC para a continuidade", "Planear, testar e manter a continuidade das TIC.", "Plano de recuperação de desastres e resultados de testes."),
  ("5.31", "Requisitos legais e contratuais", "Identificar e cumprir os requisitos legais, regulamentares e contratuais.", "Registo de requisitos legais (por exemplo RJC, RGPD) atualizado."),
  ("5.32", "Propriedade intelectual", "Proteger os direitos de propriedade intelectual.", "Inventário de licenças de software."),
  ("5.33", "Proteção de registos", "Proteger os registos contra perda, destruição, falsificação e acesso indevido.", "Política de retenção e proteção de registos."),
  ("5.34", "Privacidade e dados pessoais", "Cumprir os requisitos de proteção de dados pessoais.", "Registo de atividades de tratamento e avaliações de impacto."),
  ("5.35", "Revisão independente", "Revisão independente da abordagem à segurança em intervalos planeados.", "Relatórios de auditoria independente."),
  ("5.36", "Conformidade com políticas e normas", "Verificar regularmente o cumprimento das políticas e normas.", "Relatórios de verificação de conformidade."),
  ("5.37", "Procedimentos operacionais documentados", "Procedimentos de operação documentados e disponíveis.", "Manual de procedimentos operacionais."),
 ]),
 ("6", "Controlos de pessoas", [
  ("6.1", "Verificação de antecedentes", "Verificar os candidatos antes da contratação, de forma proporcional ao risco.", "Procedimento de verificação e registos por contratação."),
  ("6.2", "Termos e condições de emprego", "Responsabilidades de segurança nos contratos de trabalho.", "Cláusulas de segurança nos contratos."),
  ("6.3", "Sensibilização e formação", "Sensibilização, educação e formação regulares em segurança.", "Plano de formação, presenças e resultados."),
  ("6.4", "Processo disciplinar", "Processo disciplinar formal para violações de segurança.", "Regulamento disciplinar com referência à segurança."),
  ("6.5", "Responsabilidades após a saída", "Deveres de segurança que se mantêm após cessação ou mudança de funções.", "Declarações de saída e acordos pós-contratuais."),
  ("6.6", "Acordos de confidencialidade", "Acordos de confidencialidade identificados, assinados e revistos.", "Acordos de confidencialidade assinados."),
  ("6.7", "Trabalho remoto", "Medidas de segurança para o trabalho fora das instalações.", "Política de teletrabalho e configuração dos acessos remotos."),
  ("6.8", "Comunicação de eventos de segurança", "Canal para o pessoal comunicar eventos de segurança.", "Canal de reporte e registos de comunicações."),
 ]),
 ("7", "Controlos físicos", [
  ("7.1", "Perímetros de segurança física", "Perímetros definidos para proteger áreas com informação e ativos.", "Planta das áreas seguras."),
  ("7.2", "Controlo de entradas", "Entradas nas áreas seguras controladas.", "Registos de acessos físicos e lista de autorizados."),
  ("7.3", "Segurança de escritórios e instalações", "Segurança física de escritórios, salas e instalações.", "Avaliação de segurança das instalações."),
  ("7.4", "Monitorização física", "Monitorização contínua das instalações contra acessos não autorizados.", "Sistema de videovigilância ou alarmes e registos."),
  ("7.5", "Ameaças físicas e ambientais", "Proteção contra incêndio, inundação, sismos e outras ameaças.", "Medidas de proteção e manutenção dos sistemas."),
  ("7.6", "Trabalho em áreas seguras", "Regras para trabalhar em áreas seguras.", "Procedimento de áreas seguras."),
  ("7.7", "Secretária limpa e ecrã limpo", "Regras de secretária limpa e de bloqueio de ecrã.", "Política de secretária e ecrã limpos e configuração de bloqueio automático."),
  ("7.8", "Localização e proteção de equipamentos", "Equipamentos colocados e protegidos de forma segura.", "Inventário de localização e medidas de proteção."),
  ("7.9", "Ativos fora das instalações", "Proteção dos ativos usados fora das instalações.", "Política de equipamentos portáteis e cifra de discos."),
  ("7.10", "Suportes de armazenamento", "Gestão do ciclo de vida dos suportes de armazenamento.", "Procedimento de gestão de suportes amovíveis."),
  ("7.11", "Serviços de suporte", "Proteção contra falhas de energia e outros serviços de suporte.", "UPS, geradores e registos de manutenção."),
  ("7.12", "Segurança da cablagem", "Cabos de energia e de dados protegidos.", "Esquemas de cablagem e proteção física."),
  ("7.13", "Manutenção de equipamentos", "Manutenção correta dos equipamentos.", "Plano e registos de manutenção."),
  ("7.14", "Eliminação ou reutilização de equipamentos", "Apagar dados e licenças antes de eliminar ou reutilizar equipamentos.", "Certificados de destruição ou apagamento seguro."),
 ]),
 ("8", "Controlos tecnológicos", [
  ("8.1", "Dispositivos dos utilizadores", "Proteção da informação nos dispositivos dos utilizadores.", "Política de dispositivos e gestão centralizada (MDM)."),
  ("8.2", "Acessos privilegiados", "Atribuição e utilização de privilégios limitadas e controladas.", "Lista de contas privilegiadas e revisões."),
  ("8.3", "Restrição de acesso à informação", "Acesso à informação de acordo com a política de acessos.", "Configuração de permissões e revisões."),
  ("8.4", "Acesso ao código-fonte", "Acesso ao código-fonte e ferramentas de desenvolvimento controlado.", "Permissões do repositório de código."),
  ("8.5", "Autenticação segura", "Tecnologias e procedimentos de autenticação segura.", "Configuração de autenticação multifator."),
  ("8.6", "Gestão da capacidade", "Monitorizar e ajustar a capacidade dos recursos.", "Relatórios de capacidade e alertas."),
  ("8.7", "Proteção contra malware", "Proteção contra software malicioso e sensibilização dos utilizadores.", "Consola antimalware com cobertura e alertas."),
  ("8.8", "Gestão de vulnerabilidades técnicas", "Identificar, avaliar e corrigir vulnerabilidades técnicas.", "Relatórios de análise de vulnerabilidades e prazos de correção."),
  ("8.9", "Gestão da configuração", "Configurações seguras definidas, documentadas e controladas.", "Configurações de referência (baselines) e verificação."),
  ("8.10", "Eliminação de informação", "Apagar a informação quando deixa de ser necessária.", "Procedimento e registos de eliminação."),
  ("8.11", "Ocultação de dados", "Ocultar dados de acordo com a política de acessos e os requisitos legais.", "Regras de mascaramento e pseudonimização."),
  ("8.12", "Prevenção de fuga de dados", "Medidas contra a fuga de informação sensível.", "Configuração DLP e alertas tratados."),
  ("8.13", "Cópias de segurança", "Cópias de segurança feitas e testadas de acordo com a política.", "Política de cópias e relatórios de testes de reposição."),
  ("8.14", "Redundância", "Redundância suficiente para cumprir os requisitos de disponibilidade.", "Arquitetura com redundância e testes de falha."),
  ("8.15", "Registos (logs)", "Registos de atividades, exceções e eventos gerados, guardados e protegidos.", "Política de registos e configuração do SIEM."),
  ("8.16", "Monitorização de atividades", "Monitorizar redes, sistemas e aplicações para detetar comportamentos anómalos.", "Alertas de monitorização e respetivo tratamento."),
  ("8.17", "Sincronização de relógios", "Relógios sincronizados com fontes aprovadas.", "Configuração NTP."),
  ("8.18", "Programas utilitários privilegiados", "Uso de utilitários que contornam controlos restrito e controlado.", "Lista de utilitários autorizados."),
  ("8.19", "Instalação de software", "Instalação de software em sistemas em produção controlada.", "Procedimento de instalação e lista de software autorizado."),
  ("8.20", "Segurança das redes", "Redes protegidas, geridas e controladas.", "Diagrama de rede e configuração de firewalls."),
  ("8.21", "Serviços de rede", "Mecanismos de segurança e níveis de serviço de rede definidos.", "Acordos de serviço de rede e requisitos de segurança."),
  ("8.22", "Segregação de redes", "Grupos de serviços, utilizadores e sistemas separados nas redes.", "Segmentação (VLAN, zonas) documentada."),
  ("8.23", "Filtragem web", "Acesso a sítios externos gerido para reduzir a exposição a conteúdos maliciosos.", "Configuração do filtro web."),
  ("8.24", "Utilização de criptografia", "Regras de utilização de criptografia e gestão de chaves.", "Política de criptografia e inventário de chaves."),
  ("8.25", "Desenvolvimento seguro", "Regras de desenvolvimento seguro de software e sistemas.", "Política de desenvolvimento seguro."),
  ("8.26", "Requisitos de segurança das aplicações", "Requisitos de segurança definidos na aquisição ou desenvolvimento de aplicações.", "Requisitos de segurança por aplicação."),
  ("8.27", "Arquitetura e engenharia seguras", "Princípios de engenharia de sistemas seguros aplicados.", "Princípios de arquitetura documentados."),
  ("8.28", "Programação segura", "Princípios de programação segura aplicados.", "Normas de programação e análise de código."),
  ("8.29", "Testes de segurança", "Testes de segurança no desenvolvimento e na aceitação.", "Planos e relatórios de testes de segurança."),
  ("8.30", "Desenvolvimento subcontratado", "Acompanhar e rever o desenvolvimento subcontratado.", "Contratos e revisões do fornecedor de desenvolvimento."),
  ("8.31", "Separação de ambientes", "Ambientes de desenvolvimento, teste e produção separados.", "Arquitetura de ambientes e controlos de acesso."),
  ("8.32", "Gestão de alterações", "Alterações aos meios de tratamento de informação controladas.", "Procedimento e registos de alterações aprovadas."),
  ("8.33", "Informação de teste", "Informação de teste escolhida, protegida e gerida.", "Regras para dados de teste (sem dados reais ou anonimizados)."),
  ("8.34", "Testes de auditoria", "Testes de auditoria planeados para não afetar a operação.", "Plano de auditoria técnica acordado."),
 ]),
]

qn = json.load(open(os.path.join(ROOT, 'src/data/legal/qnrcs.json')))
by27002, by27001 = {}, {}
for o in qn['objectives']:
    for cat in o['categories']:
        for k in cat['controls']:
            r = k.get('references') or {}
            for x in r.get('iso27002', []): by27002.setdefault(x, []).append(k['id'])
            for x in r.get('iso27001', []): by27001.setdefault(x, []).append(k['id'])

def qlinks(idx, ident):
    out = list(idx.get(ident, []))
    # cláusula com subnúmeros (ex.: 7.5 ← 7.5.1, 7.5.2)
    for key, v in idx.items():
        if key.startswith(ident + '.'): out += v
    return sorted(set(out))

items = []
for num, name, rows in CLAUSES:
    for i, (cid, title, desc, ev) in enumerate(rows):
        items.append({"id": f"C.{cid}", "kind": "clause", "group": num, "group_name": name, "ref": cid, "title": title, "description": desc, "evidence": ev, "qnrcs": qlinks(by27001, cid), "order": len(items) + 1})
for num, name, rows in ANNEX:
    for cid, title, desc, ev in rows:
        items.append({"id": f"A.{cid}", "kind": "control", "group": num, "group_name": name, "ref": cid, "title": title, "description": desc, "evidence": ev, "qnrcs": sorted(set(by27002.get(cid, []))), "order": len(items) + 1})

assert sum(1 for i in items if i['kind'] == 'control') == 93
out = {
  "source": {
    "title": "ISO/IEC 27001:2022 — guia AnkoraOne",
    "edition": "ISO/IEC 27001:2022 com a emenda 1:2024 (EN ISO/IEC 27001:2023)",
    "ref": "Estrutura das cláusulas 4 a 10 e do Anexo A. Títulos, descrições e evidências sugeridas escritos pela AnkoraOne; não reproduzem a norma.",
    "links_ref": "Ligações ao QNRCS: Regulamento do CNCS n.º 756/2026, Anexo I (referências oficiais à ISO/IEC 27001 e 27002)",
    "url": "https://www.iso.org/standard/27001",
    "validation": "por_validar",
    "note": "A norma é protegida por direitos de autor e não está incluída. Para certificação, a entidade deve usar o texto oficial e uma entidade certificadora acreditada."
  },
  "groups": [{"kind": "clause", "code": n, "name": nm} for n, nm, _ in CLAUSES] + [{"kind": "control", "code": n, "name": nm} for n, nm, _ in ANNEX],
  "items": items,
}
json.dump(out, open(os.path.join(ROOT, 'src/data/legal/iso27001.json'), 'w'), ensure_ascii=False, indent=1)
c = [i for i in items if i['kind'] == 'control']
print(len(items), 'itens;', len(c), 'controlos;', sum(1 for i in c if i['qnrcs']), 'com ligação QNRCS;', sum(1 for i in items if i['kind']=='clause' and i['qnrcs']), 'cláusulas ligadas')
