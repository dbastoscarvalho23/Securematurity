/**
 * Modelos e relatórios por referencial (docs/modelos/, copiados para public/modelos/ e servidos pela app).
 * Gerados por docs/modelos/fonte/modelos.js (Word) e registos.py (Excel) a partir de src/data/legal/.
 * Ao acrescentar um ficheiro, acrescente-o aqui e em docs/modelos/README.md.
 */
export const TEMPLATE_PACKS = [
  {
    id: 'rjc-qnrcs', title: 'RJC e QNRCS', source: 'DL 125/2025 · Reg. CNCS n.º 756/2026',
    pt: 'Registo, responsável de cibersegurança, ponto de contacto permanente, órgãos de gestão, análise de riscos, notificações de incidentes (inicial, atualização, fim de impacto, intercalar e final), comunicação aos destinatários e relatório anual. Livro Excel com a avaliação QNRCS por nível, a lista de ativos do art. 32.º, a estatística trimestral e os riscos.',
    en: 'Registration, cybersecurity officer, permanent contact point, management bodies, risk analysis, incident notifications (initial, update, end of impact, interim and final), notice to service recipients and annual report. Excel workbook with the QNRCS assessment by level, the art. 32 asset list, quarterly statistics and risks.',
    files: [
      { name: 'AnkoraOne-Modelos-RJC-QNRCS.docx', kind: 'docx' },
      { name: 'AnkoraOne-Registos-RJC-QNRCS.xlsx', kind: 'xlsx' },
    ],
  },
  {
    id: 'nis2', title: 'NIS2 e Reg. 2024/2690', source: 'Diretiva (UE) 2022/2555 · Reg. Exec. (UE) 2024/2690',
    pt: 'Avaliação de incidente significativo pelos critérios do Reg. 2024/2690, política de segurança dos sistemas de rede e informação e relatório de conformidade com o art. 21.º. Livro Excel com os 161 requisitos do anexo.',
    en: 'Significant incident assessment under Reg. 2024/2690, network and information systems security policy and art. 21 compliance report. Excel workbook with the 161 annex requirements.',
    files: [
      { name: 'AnkoraOne-Modelos-NIS2-Reg2024-2690.docx', kind: 'docx' },
      { name: 'AnkoraOne-Registos-NIS2-Reg2024-2690.xlsx', kind: 'xlsx' },
    ],
  },
  {
    id: 'dora', title: 'DORA', source: 'Reg. (UE) 2022/2554 · RTS 2024/1772, 2024/1774, 2025/301 · ITS 2024/2956',
    pt: 'Classificação de incidentes, notificação inicial e relatórios intercalar e final, notificação voluntária de ciberameaças, índice do quadro de gestão do risco TIC e organização do registo de informação. Livro Excel com as 111 obrigações e os 15 modelos do registo.',
    en: 'Incident classification, initial notification and intermediate and final reports, voluntary cyber threat notification, ICT risk framework index and register of information. Excel workbook with the 111 obligations and the 15 register templates.',
    files: [
      { name: 'AnkoraOne-Modelos-DORA.docx', kind: 'docx' },
      { name: 'AnkoraOne-Registos-DORA.xlsx', kind: 'xlsx' },
    ],
  },
  {
    id: 'iso27001', title: 'ISO/IEC 27001:2022', source: 'Guia AnkoraOne (a norma não é reproduzida)',
    pt: 'Política, plano de tratamento de riscos, relatório de auditoria interna, ata de revisão pela gestão, não conformidades e informação documentada. Livro Excel com a Declaração de Aplicabilidade (93 controlos, ligação ao QNRCS) e o registo de riscos.',
    en: 'Policy, risk treatment plan, internal audit report, management review minutes, nonconformities and documented information. Excel workbook with the Statement of Applicability (93 controls, QNRCS links) and risk register.',
    files: [
      { name: 'AnkoraOne-Modelos-ISO27001.docx', kind: 'docx' },
      { name: 'AnkoraOne-Registos-ISO27001.xlsx', kind: 'xlsx' },
    ],
  },
  {
    id: 'iso42001', title: 'ISO/IEC 42001:2023', source: 'Guia AnkoraOne (a norma não é reproduzida)',
    pt: 'Política de IA, tratamento de riscos, auditoria interna, revisão pela gestão, não conformidades e avaliação de impacto de sistemas de IA. Livro Excel com a Declaração de Aplicabilidade (38 controlos), o inventário de sistemas de IA e o Anexo C.',
    en: 'AI policy, risk treatment, internal audit, management review, nonconformities and AI system impact assessment. Excel workbook with the Statement of Applicability (38 controls), AI system inventory and Annex C.',
    files: [
      { name: 'AnkoraOne-Modelos-ISO42001.docx', kind: 'docx' },
      { name: 'AnkoraOne-Registos-ISO42001.xlsx', kind: 'xlsx' },
    ],
  },
  {
    id: 'tisax', title: 'TISAX', source: 'ENX · VDA ISA 6.0.3 (CC BY-ND 4.0)',
    pt: 'Âmbito, objetivos de avaliação e plano de preparação. Livro Excel com a autoavaliação dos 80 controlos do VDA ISA 6.0.3, com o texto do catálogo sem alterações e a atribuição exigida pela licença.',
    en: 'Scope, assessment objectives and preparation plan. Excel workbook with the self-assessment of the 80 VDA ISA 6.0.3 controls, catalogue text unchanged and with the attribution required by the licence.',
    files: [
      { name: 'AnkoraOne-Modelos-TISAX.docx', kind: 'docx' },
      { name: 'AnkoraOne-Autoavaliacao-TISAX-ISA6.xlsx', kind: 'xlsx' },
    ],
  },
];

export const templateUrl = (file) => `/modelos/${file.name}`;
