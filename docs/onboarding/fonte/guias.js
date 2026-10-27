// Gera os guias de implementação por referencial (NIS2/RJC, ISO/IEC 27001 e ISO/IEC 42001) em Word.
// As tabelas de tarefas, cláusulas, controlos e contagens vêm dos dados da Biblioteca Legal (src/data/legal e
// src/lib/legal/journeyTemplate.js), para que os guias não divirjam da plataforma. Textos das normas ISO não reproduzidos.
const fs = require('fs');
const path = require('path');
const { Packer } = require('docx');
const E = require('./estilo');
const { t, p, P, note, H1, H2, H3, B, N, gap, table, callout, tip, cover, toc, makeDocument } = E;

const ROOT = path.resolve(__dirname, '..', '..', '..');
const OUT = path.resolve(__dirname, '..', 'guias');
const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const qnrcs = read('src/data/legal/qnrcs.json');
const epr = read('src/data/legal/epr-measures.json');
const iso27 = read('src/data/legal/iso27001.json');
const iso42 = read('src/data/legal/iso42001.json');
const VERSION = 'Versão 1.0 · outubro de 2026';

async function write(doc, name) {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, name), await Packer.toBuffer(doc));
  console.log('ok', name);
}

const yes = (b) => (b ? 'Sim' : '');
const controlsOf = (iso) => iso.items.filter((i) => i.kind === 'control');
const clausesOf = (iso) => iso.items.filter((i) => i.kind === 'clause');
const byGroup = (items) => items.reduce((m, i) => { (m[i.group] ||= []).push(i); return m; }, {});

