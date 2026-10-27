const fs = require('fs');
const path = require('path');
const pptxgen = require('pptxgenjs');
const React = require('react');
const ReactDOMServer = require('react-dom/server');
const sharp = require('sharp');
const lu = require('react-icons/lu');
// O tema (cores do esquema) é aplicado por um script externo opcional; sem ele, o deck usa as cores diretas.
let applyTheme = null;
try { ({ applyTheme } = require(process.env.APPLY_THEME || './apply_theme.js')); } catch { applyTheme = null; }
// Versão do deck (ver capa e README)

const DIR = __dirname;
const OUT = path.join(DIR, 'AnkoraOne-Apresentacao-Onboarding.pptx');
const HEX = { navy: '070A13', card: '0C111D', gold: 'CFA04A', teal: '26A699', light: 'F3F5F8', line: 'DDE2EA', muted: '5B6474', ink: '111827', soft: 'C9CFDA' };
const THEME = {
  name: 'AnkoraOne', headFontFace: 'Calibri', bodyFontFace: 'Calibri',
  colors: { dk1: HEX.navy, lt1: 'FFFFFF', dk2: HEX.card, lt2: HEX.light, accent1: HEX.gold, accent2: HEX.teal, accent3: '2B3550', accent4: 'E8B04B', accent5: '5B6474', accent6: 'D9534F', hlink: HEX.teal, folHlink: HEX.gold },
};

async function icon(name, color, size = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(lu[name], { color: '#' + color, size: String(size) }));
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return 'image/png;base64,' + buf.toString('base64');
}
const b64 = (f) => 'image/png;base64,' + fs.readFileSync(path.join(DIR, f)).toString('base64');

