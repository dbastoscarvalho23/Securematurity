// Modelos de registo para auditoria (AO-REG-01 a AO-REG-05).
// Mesmo estilo dos documentos de onboarding (docs/onboarding/fonte/estilo.js), com marca de água e cabeçalho próprios.
// Gerar: cd docs/governanca/modelos/fonte && node modelos.js   → docs/governanca/modelos/*.docx
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, ShadingType,
  AlignmentType, LevelFormat, BorderStyle, Header, Footer, PageNumber, VerticalAlign, HeadingLevel,
  HorizontalPositionRelativeFrom, VerticalPositionRelativeFrom, HorizontalPositionAlign, VerticalPositionAlign,
  TextWrappingType,
} = require('docx');

const DIR = __dirname;
const OUT = path.resolve(DIR, '..');
const NAVY = '070A13', GOLD = 'CFA04A', TEAL = '26A699', INK = '111827', MUTED = '5B6474', LINE = 'D9DEE7';
const TINT = 'F4F1EA', TEALT = 'E6F5F3', LABEL = 'F3F5F8', GOLD_DARK = '8A6620', TEAL_DARK = '17766C';
const FONT = 'Calibri';
const W = 9638; // largura útil A4 com margens de 2 cm (DXA)
const VERSAO = '1.0';
const DATA = 'outubro de 2026';

const logoNavy = fs.readFileSync(path.join(DIR, 'logo-navy.png'));
const logoWhite = fs.readFileSync(path.join(DIR, 'logo-white.png'));
const marca = fs.readFileSync(path.join(DIR, 'marca-agua.png'));

const t = (text, o = {}) => new TextRun({ text, font: FONT, ...o });
const rich = (s, o = {}) => String(s).split(/(\*\*[^*]+\*\*)/).filter(Boolean)
  .map((x) => (x.startsWith('**') ? t(x.slice(2, -2), { bold: true, ...o }) : t(x, o)));
const P = (s, o = {}) => new Paragraph({ spacing: { after: 120, line: 288 }, ...o, children: rich(s) });
const H = (s) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [t(s)] });
const gap = (after = 80) => new Paragraph({ spacing: { after }, children: [] });

const line = { style: BorderStyle.SINGLE, size: 4, color: LINE };
const borders = { top: line, bottom: line, left: line, right: line };
const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const noBorders = { top: none, bottom: none, left: none, right: none };

const widthsOf = (ratios) => {
  const sum = ratios.reduce((a, b) => a + b, 0);
  const ws = ratios.map((r) => Math.round((r / sum) * W));
  ws[ws.length - 1] += W - ws.reduce((a, b) => a + b, 0);
  return ws;
};
const cell = (children, width, o = {}) => new TableCell({
  width: { size: width, type: WidthType.DXA }, borders, margins: { top: 90, bottom: 90, left: 120, right: 120 },
  verticalAlign: VerticalAlign.CENTER, ...o, children,
});
const para = (s, o = {}, keepNext = false) => new Paragraph({ spacing: { after: 30 }, keepNext, keepLines: keepNext, children: rich(s, o) });
const hint = (s) => new Paragraph({ spacing: { after: 30 }, children: [t(s, { italics: true, color: '9AA3B2', size: 17 })] });

/** Campos a preencher: rótulo à esquerda, espaço em branco (com dica opcional) à direita. */
function form(rows, ratios = [3.2, 6.8]) {
  const ws = widthsOf(ratios);
  return new Table({
    width: { size: W, type: WidthType.DXA }, columnWidths: ws,
    rows: rows.map(([label, help, tall]) => new TableRow({
      cantSplit: true, height: { value: tall ? 900 : 440, rule: 'atLeast' },
      children: [
        cell([para(label, { bold: true, size: 19, color: NAVY })], ws[0], { shading: { fill: LABEL, type: ShadingType.CLEAR, color: 'auto' } }),
        cell(String(help || '').split('\n').map((l) => (l.startsWith('☐') ? para(l, { size: 19 }) : (l ? hint(l) : para('')))), ws[1]),
      ],
    })),
  });
}

/** Caixas de escolha numa linha de formulário. */
const boxes = (opts) => opts.map((o) => `☐ ${o}`).join('     ');

