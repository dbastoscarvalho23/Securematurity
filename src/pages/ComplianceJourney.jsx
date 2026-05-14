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
    section: '1. Registration and CNCS Enrolment',
    section_order: 1,
    tasks: [
      'Confirm whether the entity is a relevant public entity Group A or Group B (number of employees, type of services, criticality).',
      'Identify the liaison with CNCS (legal or information systems management).',
      'Complete registration on the CNCS electronic platform within the applicable deadline.',
      'Verify and document the classification (A or B), keeping justification in minutes or internal dispatch.',
    ],
  },
  {
    section: '2. Governance Model and Responsibilities',
    section_order: 2,
    tasks: [
      'Formally designate a Cybersecurity Officer with direct link to management.',
      'Designate a permanent point of contact for communication with CNCS and sectoral authorities.',
      'Create a Cybersecurity / Digital Risk Committee with representatives from critical areas.',
      'Define a regular meeting schedule with reporting to the executive body.',
    ],
  },
  {
    section: '3. Risk Management System',
    section_order: 3,
    tasks: [
      'Identify critical assets and services (water, waste, mobility, social services, etc.).',
      'Conduct a cybersecurity risk analysis including supply chain risks.',
      'Approve the cybersecurity policy by the governing body.',
      'Define a risk treatment plan with priorities, deadlines and responsible parties.',
      'Establish periodic risk review (at least annual or after significant incidents).',
    ],
  },
  {
    section: '4. Technical and Organisational Measures',
    section_order: 4,
    tasks: [
      'Maintain an up-to-date inventory of IT assets and critical information systems.',
      'Implement access and identity management with regular privilege reviews.',
      'Apply multi-factor authentication on critical systems and remote access.',
      'Define a vulnerability and patch management process.',
      'Implement backup policies with restoration tests and segregated copies.',
      'Strengthen network security measures (segmentation, firewalls, endpoint protection).',
      'Define security rules for the acquisition, development and maintenance of systems.',
      'Align information security practices with GDPR (classification, encryption, etc.).',
    ],
  },
  {
    section: '5. Supply Chain and Contracts',
    section_order: 5,
    tasks: [
      'Identify critical suppliers and service providers.',
      'Review contracts to include cybersecurity requirements and incident notification obligations.',
      'Provide for audit rights or the right to obtain security evidence.',
      'Establish a supplier risk assessment process before new procurement.',
    ],
  },
  {
    section: '6. Incident Management and Reporting',
    section_order: 6,
    tasks: [
      'Create a written incident management procedure with clear roles and workflows.',
      'Define criteria for classifying an incident as significant.',
      'Prepare capability to notify CNCS via platform within legal deadlines.',
      'Conduct annual simulations/exercises of the incident response process.',
    ],
  },
  {
    section: '7. Training and Culture',
    section_order: 7,
    tasks: [
      'Define an annual cybersecurity training plan for management bodies and senior staff.',
      'Include specific actions for IT/operational teams and critical services.',
      'Implement awareness campaigns and phishing simulators for all employees.',
      'Define indicators to measure participation and effectiveness of awareness actions.',
    ],
  },
  {
    section: '8. Reporting and Supervision',
    section_order: 8,
    tasks: [
      'Prepare an annual cybersecurity report covering risks, measures, incidents and future plans.',
      'Archive evidence: minutes, reports, training records, notifications, audits.',
      'Organise documentation to facilitate CNCS inspections and information requests.',
    ],
  },
];