// ── Guia NIS2 / RJC ──────────────────────────────────────────────────────────────────────────────────
async function guiaNis2() {
  const { JOURNEY_TEMPLATE_PT: J } = await import(path.join(ROOT, 'src/lib/legal/journeyTemplate.js'));
  const objectives = qnrcs.objectives.map((o) => [o.name, o.categories.length, o.categories.reduce((n, c) => n + c.controls.length, 0)]);
  const totalControls = objectives.reduce((n, o) => n + o[2], 0);
  const perLevel = { basico: 0, substancial: 0, elevado: 0 };
  for (const o of qnrcs.objectives) for (const c of o.categories) for (const k of c.controls) for (const l of Object.keys(k.measures || {})) perLevel[l] += 1;
  const taskCount = J.reduce((n, s) => n + s.tasks.length, 0);

  const body = [...toc()];
  body.push(H1('1. O que é e a quem se aplica'),
    P('O **Regime Jurídico da Cibersegurança (RJC)**, em anexo ao **Decreto-Lei n.º 125/2025**, transpõe para Portugal a **Diretiva (UE) 2022/2555 (NIS2)**. O **Regulamento do CNCS n.º 756/2026** fixa as medidas mínimas, o Quadro Nacional de Referência para a Cibersegurança (QNRCS) e os procedimentos junto do Centro Nacional de Cibersegurança (CNCS).'),
    table(['Marco', 'Data'], [
      ['Entrada em vigor do DL 125/2025', '3 de abril de 2026'],
      ['Publicação do Regulamento n.º 756/2026', '22 de junho de 2026'],
      ['Efeitos dos arts. 27.º, n.os 1 e 2, 28.º a 30.º e 33.º do RJC (medidas, fornecedores, análise de riscos, relatório anual)', '22 de junho de 2028 (DL 125/2025, art. 10.º, n.º 2)'],
    ], [6.5, 3]),
    gap(),
    H2('Qualificações possíveis'),
    table(['Qualificação', 'O que implica'], [
      ['Entidade essencial', 'Todas as obrigações do RJC; relatório anual; medidas mínimas do nível de conformidade notificado pelo CNCS'],
      ['Entidade importante', 'Obrigações do RJC e medidas mínimas do nível de conformidade notificado'],
      ['Entidade pública relevante (Grupo A ou B)', 'Medidas do Anexo IV do Reg. 756/2026; o Grupo A aplica também as do Grupo B (art. 30.º, n.º 3)'],
      ['Não abrangida', 'Sem obrigações do RJC; pode seguir as medidas como boas práticas'],
    ], [3, 6.5]),
    gap(),
    callout('O nível de conformidade', [
      'Básico, Substancial ou Elevado. Só fica definido quando o CNCS o notifica; até lá, o cálculo da AnkoraOne é indicativo.',
      'Os níveis são cumulativos: quem está no Substancial ou no Elevado aplica também as medidas dos níveis inferiores (Reg. 756/2026, art. 30.º, n.º 2).',
    ]),
  );

  body.push(H1('2. O que a lei pede, por área'),
    P('A tabela resume as obrigações principais e onde as trabalhar na AnkoraOne. A base legal completa de cada uma está na Biblioteca Legal.'),
    table(['Área', 'Base legal', 'Na AnkoraOne'], [
      ['Registo e qualificação', 'RJC, arts. 8.º e 35.º; Reg. 756/2026, arts. 6.º a 11.º', 'Enquadramento · Jornada A'],
      ['Responsabilidade da gestão', 'RJC, art. 25.º', 'Jornada B · Documentos'],
      ['Responsável de cibersegurança e ponto de contacto', 'RJC, arts. 31.º e 32.º; Reg. 756/2026, arts. 14.º e 15.º', 'Jornada B'],
      ['Gestão dos riscos', 'RJC, arts. 26.º e 29.º; Reg. 756/2026, art. 31.º', 'Gestão de Risco · Jornada C'],
      ['Medidas de cibersegurança (nove áreas)', 'RJC, art. 27.º; Reg. 756/2026, art. 30.º e Anexos III e IV', 'Biblioteca Legal › Conformidade · Jornada D'],
      ['Ativos acessíveis pela Internet', 'Reg. 756/2026, art. 32.º', 'Ativos e ferramentas · Jornada D'],
      ['Cadeia de abastecimento', 'RJC, art. 28.º', 'Fornecedores · Cadeia de Abastecimento · Jornada E'],
      ['Incidentes', 'RJC, arts. 40.º a 44.º e 48.º; Reg. 756/2026, art. 20.º', 'Incidentes · Jornada F'],
      ['Formação', 'RJC, art. 25.º; QNRCS PR.FC', 'Jornada G'],
      ['Relatório anual e supervisão', 'RJC, arts. 30.º, 54.º e 55.º; Reg. 756/2026, art. 13.º', 'Relatórios · Jornada H'],
    ], [3, 3.6, 3]),
  );

  body.push(H1('3. As medidas mínimas'),
    H2('3.1 Entidades essenciais e importantes: o QNRCS'),
    P(`O Anexo I do Regulamento n.º 756/2026 tem **${totalControls} controlos** organizados em seis objetivos. O Anexo III indica, para cada controlo, a medida mínima por nível e o critério de verificação, que é o que a AnkoraOne mostra como «O que guardar como evidência».`),
    table(['Objetivo', 'Categorias', 'Controlos'], objectives.map((o) => [o[0], String(o[1]), String(o[2])]), [5, 2, 2]),
    gap(),
    P(`Medidas definidas por nível no Anexo III: **${perLevel.basico}** no Básico, **${perLevel.substancial}** no Substancial e **${perLevel.elevado}** no Elevado. Como os níveis são cumulativos, uma entidade no nível Elevado aplica as medidas dos três.`),
    H2('3.2 Entidades públicas relevantes: o Anexo IV'),
    P(`O Grupo B tem **${epr.group_B.length} medidas** e o Grupo A **${epr.group_A.length}**; uma entidade do Grupo A aplica as duas listas. Cada medida tem área, texto e critério de verificação.`),
    tip('Na AnkoraOne', ['Abra **Biblioteca Legal › Conformidade**: só aparecem as medidas do seu nível ou grupo. Para cada uma defina o estado e o responsável, guarde a evidência pedida e exporte o progresso em CSV.']),
  );

  body.push(H1('4. Roteiro de implementação'),
    P('A ordem abaixo segue a jornada da AnkoraOne. As fases 1 e 2 têm prazos curtos; comece por elas.'),
    table(['Fase', 'O que fazer', 'Na AnkoraOne', 'Resultado'], [
      ['0. Enquadramento', 'Confirmar se está abrangida, a qualificação e o nível', 'Clientes › Enquadramento', 'Relatório de enquadramento (PDF) e jornada criada'],
      ['1. Registo e governação', 'Conta no CNCS, autoidentificação, responsável e ponto de contacto, aprovação pela gestão', 'Jornada A e B · Documentos', 'Registo no CNCS; nomeações comunicadas; política aprovada'],
      ['2. Riscos e ativos', 'Inventário de ativos, análise de riscos anual, risco residual, lista do art. 32.º', 'Ativos e ferramentas · Gestão de Risco', 'Inventário, registo de riscos, lista enviada ao CNCS'],
      ['3. Medidas mínimas', 'Aplicar as medidas do nível e cobrir as nove áreas do art. 27.º', 'Biblioteca Legal › Conformidade · Evidências', 'Medidas com evidência aceite'],
      ['4. Fornecedores', 'Identificar os críticos e avaliar o risco todos os anos', 'Fornecedores · Questionários', 'Avaliações e cláusulas contratuais'],
      ['5. Incidentes', 'Critérios de incidente significativo, procedimento e canais alternativos', 'Incidentes', 'Procedimento testado; modelos de notificação'],
      ['6. Formação', 'Plano para todo o pessoal, formação específica e exercícios', 'Jornada G · Tarefas', 'Plano e registos de formação'],
      ['7. Relatórios e supervisão', 'Relatório anual, evidências organizadas, certificações', 'Relatórios · Repositório documental', 'Relatório anual entregue; dossiê pronto para o CNCS'],
    ], [2.2, 3.6, 2.6, 2.8]),
  );

  const refs = ['n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8'];
  body.push(H1(`5. A jornada completa (${taskCount} tarefas)`),
    P('Lista das tarefas da jornada de conformidade RJC_2026, com a base legal de cada uma. As tarefas marcadas produzem efeitos a 22 de junho de 2028.'));
  J.forEach((s, i) => {
    body.push(H2(s.section),
      table(['Tarefa', 'Base legal', 'Efeitos'], s.tasks.map((x) => [x.title, x.basis, x.from2028 ? 'A partir de 22-06-2028' : 'Já em vigor']), [5.2, 3.4, 1.6]));
    if (i === 0) body.push(note('A ordem das tarefas é a recomendada; pode trabalhar várias secções em paralelo.'));
  });
  void refs;

  body.push(H1('6. Prazos'),
    table(['Obrigação', 'Prazo', 'Base legal'], [
      ['Autoidentificação no CNCS', '30 dias após o início de atividade; 60 dias após a plataforma do CNCS ficar disponível, se já estiver em atividade', 'RJC, art. 8.º, n.º 1; Reg. 756/2026, art. 8.º'],
      ['Resposta ao projeto de qualificação', '10 dias úteis', 'Reg. 756/2026, art. 9.º'],
      ['Responsável de cibersegurança e ponto de contacto permanente', '20 dias úteis', 'RJC, arts. 31.º e 32.º; Reg. 756/2026, arts. 14.º e 15.º'],
      ['Alteração de dados do registo', '30 dias úteis (3 meses para os prestadores digitais do art. 35.º, n.º 4)', 'RJC, art. 35.º, n.os 3 e 4; Reg. 756/2026, art. 11.º'],
      ['Notificação inicial de incidente significativo', '24 horas', 'RJC, arts. 41.º e 42.º; Reg. 756/2026, art. 20.º'],
      ['Atualização da notificação', 'Até 72 horas', 'RJC, art. 42.º'],
      ['Fim do impacto', '24 horas após o fim do impacto', 'RJC, art. 43.º'],
      ['Relatório final do incidente', '30 dias úteis', 'RJC, art. 44.º'],
      ['Lista de ativos acessíveis pela Internet', 'Até 31 de janeiro do ano seguinte à qualificação ou em 6 meses (o que ocorrer primeiro); depois, anual', 'Reg. 756/2026, art. 32.º'],
      ['Relatório anual (entidades essenciais)', 'Último dia útil de janeiro do ano seguinte; o primeiro em janeiro de 2029, relativo a 2028', 'RJC, art. 30.º; Reg. 756/2026, art. 13.º'],
      ['Alterações às certificações', 'Revogação em 72 horas; restantes em 10 dias úteis', 'Reg. 756/2026, art. 27.º, n.º 6'],
      ['Adaptação a nova qualificação ou novas medidas', '6 meses', 'RJC, art. 26.º, n.º 8'],
    ], [3.4, 3.6, 3]),
    gap(),
    tip('Na AnkoraOne', ['Ao registar um incidente, a plataforma calcula os prazos de notificação a partir da hora de deteção e prepara os textos. Os lembretes de prazos configuram-se em **Definições**.']),
  );

  body.push(H1('7. A NIS2 e a ISO/IEC 27001'),
    P('O Anexo I do Regulamento n.º 756/2026 indica, para cada controlo do QNRCS, os controlos correspondentes da ISO/IEC 27001 e 27002. Com essas referências oficiais, **92 dos 93 controlos** do Anexo A da ISO/IEC 27001 ficam ligados a controlos do QNRCS. Uma evidência guardada para uma medida do RJC conta também no guia ISO/IEC 27001.'),
    P('A certificação ISO/IEC 27001 não substitui as obrigações do RJC (registo, notificações, relatório anual), mas a maior parte do trabalho de medidas e evidências é comum.'),
  );

  body.push(H1('8. Lista de verificação'),
    callout('Arranque', [
      '☐ Enquadramento confirmado e relatório guardado',
      '☐ Conta na plataforma do CNCS e autoidentificação feitas',
      '☐ Responsável de cibersegurança e ponto de contacto comunicados',
      '☐ Medidas de cibersegurança aprovadas pela gestão',
    ]),
    gap(),
    callout('Funcionamento', [
      '☐ Inventário de ativos e lista do art. 32.º enviada',
      '☐ Análise de riscos anual e risco residual',
      '☐ Medidas mínimas do nível com evidência aceite',
      '☐ Fornecedores críticos avaliados',
      '☐ Procedimento de incidentes testado e canais alternativos definidos',
      '☐ Plano de formação em curso',
      '☐ Relatório anual preparado (entidades essenciais)',
    ], E.TEALT, E.TEAL),
    gap(),
    note('Este guia descreve a plataforma e a legislação em outubro de 2026. As referências remetem para os textos publicados no Diário da República e no EUR-Lex, disponíveis na Biblioteca Legal.'),
  );

  await write(makeDocument({
    title: 'AnkoraOne — Guia NIS2 (RJC)', description: 'Guia de implementação do Regime Jurídico da Cibersegurança (NIS2) na AnkoraOne',
    headerText: 'Guia de implementação · NIS2 (RJC)',
    coverChildren: cover({ kicker: 'GUIA DE IMPLEMENTAÇÃO', title: 'NIS2 em Portugal: o Regime Jurídico da Cibersegurança', summary: 'O que a lei pede, as medidas mínimas por nível, o roteiro, a jornada completa com a base legal de cada tarefa e os prazos, com o caminho de cada passo na AnkoraOne.', version: VERSION }),
    body,
  }), 'AnkoraOne-Guia-NIS2.docx');
}