/** Grelha com cabeçalho azul-escuro e linhas em branco (ou pré-preenchidas na 1.ª coluna). */
function grid(headers, ratios, rows) {
  const ws = widthsOf(ratios);
  const head = new TableRow({ tableHeader: true, children: headers.map((h, i) => cell([para(h, { bold: true, color: 'FFFFFF', size: 18 })], ws[i], { shading: { fill: NAVY, type: ShadingType.CLEAR, color: 'auto' } })) });
  const body = rows.map((r) => new TableRow({ cantSplit: true, height: { value: 480, rule: 'atLeast' }, children: headers.map((_, i) => cell([para(r[i] || '', { size: 19 })], ws[i])) }));
  return new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: ws, rows: [head, ...body] });
}
const blank = (n, first = []) => Array.from({ length: n }, (_, i) => [first[i] || '']);

/** Caixa de destaque. */
function callout(title, lines, fill = TINT, color = GOLD_DARK) {
  const b = { style: BorderStyle.SINGLE, size: 4, color: fill };
  return new Table({
    width: { size: W, type: WidthType.DXA }, columnWidths: [W],
    rows: [new TableRow({ children: [new TableCell({
      width: { size: W, type: WidthType.DXA }, shading: { fill, type: ShadingType.CLEAR, color: 'auto' },
      borders: { top: b, bottom: b, left: b, right: b }, margins: { top: 120, bottom: 120, left: 200, right: 200 },
      children: [new Paragraph({ spacing: { after: 60 }, children: [t(title, { bold: true, color })] }),
        ...lines.map((l) => new Paragraph({ spacing: { after: 40, line: 276 }, children: rich(l, { size: 19 }) }))],
    })] })],
  });
}

/** Assinaturas: uma coluna por interveniente. */
function signatures(roles) {
  const ws = widthsOf(roles.map(() => 1));
  const rowsOf = ['Nome', 'Função', 'Data', 'Assinatura'];
  return new Table({
    width: { size: W, type: WidthType.DXA }, columnWidths: ws,
    rows: [
      new TableRow({ cantSplit: true, children: roles.map((r, i) => cell([para(r, { bold: true, color: 'FFFFFF', size: 18 }, true)], ws[i], { shading: { fill: NAVY, type: ShadingType.CLEAR, color: 'auto' } })) }),
      ...rowsOf.map((label) => new TableRow({ cantSplit: true, height: { value: label === 'Assinatura' ? 900 : 420, rule: 'atLeast' }, children: roles.map((_, i) => cell([para(label, { size: 16, color: MUTED }, label !== 'Assinatura')], ws[i], { verticalAlign: VerticalAlign.TOP })) })),
    ],
  });
}

/** Bloco de título na primeira página: faixa azul-escura com logótipo, código e finalidade. */
function titleBlock({ code, title, purpose }) {
  return new Table({
    width: { size: W, type: WidthType.DXA }, columnWidths: [W],
    rows: [new TableRow({ children: [new TableCell({
      width: { size: W, type: WidthType.DXA }, shading: { fill: NAVY, type: ShadingType.CLEAR, color: 'auto' },
      borders: noBorders, margins: { top: 300, bottom: 300, left: 360, right: 360 },
      children: [
        new Paragraph({ spacing: { after: 240 }, children: [new ImageRun({ type: 'png', data: logoWhite, transformation: { width: 170, height: 39 } })] }),
        new Paragraph({ spacing: { after: 80 }, children: [t(`MODELO DE REGISTO · ${code}`, { color: GOLD, bold: true, size: 18, characterSpacing: 40 })] }),
        new Paragraph({ spacing: { after: 160 }, children: [t(title, { color: 'FFFFFF', bold: true, size: 40 })] }),
        new Paragraph({ spacing: { after: 0, line: 288 }, children: [t(purpose, { color: 'C9CFDA', size: 20 })] }),
      ],
    })] })],
  });
}

/** Controlo do registo: igual em todos os modelos. */
const control = (code) => form([
  ['N.º do registo', `${code}-AAAA-NNN (ano e número sequencial)`],
  ['Data', 'DD/MM/AAAA'],
  ['Preenchido por', 'Nome e função'],
  ['Local de arquivo', 'Pasta, repositório ou ligação onde o registo assinado fica guardado'],
  ['Prazo de conservação', 'Conforme a política de retenção da Neora e o contrato com o cliente'],
]);

