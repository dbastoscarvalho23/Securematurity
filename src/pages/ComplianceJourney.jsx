import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, Clock, Circle, MinusCircle, ChevronDown, ChevronUp, Loader2, Plus, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import ChecklistItemRow from '@/components/compliance/ChecklistItemRow';
import { toast } from 'sonner';

// Full RJCS checklist template from the Excel
const RJCS_TEMPLATE = [
  {
    section: '1. Enquadramento e registo no CNCS',
    section_order: 1,
    tasks: [
      'Confirmar se a entidade é pública relevante Grupo A ou Grupo B (n.º de trabalhadores, tipo de serviços, criticidade).',
      'Identificar interlocutor com o CNCS (jurídico ou direção de sistemas de informação).',
      'Efetuar o registo na plataforma eletrónica do CNCS dentro do prazo aplicável.',
      'Verificar e documentar a classificação (A ou B), guardando fundamentação em ata ou despacho interno.',
    ],
  },
  {
    section: '2. Modelo de governação e responsáveis',
    section_order: 2,
    tasks: [
      'Designar formalmente um Responsável de Cibersegurança com ligação direta à gestão.',
      'Designar um ponto de contacto permanente para comunicação com CNCS e autoridades setoriais.',
      'Criar um Comité de Cibersegurança / Riscos Digitais com representantes de áreas críticas.',
      'Definir calendário de reuniões regulares com reporte ao órgão executivo.',
    ],
  },
  {
    section: '3. Sistema de gestão de risco',
    section_order: 3,
    tasks: [
      'Identificar ativos e serviços críticos (sistemas de água, resíduos, mobilidade, ação social, etc.).',
      'Realizar análise de riscos de cibersegurança incluindo riscos na cadeia de fornecimento.',
      'Aprovar política de cibersegurança pelo órgão dirigente.',
      'Definir plano de tratamento de riscos com prioridades, prazos e responsáveis.',
      'Estabelecer revisão periódica do risco (pelo menos anual ou após incidentes relevantes).',
    ],
  },
  {
    section: '4. Medidas técnicas e organizativas',
    section_order: 4,
    tasks: [
      'Manter inventário atualizado de ativos de TI e sistemas de informação críticos.',
      'Implementar gestão de acessos e identidades com revisão regular de privilégios.',
      'Aplicar autenticação multifator nos sistemas críticos e acessos remotos.',
      'Definir processo de gestão de vulnerabilidades e atualizações (patching).',
      'Implementar políticas de backup com testes de restauração e cópias segregadas.',
      'Reforçar medidas de segurança de rede (segmentação, firewalls, proteção de endpoint).',
      'Definir regras de segurança na aquisição, desenvolvimento e manutenção de sistemas.',
      'Alinhar práticas de segurança da informação com o RGPD (classificação, encriptação, etc.).',
    ],
  },
  {
    section: '5. Cadeia de abastecimento e contratos',
    section_order: 5,
    tasks: [
      'Identificar fornecedores e prestadores de serviços críticos.',
      'Rever contratos para incluir requisitos de cibersegurança e obrigações de notificação de incidentes.',
      'Prever direitos de auditoria ou de obtenção de evidências de segurança.',
      'Estabelecer processo de avaliação de risco de fornecedores antes de novas contratações.',
    ],
  },
  {
    section: '6. Gestão de incidentes e reporte',
    section_order: 6,
    tasks: [
      'Criar procedimento escrito de gestão de incidentes com papéis e fluxos claros.',
      'Definir critérios para classificar um incidente como significativo.',
      'Preparar capacidade para notificar o CNCS via plataforma dentro dos prazos legais.',
      'Realizar simulações/exercícios anuais do processo de resposta a incidentes.',
    ],
  },
  {
    section: '7. Formação e cultura',
    section_order: 7,
    tasks: [
      'Definir plano anual de formação em cibersegurança para órgãos de gestão e chefias.',
      'Incluir ações específicas para equipas TI/operacionais e serviços críticos.',
      'Implementar campanhas de sensibilização e simuladores de phishing para todos os colaboradores.',
      'Definir indicadores para medir participação e eficácia das ações de sensibilização.',
    ],
  },
  {
    section: '8. Relatórios e supervisão',
    section_order: 8,
    tasks: [
      'Elaborar relatório anual de cibersegurança com riscos, medidas, incidentes e planos futuros.',
      'Arquivar evidências: atas, relatórios, registos de formação, notificações, auditorias.',
      'Organizar documentação para facilitar inspeções e pedidos de informação do CNCS.',
    ],
  },
];

