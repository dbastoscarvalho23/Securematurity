import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, Clock, Circle, Loader2, Plus, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import ChecklistItemRow from '@/components/compliance/ChecklistItemRow';
import { toast } from 'sonner';

const RJCS_TEMPLATE_EN = [
  {
    section: 'A. Framework and CNCS Registration',
    section_order: 1,
    tasks: [
      '1. Identify liaison with CNCS (legal or information systems directorate).',
      '2. Register the entity on the CNCS MyCiber platform.',
      '3. Complete registration on the CNCS electronic platform within the applicable deadline.',
      '4. Classify the entity type: Essential Entity or Important Entity (according to NIS2/RJCS criteria).',
      '5. Classify the entity as Relevant Public Entity Group A or Group B (number of employees, type of services, criticality).',
      '6. Verify and document the classification (A or B), keeping justification in minutes or internal dispatch.',
      '7. Maintain updated record of classifications and communicate changes to CNCS.',
    ],
  },
  {
    section: 'B. Governance Model and Responsible Parties',
    section_order: 2,
    tasks: [
      '1. Formally designate a Cybersecurity Officer with direct connection to management.',
      '2. Designate a permanent point of contact for communication with CNCS and sectoral authorities.',
      '3. Create a Cybersecurity / Digital Risks Committee with representatives from critical areas.',
      '4. Define schedule of regular meetings with reporting to the executive body.',
    ],
  },
  {
    section: 'C. Risk Management System',
    section_order: 3,
    tasks: [
      '1. Identify critical assets and services (water systems, waste, mobility, social services, etc.).',
      '2. Conduct cybersecurity risk analysis including supply chain risks.',
      '3. Approve cybersecurity policy by the governing body.',
      '4. Define risk treatment plan with priorities, deadlines, and responsible parties.',
      '5. Establish periodic risk review (at least annually or after relevant incidents).',
    ],
  },
  {
    section: 'D. Technical and Organizational Measures',
    section_order: 4,
    tasks: [
      '1. Maintain updated inventory of IT assets and critical information systems.',
      '2. Implement access and identity management with regular privilege review.',
      '3. Apply multi-factor authentication on critical systems and remote access.',
      '4. Define vulnerability management and update (patching) process.',
      '5. Implement backup policies with restoration tests and segregated copies.',
      '6. Strengthen network security measures (segmentation, firewalls, endpoint protection).',
      '7. Define security rules for system acquisition, development, and maintenance.',
      '8. Align information security practices with GDPR (classification, encryption, etc.).',
    ],
  },
  {
    section: 'E. Supply Chain and Contracts',
    section_order: 5,
    tasks: [
      '1. Identify critical suppliers and service providers.',
      '2. Review contracts to include cybersecurity requirements and incident notification obligations.',
      '3. Provide for audit rights or obtaining security evidence.',
      '4. Establish supplier risk assessment process before new contracts.',
    ],
  },
  {
    section: 'F. Incident Management and Reporting',
    section_order: 6,
    tasks: [
      '1. Create written incident management procedure with clear roles and workflows.',
      '2. Define criteria for classifying an incident as significant.',
      '3. Prepare capability to notify CNCS via platform within legal deadlines.',
      '4. Conduct annual simulations/exercises of the incident response process.',
    ],
  },
  {
    section: 'G. Training and Culture',
    section_order: 7,
    tasks: [
      '1. Define annual cybersecurity training plan for management bodies and leadership.',
      '2. Include specific actions for IT/operational teams and critical services.',
      '3. Implement awareness campaigns and phishing simulators for all employees.',
      '4. Define indicators to measure participation and effectiveness of awareness actions.',
    ],
  },
  {
    section: 'H. Reports and Supervision',
    section_order: 8,
    tasks: [
      '1. Prepare annual cybersecurity report with risks, measures, incidents, and future plans.',
      '2. Archive evidence: minutes, reports, training records, notifications, audits.',
      '3. Organize documentation to facilitate inspections and information requests from CNCS.',
    ],
  },
];