(async () => {
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_WIDE'; // 13.333 x 7.5
  pres.title = 'AnkoraOne — Onboarding de novos clientes';
  pres.author = 'AnkoraOne';
  pres.company = 'AnkoraOne';
  pres.theme = { headFontFace: 'Calibri', bodyFontFace: 'Calibri' };
  const C = pres.SchemeColor;
  const logoW = b64('logo-white.png'), logoN = b64('logo-navy.png');

  // ── Layouts ──────────────────────────────────────────────────────────────────────────
  pres.defineSlideMaster({
    title: 'CAPA', background: { color: HEX.navy },
    objects: [
      { image: { x: 0.8, y: 0.7, w: 2.6, h: 0.59, data: logoW } },
      { placeholder: { options: { name: 'kicker', type: 'body', x: 0.8, y: 2.7, w: 11, h: 0.4, fontSize: 14, bold: true, color: C.accent1, charSpacing: 4, margin: 0 }, text: '' } },
      { placeholder: { options: { name: 'title', type: 'title', align: 'left', x: 0.8, y: 3.15, w: 11.5, h: 1.3, fontSize: 44, bold: true, color: C.background1, margin: 0, valign: 'top' }, text: '' } },
      { placeholder: { options: { name: 'body', type: 'body', x: 0.8, y: 4.55, w: 9.5, h: 1.2, fontSize: 18, color: 'C9CFDA', margin: 0, valign: 'top' }, text: '' } },
    ],
  });
  pres.defineSlideMaster({
    title: 'SECCAO', background: { color: HEX.navy },
    objects: [
      { image: { x: 11.2, y: 6.75, w: 1.6, h: 0.36, data: logoW } },
      { placeholder: { options: { name: 'kicker', type: 'body', x: 0.8, y: 2.6, w: 11, h: 0.4, fontSize: 14, bold: true, color: C.accent1, charSpacing: 4, margin: 0 }, text: '' } },
      { placeholder: { options: { name: 'title', type: 'title', align: 'left', x: 0.8, y: 3.05, w: 11.5, h: 1.2, fontSize: 40, bold: true, color: C.background1, margin: 0, valign: 'top' }, text: '' } },
      { placeholder: { options: { name: 'body', type: 'body', x: 0.8, y: 4.3, w: 10, h: 0.9, fontSize: 18, color: 'C9CFDA', margin: 0, valign: 'top' }, text: '' } },
    ],
    slideNumber: { x: 0.8, y: 6.85, w: 1, h: 0.3, fontSize: 10, color: '8892A6' },
  });
  pres.defineSlideMaster({
    title: 'CONTEUDO', background: { color: 'FFFFFF' },
    margin: [0.5, 0.6, 0.6, 0.6],
    objects: [
      { image: { x: 11.45, y: 6.88, w: 1.3, h: 0.3, data: logoN } },
      { placeholder: { options: { name: 'title', type: 'title', align: 'left', x: 0.6, y: 0.45, w: 12.1, h: 0.9, fontSize: 32, bold: true, color: C.text1, margin: 0, valign: 'top' }, text: '' } },
    ],
    slideNumber: { x: 0.6, y: 6.9, w: 1, h: 0.3, fontSize: 10, color: HEX.muted },
  });

  let n = 0;
  const notes = (s, txt) => s.addNotes(txt);
  const card = (s, x, y, w, h, fill = HEX.light, name) => s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.12, fill: { color: fill }, line: { color: fill }, objectName: name || `card-${++n}` });
  const txt = (s, text, o) => s.addText(text, { isTextBox: true, margin: 0, valign: 'top', fontSize: 14, color: HEX.ink, ...o });
  const circleIcon = async (s, x, y, d, name, bg = C.text1, fg = HEX.gold) => {
    s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: bg }, line: { color: bg }, objectName: `icon-bg-${++n}` });
    s.addImage({ data: await icon(name, fg), x: x + d * 0.22, y: y + d * 0.22, w: d * 0.56, h: d * 0.56, objectName: `icon-${n}` });
  };
  const content = (title, section) => { const s = pres.addSlide({ masterName: 'CONTEUDO', sectionTitle: section }); s.addText(title, { placeholder: 'title' }); return s; };

  // 1. Capa
  pres.addSection({ title: 'Abertura' });
  {
    const s = pres.addSlide({ masterName: 'CAPA', sectionTitle: 'Abertura' });
    s.addText('ONBOARDING DE NOVOS CLIENTES', { placeholder: 'kicker' });
    s.addText('Começar a trabalhar na AnkoraOne', { placeholder: 'title' });
    s.addText('Regime Jurídico da Cibersegurança (NIS2), ISO/IEC 27001 e ISO/IEC 42001: criação da conta, navegação, uso diário e guia por referencial', { placeholder: 'body' });
    txt(s, 'app.ankoraone.com  ·  versão 1.2  ·  outubro de 2026', { x: 0.8, y: 6.6, w: 6, h: 0.35, fontSize: 12, color: HEX.gold });
    notes(s, 'Apresentação de arranque para novos clientes. Duração prevista: 30 a 40 minutos.');
  }

  // 2. O que é
  {
    const s = content('A conformidade da sua organização num só sítio', 'Abertura');
    txt(s, 'Tudo o que a plataforma pede vem dos textos oficiais: DL 125/2025, Regulamento do CNCS n.º 756/2026 e Diretiva NIS2.', { x: 0.6, y: 1.35, w: 12, h: 0.45, fontSize: 16, color: HEX.muted });
    const items = [
      ['LuScale', 'Enquadramento', 'Qualificação e nível de conformidade, com a base legal de cada conclusão'],
      ['LuListChecks', 'Jornada', 'As tarefas que a lei pede, por ordem e com os prazos'],
      ['LuShieldCheck', 'Medidas mínimas', 'O que cumprir no seu nível e o que guardar como evidência'],
      ['LuFolderLock', 'Evidências e documentos', 'Ficheiros privados, versões, validade e aprovação assinada'],
      ['LuGauge', 'Maturidade', 'Avaliações por referencial e plano de ação com tarefas'],
      ['LuSiren', 'Riscos e incidentes', 'Riscos, notificações ao CNCS, vulnerabilidades e fornecedores'],
    ];
    for (let i = 0; i < items.length; i++) {
      const x = 0.6 + (i % 3) * 4.1, y = 2.1 + Math.floor(i / 3) * 2.3;
      card(s, x, y, 3.85, 2.05);
      await circleIcon(s, x + 0.3, y + 0.3, 0.7, items[i][0]);
      txt(s, items[i][1], { x: x + 1.15, y: y + 0.42, w: 2.55, h: 0.5, fontSize: 17, bold: true });
      txt(s, items[i][2], { x: x + 0.3, y: y + 1.15, w: 3.3, h: 0.8, fontSize: 13, color: HEX.muted });
    }
  }

  // 3. Cinco passos
  {
    const s = content('Cinco passos até estar operacional', 'Abertura');
    const steps = [
      ['Criar o cliente', 'Consultor', 'Ficha, referenciais e repositório'],
      ['Enquadramento no RJC', 'Consultor e cliente', 'Qualificação, nível, prazos e jornada'],
      ['Atribuir a licença', 'Consultor', 'Core, PRO ou Enterprise'],
      ['Convidar a equipa', 'Consultor ou admin. do cliente', 'Contas com o perfil certo'],
      ['Primeira avaliação', 'Consultor e cliente', 'Ponto de partida e plano de ação'],
    ];
    s.addShape(pres.shapes.LINE, { x: 1.2, y: 2.75, w: 10.9, h: 0, line: { color: HEX.line, width: 2 }, objectName: 'timeline' });
    steps.forEach(([a, b, c], i) => {
      const x = 0.6 + i * 2.5;
      s.addShape(pres.shapes.OVAL, { x: x + 0.6, y: 2.35, w: 0.8, h: 0.8, fill: { color: i === 1 ? HEX.gold : HEX.navy }, line: { color: 'FFFFFF', width: 3 }, objectName: `step-${i}` });
      txt(s, String(i + 1), { x: x + 0.6, y: 2.35, w: 0.8, h: 0.8, fontSize: 22, bold: true, color: i === 1 ? HEX.navy : 'FFFFFF', align: 'center', valign: 'middle' });
      txt(s, a, { x, y: 3.45, w: 2.2, h: 0.75, fontSize: 17, bold: true, align: 'center' });
      txt(s, b, { x, y: 4.2, w: 2.2, h: 0.4, fontSize: 12, color: '17766C', bold: true, align: 'center' });
      txt(s, c, { x, y: 4.6, w: 2.2, h: 0.8, fontSize: 13, color: HEX.muted, align: 'center' });
    });
    card(s, 0.6, 5.7, 12.1, 0.8, 'F7F2E7');
    txt(s, [{ text: 'Duração: ', options: { bold: true } }, { text: 'uma reunião de 30 a 45 minutos para os passos 1 a 3, com a informação preparada (manual, secção 2).' }], { x: 0.9, y: 5.85, w: 11.5, h: 0.5, fontSize: 14, valign: 'middle' });
  }

  // 4. Perfis
  {
    const s = content('Três perfis, responsabilidades claras', 'Abertura');
    const cols = [
      ['LuUserCog', 'Consultor', 'Administrador da plataforma', ['Cria o cliente e a licença', 'Faz ou valida o enquadramento', 'Cria avaliações', 'Aceita ou rejeita evidências']],
      ['LuUsers', 'Administrador do cliente', 'Responsável de cibersegurança', ['Gere a jornada e as medidas', 'Aprova documentos', 'Convida utilizadores', 'Riscos, incidentes, fornecedores, IA']],
      ['LuUser', 'Utilizador', 'Restante equipa', ['Consulta a jornada e a lei', 'Responde a avaliações', 'Trata as suas tarefas', 'Propõe documentos e evidências']],
    ];
    for (let i = 0; i < 3; i++) {
      const x = 0.6 + i * 4.1, [ic, t1, t2, list] = cols[i];
      card(s, x, 1.6, 3.85, 4.9, i === 1 ? HEX.navy : HEX.light);
      await circleIcon(s, x + 0.35, 1.95, 0.75, ic, i === 1 ? HEX.gold : HEX.navy, i === 1 ? HEX.navy : HEX.gold);
      txt(s, t1, { x: x + 0.35, y: 2.9, w: 3.2, h: 0.5, fontSize: 20, bold: true, color: i === 1 ? 'FFFFFF' : HEX.ink });
      txt(s, t2, { x: x + 0.35, y: 3.4, w: 3.2, h: 0.4, fontSize: 13, color: i === 1 ? HEX.gold : '17766C' });
      txt(s, list.map((l, j) => ({ text: l, options: { bullet: true, breakLine: j < list.length - 1 } })), { x: x + 0.35, y: 4.0, w: 3.2, h: 2.3, fontSize: 14, color: i === 1 ? 'E6E9EF' : HEX.ink, paraSpaceAfter: 8 });
    }
  }

  // 5. Enquadramento
  {
    const s = content('O enquadramento define o que tem de cumprir', 'Abertura');
    const st = ['Atividade (Anexos I e II)', 'Tipo de entidade (art. 4.º)', 'Dimensão', 'Casos especiais', 'Entidade pública', 'Prazos e decisões do CNCS', 'Resultado com a base legal'];
    txt(s, 'Sete perguntas, por esta ordem', { x: 0.6, y: 1.5, w: 5, h: 0.4, fontSize: 16, bold: true, color: '17766C' });
    st.forEach((a, i) => {
      s.addShape(pres.shapes.OVAL, { x: 0.6, y: 2.05 + i * 0.62, w: 0.42, h: 0.42, fill: { color: HEX.navy }, line: { color: HEX.navy }, objectName: `q-${i}` });
      txt(s, String(i + 1), { x: 0.6, y: 2.05 + i * 0.62, w: 0.42, h: 0.42, fontSize: 13, bold: true, color: HEX.gold, align: 'center', valign: 'middle' });
      txt(s, a, { x: 1.2, y: 2.05 + i * 0.62, w: 4.3, h: 0.42, fontSize: 15, valign: 'middle' });
    });
    const res = [
      ['Essencial ou importante', 'Medidas do nível Básico, Substancial ou Elevado (cumulativas)', HEX.navy, 'FFFFFF'],
      ['Pública relevante A ou B', 'Medidas do Anexo IV; o Grupo A inclui o B', HEX.navy, 'FFFFFF'],
      ['Não abrangida', 'Boas práticas, por exemplo ISO/IEC 27001', HEX.light, HEX.ink],
      ['Por determinar', 'Pontos em aberto a confirmar com o CNCS', HEX.light, HEX.ink],
    ];
    res.forEach(([a, b, f, c], i) => {
      const x = 6.0 + (i % 2) * 3.4, y = 1.6 + Math.floor(i / 2) * 2.05;
      card(s, x, y, 3.2, 1.85, f);
      txt(s, a, { x: x + 0.25, y: y + 0.25, w: 2.7, h: 0.6, fontSize: 16, bold: true, color: f === HEX.navy ? HEX.gold : HEX.ink });
      txt(s, b, { x: x + 0.25, y: y + 0.9, w: 2.7, h: 0.85, fontSize: 13, color: c === 'FFFFFF' ? 'E6E9EF' : HEX.muted });
    });
    card(s, 6.0, 5.8, 6.6, 0.75, 'E6F5F3');
    txt(s, 'Ao confirmar: jornada criada, secção A atualizada e relatório de enquadramento guardado em PDF como evidência.', { x: 6.25, y: 5.88, w: 6.2, h: 0.6, fontSize: 13, valign: 'middle', color: '17766C' });
  }

  // 6. Licença
  {
    const s = content('A licença escolhe os módulos disponíveis', 'Abertura');
    const tiers = [
      ['Core', ['Jornada de Conformidade', 'Avaliações e Plano de Ação', 'Documentos e Evidências', 'Biblioteca Legal e Guia', 'Gestão de Risco', 'Relatórios', 'Ativos e Ferramentas']],
      ['PRO', ['Tudo o que está no Core', 'Gestão de Incidentes', 'Gestão de Fornecedores', 'Alertas de vulnerabilidades (CVE)']],
      ['Enterprise', ['Tudo o que está no PRO', 'Assistente de IA, com quota mensal', 'Privacidade (quando disponível)']],
    ];
    tiers.forEach(([t1, list], i) => {
      const x = 0.6 + i * 4.1, dark = i === 2;
      card(s, x, 1.6, 3.85, 4.4, dark ? HEX.navy : HEX.light);
      txt(s, t1, { x: x + 0.35, y: 1.9, w: 3.2, h: 0.6, fontSize: 26, bold: true, color: dark ? HEX.gold : HEX.navy });
      txt(s, list.map((l, j) => ({ text: l, options: { bullet: true, breakLine: j < list.length - 1 } })), { x: x + 0.35, y: 2.7, w: 3.25, h: 3.1, fontSize: 14, color: dark ? 'E6E9EF' : HEX.ink, paraSpaceAfter: 6 });
    });
    txt(s, 'A licença define também os referenciais (NIS2, QNRCS, ISO/IEC 27001, ISO/IEC 42001, DORA…) e o número de utilizadores (mínimo de 5). O menu só mostra o que está incluído.', { x: 0.6, y: 6.2, w: 12, h: 0.5, fontSize: 14, color: HEX.muted });
  }

  // 7. Secção
  pres.addSection({ title: 'Navegar e trabalhar' });
  {
    const s = pres.addSlide({ masterName: 'SECCAO', sectionTitle: 'Navegar e trabalhar' });
    s.addText('PARTE 2', { placeholder: 'kicker' });
    s.addText('Navegar e trabalhar no dia a dia', { placeholder: 'title' });
    s.addText('Entrar, o menu, a jornada, as medidas, as evidências e as avaliações', { placeholder: 'body' });
  }

  // 8. Menu
  {
    const s = content('O menu segue a ordem do trabalho', 'Navegar e trabalhar');
    txt(s, 'Entrar em app.ankoraone.com com Google, Microsoft ou email. Só aparecem os itens da licença e do perfil.', { x: 0.6, y: 1.35, w: 12, h: 0.45, fontSize: 16, color: HEX.muted });
    const g = [
      ['LuCompass', 'Visão geral', 'Painel'],
      ['LuShieldCheck', 'Avaliar e comprovar', 'Jornada · Avaliações · Evidências · Biblioteca Legal · Guia · Ativos'],
      ['LuListChecks', 'Melhorar e gerir', 'Plano de Ação · Recomendações · Tarefas · Riscos · Incidentes · Vulnerabilidades'],
      ['LuBookOpen', 'Governar', 'Documentos · Repositório documental · Auditoria · Cadeia de Abastecimento · Fornecedores'],
      ['LuGauge', 'Analisar', 'Relatórios e relatório anual'],
    ];
    for (let i = 0; i < g.length; i++) {
      const x = 0.6 + i * 2.45;
      card(s, x, 2.05, 2.25, 4.35, i === 1 ? HEX.navy : HEX.light);
      await circleIcon(s, x + 0.3, 2.35, 0.65, g[i][0], i === 1 ? HEX.gold : HEX.navy, i === 1 ? HEX.navy : HEX.gold);
      txt(s, g[i][1], { x: x + 0.3, y: 3.2, w: 1.75, h: 0.8, fontSize: 16, bold: true, color: i === 1 ? 'FFFFFF' : HEX.ink });
      txt(s, g[i][2], { x: x + 0.3, y: 4.05, w: 1.75, h: 2.2, fontSize: 13, color: i === 1 ? 'E6E9EF' : HEX.muted });
    }
    txt(s, 'Sistema: Relatório de Emails e Definições (perfil, utilizadores, lembretes, repositório, tema e língua).', { x: 0.6, y: 6.5, w: 10.5, h: 0.35, fontSize: 12, color: HEX.muted });
  }

  // 9. Jornada
  {
    const s = content('A jornada organiza a lei em oito secções', 'Navegar e trabalhar');
    const sec = [['A', 'Âmbito e qualificação', '7 tarefas'], ['B', 'Governação e responsáveis', '5 tarefas'], ['C', 'Gestão dos riscos', '3 tarefas'], ['D', 'Medidas de cibersegurança', '5 tarefas'],
      ['E', 'Cadeia de abastecimento', '3 tarefas'], ['F', 'Incidentes', '5 tarefas'], ['G', 'Formação e sensibilização', '3 tarefas'], ['H', 'Relatórios e supervisão', '4 tarefas']];
    sec.forEach(([l, a, b], i) => {
      const x = 0.6 + (i % 4) * 3.05, y = 1.55 + Math.floor(i / 4) * 1.65;
      card(s, x, y, 2.85, 1.45);
      s.addShape(pres.shapes.OVAL, { x: x + 0.22, y: y + 0.3, w: 0.62, h: 0.62, fill: { color: HEX.navy }, line: { color: HEX.navy }, objectName: `sec-${l}` });
      txt(s, l, { x: x + 0.22, y: y + 0.3, w: 0.62, h: 0.62, fontSize: 20, bold: true, color: HEX.gold, align: 'center', valign: 'middle' });
      txt(s, a, { x: x + 1.0, y: y + 0.25, w: 1.75, h: 0.75, fontSize: 14, bold: true });
      txt(s, b, { x: x + 1.0, y: y + 1.0, w: 1.75, h: 0.35, fontSize: 12, color: HEX.muted });
    });
    // exemplo de tarefa
    card(s, 0.6, 5.0, 12.1, 1.55, 'FFFFFF');
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 5.0, w: 12.1, h: 1.55, rectRadius: 0.12, fill: { color: 'FFFFFF' }, line: { color: HEX.line, width: 1 }, objectName: 'exemplo' });
    txt(s, 'EXEMPLO DE TAREFA', { x: 0.9, y: 5.15, w: 4, h: 0.3, fontSize: 11, bold: true, color: '8A6620', charSpacing: 2 });
    txt(s, 'Nomear o responsável de cibersegurança e comunicá-lo em 20 dias úteis', { x: 0.9, y: 5.5, w: 11.4, h: 0.45, fontSize: 17, bold: true });
    txt(s, 'RJC, art. 31.º, n.os 1, 3 e 4; Reg. 756/2026, art. 14.º    ·    estado, responsável, data-alvo, notas e evidências', { x: 0.9, y: 6.0, w: 11.4, h: 0.35, fontSize: 13, color: HEX.muted });
  }

  // 10. Medidas e evidências
  {
    const s = content('Cada medida diz o que guardar como evidência', 'Navegar e trabalhar');
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 1.55, w: 6.3, h: 3.6, rectRadius: 0.12, fill: { color: 'FFFFFF' }, line: { color: HEX.line, width: 1 }, objectName: 'medida' });
    txt(s, 'GR.CO-1   ·   nível Substancial', { x: 0.9, y: 1.8, w: 5.8, h: 0.35, fontSize: 13, bold: true, color: '8A6620' });
    txt(s, 'A missão, visão, estratégia de gestão dos riscos e objetivos da entidade são definidos e comunicados.', { x: 0.9, y: 2.2, w: 5.8, h: 0.95, fontSize: 16, bold: true });
    txt(s, [{ text: 'O que guardar como evidência: ', options: { bold: true, color: '17766C' } }, { text: 'Registo documentado da missão, visão, estratégia de gestão do risco e objetivos no âmbito da cibersegurança e respetivas prioridades.' }], { x: 0.9, y: 3.25, w: 5.8, h: 1.1, fontSize: 13 });
    txt(s, 'Reg. 756/2026, Anexo III — GR.CO-1', { x: 0.9, y: 4.55, w: 5.8, h: 0.3, fontSize: 12, color: HEX.muted });
    txt(s, 'Exemplo real da Biblioteca Legal › Conformidade', { x: 0.6, y: 5.3, w: 6.3, h: 0.3, fontSize: 12, color: HEX.muted, italic: true });
    // ciclo de vida
    txt(s, 'Ciclo de vida de uma evidência', { x: 7.4, y: 1.55, w: 5.3, h: 0.4, fontSize: 16, bold: true, color: '17766C' });
    const states = [['Por rever', HEX.light, HEX.ink], ['Aceite e válida', HEX.teal, 'FFFFFF'], ['Expirada', 'F7F2E7', HEX.ink], ['Substituída', HEX.light, HEX.ink]];
    states.forEach(([a, f, c], i) => {
      card(s, 7.4, 2.1 + i * 0.78, 2.6, 0.6, f);
      txt(s, a, { x: 7.4, y: 2.1 + i * 0.78, w: 2.6, h: 0.6, fontSize: 14, bold: true, color: c, align: 'center', valign: 'middle' });
    });
    const why = ['Carregada; o consultor revê', 'Cumpre o critério', 'Passou a data de validade', 'Há uma versão nova'];
    why.forEach((a, i) => txt(s, a, { x: 10.2, y: 2.1 + i * 0.78, w: 2.6, h: 0.6, fontSize: 13, color: HEX.muted, valign: 'middle' }));
    txt(s, [{ text: 'Regras: ', options: { bold: true } }, { text: 'ficheiros até 8 MB, nunca públicos; cada abertura fica registada; evidências de ativos são restritas.' }], { x: 7.4, y: 5.3, w: 5.3, h: 0.9, fontSize: 13, color: HEX.ink });
  }

  // 10b. Repositório e classificação
  {
    const s = content('Carregue o que já tem: a plataforma propõe onde pertence', 'Navegar e trabalhar');
    txt(s, 'Governar › Repositório documental: todos os ficheiros do cliente nas mesmas 13 pastas, no repositório escolhido (plataforma, Google Drive, OneDrive ou NAS).', { x: 0.6, y: 1.35, w: 12, h: 0.45, fontSize: 15, color: HEX.muted });
    const steps = [
      ['LuInbox', 'Carregar', 'Na área Por classificar, ou diretamente na pasta «00 Por classificar» e Procurar na pasta'],
      ['LuListFilter', 'Pré-selecionar', 'Sem IA: medidas, tarefas e controlos ISO com texto parecido'],
      ['LuSparkles', 'Classificar', 'A IA propõe o tipo e até 8 ligações, cada uma com excerto e confiança; até 25 de cada vez'],
      ['LuClipboardCheck', 'Rever e indexar', 'Uma pessoa confirma; nasce uma evidência Por rever; nada muda de estado sozinho'],
    ];
    for (let i = 0; i < steps.length; i++) {
      const x = 0.6 + i * 3.05;
      card(s, x, 2.05, 2.85, 2.65, i === 2 ? HEX.navy : HEX.light);
      await circleIcon(s, x + 0.25, 2.3, 0.7, steps[i][0], i === 2 ? HEX.gold : HEX.navy, i === 2 ? HEX.navy : HEX.gold);
      txt(s, steps[i][1], { x: x + 0.25, y: 3.15, w: 2.4, h: 0.45, fontSize: 17, bold: true, color: i === 2 ? 'FFFFFF' : HEX.ink });
      txt(s, steps[i][2], { x: x + 0.25, y: 3.65, w: 2.4, h: 1.3, fontSize: 13, color: i === 2 ? 'E6E9EF' : HEX.muted });
      if (i < 3) s.addShape(pres.shapes.CHEVRON, { x: x + 2.88, y: 3.4, w: 0.14, h: 0.35, fill: { color: HEX.gold }, line: { color: HEX.gold }, objectName: `seta-rep-${i}` });
    }
    card(s, 0.6, 5.0, 12.1, 1.2, 'E6F5F3');
    txt(s, [{ text: 'Qualidade das propostas: ', options: { bold: true, color: '17766C' } }, { text: 'quantas ligações propostas as pessoas mantêm, por nível de confiança. Documentos com endereços de ativos expostos à Internet nunca seguem para a IA.' }], { x: 0.9, y: 5.15, w: 11.5, h: 0.9, fontSize: 14, valign: 'middle' });
  }

  // 11. Avaliações
  {
    const s = content('Avaliar a maturidade de 0 a 5 e transformar lacunas em tarefas', 'Navegar e trabalhar');
    const lv = ['Inexistente', 'Inicial', 'Em desenvolvimento', 'Definido', 'Gerido', 'Otimizado'];
    const shade = ['E9EDF2', 'DCE2EA', 'C6CFDB', '9AA7BA', HEX.gold, HEX.navy];
    lv.forEach((a, i) => {
      const x = 0.6 + i * 2.03;
      card(s, x, 1.65, 1.9, 1.55, shade[i]);
      txt(s, String(i), { x, y: 1.75, w: 1.9, h: 0.75, fontSize: 36, bold: true, align: 'center', color: i === 5 ? HEX.gold : HEX.navy });
      txt(s, a, { x: x + 0.1, y: 2.55, w: 1.7, h: 0.55, fontSize: 13, bold: true, align: 'center', color: i === 5 ? 'FFFFFF' : HEX.ink });
    });
    txt(s, 'Nível-alvo por omissão: 4 (Gerido)', { x: 8.7, y: 3.3, w: 4, h: 0.35, fontSize: 12, color: '8A6620', bold: true, align: 'right' });
    const flow = [['Avaliação', 'O consultor cria-a com os referenciais (ex.: NIS2 e ISO/IEC 27001)'], ['Respostas', 'A equipa responde e liga evidências a cada pergunta'], ['Pontuação', 'Por domínio, por referencial e global'], ['Plano de ação', 'Recomendações com prioridade, esforço e prazo, que viram tarefas']];
    flow.forEach(([a, b], i) => {
      const x = 0.6 + i * 3.05;
      card(s, x, 4.0, 2.85, 2.3, i === 3 ? 'E6F5F3' : HEX.light);
      txt(s, a, { x: x + 0.25, y: 4.2, w: 2.4, h: 0.45, fontSize: 17, bold: true, color: i === 3 ? '17766C' : HEX.navy });
      txt(s, b, { x: x + 0.25, y: 4.75, w: 2.4, h: 1.4, fontSize: 13, color: HEX.muted });
      if (i < 3) s.addShape(pres.shapes.CHEVRON, { x: x + 2.88, y: 4.95, w: 0.14, h: 0.35, fill: { color: HEX.gold }, line: { color: HEX.gold }, objectName: `seta-${i}` });
    });
  }

  // 12. IA
  {
    const s = content('O assistente de IA prepara rascunhos, não decide', 'Navegar e trabalhar');
    await circleIcon(s, 0.6, 1.55, 0.8, 'LuSparkles');
    txt(s, 'Ativo só onde há documentos para construir ou analisar', { x: 1.6, y: 1.65, w: 5, h: 0.65, fontSize: 17, bold: true });
    const on = ['Políticas, procedimentos e planos de evidências por medida', 'Análise de evidências face ao critério oficial', 'Classificação de documentos carregados', 'Notificações de incidentes e relatório anual', 'Questionários a fornecedores e leitura de respostas', 'Recomendações para o plano de ação'];
    txt(s, on.map((l, j) => ({ text: l, options: { bullet: true, breakLine: j < on.length - 1 } })), { x: 0.6, y: 2.6, w: 6, h: 3.0, fontSize: 15, paraSpaceAfter: 8 });
    card(s, 7.2, 1.55, 5.5, 4.95, HEX.navy);
    txt(s, 'REGRAS', { x: 7.55, y: 1.85, w: 4.8, h: 0.35, fontSize: 12, bold: true, color: HEX.gold, charSpacing: 3 });
    const rules = ['Usa só os textos oficiais da Biblioteca Legal', 'O resultado é sempre um rascunho a aprovar por uma pessoa', 'Não recebe contactos, inventário de ativos nem evidências restritas', 'Cada pedido fica na auditoria e conta para a quota (máximo de 30 por minuto)', 'Motor escolhido pelo administrador: Claude ou Base44'];
    txt(s, rules.map((l, j) => ({ text: l, options: { bullet: true, breakLine: j < rules.length - 1 } })), { x: 7.55, y: 2.35, w: 4.85, h: 3.9, fontSize: 15, color: 'E6E9EF', paraSpaceAfter: 10 });
    txt(s, 'Incluído na licença Enterprise.', { x: 0.6, y: 6.0, w: 6, h: 0.35, fontSize: 12, color: HEX.muted });
  }

  // 13. Secção
  pres.addSection({ title: 'Guia por referencial' });
  {
    const s = pres.addSlide({ masterName: 'SECCAO', sectionTitle: 'Guia por referencial' });
    s.addText('PARTE 3', { placeholder: 'kicker' });
    s.addText('Guia por referencial', { placeholder: 'title' });
    s.addText('RJC e NIS2, ISO/IEC 27001, ISO/IEC 42001 e os restantes referenciais (com um guia de implementação para cada um dos três primeiros)', { placeholder: 'body' });
  }

  // 14. RJC prazos
  {
    const s = content('RJC e NIS2: os prazos que não podem falhar', 'Guia por referencial');
    const stats = [['24 h', 'Notificação inicial de incidente significativo', 'RJC, arts. 41.º e 42.º'], ['72 h', 'Atualização da notificação', 'RJC, art. 42.º'], ['30', 'dias úteis para o relatório final do incidente', 'RJC, art. 44.º'], ['20', 'dias úteis para nomear o responsável e o ponto de contacto', 'RJC, arts. 31.º e 32.º']];
    stats.forEach(([a, b, c], i) => {
      const x = 0.6 + i * 3.05;
      card(s, x, 1.55, 2.85, 2.75, i === 0 ? HEX.navy : HEX.light);
      txt(s, a, { x: x + 0.25, y: 1.7, w: 2.4, h: 1.0, fontSize: 54, bold: true, color: i === 0 ? HEX.gold : HEX.navy });
      txt(s, b, { x: x + 0.25, y: 2.75, w: 2.4, h: 0.95, fontSize: 14, color: i === 0 ? 'FFFFFF' : HEX.ink });
      txt(s, c, { x: x + 0.25, y: 3.8, w: 2.4, h: 0.35, fontSize: 11, color: i === 0 ? HEX.soft : HEX.muted });
    });
    const rows = [
      ['Autoidentificação no CNCS', '30 dias após iniciar atividade; 60 dias após a plataforma do CNCS, se já em atividade'],
      ['Lista de ativos acessíveis pela Internet', 'Até 31 de janeiro do ano seguinte à qualificação ou em 6 meses; depois, anual'],
      ['Relatório anual (essenciais)', 'Último dia útil de janeiro, a partir de 2028'],
    ];
    s.addTable([[{ text: 'Obrigação', options: { bold: true, color: 'FFFFFF', fill: { color: HEX.navy } } }, { text: 'Prazo', options: { bold: true, color: 'FFFFFF', fill: { color: HEX.navy } } }],
      ...rows.map((r) => r.map((t) => ({ text: t })))], { x: 0.6, y: 4.55, w: 12.1, colW: [4.3, 7.8], fontSize: 13, color: HEX.ink, border: { type: 'solid', pt: 0.75, color: HEX.line }, margin: 0.08, fontFace: 'Calibri' });
    txt(s, 'Em vigor desde 3 de abril de 2026 (DL 125/2025). Arts. 27.º, n.os 1 e 2, 28.º a 30.º e 33.º do RJC: efeitos a 22 de junho de 2028.', { x: 0.6, y: 6.45, w: 10.6, h: 0.35, fontSize: 12, color: '8A6620', bold: true });
  }

  // 15. ISO 27001
  {
    const s = content('ISO/IEC 27001: um guia com Declaração de Aplicabilidade', 'Guia por referencial');
    card(s, 0.6, 1.45, 12.1, 0.8, 'F7F2E7');
    txt(s, [{ text: 'Guia de preparação: ', options: { bold: true, color: '8A6620' } }, { text: 'textos da AnkoraOne, estrutura conferida com o texto oficial (outubro de 2026); a norma não está reproduzida. Para certificação: texto oficial e entidade acreditada.' }], { x: 0.9, y: 1.55, w: 11.5, h: 0.6, fontSize: 14, valign: 'middle' });
    const stats = [['25', 'requisitos do sistema de gestão (cláusulas 4 a 10)'], ['93', 'controlos do Anexo A, com aplicabilidade e justificação'], ['92', 'controlos ligados ao QNRCS pelo Reg. 756/2026']];
    stats.forEach(([a, b], i) => {
      const y = 2.5 + i * 1.3;
      card(s, 0.6, y, 4.6, 1.15, i === 1 ? HEX.navy : HEX.light);
      txt(s, a, { x: 0.85, y: y + 0.12, w: 1.3, h: 0.9, fontSize: 44, bold: true, color: i === 1 ? HEX.gold : HEX.navy, valign: 'middle' });
      txt(s, b, { x: 2.15, y: y + 0.15, w: 2.9, h: 0.85, fontSize: 14, color: i === 1 ? 'FFFFFF' : HEX.ink, valign: 'middle' });
    });
    txt(s, 'Como trabalhar (Biblioteca Legal › ISO/IEC 27001)', { x: 5.6, y: 2.5, w: 7.1, h: 0.4, fontSize: 17, bold: true, color: '17766C' });
    const how = ['Cláusulas 4 a 6: âmbito, política, metodologia de riscos e objetivos', 'Avaliação e tratamento de riscos em Gestão de Risco', 'Anexo A: aplicável ou não, justificação e método de implementação', 'Exportar a Declaração de Aplicabilidade e aprová-la em Documentos', 'Evidências por controlo; as do RJC ligadas contam também', 'Análise de lacunas: sistema de gestão e controlos em separado', 'Auditoria interna (9.2) e revisão pela gestão (9.3) antes da certificação'];
    txt(s, how.map((l, j) => ({ text: l, options: { bullet: { type: 'number' }, breakLine: j < how.length - 1 } })), { x: 5.6, y: 3.0, w: 7.1, h: 3.6, fontSize: 14, paraSpaceAfter: 6 });
  }

  // 15b. ISO 42001
  {
    const s = content('ISO/IEC 42001: gerir a inteligência artificial', 'Guia por referencial');
    txt(s, 'Para quem desenvolve, fornece ou usa sistemas de IA. Guia em Biblioteca Legal › ISO/IEC 42001, com a mesma abordagem da 27001.', { x: 0.6, y: 1.35, w: 12, h: 0.45, fontSize: 15, color: HEX.muted });
    const stats = [['27', 'requisitos (cláusulas 4 a 10), com a avaliação de impacto em 6.1.4 e 8.4'], ['38', 'controlos do Anexo A em 9 domínios'], ['33', 'apoiam-se em requisitos da 27001; 5 são próprios da IA']];
    stats.forEach(([a, b], i) => {
      const y = 2.0 + i * 1.3;
      card(s, 0.6, y, 4.6, 1.15, i === 1 ? HEX.navy : HEX.light);
      txt(s, a, { x: 0.85, y: y + 0.12, w: 1.3, h: 0.9, fontSize: 44, bold: true, color: i === 1 ? HEX.gold : HEX.navy, valign: 'middle' });
      txt(s, b, { x: 2.15, y: y + 0.15, w: 2.9, h: 0.85, fontSize: 14, color: i === 1 ? 'FFFFFF' : HEX.ink, valign: 'middle' });
    });
    card(s, 0.6, 5.95, 4.6, 0.6, 'F7F2E7');
    txt(s, 'Não substitui o Regulamento (UE) 2024/1689.', { x: 0.8, y: 5.95, w: 4.3, h: 0.6, fontSize: 13, valign: 'middle', color: '8A6620', bold: true });
    card(s, 5.6, 2.0, 7.1, 4.55, HEX.light);
    await circleIcon(s, 5.9, 2.25, 0.65, 'LuLayers');
    txt(s, 'Um só sistema de gestão com a 27001', { x: 6.75, y: 2.35, w: 5.8, h: 0.5, fontSize: 18, bold: true, color: HEX.navy });
    const integ = ['Mesma análise de contexto, controlo documental, auditoria interna e revisão pela gestão', 'Cada controlo mostra os requisitos da 27001 de base e conta as evidências que já lá estão', 'Avaliação de impacto em pessoas e na sociedade: nova, sem equivalente na 27001', 'Declaração de Aplicabilidade separada para cada norma', 'Objetivos e fontes de risco do Anexo C como lista de apoio'];
    txt(s, integ.map((l, j) => ({ text: l, options: { bullet: true, breakLine: j < integ.length - 1 } })), { x: 5.9, y: 3.1, w: 6.5, h: 3.3, fontSize: 14, paraSpaceAfter: 8 });
  }

  // 16. Outros referenciais
  {
    const s = content('Outros referenciais disponíveis na plataforma', 'Guia por referencial');
    const fw = [
      ['QNRCS', 'Reg. 756/2026, Anexo I', '107 controlos em seis objetivos, com medida e verificação por nível'],
      ['Requisitos técnicos NIS2', 'Reg. de Execução (UE) 2024/2690', '161 requisitos para serviços digitais'],
      ['DORA', 'Reg. (UE) 2022/2554', '111 obrigações e prazos de incidentes para o setor financeiro'],
      ['TISAX', 'VDA ISA 6.0.3 e 2027.1', '80 e 78 controlos para a indústria automóvel'],
      ['CIS Controls v8.1', 'CIS', 'Identificadores; o texto entra com o ficheiro oficial da entidade'],
      ['NIST CSF 2.0', 'NIST', 'Correspondências a partir do QNRCS'],
    ];
    fw.forEach(([a, b, c], i) => {
      const x = 0.6 + (i % 3) * 4.1, y = 1.55 + Math.floor(i / 3) * 2.45;
      card(s, x, y, 3.85, 2.2);
      txt(s, a, { x: x + 0.3, y: y + 0.25, w: 3.3, h: 0.45, fontSize: 18, bold: true, color: HEX.navy });
      txt(s, b, { x: x + 0.3, y: y + 0.72, w: 3.3, h: 0.35, fontSize: 12, bold: true, color: '17766C' });
      txt(s, c, { x: x + 0.3, y: y + 1.15, w: 3.3, h: 0.9, fontSize: 13, color: HEX.muted });
    });
    txt(s, 'Biblioteca Legal › Relações entre referenciais mostra as correspondências (1338 ligações) para reaproveitar evidências.', { x: 0.6, y: 6.5, w: 10.6, h: 0.35, fontSize: 12, color: HEX.muted });
  }

  // 17. 90 dias
  pres.addSection({ title: 'Fecho' });
  {
    const s = content('Os primeiros 90 dias', 'Fecho');
    const ph = [['Semana 1', 'Conta, enquadramento e equipa convidada'], ['Semanas 2 a 4', 'Responsável e ponto de contacto; autoidentificação; primeira avaliação NIS2 e ISO'], ['Mês 2', 'Políticas aprovadas; inventário de ativos e de sistemas de IA; documentos carregados em Por classificar'], ['Mês 3', 'Medidas com evidências; Declarações de Aplicabilidade; incidentes testados; plano revisto']];
    s.addShape(pres.shapes.LINE, { x: 0.9, y: 2.25, w: 11.5, h: 0, line: { color: HEX.line, width: 2 }, objectName: 'linha-90' });
    ph.forEach(([a, b], i) => {
      const x = 0.6 + i * 3.05;
      s.addShape(pres.shapes.OVAL, { x: x + 0.1, y: 2.0, w: 0.5, h: 0.5, fill: { color: i === 3 ? HEX.gold : HEX.navy }, line: { color: 'FFFFFF', width: 3 }, objectName: `fase-${i}` });
      txt(s, a, { x, y: 2.75, w: 2.85, h: 0.45, fontSize: 18, bold: true, color: HEX.navy });
      txt(s, b, { x, y: 3.25, w: 2.75, h: 1.6, fontSize: 14, color: HEX.muted });
    });
    card(s, 0.6, 5.1, 12.1, 1.45, 'E6F5F3');
    txt(s, 'Depois do arranque', { x: 0.9, y: 5.25, w: 5, h: 0.4, fontSize: 16, bold: true, color: '17766C' });
    txt(s, 'Revisão trimestral da maturidade, análise anual dos riscos, lembretes de revisão de documentos e preparação do relatório anual.', { x: 0.9, y: 5.7, w: 11.5, h: 0.7, fontSize: 14 });
  }

  // 18. Fecho
  {
    const s = pres.addSlide({ masterName: 'CAPA', sectionTitle: 'Fecho' });
    s.addText('PRÓXIMO PASSO', { placeholder: 'kicker' });
    s.addText('Marcar a reunião de criação da conta', { placeholder: 'title' });
    s.addText('Traga a informação da secção 2 do manual de onboarding. Guias de implementação: NIS2, ISO/IEC 27001 e ISO/IEC 42001.\napp.ankoraone.com  ·  daniel.carvalho@ankoraone.com', { placeholder: 'body' });
  }

  await pres.writeFile({ fileName: OUT });
  if (applyTheme) await applyTheme(OUT, THEME);
  console.log('ok');
})();