// ── Partes comuns aos guias ISO ──────────────────────────────────────────────────────────────────────
function clauseTable(iso) {
  return table(['Requisito', 'Título', 'Informação documentada', 'O que guardar'], clausesOf(iso).map((c) => [c.ref, c.title, yes(c.documented), c.evidence]), [1.1, 3.2, 1.6, 4.1]);
}
function annexAppendix(iso, extra) {
  const out = [];
  const groups = iso.groups.filter((g) => g.kind === 'control');
  const items = byGroup(controlsOf(iso));
  for (const g of groups) {
    out.push(H2(`A.${g.code} — ${g.name}`),
      table(extra ? ['Controlo', 'Título', 'O que guardar', extra.header] : ['Controlo', 'Título', 'O que guardar'],
        (items[g.code] || []).map((c) => (extra ? [c.id, c.title, c.evidence, extra.value(c)] : [c.id, c.title, c.evidence])),
        extra ? [1.2, 3, 3.8, 2] : [1.2, 3.6, 5]));
  }
  return out;
}
const certification = () => [
  table(['Etapa', 'O que acontece'], [
    ['Escolher a entidade certificadora', 'Uma entidade acreditada para a norma (em Portugal, a acreditação é dada pelo IPAC ou por um organismo de acreditação de outro país signatário dos acordos europeus).'],
    ['Auditoria de fase 1', 'Revisão da documentação e da preparação: âmbito, política, avaliação de riscos, Declaração de Aplicabilidade, auditoria interna e revisão pela gestão.'],
    ['Auditoria de fase 2', 'Verificação, no terreno, de que o sistema funciona e de que os controlos estão aplicados.'],
    ['Certificado e manutenção', 'Ciclo de 3 anos, com auditorias de acompanhamento anuais e auditoria de renovação no fim do ciclo.'],
  ], [3, 6.5]),
  gap(),
  tip('Preparar a auditoria na AnkoraOne', ['Exporte a Declaração de Aplicabilidade e a análise de lacunas, confirme que as cláusulas com informação documentada obrigatória têm evidência aceite e use o **Repositório documental** para entregar o dossiê.']),
];