function buildDoc({ code, title, purpose, instructions, body }) {
  const watermark = new Paragraph({ children: [new ImageRun({
    type: 'png', data: marca, transformation: { width: 420, height: 365 },
    floating: {
      horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, align: HorizontalPositionAlign.CENTER },
      verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, align: VerticalPositionAlign.CENTER },
      behindDocument: true, allowOverlap: true, wrap: { type: TextWrappingType.NONE },
    },
    altText: { name: 'Marca de água AnkoraOne', description: 'Símbolo A1 da AnkoraOne', title: 'Marca de água' },
  })] });
  const ws = widthsOf([5, 5]);
  const header = new Header({ children: [
    new Table({
      width: { size: W, type: WidthType.DXA }, columnWidths: ws,
      rows: [new TableRow({ children: [
        new TableCell({ width: { size: ws[0], type: WidthType.DXA }, borders: { ...noBorders, bottom: { style: BorderStyle.SINGLE, size: 6, color: GOLD } }, verticalAlign: VerticalAlign.BOTTOM,
          margins: { bottom: 80 }, children: [new Paragraph({ children: [new ImageRun({ type: 'png', data: logoNavy, transformation: { width: 120, height: 27 } })] })] }),
        new TableCell({ width: { size: ws[1], type: WidthType.DXA }, borders: { ...noBorders, bottom: { style: BorderStyle.SINGLE, size: 6, color: GOLD } }, verticalAlign: VerticalAlign.BOTTOM,
          margins: { bottom: 80 }, children: [
            new Paragraph({ alignment: AlignmentType.RIGHT, children: [t(`${code} · ${title}`, { color: NAVY, bold: true, size: 16 })] }),
            new Paragraph({ alignment: AlignmentType.RIGHT, children: [t('Uso interno e do cliente · Confidencial', { color: MUTED, size: 15 })] }),
          ] }),
      ] })],
    }),
    watermark,
  ] });
  const footer = new Footer({ children: [new Paragraph({
    border: { top: { style: BorderStyle.SINGLE, size: 4, color: LINE, space: 4 } },
    tabStops: [{ type: 'right', position: W }],
    children: [
      t(`AnkoraOne · Neora Consulting · Modelo ${code}, versão ${VERSAO} (${DATA})`, { color: MUTED, size: 15 }),
      t('\tPágina ', { color: MUTED, size: 15 }),
      new TextRun({ children: [PageNumber.CURRENT], font: FONT, color: MUTED, size: 15 }),
      t(' de ', { color: MUTED, size: 15 }),
      new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, color: MUTED, size: 15 }),
    ],
  })] });

  return new Document({
    creator: 'AnkoraOne', title: `${code} · ${title}`, description: purpose,
    styles: {
      default: { document: { run: { font: FONT, size: 21, color: INK } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 26, bold: true, color: GOLD_DARK, font: FONT }, paragraph: { spacing: { before: 300, after: 120 }, outlineLevel: 0, keepNext: true } },
      ],
    },
    numbering: { config: [{ reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] }] },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1500, bottom: 1134, left: 1134, right: 1134, header: 500, footer: 500 } } },
      headers: { default: header }, footers: { default: footer },
      children: [
        titleBlock({ code, title, purpose }), gap(200),
        callout('Como preencher', instructions, TEALT, TEAL_DARK), gap(120),
        H('Controlo do registo'), control(code),
        ...body,
      ],
    }],
  });
}

// ── Modelos ─────────────────────────────────────────────────────────────────────────────────────────

