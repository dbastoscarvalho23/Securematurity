// Modelos e relatórios por referencial (documentos Word).
// Os campos dos modelos legais são lidos dos textos oficiais da Biblioteca Legal (src/data/legal/*.json):
// cada linha de formulário corresponde a uma alínea do diploma, com a redação publicada.
// Os modelos ISO seguem só a estrutura e a numeração das normas, com redação da AnkoraOne (as normas não são reproduzidas).
//
// Uso: node modelos.js   → docs/modelos/<referencial>/*.docx
const fs = require('fs');
const path = require('path');
const { Packer } = require('docx');
const S = require('../../onboarding/fonte/estilo');

const { t, P, note, H1, H2, H3, B, N, gap, table, callout, tip, cover, toc, makeDocument } = S;
const LEGAL = path.join(__dirname, '../../../src/data/legal');
const OUT = path.join(__dirname, '..');
const load = (f) => JSON.parse(fs.readFileSync(path.join(LEGAL, `${f}.json`), 'utf8'));
const VERSION = 'Versão 1.0 · outubro de 2026';

const rjc = load('rjc');
const reg756 = load('reg756');
const nis2 = load('nis2');
const r2690 = load('regexec2690');
const dora = load('dora');
const iso27 = load('iso27001');
const iso42 = load('iso42001');
const tisax = load('tisax');

// ── Leitura dos textos oficiais ──────────────────────────────────────────────
const rjcArt = (n) => {
  const a = rjc.articles.find((x) => x.number === n);
  if (!a) throw new Error(`RJC: artigo ${n} em falta`);
  return a.text;
};
/** Texto do número `n` de um artigo («n — …» até ao número seguinte). */
function numero(text, n) {
  const parts = String(text).split(/\n(?=\d+ — )/);
  const p = parts.find((x) => x.startsWith(`${n} — `));
  if (!p) throw new Error(`número ${n} em falta`);
  return p;
}
/** Alíneas (a), b), …) e subalíneas (i), ii), …) de um bloco de texto. */
function alineas(block) {
  const out = [];
  for (const raw of String(block).split('\n')) {
    const line = raw.trim();
    const sub = line.match(/^([ivx]+)\)\s+(.*)$/);
    const al = line.match(/^([a-z])\)\s+(.*)$/);
    const last = out[out.length - 1];
    const next = last ? String.fromCharCode(last.id.charCodeAt(0) + 1) : 'a';
    // «i)», «v)» e «x)» podem ser alíneas (a seguir a h), u) e w)) ou subalíneas.
    if (al && (!sub || al[1] === next)) out.push({ id: al[1], text: al[2], sub: [] });
    else if (sub && last) last.sub.push({ id: sub[1], text: sub[2] });
  }
  return out;
}
const reg756Ob = (id) => {
  const o = reg756.obligations.find((x) => x.id === id);
  if (!o) throw new Error(`Reg. 756: ${id} em falta`);
  return o;
};
const doraPhase = (id) => dora.incident_reporting.find((x) => x.phase === id);
/** Alíneas depois de um marcador («informações gerais:», «informações específicas:»). */
function afterMarker(text, marker, untilMarker) {
  let s = String(text);
  const i = s.indexOf(marker);
  if (i < 0) throw new Error(`marcador em falta: ${marker}`);
  s = s.slice(i + marker.length);
  if (untilMarker) { const j = s.indexOf(untilMarker); if (j >= 0) s = s.slice(0, j); }
  return alineas(s);
}

// ── Peças de formulário ─────────────────────────────────────────────────────
const strip = (s) => s.replace(/[;,]\s+(e|ou)$/, '').replace(/[;.]\s*$/, '');
/** Formulário: uma linha por alínea (redação oficial), coluna de base legal e coluna em branco. */
function form(items, baseRef, extra = []) {
  const rows = [];
  for (const a of items) {
    rows.push([`${a.id}) ${strip(a.text)}`, `${baseRef}, al. ${a.id})`, '']);
    for (const s of a.sub) rows.push([`      ${s.id}) ${strip(s.text)}`, `${baseRef}, al. ${a.id}), ${s.id})`, '']);
  }
  for (const e of extra) rows.push([e[0], e[1] || '', '']);
  return table(['Campo (redação do diploma)', 'Base legal', 'Preenchimento'], rows, [44, 18, 38]);
}
/** Formulário com campos próprios (sem alíneas). */
const fields = (rows) => table(['Campo', 'Referência', 'Preenchimento'], rows.map((r) => [r[0], r[1] || '', '']), [40, 22, 38]);
const signoff = (roles = ['Preparado por', 'Revisto por', 'Aprovado por']) => table(['Função', 'Nome e cargo', 'Data', 'Assinatura'], roles.map((r) => [r, '', '', '']), [22, 38, 16, 24]);
const meta = (rows) => table(['Elemento', 'Indicação'], rows, [30, 70]);
const metaG = (rows) => [meta(rows), gap()];
const quote = (title, text) => callout(title, String(text).split('\n').filter(Boolean));