const RJCS_TEMPLATE_PT = [
  {
    section: '1. Enquadramento e registo no CNCS',
    section_order: 1,
    tasks: [
      'Confirmar se a entidade é entidade pública relevante Grupo A ou Grupo B (número de trabalhadores, tipo de serviços, criticidade).',
      'Identificar o interlocutor com o CNCS (jurídico ou gestão de sistemas de informação).',
      'Efetuar o registo na plataforma eletrónica do CNCS dentro do prazo aplicável.',
      'Verificar e documentar a classificação (A ou B), mantendo justificação em ata ou despacho interno.',
    ],
  },
  {
    section: '2. Modelo de governação e responsabilidades',
    section_order: 2,
    tasks: [
      'Designar formalmente um Responsável pela Cibersegurança com ligação direta à gestão de topo.',
      'Designar um ponto de contacto permanente para comunicação com o CNCS e autoridades setoriais.',
      'Criar uma Comissão de Cibersegurança / Risco Digital com representantes das áreas críticas.',
      'Definir periodicidade de reuniões e reporte ao órgão executivo.',
    ],
  },
  {
    section: '3. Sistema de gestão do risco',
    section_order: 3,
    tasks: [
      'Identificar ativos e serviços críticos (água, resíduos, mobilidade, serviços sociais, etc.).',
      'Realizar análise de risco de cibersegurança incluindo riscos de cadeia de fornecimento.',
      'Aprovar a política de cibersegurança pelo órgão de gestão.',
      'Definir plano de tratamento de risco com prioridades, prazos e responsáveis.',
      'Estabelecer revisão periódica do risco (pelo menos anual ou após incidentes significativos).',
    ],
  },
  {
    section: '4. Medidas técnicas e organizacionais',
    section_order: 4,
    tasks: [
      'Manter inventário atualizado de ativos de TI e sistemas de informação críticos.',
      'Implementar gestão de acessos e identidades com revisão periódica de privilégios.',
      'Aplicar autenticação multifator em sistemas críticos e acessos remotos.',
      'Definir processo de gestão de vulnerabilidades e patches.',
      'Implementar políticas de backup com testes de restauro e cópias segregadas.',
      'Reforçar medidas de segurança de rede (segmentação, firewalls, proteção de endpoints).',
      'Definir regras de segurança para aquisição, desenvolvimento e manutenção de sistemas.',
      'Alinhar práticas de segurança da informação com o RGPD (classificação, cifragem, etc.).',
    ],
  },
  {
    section: '5. Cadeia de fornecimento e contratos',
    section_order: 5,
    tasks: [
      'Identificar fornecedores e prestadores de serviços críticos.',
      'Rever contratos para incluir requisitos de cibersegurança e obrigações de notificação de incidentes.',
      'Prever direitos de auditoria ou o direito a obter evidências de segurança.',
      'Estabelecer processo de avaliação do risco de fornecedores antes de novas aquisições.',
    ],
  },
  {
    section: '6. Gestão e reporte de incidentes',
    section_order: 6,
    tasks: [
      'Criar procedimento escrito de gestão de incidentes com papéis e fluxos claros.',
      'Definir critérios para classificar um incidente como significativo.',
      'Preparar capacidade de notificação ao CNCS via plataforma dentro dos prazos legais.',
      'Realizar simulacros/exercícios anuais do processo de resposta a incidentes.',
    ],
  },
  {
    section: '7. Formação e cultura',
    section_order: 7,
    tasks: [
      'Definir plano anual de formação em cibersegurança para órgãos de gestão e quadros superiores.',
      'Incluir ações específicas para equipas de TI/operacionais e serviços críticos.',
      'Implementar campanhas de sensibilização e simuladores de phishing para todos os colaboradores.',
      'Definir indicadores para medir a participação e eficácia das ações de sensibilização.',
    ],
  },
  {
    section: '8. Reporte e supervisão',
    section_order: 8,
    tasks: [
      'Preparar relatório anual de cibersegurança cobrindo riscos, medidas, incidentes e planos futuros.',
      'Arquivar evidências: atas, relatórios, registos de formação, notificações, auditorias.',
      'Organizar documentação para facilitar inspeções do CNCS e pedidos de informação.',
    ],
  },
];

function SectionCard({ section, items, queryKey }) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(true);
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
              {items[0]?.section_order ?? '?'}
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
          {items.map(item => (
            <ChecklistItemRow key={item.id} item={item} queryKey={queryKey} />
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
            {sections.map(sec => (
              <SectionCard key={sec} section={sec} items={grouped[sec]} queryKey={queryKey} />
            ))}
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