const MODELOS = [
  {
    file: 'AO-REG-01-Registo-de-alteracao-e-publicacao.docx',
    code: 'AO-REG-01', title: 'Registo de alteração e publicação',
    purpose: 'Prova, para cada alteração à plataforma, quem a pediu, como foi testada e revista, quando foi publicada e como se volta atrás.',
    instructions: [
      'Um registo por publicação em produção. Alterações agrupadas no mesmo PR partilham o registo.',
      'Preencha a secção 4 com o resultado e a evidência (ligação ao PR, ao teste ou ao relatório de revisão).',
      'Uma alteração que toque na Biblioteca Legal exige a decisão explícita do responsável do repositório antes da publicação.',
    ],
    body: [
      H('1. Identificação'),
      form([
        ['Título da alteração', 'Resumo numa linha'],
        ['Pedida por', 'Nome e organização'],
        ['Motivo', boxes(['Requisito novo', 'Correção', 'Segurança', 'Legal ou regulatório'])],
        ['PR no GitHub', 'Número e ligação'],
        ['Ramo e autor do código', ''],
        ['Data do pedido', 'DD/MM/AAAA'],
      ]),
      H('2. Classificação'),
      form([
        ['Urgência', boxes(['Normal', 'Urgente (segurança ou falha em produção)'])],
        ['Âmbito sensível (assinale tudo o que se aplica)', [boxes(['Biblioteca Legal ou modelos documentais', 'Regras de acesso ou dados de clientes']), boxes(['Segredos ou integrações externas', 'Dados pessoais'])].join('\n')],
      ]),
      H('3. Avaliação de impacto'),
      form([
        ['Componentes afetados', 'Páginas, funções, entidades, workflows', true],
        ['Clientes afetados', 'Todos, alguns (quais) ou nenhum'],
        ['Dados pessoais', 'Sim ou não; se sim, que categorias'],
        ['Alterações ao modelo de dados', 'Entidades ou campos criados, alterados ou removidos'],
        ['Riscos e mitigação', '', true],
      ]),
      H('4. Testes e verificações'),
      grid(['Verificação', 'Resultado', 'Evidência'], [3.6, 2, 4.4], [
        ['Teste «checks» no GitHub (obrigatório no ramo main)'], ['Integridade da Biblioteca Legal (manifesto SHA-256)'],
        ['Verificação de nomes por definir nas funções'], ['Regras de acesso delegado atualizadas'],
        ['Testes do servidor próprio (quando aplicável)'], ['Testes manuais na app'], ['Revisão independente'],
      ]),
      H('5. Publicação'),
      form([
        ['Checkpoint publicado', 'Identificador na Base44 (ou versão no servidor próprio)'],
        ['Commit', 'Hash Git do código publicado'],
        ['Data e hora', 'DD/MM/AAAA HH:MM (hora de Lisboa)'],
        ['Publicado por', ''],
        ['Versão de reversão', 'Checkpoint ou versão anterior, para voltar atrás se for preciso'],
        ['Verificação após publicar', 'O que foi conferido em produção e com que resultado', true],
      ]),
      H('6. Aprovação'),
      signatures(['Autor', 'Revisor', 'Responsável pela publicação']),
    ],
  },
  {
    file: 'AO-REG-02-Autorizacao-de-acesso-delegado.docx',
    code: 'AO-REG-02', title: 'Autorização de acesso delegado',
    purpose: 'Formaliza a autorização do cliente para que um consultor ou auditor aceda aos seus dados na AnkoraOne, com nível, finalidade e prazo.',
    instructions: [
      'Complementa a aprovação feita na app (Definições › Acessos), que fica registada na trilha de auditoria. Os dois devem coincidir no nível e no prazo.',
      'Quem autoriza é o administrador do próprio cliente. A plataforma pede e acompanha, mas não decide.',
      'Prazo máximo: 365 dias para uma delegação; 30 dias, só de leitura, para um acesso externo.',
    ],
    body: [
      H('1. Cliente'),
      form([
        ['Entidade', 'Denominação social'],
        ['NIF', ''],
        ['Quem autoriza', 'Nome, função e email do administrador do cliente na AnkoraOne'],
      ]),
      H('2. Pessoa autorizada'),
      form([
        ['Nome', ''],
        ['Organização', 'Por exemplo, Neora Consulting ou entidade auditora'],
        ['Email da conta na AnkoraOne', ''],
        ['Função', 'Consultor, auditor, outro'],
      ]),
      H('3. Âmbito do acesso'),
      form([
        ['Tipo', boxes(['Delegação (até 365 dias)', 'Externo, só leitura (até 30 dias)'])],
        ['Nível', boxes(['Leitura', 'Contribuidor', 'Administrador'])],
        ['Finalidade', 'Para que serve o acesso (por exemplo, acompanhamento da conformidade com o RJC)', true],
        ['Áreas abrangidas', 'Toda a conta do cliente ou áreas específicas'],
        ['Início', 'DD/MM/AAAA'],
        ['Fim', 'DD/MM/AAAA (o acesso termina automaticamente nesta data)'],
      ]),
      H('4. Enquadramento e obrigações'),
      form([
        ['Contrato de prestação de serviços', 'Referência e data'],
        ['Acordo de tratamento de dados', 'Referência e data (art. 28.º do Regulamento (UE) 2016/679, RGPD)'],
      ]),
      gap(100),
      callout('A pessoa autorizada compromete-se a:', [
        '• manter a confidencialidade da informação a que tenha acesso;',
        '• usar o acesso só para a finalidade indicada na secção 3;',
        '• não retirar dados da plataforma sem autorização escrita do cliente;',
        '• comunicar de imediato ao cliente e à Neora qualquer suspeita de incidente ou de acesso indevido;',
        '• deixar de usar o acesso na data de fim ou logo que seja revogado.',
      ]),
      H('5. Registo na app'),
      form([
        ['Identificador da atribuição', 'Em Definições › Acessos'],
        ['Data do pedido', ''],
        ['Data da aprovação', ''],
        ['Aprovado na app por', 'Conta do administrador do cliente'],
      ]),
      H('6. Revogação ou fim antecipado'),
      form([
        ['Data', ''],
        ['Motivo', boxes(['Fim do serviço', 'Pedido do cliente', 'Renúncia', 'Incidente'])],
        ['Revogado na app por', ''],
      ]),
      H('7. Assinaturas'),
      signatures(['Cliente', 'Pessoa autorizada', 'Neora Consulting']),
    ],
  },
  {
    file: 'AO-REG-03-Registo-de-credencial-tecnica.docx',
    code: 'AO-REG-03', title: 'Registo de credencial técnica',
    purpose: 'Regista a entrega, a guarda e a revogação de credenciais técnicas: chaves de API, contas de alojamento e acessos a consolas ou ao DNS.',
    instructions: [
      '**Nunca escreva neste registo a palavra-passe, a chave ou o código.** Regista-se apenas onde a credencial fica guardada e quem a pode usar.',
      'Peça sempre o acesso mínimo necessário para a finalidade.',
      'Uma credencial sem finalidade em curso é revogada, e a revogação regista-se na secção 4.',
    ],
    body: [
      H('1. Credencial'),
      form([
        ['Tipo', boxes(['Chave de API', 'Conta de serviço', 'Acesso a consola', 'Certificado', 'Outro'])],
        ['Sistema', 'Por exemplo: Base44, fornecedor de alojamento, registador do domínio, GitHub'],
        ['Finalidade', 'Para que é usada e em que fase do plano', true],
        ['Permissões concedidas', 'Âmbito exato (leitura, escrita, administração)'],
        ['Titular da conta', 'Pessoa ou organização que detém a conta de origem'],
      ]),
      H('2. Entrega e guarda'),
      form([
        ['Entregue por', 'Nome e função'],
        ['Recebida por', 'Nome e função'],
        ['Data da entrega', ''],
        ['Onde fica guardada', 'Por exemplo: segredo do GitHub Actions, segredo da app, gestor de palavras-passe'],
        ['Nome do segredo', 'Nome da variável ou da entrada; nunca o valor'],
        ['Quem lhe pode aceder', ''],
      ]),
      H('3. Ciclo de vida'),
      form([
        ['Validade', 'Data de expiração definida na origem, se existir'],
        ['Rotação prevista', 'Periodicidade ou data'],
        ['Próxima revisão da necessidade', 'DD/MM/AAAA'],
      ]),
      H('4. Revogação'),
      form([
        ['Data', ''],
        ['Motivo', boxes(['Fim da finalidade', 'Rotação', 'Suspeita de exposição', 'Saída da pessoa'])],
        ['Revogada por', ''],
        ['Confirmação', 'Como se confirmou que deixou de funcionar'],
      ]),
      H('5. Assinaturas'),
      signatures(['Quem entrega', 'Quem recebe']),
    ],
  },
  {
    file: 'AO-REG-04-Ata-e-registo-de-decisoes.docx',
    code: 'AO-REG-04', title: 'Ata e registo de decisões',
    purpose: 'Regista o que foi decidido numa reunião, porquê e quem fica responsável. Cada decisão fica numerada para se poder citar nos PR e no plano executivo.',
    instructions: [
      'Numere as decisões como D-AAAA-NNN, seguindo a numeração das reuniões anteriores.',
      'Registe também as alternativas que foram afastadas e porquê: é o que mais falta faz quando a decisão é revista.',
      'A ata fica aprovada quando todos os participantes a assinam ou a confirmam por email (indique a data na secção 6).',
    ],
    body: [
      H('1. Reunião'),
      form([
        ['Assunto', ''],
        ['Data e hora', ''],
        ['Local ou meio', 'Presencial (onde) ou videochamada'],
        ['Convocada por', ''],
        ['Participantes', 'Nome, organização e função de cada um', true],
        ['Documentos de apoio', 'Por exemplo: plano executivo (versão e data)'],
      ]),
      H('2. Ordem de trabalhos'),
      grid(['N.º', 'Ponto'], [0.8, 9.2], blank(5, ['1', '2', '3', '4', '5'])),
      H('3. Decisões'),
      grid(['N.º', 'Decisão', 'Alternativas afastadas', 'Fundamento', 'Responsável', 'Prazo'], [1.2, 2.6, 2, 2, 1.4, 1.1], blank(5)),
      H('4. Ações'),
      grid(['N.º', 'Ação', 'Responsável', 'Prazo', 'Estado'], [0.8, 4.6, 1.8, 1.4, 1.4], blank(5)),
      H('5. Pontos em aberto'),
      form([['Ponto', 'O que falta para decidir e quem traz a informação', true], ['Ponto', '', true]]),
      H('6. Aprovação da ata'),
      form([['Aprovada por email em', 'DD/MM/AAAA (anexar as confirmações)']]),
      gap(120),
      signatures(['Participante', 'Participante', 'Participante']),
    ],
  },
  {
    file: 'AO-REG-05-Registo-de-ensaio-e-migracao-de-dados.docx',
    code: 'AO-REG-05', title: 'Registo de ensaio e migração de dados',
    purpose: 'Prova que uma cópia ou migração de dados entre plataformas foi completa e íntegra: o que saiu da origem, o que chegou ao destino e as diferenças.',
    instructions: [
      'Use um registo por ensaio e outro para a migração definitiva de cada cliente.',
      'As contagens e as verificações SHA-256 vêm do relatório automático da migração; anexe-o.',
      'Uma diferença sem explicação reprova a migração e obriga a reverter.',
    ],
    body: [
      H('1. Identificação'),
      form([
        ['Tipo', boxes(['Ensaio', 'Migração definitiva'])],
        ['Origem', 'Por exemplo: Base44, app 6adf8df8…'],
        ['Destino', 'Servidor, região e versão'],
        ['Âmbito', 'Clientes, entidades e ficheiros abrangidos', true],
        ['Janela', 'Início e fim (data e hora)'],
        ['Responsável técnico', ''],
        ['Responsável do cliente', 'Só na migração definitiva'],
      ]),
      H('2. Preparação'),
      form([
        ['Cópia de segurança da origem', 'Onde fica e de que data'],
        ['Plano de reversão', 'Como se volta à origem e em quanto tempo'],
        ['Clientes avisados em', 'DD/MM/AAAA'],
      ]),
      H('3. Resultados'),
      grid(['Conjunto de dados', 'Na origem', 'No destino', 'Diferenças', 'Verificação'], [3, 1.4, 1.4, 1.6, 2.6], [
        ['Clientes'], ['Utilizadores'], ['Avaliações e respostas'], ['Evidências (ficheiros)'], ['Documentos'],
        ['Trilha de auditoria'], ['Outros'],
      ]),
      H('4. Verificações funcionais'),
      form([
        ['Isolamento entre clientes', boxes(['Conforme', 'Não conforme'])],
        ['Início de sessão e nova palavra-passe', boxes(['Conforme', 'Não conforme'])],
        ['Trilha de auditoria verificada sem quebras', boxes(['Conforme', 'Não conforme'])],
        ['Ficheiros privados abrem por ligação assinada', boxes(['Conforme', 'Não conforme'])],
        ['Biblioteca Legal íntegra (manifesto)', boxes(['Conforme', 'Não conforme'])],
      ], [4.2, 5.8]),
      H('5. Resultado e decisão'),
      form([
        ['Resultado', boxes(['Aprovado', 'Aprovado com reservas', 'Reprovado: reverter'])],
        ['Observações', '', true],
      ]),
      H('6. Assinaturas'),
      signatures(['Responsável técnico', 'Neora Consulting', 'Cliente']),
    ],
  },
];

(async () => {
  for (const m of MODELOS) {
    const buf = await Packer.toBuffer(buildDoc(m));
    fs.writeFileSync(path.join(OUT, m.file), buf);
    console.log(`${m.file} (${Math.round(buf.length / 1024)} KB)`);
  }
})();