function intro({ framework, channel, prevail, extra = [] }) {
  return [
    H1('Como usar estes modelos'),
    P(`Este documento reúne os modelos de trabalho para ${framework}. Cada modelo começa numa página nova, indica a base legal, o prazo e o canal de envio, e tem um formulário com os campos exigidos.`),
    P('Nos modelos legais, a coluna **Campo** reproduz a redação do diploma, alínea a alínea, tal como está publicada no Diário da República ou no Jornal Oficial da UE. Não se acrescentaram nem retiraram requisitos. Os campos sem base legal estão assinalados como «elemento de controlo interno».'),
    callout('Canal oficial e prevalência', [channel, prevail]),
    ...extra,
    H2('Regras de preenchimento'),
    B('Preencha a coluna **Preenchimento** e guarde o documento no repositório documental do cliente, com a data e a versão.'),
    B('Nos campos que o diploma admite «se aplicável» ou «se disponível», escreva «Não aplicável» ou «Ainda não disponível» em vez de deixar em branco.'),
    B('Datas e horas no formato AAAA-MM-DD hh:mm, com o fuso horário (por exemplo 2026-10-27 09:30 WET).'),
    B('Na AnkoraOne, os mesmos campos estão nos rascunhos com IA e no plano do incidente; o texto gerado é sempre revisto antes de ser enviado.'),
  ];
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. RJC e QNRCS
// ═══════════════════════════════════════════════════════════════════════════
function packRJC() {
  const body = [];
  const DL = 'RJC';
  body.push(...toc());
  body.push(...intro({
    framework: 'o Regime Jurídico da Cibersegurança (RJC, aprovado pelo Decreto-Lei n.º 125/2025) e o Regulamento do CNCS n.º 756/2026 (QNRCS)',
    channel: 'Todas as comunicações à autoridade de cibersegurança competente são feitas pela plataforma eletrónica do CNCS (RJC, art. 40.º, n.º 6; Reg. 756/2026, art. 12.º). Sem capacidade operacional própria, a notificação de incidentes pode, excecionalmente, ser feita por correio eletrónico ou telefone (Reg. 756/2026, art. 20.º, n.º 4).',
    prevail: 'Quando o CNCS disponibilizar modelos de utilização obrigatória (por exemplo, para o relatório anual: RJC, art. 30.º, n.º 5; Reg. 756/2026, art. 13.º, n.º 3), esses modelos prevalecem e estes servem para preparar a informação.',
  }));

  // Registo
  const a35 = rjcArt('35.º');
  body.push(H1('M1 · Dados de registo na plataforma'));
  body.push(...metaG([
    ['Base legal', 'RJC, art. 35.º, n.os 1 a 3; Reg. 756/2026, arts. 8.º a 11.º'],
    ['Quem', 'Entidades essenciais, importantes e públicas relevantes'],
    ['Prazo', 'Autoidentificação: 60 dias para as entidades já em atividade (RJC, art. 8.º, n.º 1). Alterações: 30 dias úteis após a alteração (RJC, art. 35.º, n.º 3); 3 meses para os prestadores digitais do art. 35.º, n.º 4'],
    ['Canal', 'Plataforma eletrónica do CNCS'],
  ]));
  body.push(H2('Elementos de identificação (art. 35.º, n.º 1)'));
  body.push(form(alineas(numero(a35, 1)), `${DL}, art. 35.º, n.º 1`));
  body.push(H2('Elementos adicionais dos prestadores digitais (art. 35.º, n.º 2)'));
  body.push(note('Só para registos de TLD, prestadores de DNS, de registo de nomes de domínio, de computação em nuvem, de centros de dados, de redes de distribuição de conteúdos, de serviços geridos e de segurança geridos, de mercados em linha, motores de pesquisa e redes sociais.'));
  body.push(form(alineas(numero(a35, 2)), `${DL}, art. 35.º, n.º 2`));
  body.push(gap(), signoff(['Preparado por', 'Validado pelo responsável de cibersegurança']));

  // Responsável de cibersegurança
  const a31 = rjcArt('31.º');
  body.push(H1('M2 · Responsável de cibersegurança: designação e comunicação'));
  body.push(...metaG([
    ['Base legal', 'RJC, art. 31.º; Reg. 756/2026, art. 14.º'],
    ['Quem', 'Entidades essenciais e importantes'],
    ['Prazo', '20 dias úteis a contar do início de funções (RJC, art. 31.º, n.º 3); substituição: sem demora injustificada (n.º 5)'],
    ['Requisito', 'Titular dos órgãos de gestão, direção ou administração, ou que lhes responda organicamente e de forma direta (n.º 1)'],
  ]));
  body.push(H2('Parte A · Minuta de deliberação de designação'));
  body.push(note('Texto proposto pela AnkoraOne para a ata ou despacho de designação. Adapte à forma jurídica da entidade.'));
  body.push(P('Em reunião de [órgão de gestão] de [data], foi deliberado designar [nome], [cargo], como responsável de cibersegurança da [entidade], nos termos do artigo 31.º do Regime Jurídico da Cibersegurança, com efeitos a partir de [data]. O responsável de cibersegurança [é titular do órgão de gestão / responde organicamente e de forma direta a (órgão)] e exerce, pelo menos, as funções seguintes:'));
  alineas(numero(a31, 2)).forEach((a) => body.push(B(`${a.id}) ${a.text.replace(/;$/, '.').replace(/\.$/, '.')}`)));
  body.push(P('Mais se deliberou comunicar a designação à autoridade de cibersegurança competente no prazo de 20 dias úteis, através da plataforma eletrónica.'));
  body.push(H2('Parte B · Comunicação à autoridade (Reg. 756/2026, art. 14.º, n.º 3)'));
  body.push(form(alineas(numero(reg756Ob('reg756-art14-responsavel-conteudo').text, 3)), 'Reg. 756/2026, art. 14.º, n.º 3', [['Data de início de funções (conta o prazo de 20 dias úteis)', 'RJC, art. 31.º, n.º 3']]));
  body.push(gap(), signoff(['Designado', 'Aprovado pelo órgão de gestão']));

  // Ponto de contacto permanente
  const a32 = rjcArt('32.º');
  body.push(H1('M3 · Ponto de contacto permanente'));
  body.push(...metaG([
    ['Base legal', 'RJC, art. 32.º; Reg. 756/2026, art. 15.º'],
    ['Quem', 'Entidades essenciais e importantes'],
    ['Disponibilidade', '24 horas por dia, 7 dias por semana, limitada a períodos de ativação comunicados pela autoridade (art. 32.º, n.º 1)'],
    ['Alterações', 'Comunicar imediatamente (art. 32.º, n.º 5)'],
  ]));
  body.push(H2('Funções que o ponto de contacto assegura (art. 32.º, n.º 2)'));
  alineas(numero(a32, 2)).forEach((a) => {
    body.push(B(`${a.id}) ${a.text}`));
    a.sub.forEach((s) => body.push(B(`${s.id}) ${s.text}`, 0)));
  });
  body.push(H2('Comunicação à autoridade (Reg. 756/2026, art. 15.º, n.º 3)'));
  body.push(form(alineas(numero(reg756Ob('reg756-art15-ponto-contacto-conteudo').text, 3)), 'Reg. 756/2026, art. 15.º, n.º 3'));
  body.push(H2('Escala de ativação (elemento de controlo interno)'));
  body.push(table(['Período', 'Elemento principal', 'Substituto', 'Contacto móvel'], [['', '', '', ''], ['', '', '', ''], ['', '', '', '']], [25, 25, 25, 25]));

  // Órgãos de gestão
  const a25 = rjcArt('25.º');
  body.push(H1('M4 · Aprovação e supervisão pelos órgãos de gestão'));
  body.push(...metaG([
    ['Base legal', 'RJC, art. 25.º'],
    ['Quem', 'Órgãos de gestão, direção e administração das entidades essenciais e importantes'],
    ['Nota', 'A responsabilidade só pode ser delegada num dos titulares dos órgãos de gestão (art. 25.º, n.º 3)'],
  ]));
  body.push(H2('Minuta de ata'));
  body.push(P('Aos [data], reuniu o [órgão de gestão] da [entidade], com a presença de [membros] e do responsável de cibersegurança, [nome], para tratar das obrigações do artigo 25.º do Regime Jurídico da Cibersegurança.'));
  body.push(table(['Obrigação (art. 25.º, n.º 1)', 'Deliberação', 'Documento de suporte'], alineas(numero(a25, 1)).map((a) => [`${a.id}) ${strip(a.text)}`, '', '']), [44, 32, 24]));
  body.push(gap(), signoff(['Presidente do órgão de gestão', 'Responsável de cibersegurança', 'Secretário da reunião']));

  // Análise de riscos
  const a29 = rjcArt('29.º');
  body.push(H1('M5 · Relatório de análise e gestão de riscos'));
  body.push(...metaG([
    ['Base legal', 'RJC, art. 29.º; Reg. 756/2026, art. 31.º'],
    ['Periodicidade', 'Pelo menos uma vez por ano e após notificação do CNCS de risco, ameaça ou vulnerabilidade emergente (Reg. 756/2026, art. 31.º, n.º 2)'],
    ['Produção de efeitos', 'As obrigações do art. 29.º produzem efeitos 24 meses após a regulamentação (DL 125/2025, art. 10.º, n.º 2)'],
  ]));
  body.push(quote('RJC, art. 29.º, n.º 3', numero(a29, 3)));
  body.push(H2('1. Âmbito e ativos analisados'));
  body.push(fields([['Ativos que garantem a continuidade das redes e sistemas de informação', 'RJC, art. 29.º, n.º 1'], ['Ativos que garantem a prestação dos serviços essenciais', 'RJC, art. 29.º, n.º 1'], ['Data e responsável da análise', 'RJC, art. 29.º, n.º 3']]));
  body.push(H2('2. Elementos considerados (Reg. 756/2026, art. 31.º, n.º 3)'));
  body.push(form(alineas(numero(reg756Ob('reg756-art31-elementos-analise').text, 3)), 'Reg. 756/2026, art. 31.º, n.º 3'));
  body.push(H2('3. Riscos identificados e tratamento'));
  body.push(note('Registe os riscos na folha «Riscos» do livro Excel deste referencial ou no módulo de riscos da AnkoraOne e junte o resumo.'));
  body.push(table(['Risco', 'Ativos', 'Nível', 'Medidas (QNRCS)', 'Risco residual'], [['', '', '', '', ''], ['', '', '', '', ''], ['', '', '', '', '']], [26, 18, 10, 26, 20]));
  body.push(H2('4. Risco residual (Reg. 756/2026, art. 31.º, n.º 4)'));
  body.push(quote('Reg. 756/2026, art. 31.º, n.º 4', reg756Ob('reg756-art31-risco-residual').text));
  body.push(fields([['Avaliação do risco residual após as medidas', 'RJC, art. 29.º, n.º 2'], ['Riscos residuais aceites e quem os aceitou', 'Elemento de controlo interno']]));
  body.push(gap(), signoff(['Responsável de cibersegurança', 'Aprovado pelo órgão de gestão']));

  // Incidentes
  const a40 = rjcArt('40.º');
  const a42 = rjcArt('42.º');
  const a43 = rjcArt('43.º');
  const a44 = rjcArt('44.º');
  body.push(H1('M6 · Avaliação de incidente significativo'));
  body.push(...metaG([
    ['Base legal', 'RJC, arts. 2.º, alínea l), e 40.º, n.os 3 e 4; Reg. 756/2026, art. 20.º, n.º 3'],
    ['Quando', 'Logo que haja indícios de um incidente; a verificação de incidente significativo inicia o prazo de 24 horas da notificação inicial'],
  ]));
  body.push(H2('Parâmetros (art. 40.º, n.º 3)'));
  body.push(form(alineas(numero(a40, 3)), `${DL}, art. 40.º, n.º 3`));
  body.push(quote('RJC, art. 40.º, n.º 4', numero(a40, 4)));
  body.push(fields([
    ['Conclusão: incidente significativo? (sim / não / possível)', 'RJC, art. 42.º, n.º 1'],
    ['Data e hora da verificação (início do prazo de 24 horas)', 'RJC, art. 42.º, n.º 1'],
    ['Resolvido nas 2 horas após a deteção? (só notificação de fim de impacto)', 'RJC, art. 41.º, n.º 2'],
    ['Outras notificações exigidas (Ministério Público, PJ, CNPD, GNS…)', 'RJC, art. 40.º, n.º 5'],
  ]));
  body.push(gap(), signoff(['Avaliado por', 'Validado pelo responsável de cibersegurança']));

  body.push(H1('M7 · Notificação inicial (até 24 horas)'));
  body.push(...metaG([['Base legal', 'RJC, art. 42.º, n.os 1 e 2'], ['Prazo', numero(a42, 1).replace(/^1 — /, '')], ['Canal', 'Plataforma eletrónica do CNCS']]));
  body.push(form(alineas(numero(a42, 2)), `${DL}, art. 42.º, n.º 2`));

  body.push(H1('M8 · Atualização da notificação inicial (até 72 horas)'));
  body.push(...metaG([['Base legal', 'RJC, art. 42.º, n.º 3'], ['Quando', 'Quando necessário, até 72 horas após a verificação do incidente significativo']]));
  body.push(quote('RJC, art. 42.º, n.º 3', numero(a42, 3)));
  body.push(fields([
    ['Revisão da informação da notificação inicial (alíneas a) a d) do n.º 2)', 'RJC, art. 42.º, n.º 3'],
    ['Avaliação inicial do incidente: gravidade', 'RJC, art. 42.º, n.º 3'],
    ['Avaliação inicial do incidente: impacto', 'RJC, art. 42.º, n.º 3'],
    ['Indicadores de exposição a riscos, se disponíveis', 'RJC, art. 42.º, n.º 3'],
  ]));

  body.push(H1('M9 · Notificação do fim de impacto significativo (até 24 horas)'));
  body.push(...metaG([['Base legal', 'RJC, art. 43.º'], ['Prazo', numero(a43, 1).replace(/^1 — /, '')], ['Nota', 'Incidente resolvido nas 2 horas após a deteção: é a única notificação obrigatória (RJC, art. 41.º, n.º 2)']]));
  body.push(form(alineas(numero(a43, 2)), `${DL}, art. 43.º, n.º 2`));

  body.push(H1('M10 · Relatório intercalar'));
  body.push(...metaG([['Base legal', 'RJC, art. 44.º, n.os 3 e 4; art. 41.º, n.º 3'], ['Quando', 'A pedido da autoridade e, se o incidente continuar em curso no fim do prazo do relatório final, nos termos do art. 44.º, n.º 3']]));
  body.push(quote('RJC, art. 44.º, n.º 3', numero(a44, 3)));
  body.push(form(alineas(numero(a44, 4)), `${DL}, art. 44.º, n.º 4`));

  body.push(H1('M11 · Relatório final (30 dias úteis)'));
  body.push(...metaG([['Base legal', 'RJC, art. 44.º, n.os 1 e 2'], ['Prazo', numero(a44, 1).replace(/^1 — /, '')]]));
  body.push(form(alineas(numero(a44, 2)), `${DL}, art. 44.º, n.º 2`));
  body.push(gap(), signoff(['Preparado por', 'Responsável de cibersegurança']));

  const a48 = rjcArt('48.º');
  body.push(H1('M12 · Comunicação aos destinatários dos serviços'));
  body.push(...metaG([['Base legal', 'RJC, art. 48.º'], ['Prazo', 'Sem demora injustificada'], ['Forma', numero(a48, 4).replace(/^4 — /, '')]]));
  body.push(quote('RJC, art. 48.º, n.os 1 e 2', `${numero(a48, 1)}\n${numero(a48, 2)}`));
  body.push(H2('Minuta de comunicação'));
  body.push(note('Texto proposto pela AnkoraOne. Linguagem simples, sem termos técnicos desnecessários.'));
  body.push(P('Assunto: Informação sobre [perturbação / ameaça] no serviço [nome do serviço]'));
  body.push(P('Informamos que, desde [data e hora], o serviço [nome] [está afetado / pode ser afetado] por [descrição breve em linguagem simples]. Isto pode ter o seguinte efeito para si: [efeito].'));
  body.push(P('Para se proteger, recomendamos que: [medidas ou soluções que o destinatário pode adotar]. Estamos a [medidas em curso] e voltaremos a informar quando a situação estiver resolvida.'));
  body.push(P('Esta comunicação é gratuita. Para esclarecimentos: [contacto].'));
  body.push(fields([['Destinatários abrangidos e meio de comunicação', 'Elemento de controlo interno'], ['Data e hora de envio', 'Elemento de controlo interno']]));

  // Relatório anual
  const a30 = rjcArt('30.º');
  body.push(H1('M13 · Relatório anual'));
  body.push(...metaG([
    ['Base legal', 'RJC, art. 30.º; Reg. 756/2026, art. 13.º'],
    ['Entidades essenciais', 'Submetem, assinado pelo responsável de cibersegurança, até ao último dia útil de janeiro do ano civil seguinte (art. 30.º, n.º 2). Entregam ao mesmo tempo a lista de ativos acessíveis pela Internet (Reg. 756/2026, art. 32.º, n.º 3, alínea b))'],
    ['Entidades importantes', 'Comunicam quando solicitado (art. 30.º, n.º 4)'],
    ['Produção de efeitos', 'O art. 30.º produz efeitos 24 meses após a regulamentação (DL 125/2025, art. 10.º, n.º 2). Confirme a data aplicável na Biblioteca Legal'],
    ['Modelo obrigatório', 'O CNCS disponibiliza na plataforma modelos de utilização obrigatória (Reg. 756/2026, art. 13.º, n.º 3). Use este documento para preparar a informação'],
  ]));
  body.push(fields([['Ano civil a que se reporta', 'RJC, art. 30.º, n.º 1'], ['Entidade e qualificação (essencial / importante)', 'RJC, art. 30.º, n.os 2 e 4']]));
  const items30 = alineas(numero(a30, 1));
  for (const a of items30) {
    body.push(H2(`${a.id}) ${strip(a.text).replace(/:$/, '')}`));
    if (a.sub.length) body.push(table(['Elemento', 'Preenchimento'], a.sub.map((s) => [`${s.id}) ${strip(s.text)}`, '']), [45, 55]));
    else if (a.id === 'b') body.push(table(['Tipo de incidente', '1.º trim.', '2.º trim.', '3.º trim.', '4.º trim.', 'Total'], [['', '', '', '', '', ''], ['', '', '', '', '', ''], ['', '', '', '', '', ''], ['Total', '', '', '', '', '']], [30, 14, 14, 14, 14, 14]));
    else body.push(table(['Preenchimento'], [['']], [100]));
  }
  body.push(gap(), signoff(['Responsável de cibersegurança (assina, art. 30.º, n.º 2)', 'Órgão de gestão (conhecimento)']));

  return makeDocument({
    title: 'Modelos RJC e QNRCS', description: 'Modelos e relatórios do Regime Jurídico da Cibersegurança', headerText: 'Modelos RJC e QNRCS',
    coverChildren: cover({ kicker: 'MODELOS E RELATÓRIOS', title: 'RJC e QNRCS', summary: 'Registo, responsável de cibersegurança, ponto de contacto permanente, órgãos de gestão, análise de riscos, notificações de incidentes, comunicação aos destinatários e relatório anual (DL 125/2025 e Reg. CNCS n.º 756/2026).', version: VERSION }),
    body,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. NIS2 e Regulamento de Execução (UE) 2024/2690
// ═══════════════════════════════════════════════════════════════════════════
function packNIS2() {
  const body = [...toc()];
  body.push(...intro({
    framework: 'a Diretiva (UE) 2022/2555 (NIS2) e o Regulamento de Execução (UE) 2024/2690',
    channel: 'Em Portugal, a NIS2 está transposta pelo RJC: notificações e registos seguem os modelos RJC e QNRCS e a plataforma do CNCS. O Regulamento de Execução 2024/2690 é diretamente aplicável às entidades do seu art. 1.º.',
    prevail: 'Para as entidades abrangidas pelo Regulamento 2024/2690, os requisitos técnicos do anexo e os critérios de incidente significativo dos arts. 3.º a 14.º aplicam-se diretamente. Os restantes devem seguir o QNRCS.',
  }));
  body.push(H2('Entidades abrangidas pelo Regulamento 2024/2690 (art. 1.º)'));
  r2690.scope_entity_types.forEach((x) => body.push(B(x)));

  // Avaliação de incidente significativo
  body.push(H1('N1 · Avaliação de incidente significativo (Reg. 2024/2690)'));
  body.push(...metaG([['Base legal', 'Reg. Exec. 2024/2690, arts. 3.º a 14.º; Diretiva NIS2, art. 23.º, n.º 3'], ['Uso', 'Assinale cada critério que se verifica. Basta um critério geral (art. 3.º) ou um critério específico do tipo de entidade']]));
  // Agrupa os critérios pelo artigo: o proémio (redação oficial) e, a seguir, as alíneas para assinalar.
  let rowsN1 = [];
  const flush = () => { if (rowsN1.length) body.push(table(['Critério (redação do regulamento)', 'Base legal', 'Verifica-se? / Fundamento'], rowsN1, [54, 24, 22])); rowsN1 = []; };
  for (const c of r2690.significant_incident_criteria) {
    if (c.kind === 'chapeau') {
      flush();
      body.push(H3(`${c.ref.replace('Reg. Exec. 2024/2690, ', '')}${c.entity_type ? ` · ${c.entity_type}` : ' · todas as entidades'}`));
      body.push(P(c.text));
    } else rowsN1.push([c.text, c.ref.replace('Reg. Exec. 2024/2690, ', ''), '']);
  }
  flush();
  body.push(gap(), signoff(['Avaliado por', 'Validado por']));

  // Política de segurança (anexo, ponto 1)
  const req = r2690.annex_requirements;
  const sec1 = req.filter((r) => r.id.startsWith('1.'));
  body.push(H1('N2 · Política de segurança dos sistemas de rede e informação'));
  body.push(...metaG([['Base legal', 'Diretiva NIS2, art. 21.º, n.º 2, alínea a); Reg. Exec. 2024/2690, anexo, ponto 1'], ['Uso', 'Estrutura mínima da política. Cada secção responde a um requisito do anexo']]));
  for (const r of sec1) {
    body.push(H2(`Requisito ${r.id}`));
    body.push(quote(`Reg. Exec. 2024/2690, anexo, ponto ${r.id}`, r.text));
    body.push(table(['Como a entidade cumpre (texto da política)'], [['']], [100]));
  }
  body.push(gap(), signoff(['Elaborado por', 'Aprovado pelo órgão de gestão']));

  // Relatório de conformidade art. 21.º
  body.push(H1('N3 · Relatório de conformidade com o art. 21.º, n.º 2'));
  body.push(...metaG([['Base legal', 'Diretiva NIS2, art. 21.º, n.º 2; Reg. Exec. 2024/2690, anexo'], ['Uso', 'Resumo para o órgão de gestão. O detalhe dos 161 requisitos está no livro Excel deste referencial']]));
  if (nis2.art21_chapeau) body.push(quote('Diretiva NIS2, art. 21.º, n.º 2', typeof nis2.art21_chapeau === 'string' ? nis2.art21_chapeau : nis2.art21_chapeau.text || ''));
  const sectionsBy = (letter) => r2690.annex_sections.filter((s) => (s.nis2_letters || []).includes(letter)).map((s) => `${s.id}. ${s.title}`).join('\n');
  body.push(table(['Medida (art. 21.º, n.º 2)', 'Pontos do anexo 2024/2690', 'Estado', 'Evidência'], nis2.art21_measures.map((m) => [`${m.letter}) ${strip(m.text)}`, sectionsBy(m.letter) || '—', '', '']), [36, 30, 12, 22]));
  body.push(gap(), signoff(['Preparado por', 'Apresentado ao órgão de gestão']));

  return makeDocument({
    title: 'Modelos NIS2 e Reg. 2024/2690', description: 'Modelos da Diretiva NIS2 e do Regulamento de Execução 2024/2690', headerText: 'Modelos NIS2 e Reg. 2024/2690',
    coverChildren: cover({ kicker: 'MODELOS E RELATÓRIOS', title: 'NIS2 e Reg. 2024/2690', summary: 'Avaliação de incidente significativo, política de segurança dos sistemas de rede e informação e relatório de conformidade com o art. 21.º da Diretiva (UE) 2022/2555.', version: VERSION }),
    body,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. DORA
// ═══════════════════════════════════════════════════════════════════════════
function packDORA() {
  const body = [...toc()];
  body.push(...intro({
    framework: 'o Regulamento (UE) 2022/2554 (DORA) e os atos delegados e de execução da Biblioteca Legal',
    channel: 'As notificações de incidentes de caráter severo e o registo de informação são enviados à autoridade competente (em Portugal, Banco de Portugal, ASF ou CMVM, conforme a entidade), no formato técnico que essa autoridade definir.',
    prevail: 'Os modelos e formatos de dados oficiais das autoridades europeias de supervisão e da autoridade competente prevalecem. Estes documentos servem para reunir e validar a informação antes do envio.',
  }));

  const ini = doraPhase('notificacao_inicial');
  const gerais = afterMarker(ini.content_text, 'informações gerais:', 'As notificações iniciais');
  const PRAZO = {
    notificacao_inicial: '4 horas após a classificação como incidente de caráter severo e, no máximo, 24 horas após a entidade ter tomado conhecimento (RTS 2025/301, art. 5.º, n.º 1, alínea a)); classificação tardia: 4 horas após a classificação (n.º 2)',
    relatorio_intercalar: 'No máximo 72 horas após a notificação inicial; relatório intercalar atualizado sem demora injustificada e, em qualquer caso, quando as atividades regulares forem repostas (RTS 2025/301, art. 5.º, n.º 1, alínea b))',
    relatorio_final: 'No máximo um mês após o relatório intercalar ou, se for o caso, após o último relatório intercalar atualizado (RTS 2025/301, art. 5.º, n.º 1, alínea c))',
  };
  const phases = [['D2', 'notificacao_inicial', 'Notificação inicial', 'As notificações iniciais', 'RTS 2025/301, art. 2.º'], ['D3', 'relatorio_intercalar', 'Relatório intercalar', 'Os relatórios intercalares', 'RTS 2025/301, art. 3.º'], ['D4', 'relatorio_final', 'Relatório final', 'Os relatórios finais', 'RTS 2025/301, art. 4.º']];

  // Classificação
  const cls = dora.major_incident_classification;
  body.push(H1('D1 · Classificação do incidente'));
  body.push(...metaG([['Base legal', `${cls.rule_ref}; ${cls.recurring_rule_ref}`], ['Uso', 'Registe os critérios e limiares atingidos. A classificação como incidente de caráter severo inicia o prazo da notificação inicial']]));
  body.push(quote(cls.rule_ref, cls.rule_text));
  body.push(quote(cls.recurring_rule_ref, cls.recurring_rule_text));
  body.push(fields([
    ['Serviços críticos afetados', 'RTS 2024/1772, art. 6.º'],
    ['Limiar do art. 9.º, n.º 5, alínea b), atingido?', 'RTS 2024/1772, art. 8.º, n.º 1, alínea a)'],
    ['Outros limiares atingidos (art. 9.º, n.os 1 a 6)', 'RTS 2024/1772, art. 8.º, n.º 1, alínea b)'],
    ['Incidente recorrente (mesma causa, 2 ou mais vezes em 6 meses)?', 'RTS 2024/1772, art. 8.º, n.º 2'],
    ['Conclusão e data e hora da classificação', 'RTS 2025/301, art. 5.º'],
  ]));

  for (const [code, id, label, marker, ref] of phases) {
    const ph = doraPhase(id);
    body.push(H1(`${code} · ${label} de incidente de caráter severo`));
    body.push(...metaG([['Base legal', `DORA, art. 19.º, n.º 4; ${ref}`], ['Prazo', PRAZO[id]], ['Fim de semana ou feriado', id === 'relatorio_final' ? 'Pode ser enviado até ao meio-dia do dia útil seguinte (RTS 2025/301, art. 5.º, n.º 4)' : 'Pode ser enviada até ao meio-dia do dia útil seguinte (RTS 2025/301, art. 5.º, n.º 4), exceto nos casos dos n.os 5 e 6 do mesmo artigo'], ['Se não for possível cumprir o prazo', 'Informar a autoridade competente sem demora injustificada, o mais tardar no próprio prazo, explicando as razões (RTS 2025/301, art. 5.º, n.º 3)']]));
    body.push(H2('Informações gerais (RTS 2025/301, art. 1.º)'));
    body.push(form(gerais, 'RTS 2025/301, art. 1.º'));
    body.push(H2(`Informações específicas (${ref})`));
    body.push(form(afterMarker(ph.content_text, 'informações específicas:'), ref));
  }

  const vol = doraPhase('notificacao_voluntaria_ameaca');
  body.push(H1('D5 · Notificação voluntária de ciberameaça significativa'));
  body.push(...metaG([['Base legal', `DORA, art. 19.º, n.º 2; ${vol.content_ref || vol.ref}`], ['Natureza', 'Voluntária']]));
  const volItems = alineas(vol.content_text);
  if (volItems.length) body.push(form(volItems, vol.content_ref || vol.ref));
  else body.push(quote(vol.content_ref || vol.ref, vol.content_text));

  // Quadro de gestão do risco TIC
  body.push(H1('D6 · Quadro de gestão do risco associado às TIC: índice de políticas'));
  body.push(...metaG([['Base legal', 'DORA, arts. 5.º a 16.º; RTS 2024/1774'], ['Uso', 'Lista de verificação das políticas, procedimentos e protocolos exigidos pelo RTS 2024/1774. Indique o documento e a data de aprovação']]));
  const arts = dora.rts_1774.articles.filter((a) => a.titulo && /TÍTULO II/.test(a.titulo));
  body.push(table(['Artigo do RTS 2024/1774', 'Tema', 'Documento da entidade', 'Aprovado em'], arts.map((a) => [a.ref, a.title, '', '']), [22, 42, 24, 12]));

  // Registo de informação
  body.push(H1('D7 · Registo de informação sobre acordos com terceiros prestadores de TIC'));
  body.push(...metaG([['Base legal', 'DORA, art. 28.º, n.º 3; ITS 2024/2956'], ['Formato', 'O registo é enviado no formato técnico definido pelas autoridades de supervisão. A lista abaixo serve para organizar a recolha por modelo']]));
  body.push(table(['Modelo', 'Nome', 'O que identifica', 'Responsável'], dora.its_2956_templates.map((m) => [m.code, m.name, m.description || '', '']), [10, 28, 46, 16]));

  return makeDocument({
    title: 'Modelos DORA', description: 'Modelos do Regulamento (UE) 2022/2554', headerText: 'Modelos DORA',
    coverChildren: cover({ kicker: 'MODELOS E RELATÓRIOS', title: 'DORA', summary: 'Classificação de incidentes, notificação inicial, relatórios intercalar e final, notificação de ciberameaças, índice do quadro de gestão do risco TIC e organização do registo de informação.', version: VERSION }),
    body,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// 4 e 5. ISO/IEC 27001 e 42001 (estrutura e numeração; redação da AnkoraOne)
// ═══════════════════════════════════════════════════════════════════════════
const clause = (iso, ref) => iso.items.find((x) => x.kind === 'clause' && x.ref === ref);
const isoNote = (std) => callout('Direitos de autor', [`Os modelos seguem a numeração da ${std}, com redação da AnkoraOne. A norma não é reproduzida: para certificação use o texto oficial, adquirido pela entidade.`]);

function isoMgmt(iso, std, prefix) {
  const b = [];
  const c = (ref) => clause(iso, ref);
  const ref = (r) => `${std}, ${r}`;
  // Política
  b.push(H1(`${prefix}1 · Política (cláusula 5.2)`));
  b.push(...metaG([['Referência', ref('5.2')], ['O que a norma pede (síntese AnkoraOne)', c('5.2').description], ['Informação documentada', 'Sim']]));
  const pol = std.includes('42001')
    ? ['Objetivo e âmbito da política de IA', 'Enquadramento para os objetivos de IA (6.2)', 'Princípios para o desenvolvimento e a utilização responsável de IA', 'Compromisso de cumprir os requisitos aplicáveis', 'Compromisso de melhoria contínua do sistema de gestão da IA', 'Relação com outras políticas (segurança da informação, privacidade, qualidade)', 'Papéis e responsabilidades (5.3)', 'Comunicação, disponibilidade e revisão']
    : ['Objetivo e âmbito', 'Objetivos de segurança da informação ou enquadramento para os definir (6.2)', 'Compromisso de cumprir os requisitos aplicáveis', 'Compromisso de melhoria contínua do sistema de gestão', 'Papéis e responsabilidades (5.3)', 'Políticas específicas por tema (Anexo A, 5.1)', 'Comunicação, disponibilidade e revisão'];
  b.push(table(['Secção', 'Texto da entidade'], pol.map((x) => [x, '']), [36, 64]));
  b.push(gap(), signoff(['Elaborado por', 'Aprovado pela gestão de topo']));
  // Tratamento de riscos
  b.push(H1(`${prefix}2 · Plano de tratamento de riscos (cláusulas 6.1.3 e 8.3)`));
  b.push(...metaG([['Referência', `${ref('6.1.3')}; ${ref('8.3')}`], ['Síntese', c('6.1.3').description]]));
  b.push(table(['Risco', 'Opção de tratamento', 'Controlos (Anexo A ou próprios)', 'Responsável', 'Prazo', 'Risco residual aceite por'], [['', '', '', '', '', ''], ['', '', '', '', '', ''], ['', '', '', '', '', ''], ['', '', '', '', '', '']], [20, 14, 24, 14, 10, 18]));
  b.push(note('A Declaração de Aplicabilidade está no livro Excel deste referencial (folha «Declaração de Aplicabilidade»).'));
  b.push(gap(), signoff(['Responsável pelo risco', 'Aprovado por']));
  // Auditoria interna
  b.push(H1(`${prefix}3 · Relatório de auditoria interna (cláusula 9.2)`));
  b.push(...metaG([['Referência', ref('9.2')], ['Síntese', c('9.2').description]]));
  b.push(fields([['Programa e ciclo de auditoria', ref('9.2')], ['Âmbito e critérios', ref('9.2')], ['Datas e locais', ''], ['Auditores e declaração de imparcialidade', ref('9.2')], ['Áreas e processos auditados', ''], ['Documentos e registos consultados', '']]));
  b.push(H2('Constatações'));
  b.push(table(['N.º', 'Cláusula ou controlo', 'Tipo', 'Descrição', 'Evidência'], [['1', '', '', '', ''], ['2', '', '', '', ''], ['3', '', '', '', '']], [6, 18, 16, 34, 26]));
  b.push(note('Tipo: não conformidade maior, não conformidade menor, observação ou oportunidade de melhoria. As não conformidades seguem para o registo de ações corretivas (cláusula 10.2).'));
  b.push(H2('Conclusão'));
  b.push(table(['Conclusão sobre a conformidade e a eficácia do sistema de gestão'], [['']], [100]));
  b.push(gap(), signoff(['Auditor responsável', 'Responsável da área auditada', 'Relatório comunicado à gestão']));
  // Revisão pela gestão
  b.push(H1(`${prefix}4 · Ata de revisão pela gestão (cláusula 9.3)`));
  b.push(...metaG([['Referência', ref('9.3')], ['Síntese', c('9.3').description]]));
  const entradas = ['Estado das ações de revisões anteriores', 'Alterações nas questões internas e externas', 'Alterações nas necessidades e expectativas das partes interessadas', 'Não conformidades e ações corretivas', 'Resultados da monitorização e medição', 'Resultados das auditorias', 'Cumprimento dos objetivos', 'Feedback das partes interessadas', 'Resultados da avaliação de riscos e estado do plano de tratamento', 'Oportunidades de melhoria'];
  if (std.includes('42001')) entradas.splice(8, 0, 'Resultados das avaliações de impacto dos sistemas de IA');
  b.push(H2('Entradas analisadas'));
  b.push(table(['Entrada', 'Síntese apresentada', 'Documento'], entradas.map((e) => [e, '', '']), [36, 44, 20]));
  b.push(H2('Decisões'));
  b.push(table(['Decisão (melhoria, alterações ao sistema, recursos)', 'Responsável', 'Prazo'], [['', '', ''], ['', '', ''], ['', '', '']], [60, 22, 18]));
  b.push(gap(), signoff(['Gestão de topo', 'Responsável do sistema de gestão']));
  // Não conformidades
  b.push(H1(`${prefix}5 · Não conformidade e ação corretiva (cláusula 10.2)`));
  b.push(...metaG([['Referência', ref('10.2')], ['Síntese', c('10.2').description]]));
  b.push(fields([['N.º e origem (auditoria, incidente, reclamação, revisão)', ''], ['Descrição da não conformidade', ref('10.2')], ['Correção imediata e consequências tratadas', ref('10.2')], ['Análise de causas', ref('10.2')], ['Existem não conformidades semelhantes?', ref('10.2')], ['Ação corretiva, responsável e prazo', ref('10.2')], ['Verificação da eficácia (data e resultado)', ref('10.2')], ['Alterações ao sistema de gestão necessárias', ref('10.2')]]));
  b.push(gap(), signoff(['Responsável pela ação', 'Verificado por']));
  // Informação documentada
  b.push(H1(`${prefix}6 · Lista de informação documentada obrigatória`));
  b.push(P(`Cláusulas da ${std} que exigem informação documentada, segundo o guia da AnkoraOne. Indique o documento da entidade e o local onde está guardado.`));
  b.push(table(['Cláusula', 'Tema', 'Documento da entidade', 'Local / versão'], iso.items.filter((x) => x.kind === 'clause' && x.documented).map((x) => [x.ref, x.title, '', '']), [10, 40, 30, 20]));
  return b;
}

function packISO27001() {
  const body = [...toc()];
  body.push(H1('Como usar estes modelos'), P('Modelos de trabalho para um sistema de gestão da segurança da informação segundo a ISO/IEC 27001:2022. Os registos tabulares (Declaração de Aplicabilidade, riscos, informação documentada) estão no livro Excel deste referencial.'), isoNote('ISO/IEC 27001:2022'));
  body.push(tip('Ligação ao RJC', ['A AnkoraOne liga cada cláusula e controlo aos controlos do QNRCS (Reg. 756/2026, Anexo I). A Declaração de Aplicabilidade em Excel tem essa coluna, para reaproveitar evidências nos dois referenciais.']));
  body.push(...isoMgmt(iso27, 'ISO/IEC 27001:2022', 'I'));
  return makeDocument({
    title: 'Modelos ISO/IEC 27001', description: 'Modelos de trabalho do sistema de gestão da segurança da informação', headerText: 'Modelos ISO/IEC 27001',
    coverChildren: cover({ kicker: 'MODELOS E RELATÓRIOS', title: 'ISO/IEC 27001:2022', summary: 'Política de segurança da informação, plano de tratamento de riscos, relatório de auditoria interna, ata de revisão pela gestão, não conformidades e informação documentada obrigatória.', version: VERSION }),
    body,
  });
}

function packISO42001() {
  const body = [...toc()];
  body.push(H1('Como usar estes modelos'), P('Modelos de trabalho para um sistema de gestão da inteligência artificial segundo a ISO/IEC 42001:2023. O inventário de sistemas de IA, a Declaração de Aplicabilidade e a lista do Anexo C estão no livro Excel deste referencial.'), isoNote('ISO/IEC 42001:2023'));
  body.push(tip('Sistema integrado com a 27001', ['Auditoria interna e revisão pela gestão podem ser comuns às duas normas. A Declaração de Aplicabilidade é uma por norma.']));
  body.push(...isoMgmt(iso42, 'ISO/IEC 42001:2023', 'A'));
  // Avaliação de impacto
  const c614 = clause(iso42, '6.1.4');
  const a5 = iso42.items.filter((x) => x.kind === 'control' && x.group === '5');
  body.push(H1('A7 · Avaliação de impacto de um sistema de IA (cláusulas 6.1.4 e 8.4)'));
  body.push(...metaG([['Referência', 'ISO/IEC 42001:2023, 6.1.4 e 8.4; Anexo A, domínio A.5'], ['Síntese', c614.description], ['Quando', 'Antes de pôr o sistema em uso, a intervalos planeados e quando há alterações significativas (8.4)']]));
  body.push(H2('1. Identificação do sistema'));
  body.push(fields([['Nome e versão do sistema de IA', ''], ['Papel da organização (fornecedor, produtor, cliente, utilizador)', 'ISO/IEC 42001, 4.1'], ['Finalidade e utilização prevista', ''], ['Utilizações indevidas razoavelmente previsíveis', ''], ['Dados utilizados (origem, categorias, dados pessoais?)', 'Anexo A, A.7'], ['Nível de automação e supervisão humana', '']]));
  body.push(H2('2. Pessoas e efeitos'));
  body.push(table(['Pessoas ou grupos afetados', 'Efeito possível (positivo ou negativo)', 'Gravidade', 'Probabilidade', 'Medidas'], [['', '', '', '', ''], ['', '', '', '', ''], ['', '', '', '', '']], [22, 30, 12, 12, 24]));
  body.push(H2('3. Controlos do domínio A.5 (avaliação de impactos)'));
  body.push(table(['Controlo', 'Tema (guia AnkoraOne)', 'Como foi tratado'], a5.map((x) => [`A.${x.ref}`, x.title, '']), [12, 40, 48]));
  body.push(H2('4. Conclusão'));
  body.push(fields([['Decisão (usar, usar com condições, não usar)', ''], ['Resultado comunicado à avaliação de riscos (6.1.2)', 'ISO/IEC 42001, 6.1.4'], ['Próxima revisão', 'ISO/IEC 42001, 8.4']]));
  body.push(gap(), signoff(['Responsável do sistema de IA', 'Aprovado por']));
  return makeDocument({
    title: 'Modelos ISO/IEC 42001', description: 'Modelos de trabalho do sistema de gestão da IA', headerText: 'Modelos ISO/IEC 42001',
    coverChildren: cover({ kicker: 'MODELOS E RELATÓRIOS', title: 'ISO/IEC 42001:2023', summary: 'Política de IA, plano de tratamento de riscos, auditoria interna, revisão pela gestão, não conformidades, informação documentada e avaliação de impacto de sistemas de IA.', version: VERSION }),
    body,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. TISAX
// ═══════════════════════════════════════════════════════════════════════════
function packTISAX() {
  const body = [...toc()];
  body.push(H1('Como usar estes modelos'));
  body.push(P(`Preparação de uma avaliação TISAX com o catálogo VDA ISA. Os factos do processo vêm do ${tisax.instrument.title} (versão ${tisax.instrument.version}, ${tisax.instrument.issuer}); nenhum texto desse documento é reproduzido. A autoavaliação ISA 6.0.3, com o texto do catálogo, está no livro Excel deste referencial.`));
  body.push(callout('Licença do catálogo ISA', ['O VDA ISA é publicado sob CC BY-ND 4.0, com direitos adicionais. A folha de autoavaliação reproduz o texto sem alterações e com a atribuição exigida. Não traduza nem altere esse texto.']));
  body.push(H1('T1 · Definição do âmbito da avaliação'));
  body.push(...metaG([['Fonte', `${tisax.instrument.title}, ${tisax.instrument.version}`], ['Validade das etiquetas', `${tisax.label_validity_years} anos`]]));
  body.push(fields([['Entidade participante e localizações incluídas', ''], ['Parceiros que pedem a etiqueta', ''], ['Prazo pedido pelo parceiro', ''], ['Avaliação Simplificada de Grupo (SGA)? Fundamento', '']]));
  body.push(H2('Objetivos de avaliação'));
  body.push(table(['N.º', 'Objetivo', 'Nível de avaliação', 'Catálogos ISA', 'Necessário? (sim / não)'], tisax.assessment_objectives.map((o) => [String(o.id), o.name, o.assessment_level, (o.isa_catalogues || []).join(', '), '']), [7, 27, 16, 32, 18]));
  body.push(H1('T2 · Plano de preparação'));
  body.push(table(['Passo', 'O que envolve (síntese AnkoraOne)', 'Responsável', 'Data prevista'], tisax.process_steps.map((s) => [`${s.step}. ${s.name}`, s.summary_pt, '', '']), [16, 54, 16, 14]));
  body.push(H2('Avaliação Simplificada de Grupo'));
  body.push(P(tisax.sga_summary_pt));
  body.push(gap(), signoff(['Responsável TISAX', 'Aprovado por']));
  return makeDocument({
    title: 'Modelos TISAX', description: 'Preparação da avaliação TISAX', headerText: 'Modelos TISAX',
    coverChildren: cover({ kicker: 'MODELOS E RELATÓRIOS', title: 'TISAX', summary: 'Definição do âmbito, objetivos de avaliação e plano de preparação. Autoavaliação VDA ISA 6.0.3 no livro Excel.', version: VERSION }),
    body,
  });
}

// ── Geração ──────────────────────────────────────────────────────────────────
const PACKS = [
  ['rjc-qnrcs', 'AnkoraOne-Modelos-RJC-QNRCS.docx', packRJC],
  ['nis2', 'AnkoraOne-Modelos-NIS2-Reg2024-2690.docx', packNIS2],
  ['dora', 'AnkoraOne-Modelos-DORA.docx', packDORA],
  ['iso27001', 'AnkoraOne-Modelos-ISO27001.docx', packISO27001],
  ['iso42001', 'AnkoraOne-Modelos-ISO42001.docx', packISO42001],
  ['tisax', 'AnkoraOne-Modelos-TISAX.docx', packTISAX],
];

(async () => {
  for (const [dir, file, fn] of PACKS) {
    const d = path.join(OUT, dir);
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, file), await Packer.toBuffer(fn()));
    console.log('→', path.join(dir, file));
  }
})().catch((e) => { console.error(e); process.exit(1); });