// ── Guia ISO/IEC 27001 ───────────────────────────────────────────────────────────────────────────────
async function guia27001() {
  const ctrl = controlsOf(iso27);
  const g = byGroup(ctrl);
  const documented = clausesOf(iso27).filter((c) => c.documented);
  const linked = ctrl.filter((c) => c.qnrcs.length).length;
  const body = [...toc()];

  body.push(H1('1. O que é'),
    P('A **ISO/IEC 27001** define os requisitos de um sistema de gestão da segurança da informação (SGSI): como a organização decide o que proteger, avalia e trata os riscos, aplica controlos e melhora continuamente. É certificável por entidades acreditadas.'),
    table(['Ponto', 'Situação em outubro de 2026'], [
      ['Edição em vigor', 'ISO/IEC 27001:2022 (em Portugal e na Europa, EN ISO/IEC 27001:2023), com a emenda 1:2024 sobre alterações climáticas'],
      ['Edição anterior', 'ISO/IEC 27001:2013, com 114 controlos; o período de transição dos certificados terminou a 31 de outubro de 2025'],
      ['Norma complementar', 'ISO/IEC 27002:2022 descreve cada controlo do Anexo A em detalhe'],
    ], [2.6, 7]),
    gap(),
    callout('Sobre este guia', [
      'A norma é protegida por direitos de autor e **não está reproduzida**. Títulos, descrições e evidências sugeridas são da AnkoraOne; a estrutura (cláusulas 4 a 10 e os 93 controlos) foi conferida com o texto oficial em outubro de 2026.',
      'Para implementar e certificar, a entidade precisa de uma cópia licenciada da norma.',
    ]),
  );

  body.push(H1('2. Estrutura da norma'),
    H2('2.1 Requisitos do sistema de gestão (cláusulas 4 a 10)'),
    P('Estas cláusulas são obrigatórias e não podem ser excluídas. A coluna «Informação documentada» assinala onde a norma exige documentos ou registos.'),
    clauseTable(iso27),
    H2('2.2 Controlos do Anexo A'),
    table(['Tema', 'Controlos'], [
      ['A.5 Controlos organizacionais', String(g['5'].length)], ['A.6 Controlos de pessoas', String(g['6'].length)],
      ['A.7 Controlos físicos', String(g['7'].length)], ['A.8 Controlos tecnológicos', String(g['8'].length)],
      ['Total', String(ctrl.length)],
    ], [6, 3]),
    gap(),
    P('Os controlos do Anexo A não são todos obrigatórios: a organização escolhe-os a partir da avaliação de riscos e justifica cada decisão na Declaração de Aplicabilidade. A lista completa, com o que guardar como evidência, está no Anexo deste guia.'),
  );

  body.push(H1('3. Informação documentada obrigatória'),
    P('Lista mínima que a norma exige (cláusulas 4 a 10). A organização acrescenta os documentos que considerar necessários e os que os controlos escolhidos pedem (por exemplo políticas e procedimentos).'),
    table(['Cláusula', 'Documento ou registo'], documented.map((c) => [c.ref, `${c.title}: ${c.evidence}`]), [1.4, 8.2]),
    gap(),
    tip('Na AnkoraOne', ['Em **Biblioteca Legal › ISO/IEC 27001**, ative «Só requisitos com informação documentada obrigatória» para ver esta lista e o estado de cada item.']),
  );

  body.push(H1('4. Roteiro de implementação'),
    table(['Fase', 'Cláusulas', 'O que fazer', 'Na AnkoraOne'], [
      ['1. Contexto e âmbito', '4.1 a 4.4', 'Questões internas e externas, partes interessadas, âmbito do SGSI', 'Guia ISO › cláusula 4 · Documentos'],
      ['2. Liderança', '5.1 a 5.3', 'Política de segurança da informação aprovada; funções e responsabilidades', 'Documentos (aprovação assinada)'],
      ['3. Riscos', '6.1, 8.2, 8.3', 'Metodologia, avaliação e plano de tratamento; aceitação do risco residual', 'Gestão de Risco'],
      ['4. Declaração de Aplicabilidade', '6.1.3 d)', 'Decidir os 93 controlos, justificar e indicar o método de implementação', 'Guia ISO › Anexo A · exportação CSV'],
      ['5. Objetivos e recursos', '6.2, 7.1', 'Objetivos mensuráveis e recursos', 'Tarefas · Plano de Ação'],
      ['6. Pessoas', '7.2 a 7.4', 'Competências, sensibilização, comunicação', 'Tarefas · evidências de formação'],
      ['7. Controlos e operação', '8.1 e Anexo A', 'Aplicar os controlos e guardar evidências', 'Guia ISO · Evidências · Repositório documental'],
      ['8. Medição e auditoria', '9.1, 9.2', 'Indicadores; auditoria interna independente', 'Relatórios · Avaliações'],
      ['9. Revisão e melhoria', '9.3, 10', 'Revisão pela gestão; não conformidades e ações corretivas', 'Documentos · Plano de Ação'],
      ['10. Certificação', '—', 'Auditorias de fase 1 e 2 por entidade acreditada', 'Exportações e dossiê'],
    ], [2.2, 1.4, 3.6, 2.6]),
  );

  body.push(H1('5. Declaração de Aplicabilidade e análise de lacunas'),
    H2('5.1 Declaração de Aplicabilidade'),
    P('Para cada controlo do Anexo A, a AnkoraOne regista:'),
    B('**Aplicável ou não aplicável:** a exclusão exige justificação.'),
    B('**Justificação:** a razão da inclusão (risco, requisito legal ou contratual) ou da exclusão.'),
    B('**Método de implementação:** como o controlo é aplicado (política, procedimento, ferramenta, contrato).'),
    B('**Estado, responsável e data-alvo**, e as evidências ligadas.'),
    P('A exportação em CSV dá a Declaração pronta a aprovar pela gestão em **Documentos**.'),
    H2('5.2 Análise de lacunas'),
    P('Mostra o sistema de gestão (cláusulas) e os controlos em separado, como nos relatórios de análise de lacunas habituais. O estado de cada requisito traduz-se assim:'),
    table(['Estado na plataforma', 'Situação'], [['Concluído', 'Conforme'], ['Em curso', 'Parcialmente conforme'], ['Pendente', 'Não conforme'], ['Não aplicável (só controlos)', 'Não aplicável']], [4, 5.5]),
    gap(),
    note('É uma autoavaliação para planear o trabalho; não substitui a auditoria interna nem a de certificação.'),
  );

  body.push(H1('6. Ligação ao RJC (NIS2)'),
    P(`Com as referências oficiais do Regulamento n.º 756/2026 (Anexo I), **${linked} dos ${ctrl.length} controlos** do Anexo A estão ligados a controlos do QNRCS. No detalhe de cada controlo, a AnkoraOne mostra o critério de verificação oficial dessas medidas e conta as evidências já guardadas para elas.`),
    P('Uma entidade abrangida pelo RJC que implemente a ISO/IEC 27001 aproveita a maior parte do trabalho, mas continua a ter obrigações próprias do RJC: registo no CNCS, notificação de incidentes com prazos, lista de ativos do art. 32.º e relatório anual.'),
  );

  body.push(H1('7. Certificação'), ...certification());

  body.push(H1('8. Lista de verificação'),
    callout('Antes da auditoria de certificação', [
      '☐ Âmbito, política e objetivos aprovados',
      '☐ Metodologia de riscos, avaliação e plano de tratamento aprovados',
      '☐ Declaração de Aplicabilidade completa, com justificações, e aprovada',
      '☐ Controlos aplicáveis implementados e com evidência',
      '☐ Formação e sensibilização registadas',
      '☐ Indicadores medidos (9.1)',
      '☐ Auditoria interna feita e não conformidades tratadas',
      '☐ Revisão pela gestão realizada e registada',
    ]),
  );

  body.push(H1('Anexo. Controlos do Anexo A'),
    note('Títulos e evidências sugeridas escritos pela AnkoraOne; não reproduzem a norma.'),
    ...annexAppendix(iso27, { header: 'Controlos QNRCS', value: (c) => c.qnrcs.join(', ') || '—' }));

  await write(makeDocument({
    title: 'AnkoraOne — Guia ISO/IEC 27001', description: 'Guia de implementação da ISO/IEC 27001:2022 na AnkoraOne',
    headerText: 'Guia de implementação · ISO/IEC 27001:2022',
    coverChildren: cover({ kicker: 'GUIA DE IMPLEMENTAÇÃO', title: 'ISO/IEC 27001: segurança da informação', summary: 'Estrutura da norma, informação documentada obrigatória, roteiro, Declaração de Aplicabilidade, análise de lacunas, ligação ao RJC e certificação, com o caminho de cada passo na AnkoraOne.', version: VERSION }),
    body,
  }), 'AnkoraOne-Guia-ISO27001.docx');
}