const RJCS_TEMPLATE_PT = [
  {
    section: 'A. Enquadramento e registo no CNCS',
    section_order: 1,
    tasks: [
      '1. Identificar interlocutor com o CNCS (jurídico ou direção de sistemas de informação).',
      '2. Efetuar o registo da entidade na plataforma MyCiber do CNCS.',
      '3. Efetuar o registo na plataforma eletrónica do CNCS dentro do prazo aplicável.',
      '4. Classificar o tipo de entidade: Entidade Essencial ou Entidade Importante (conforme critérios NIS2/RJCS).',
      '5. Classificar a entidade como Entidade Pública Relevante Grupo A ou Grupo B (n.º de trabalhadores, tipo de serviços, criticidade).',
      '6. Verificar e documentar a classificação (A ou B), guardando fundamentação em ata ou despacho interno.',
      '7. Manter registo atualizado das classificações e comunicar alterações ao CNCS.',
    ],
  },
  {
    section: 'B. Modelo de governação e responsáveis',
    section_order: 2,
    tasks: [
      '1. Designar formalmente um Responsável de Cibersegurança com ligação direta à gestão.',
      '2. Designar um ponto de contacto permanente para comunicação com CNCS e autoridades setoriais.',
      '3. Criar um Comité de Cibersegurança / Riscos Digitais com representantes de áreas críticas.',
      '4. Definir calendário de reuniões regulares com reporte ao órgão executivo.',
    ],
  },
  {
    section: 'C. Sistema de gestão de risco',
    section_order: 3,
    tasks: [
      '1. Identificar ativos e serviços críticos (sistemas de água, resíduos, mobilidade, ação social, etc.).',
      '2. Realizar análise de riscos de cibersegurança incluindo riscos na cadeia de fornecimento.',
      '3. Aprovar política de cibersegurança pelo órgão dirigente.',
      '4. Definir plano de tratamento de riscos com prioridades, prazos e responsáveis.',
      '5. Estabelecer revisão periódica do risco (pelo menos anual ou após incidentes relevantes).',
    ],
  },
  {
    section: 'D. Medidas técnicas e organizativas',
    section_order: 4,
    tasks: [
      '1. Manter inventário atualizado de ativos de TI e sistemas de informação críticos.',
      '2. Implementar gestão de acessos e identidades com revisão regular de privilégios.',
      '3. Aplicar autenticação multifator nos sistemas críticos e acessos remotos.',
      '4. Definir processo de gestão de vulnerabilidades e atualizações (patching).',
      '5. Implementar políticas de backup com testes de restauração e cópias segregadas.',
      '6. Reforçar medidas de segurança de rede (segmentação, firewalls, proteção de endpoint).',
      '7. Definir regras de segurança na aquisição, desenvolvimento e manutenção de sistemas.',
      '8. Alinhar práticas de segurança da informação com o RGPD (classificação, encriptação, etc.).',
    ],
  },
  {
    section: 'E. Cadeia de abastecimento e contratos',
    section_order: 5,
    tasks: [
      '1. Identificar fornecedores e prestadores de serviços críticos.',
      '2. Rever contratos para incluir requisitos de cibersegurança e obrigações de notificação de incidentes.',
      '3. Prever direitos de auditoria ou de obtenção de evidências de segurança.',
      '4. Estabelecer processo de avaliação de risco de fornecedores antes de novas contratações.',
    ],
  },
  {
    section: 'F. Gestão de incidentes e reporte',
    section_order: 6,
    tasks: [
      '1. Criar procedimento escrito de gestão de incidentes com papéis e fluxos claros.',
      '2. Definir critérios para classificar um incidente como significativo.',
      '3. Preparar capacidade para notificar o CNCS via plataforma dentro dos prazos legais.',
      '4. Realizar simulações/exercícios anuais do processo de resposta a incidentes.',
    ],
  },
  {
    section: 'G. Formação e cultura',
    section_order: 7,
    tasks: [
      '1. Definir plano anual de formação em cibersegurança para órgãos de gestão e chefias.',
      '2. Incluir ações específicas para equipas TI/operacionais e serviços críticos.',
      '3. Implementar campanhas de sensibilização e simuladores de phishing para todos os colaboradores.',
      '4. Definir indicadores para medir participação e eficácia das ações de sensibilização.',
    ],
  },
  {
    section: 'H. Relatórios e supervisão',
    section_order: 8,
    tasks: [
      '1. Elaborar relatório anual de cibersegurança com riscos, medidas, incidentes e planos futuros.',
      '2. Arquivar evidências: atas, relatórios, registos de formação, notificações, auditorias.',
      '3. Organizar documentação para facilitar inspeções e pedidos de informação do CNCS.',
    ],
  },
];

function SectionCard({ section, items, queryKey, template }) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(true);
  // Build a map from task_order -> translated text using the template for this section
  const translatedTasks = {};
  if (template) {
    template.tasks.forEach((text, idx) => { translatedTasks[idx + 1] = text; });
  }
  const total = items.length;
  const done = items.filter(i => i.status === 'done').length;
  const inProgress = items.filter(i => i.status === 'in_progress').length;
  const na = items.filter(i => i.status === 'not_applicable').length;
  const active = total - na;
  const progress = active > 0 ? Math.round((done / active) * 100) : 0;

  return (
    <Card>
      <CardHeader className="cursor-pointer pb-3" onClick={() => setExpanded(e => !e)}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
              progress === 100 ? 'bg-accent/20 text-accent' : 'bg-primary/10 text-primary'
            )}>
              {section.match(/^([A-H])\./)?.[1] ?? items[0]?.section_order ?? '?'}
            </div>
            <div className="min-w-0">
              <CardTitle className="text-sm font-semibold leading-tight">
                {section.replace(/^\d+\.\s*/, '')}
              </CardTitle>
              <div className="flex items-center gap-3 mt-1">
                <Progress value={progress} className="h-1.5 w-28" />
                <span className="text-xs text-muted-foreground">{done}/{active} {t('compliance_section_completed_of')}</span>
                {inProgress > 0 && <Badge variant="outline" className="text-xs text-chart-4 border-chart-4/30">{inProgress} {t('status_in_progress')}</Badge>}
              </div>
            </div>
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0 space-y-2">
          {[...items].sort((a, b) => (a.task_order ?? 0) - (b.task_order ?? 0)).map(item => (
            <ChecklistItemRow key={item.id} item={item} queryKey={queryKey} displayText={translatedTasks[item.task_order]} />
          ))}
        </CardContent>
      )}
    </Card>
  );
}