const STATUS_ORDER = ['pending', 'in_progress', 'done', 'not_applicable'];
const STATUS_LABELS = { pending: 'Pendente', in_progress: 'Em Curso', done: 'Concluído', not_applicable: 'N/A' };
const STATUS_COLORS = {
  pending: 'text-muted-foreground',
  in_progress: 'text-chart-4',
  done: 'text-accent',
  not_applicable: 'text-muted-foreground',
};

function SectionCard({ section, items, queryKey }) {
  const [expanded, setExpanded] = useState(true);
  const total = items.length;
  const done = items.filter(i => i.status === 'done').length;
  const inProgress = items.filter(i => i.status === 'in_progress').length;
  const na = items.filter(i => i.status === 'not_applicable').length;
  const active = total - na;
  const progress = active > 0 ? Math.round((done / active) * 100) : 0;

  return (
    <Card>
      <CardHeader
        className="cursor-pointer pb-3"
        onClick={() => setExpanded(e => !e)}
      >
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
                <span className="text-xs text-muted-foreground">{done}/{active} concluídas</span>
                {inProgress > 0 && <Badge variant="outline" className="text-xs text-chart-4 border-chart-4/30">{inProgress} em curso</Badge>}
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
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'admin';
  const [selectedCustomerId, setSelectedCustomerId] = useState(isAdmin ? '' : user?.customer_id);
  const [initializing, setInitializing] = useState(false);

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

  // Initialise checklist for this customer from the template
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
      toast.success('Checklist RJCS inicializada com sucesso!');
    },
    onError: () => setInitializing(false),
  });

  // Group by section
  const grouped = items.reduce((acc, item) => {
    if (!acc[item.section]) acc[item.section] = [];
    acc[item.section].push(item);
    return acc;
  }, {});
  const sections = Object.keys(grouped).sort((a, b) => {
    const aOrder = grouped[a][0]?.section_order ?? 99;
    const bOrder = grouped[b][0]?.section_order ?? 99;
    return aOrder - bOrder;
  });

  // Summary stats
  const total = items.length;
  const done = items.filter(i => i.status === 'done').length;
  const inProgress = items.filter(i => i.status === 'in_progress').length;
  const na = items.filter(i => i.status === 'not_applicable').length;
  const active = total - na;
  const overallProgress = active > 0 ? Math.round((done / active) * 100) : 0;

  const selectedCustomer = customers.find(c => c.id === activeCustomerId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Jornada de Conformidade RJCS</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Regime Jurídico da Cibersegurança — Checklist de conformidade por etapas
          </p>
        </div>
        {isAdmin && (
          <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Selecionar cliente..." />
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
            <p className="font-medium">Selecione um cliente para ver a checklist</p>
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
            <p className="font-medium text-lg mb-1">Checklist ainda não inicializada</p>
            <p className="text-sm text-muted-foreground mb-6">
              Clique abaixo para criar a checklist RJCS completa para{' '}
              <strong>{selectedCustomer?.name || 'este cliente'}</strong>.
            </p>
            <Button onClick={() => initMutation.mutate()} disabled={initializing} className="gap-2">
              {initializing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Inicializar Checklist RJCS
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Total de tarefas</p>
                <p className="text-2xl font-bold mt-1">{total}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Concluídas</p>
                <p className="text-2xl font-bold mt-1 text-accent">{done}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Em Curso</p>
                <p className="text-2xl font-bold mt-1 text-chart-4">{inProgress}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Progresso Global</p>
                <p className="text-2xl font-bold mt-1">{overallProgress}%</p>
                <Progress value={overallProgress} className="h-1.5 mt-1" />
              </CardContent>
            </Card>
          </div>

          {/* Section cards */}
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
                  if (!confirm('Tem a certeza que quer reinicializar a checklist? Todos os dados serão apagados.')) return;
                  setInitializing(true);
                  for (const item of items) {
                    await base44.entities.ComplianceChecklist.delete(item.id);
                  }
                  await initMutation.mutateAsync();
                }}
                disabled={initializing}
              >
                <RefreshCw className="w-3 h-3" /> Reinicializar Checklist
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}