// ── Guia ISO/IEC 42001 ───────────────────────────────────────────────────────────────────────────────
async function guia42001() {
  const ctrl = controlsOf(iso42);
  const g = byGroup(ctrl);
  const aiOnly = ctrl.filter((c) => !c.iso27001.length);
  const documented = clausesOf(iso42).filter((c) => c.documented);
  const titles27 = Object.fromEntries(iso27.items.map((i) => [i.id, i.title]));
  const body = [...toc()];

  body.push(H1('1. O que é'),
    P('A **ISO/IEC 42001:2023** (1.ª edição, dezembro de 2023) define os requisitos de um sistema de gestão da inteligência artificial: como uma organização que desenvolve, fornece ou usa sistemas de IA os governa de forma responsável, avalia os riscos e o impacto nas pessoas e na sociedade e melhora continuamente. É certificável por entidades acreditadas.'),
    table(['Ponto', 'O que saber'], [
      ['A quem se aplica', 'A qualquer organização que desenvolva, forneça ou use sistemas de IA, seja qual for a dimensão ou o setor'],
      ['Papel da organização', 'Define-se para cada sistema (por exemplo fornecedor, produtor, cliente ou utilizador) e muda os controlos aplicáveis'],
      ['Estrutura', 'A mesma das outras normas de sistemas de gestão (cláusulas 4 a 10), o que permite integrá-la com a ISO/IEC 27001'],
      ['Regulamento da IA', 'A norma não substitui as obrigações do Regulamento (UE) 2024/1689; ajuda a organizar a gestão, os riscos e a documentação que ele também pede'],
    ], [2.6, 7]),
    gap(),
    callout('Sobre este guia', [
      'A norma é protegida por direitos de autor e **não está reproduzida**. Títulos, descrições e evidências sugeridas são da AnkoraOne; a estrutura (cláusulas, os 38 controlos do Anexo A e o Anexo C) foi conferida com o texto oficial em outubro de 2026.',
      'O Anexo B da norma (orientação de implementação de cada controlo) é normativo e deve ser lido no texto oficial.',
    ]),
  );

  body.push(H1('2. Estrutura da norma'),
    H2('2.1 Requisitos do sistema de gestão (cláusulas 4 a 10)'),
    P('Iguais em estrutura aos da ISO/IEC 27001, com uma diferença importante: a **avaliação de impacto dos sistemas de IA** (6.1.4 no planeamento e 8.4 na operação).'),
    clauseTable(iso42),
    H2('2.2 Controlos do Anexo A'),
    table(['Domínio', 'Controlos'], iso42.groups.filter((x) => x.kind === 'control').map((x) => [`A.${x.code} ${x.name}`, String(g[x.code].length)]).concat([['Total', String(ctrl.length)]]), [7, 2]),
    gap(),
    P(`Tal como na 27001, os controlos escolhem-se a partir dos riscos e da avaliação de impacto, com justificação na Declaração de Aplicabilidade. **${ctrl.length - aiOnly.length}** apoiam-se em requisitos da ISO/IEC 27001 e **${aiOnly.length}** são próprios da IA.`),
  );

  body.push(H1('3. A avaliação de impacto'),
    P('É o requisito que mais distingue a 42001. A avaliação de riscos pergunta o que pode afetar a organização; a avaliação de impacto pergunta que efeitos o sistema de IA pode ter **nas pessoas, em grupos de pessoas e na sociedade**, mesmo quando não há qualquer falha de segurança (por exemplo decisões injustas ou difíceis de explicar).'),
    table(['Requisito', 'O que pede (resumo AnkoraOne)'], [
      ['6.1.4 e 8.4', 'Processo de avaliação de impacto, aplicado a intervalos planeados e em alterações significativas; resultados usados na avaliação de riscos'],
      ['A.5.2', 'Processo definido para avaliar as consequências ao longo do ciclo de vida'],
      ['A.5.3', 'Resultados documentados e conservados durante um período definido'],
      ['A.5.4', 'Impacto em pessoas ou grupos (equidade, privacidade, segurança física)'],
      ['A.5.5', 'Impacto na sociedade'],
    ], [2, 7.5]),
    gap(),
    H3('Como fazer'),
    N('Descreva o sistema: finalidade, utilizadores, pessoas afetadas, dados usados e onde funciona.', 'n1'),
    N('Identifique os efeitos possíveis, positivos e negativos, usando os objetivos e as fontes de risco do Anexo C (secção 6).', 'n1'),
    N('Avalie a gravidade e a probabilidade e decida as medidas (controlos do Anexo A, supervisão humana, informação aos utilizadores).', 'n1'),
    N('Registe o resultado, a decisão e quem a aprovou; repita quando o sistema mudar de forma significativa.', 'n1'),
    tip('Na AnkoraOne', ['Guarde cada avaliação como evidência ligada a 6.1.4 e aos controlos A.5.2 a A.5.5 do guia ISO/IEC 42001. Use a **Gestão de Risco** para os riscos que dela resultem.']),
  );

  body.push(H1('4. Integração com a ISO/IEC 27001'),
    P('Se a entidade já tem (ou está a construir) um SGSI, a 42001 deve alargá-lo, e não criar um segundo sistema.'),
    table(['Elemento', 'Abordagem'], [
      ['Contexto, partes interessadas e âmbito', 'Uma análise única, alargada às questões e às partes interessadas da IA; âmbito com os sistemas de IA e o papel da entidade'],
      ['Política', 'Política integrada ou política de IA alinhada com a de segurança, com o mesmo responsável'],
      ['Riscos', 'A mesma metodologia, com critérios próprios para as consequências da IA; avaliação de impacto acrescentada'],
      ['Informação documentada, competências, comunicação', 'Os mesmos processos, com conteúdo de IA acrescentado'],
      ['Auditoria interna e revisão pela gestão', 'Um programa e uma revisão para as duas normas, com pontos próprios para a IA'],
      ['Declaração de Aplicabilidade', '**Uma por norma**: os Anexos A são diferentes (93 e 38 controlos)'],
    ], [3.2, 6.4]),
    gap(),
    P('Na AnkoraOne, cada controlo da 42001 mostra os requisitos da 27001 em que se apoia e conta as evidências que já lá estão. Os controlos sem base na 27001 têm de ser criados de raiz:'),
    table(['Controlo', 'Título'], aiOnly.map((c) => [c.id, c.title]), [1.6, 8]),
  );

  body.push(H1('5. Roteiro de implementação'),
    table(['Fase', 'Cláusulas e controlos', 'O que fazer', 'Na AnkoraOne'], [
      ['1. Inventário e papel', '4.1 a 4.3; A.4', 'Lista de sistemas de IA, papel em cada um, recursos (dados, ferramentas, computação, pessoas), âmbito', 'Guia ISO/IEC 42001 · Ativos e ferramentas'],
      ['2. Liderança', '5; A.2, A.3', 'Política de IA, alinhamento com outras políticas, responsabilidades, canal para preocupações', 'Documentos'],
      ['3. Riscos e impacto', '6.1, 8.2 a 8.4; A.5', 'Critérios, avaliação de riscos, avaliação de impacto por sistema, plano de tratamento', 'Gestão de Risco · Evidências'],
      ['4. Declaração de Aplicabilidade', '6.1.3', 'Decidir os 38 controlos, justificar e indicar o método de implementação', 'Guia ISO/IEC 42001 · exportação CSV'],
      ['5. Ciclo de vida e dados', 'A.6, A.7', 'Requisitos, documentação, verificação e validação, entrada em produção, monitorização, registos; qualidade e proveniência dos dados', 'Evidências · Repositório documental'],
      ['6. Informação e utilização', 'A.8, A.9', 'Informação aos utilizadores, reporte externo, comunicação de incidentes, utilização prevista', 'Documentos · Incidentes'],
      ['7. Terceiros', 'A.10', 'Responsabilidades partilhadas, fornecedores de IA, expectativas dos clientes', 'Fornecedores · Questionários'],
      ['8. Avaliação e melhoria', '9, 10', 'Indicadores, auditoria interna, revisão pela gestão, ações corretivas', 'Relatórios · Plano de Ação'],
    ], [2, 2, 3.6, 2.4]),
  );

  body.push(H1('6. Objetivos e fontes de risco (Anexo C)'),
    P('O Anexo C é informativo e não exaustivo. Ajuda a escolher os objetivos de IA (6.2) e a identificar riscos (6.1.2).'),
    H2('Objetivos'),
    table(['Ref.', 'Objetivo', 'Em resumo'], iso42.objectives.map((o) => [o.id, o.title, o.description]), [1.2, 3, 5.4]),
    H2('Fontes de risco'),
    table(['Ref.', 'Fonte de risco', 'Em resumo'], iso42.risk_sources.map((o) => [o.id, o.title, o.description]), [1.2, 3, 5.4]),
  );

  body.push(H1('7. Informação documentada obrigatória'),
    table(['Cláusula', 'Documento ou registo'], documented.map((c) => [c.ref, `${c.title}: ${c.evidence}`]), [1.4, 8.2]),
  );

  body.push(H1('8. Certificação'), ...certification());

  body.push(H1('9. Lista de verificação'),
    callout('Antes da auditoria de certificação', [
      '☐ Inventário de sistemas de IA e papel da entidade em cada um',
      '☐ Âmbito, política de IA e responsabilidades aprovados',
      '☐ Avaliação de riscos de IA e avaliação de impacto de cada sistema registadas',
      '☐ Declaração de Aplicabilidade da 42001 completa e aprovada (separada da 27001)',
      '☐ Controlos do ciclo de vida e dos dados com evidência',
      '☐ Informação aos utilizadores e plano de comunicação de incidentes',
      '☐ Fornecedores de IA avaliados',
      '☐ Auditoria interna e revisão pela gestão com pontos de IA',
    ]),
  );

  body.push(H1('Anexo. Controlos do Anexo A'),
    note('Títulos e evidências sugeridas escritos pela AnkoraOne; não reproduzem a norma. A coluna da direita indica os requisitos da ISO/IEC 27001 em que o controlo se apoia (orientação AnkoraOne).'),
    ...annexAppendix(iso42, { header: 'Base na ISO/IEC 27001', value: (c) => (c.iso27001.length ? c.iso27001.map((id) => `${id.startsWith('C.') ? `Cláusula ${id.slice(2)}` : id} ${titles27[id] || ''}`.trim()).join('\n') : 'Próprio da IA') }));

  await write(makeDocument({
    title: 'AnkoraOne — Guia ISO/IEC 42001', description: 'Guia de implementação da ISO/IEC 42001:2023 na AnkoraOne',
    headerText: 'Guia de implementação · ISO/IEC 42001:2023',
    coverChildren: cover({ kicker: 'GUIA DE IMPLEMENTAÇÃO', title: 'ISO/IEC 42001: gestão da inteligência artificial', summary: 'Estrutura da norma, avaliação de impacto, integração com a ISO/IEC 27001, roteiro, objetivos e fontes de risco, informação documentada e certificação, com o caminho de cada passo na AnkoraOne.', version: VERSION }),
    body,
  }), 'AnkoraOne-Guia-ISO42001.docx');
}

(async () => {
  await guiaNis2();
  await guia27001();
  await guia42001();
})();