export default function ComplianceJourney() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'admin';
  const [selectedCustomerId, setSelectedCustomerId] = useState(isAdmin ? '' : user?.customer_id);
  const [initializing, setInitializing] = useState(false);

  const RJCS_TEMPLATE = language === 'pt' ? RJCS_TEMPLATE_PT : RJCS_TEMPLATE_EN;

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list('-name', 200),
    enabled: isAdmin,
  });

  const activeCustomerId = isAdmin ? selectedCustomerId : user?.customer_id;
  const queryKey = ['compliance-checklist', activeCustomerId];

  const { data: items = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => base44.entities.ComplianceChecklist.filter({ customer_id: activeCustomerId, framework: 'RJCS' }, 'section_order', 500),
    enabled: !!activeCustomerId,
  });

  const initMutation = useMutation({
    mutationFn: async () => {
      setInitializing(true);
      const records = [];
      RJCS_TEMPLATE.forEach(sec => {
        sec.tasks.forEach((task, idx) => {
          records.push({
            customer_id: activeCustomerId,
            customer_name: customers.find(c => c.id === activeCustomerId)?.name || '',
            framework: 'RJCS',
            section: sec.section,
            section_order: sec.section_order,
            task_text: task,
            task_order: idx + 1,
            status: 'pending',
          });
        });
      });
      await base44.entities.ComplianceChecklist.bulkCreate(records);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setInitializing(false);
      toast.success(t('compliance_init_success'));
    },
    onError: () => setInitializing(false),
  });

  const grouped = items.reduce((acc, item) => {
    if (!acc[item.section]) acc[item.section] = [];
    acc[item.section].push(item);
    return acc;
  }, {});
  const sections = Object.keys(grouped).sort((a, b) => {
    return (grouped[a][0]?.section_order ?? 99) - (grouped[b][0]?.section_order ?? 99);
  });

  const total = items.length;
  const done = items.filter(i => i.status === 'done').length;
  const inProgress = items.filter(i => i.status === 'in_progress').length;
  const na = items.filter(i => i.status === 'not_applicable').length;
  const active = total - na;
  const overallProgress = active > 0 ? Math.round((done / active) * 100) : 0;

  const selectedCustomer = customers.find(c => c.id === activeCustomerId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">{t('compliance_journey_title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('compliance_journey_subtitle')}</p>
        </div>
        {isAdmin && (
          <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder={t('compliance_select_customer')} />
            </SelectTrigger>
            <SelectContent>
              {customers.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {!activeCustomerId ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Circle className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p className="font-medium">{t('compliance_select_customer_prompt')}</p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-4 text-muted-foreground opacity-40" />
            <p className="font-medium text-lg mb-1">{t('compliance_not_initialised')}</p>
            <p className="text-sm text-muted-foreground mb-6">
              {t('compliance_not_initialised_desc')}{' '}
              <strong>{selectedCustomer?.name || ''}</strong>.
            </p>
            <Button onClick={() => initMutation.mutate()} disabled={initializing} className="gap-2">
              {initializing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {t('compliance_init_button')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{t('compliance_total_tasks')}</p><p className="text-2xl font-bold mt-1">{total}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{t('compliance_completed')}</p><p className="text-2xl font-bold mt-1 text-accent">{done}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{t('compliance_in_progress')}</p><p className="text-2xl font-bold mt-1 text-chart-4">{inProgress}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{t('compliance_overall_progress')}</p><p className="text-2xl font-bold mt-1">{overallProgress}%</p><Progress value={overallProgress} className="h-1.5 mt-1" /></CardContent></Card>
          </div>

          <div className="space-y-4">
            {sections.map(sec => {
              const secOrder = grouped[sec][0]?.section_order;
              const templateSection = RJCS_TEMPLATE.find(t => t.section_order === secOrder);
              return (
                <SectionCard key={sec} section={templateSection?.section || sec} items={grouped[sec]} queryKey={queryKey} template={templateSection} />
              );
            })}
          </div>

          {isAdmin && (
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={async () => {
                  if (!confirm(t('compliance_reinit_confirm'))) return;
                  setInitializing(true);
                  for (const item of items) {
                    await base44.entities.ComplianceChecklist.delete(item.id);
                  }
                  await initMutation.mutateAsync();
                }}
                disabled={initializing}
              >
                <RefreshCw className="w-3 h-3" /> {t('compliance_reinit')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}