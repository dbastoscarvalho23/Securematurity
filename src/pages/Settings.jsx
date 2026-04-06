import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Settings as SettingsIcon, Shield, Loader2, UserPlus, Mail, Trash2, Pencil, User } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import EditUserDialog from '@/components/settings/EditUserDialog';

export default function Settings() {
  const { user: currentUser, checkAppState, refreshUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const isCustomerAdmin = currentUser?.role === 'customer_admin';

  const [isSeeding, setIsSeeding] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('user');
  const [isInviting, setIsInviting] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [invitedToDelete, setInvitedToDelete] = useState(null);
  const [userToEdit, setUserToEdit] = useState(null);

  // Profile edit state (for current user's own profile)
  const [profileName, setProfileName] = useState('');
  const [profileCustomerId, setProfileCustomerId] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const queryClient = useQueryClient();

  const deleteUserMutation = useMutation({
    mutationFn: async (userId) => {
      await base44.asServiceRole.entities.User.delete(userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User deleted successfully');
      setUserToDelete(null);
    },
    onError: (err) => {
      toast.error(err?.message || 'Failed to delete user');
    }
  });

  const deleteInvitedUserMutation = useMutation({
    mutationFn: async (invitedUserId) => {
      await base44.entities.InvitedUser.delete(invitedUserId);
    },
    onSuccess: () => {
      refetchInvited();
      toast.success('Invitation deleted');
      setInvitedToDelete(null);
    },
    onError: (err) => {
      toast.error(err?.message || 'Failed to delete invitation');
    }
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, data }) => {
      const res = await base44.functions.invoke('adminUpdateUser', { userId, data });
      if (res.data?.error) throw new Error(res.data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User updated successfully');
      setUserToEdit(null);
    },
    onError: (err) => {
      toast.error(err?.message || 'Failed to update user');
    }
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const { data: frameworks = [] } = useQuery({
    queryKey: ['frameworks'],
    queryFn: () => base44.entities.Framework.list(),
  });

  const { data: questions = [] } = useQuery({
    queryKey: ['questions'],
    queryFn: () => base44.entities.Question.list('-created_date', 500),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  // Pre-populate profile fields directly from the auth context user
  useEffect(() => {
    if (currentUser) {
      setProfileName(currentUser.display_name || currentUser.full_name || '');
      setProfileCustomerId(currentUser.customer_id || '');
    }
  }, [currentUser?.email, currentUser?.display_name, currentUser?.full_name, currentUser?.customer_id]);

  const { data: invitedUsers = [], refetch: refetchInvited } = useQuery({
    queryKey: ['invited-users'],
    queryFn: () => base44.entities.InvitedUser.list(),
  });

  const { data: responses = [] } = useQuery({
    queryKey: ['all-responses'],
    queryFn: () => base44.entities.AssessmentResponse.list('-created_date', 2000),
  });

  // Compute weighted risk score per framework (0–5 scale)
  // Score = sum(maturity_level * weight) / sum(weight) for all answered questions
  const frameworkScores = {};
  questions.forEach(q => {
    const answered = responses.filter(r => r.question_id === q.id && r.maturity_level != null);
    if (answered.length === 0) return;
    const fw = q.framework_code;
    if (!frameworkScores[fw]) frameworkScores[fw] = { weightedSum: 0, totalWeight: 0, answeredCount: 0 };
    const w = q.weight || 1;
    // Average maturity across all responses for this question
    const avgLevel = answered.reduce((s, r) => s + r.maturity_level, 0) / answered.length;
    frameworkScores[fw].weightedSum += avgLevel * w;
    frameworkScores[fw].totalWeight += w;
    frameworkScores[fw].answeredCount += answered.length;
  });

  const getRiskScore = (code) => {
    const s = frameworkScores[code];
    if (!s || s.totalWeight === 0) return null;
    return s.weightedSum / s.totalWeight;
  };

  const getRiskLabel = (score) => {
    if (score === null) return { label: 'No Data', color: 'text-muted-foreground' };
    if (score >= 4) return { label: 'Low Risk', color: 'text-accent' };
    if (score >= 3) return { label: 'Moderate', color: 'text-chart-3' };
    if (score >= 2) return { label: 'Elevated', color: 'text-chart-4' };
    return { label: 'High Risk', color: 'text-destructive' };
  };

  // Derive current user's record from the users list
  const myRecord = users.find(u => u.email === currentUser?.email);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      const selectedCustomer = customers.find(c => c.id === profileCustomerId);
      await base44.auth.updateMe({
        display_name: profileName,
        customer_id: profileCustomerId || null,
        customer_name: selectedCustomer?.name || null,
      });
      await refreshUser();
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Profile updated successfully');
    } catch (err) {
      toast.error(err?.message || 'Failed to update profile');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setIsInviting(true);
    try {
      const me = await base44.auth.me();
      // customer_admin can only invite 'user' role, auto-assigned to their own customer
      const effectiveRole = isCustomerAdmin ? 'user' : inviteRole;
      await base44.users.inviteUser(inviteEmail, effectiveRole);
      const alreadyTracked = invitedUsers.find(u => u.email === inviteEmail);
      if (!alreadyTracked) {
        await base44.entities.InvitedUser.create({
          email: inviteEmail,
          role: effectiveRole,
          status: 'inactive',
          invited_by: me?.email || '',
        });
      }
      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteEmail('');
      setInviteRole('user');
      refetchInvited();
    } catch (err) {
      toast.error(err?.message || `Failed to send invitation to ${inviteEmail}`);
    } finally {
      setIsInviting(false);
    }
  };

  const seedFrameworks = async () => {
    setIsSeeding(true);
    const fwData = [
      { code: 'NIS2', name: 'NIS2 / Decreto-Lei n.º 125/2025', version: '2025', description: 'Portuguese transposition of EU NIS2 Directive', status: 'active' },
      { code: 'ISO27001', name: 'ISO/IEC 27001:2022', version: '2022', description: 'Information security management system standard', status: 'active' },
      { code: 'NIST_CSF', name: 'NIST Cybersecurity Framework', version: '2.0', description: 'NIST framework for managing cybersecurity risk', status: 'active' },
      { code: 'CIS_V8', name: 'CIS Controls v8', version: '8.0', description: 'Center for Internet Security critical security controls', status: 'active' },
      { code: 'QNRC', name: 'Quadro Nacional de Referência para a Cibersegurança', version: '1.0', description: 'Framework nacional português para gestão de risco de cibersegurança (CNCS)', status: 'active' },
      { code: 'ENISA', name: 'ENISA Cybersecurity Framework', version: '2024', description: 'European Union Agency for Cybersecurity (ENISA) framework based on NIS2 Article 21 risk management measures and ENISA cybersecurity guidelines', status: 'active' },
    ];
    await base44.entities.Framework.bulkCreate(fwData);

    // Seed sample questions
    const sampleQuestions = [
      // NIS2
      { framework_code: 'NIS2', domain: 'Governance', control_id: 'NIS2-GOV-01', question_text: 'Does the organization have a formal cybersecurity governance structure with clear roles and responsibilities?', order_index: 1, weight: 3, guidance: 'Look for documented roles, CISO appointment, board-level oversight.' },
      { framework_code: 'NIS2', domain: 'Governance', control_id: 'NIS2-GOV-02', question_text: 'Is there a comprehensive cybersecurity policy approved by top management?', order_index: 2, weight: 3 },
      { framework_code: 'NIS2', domain: 'Risk Management', control_id: 'NIS2-RM-01', question_text: 'Does the organization conduct regular cybersecurity risk assessments?', order_index: 3, weight: 3 },
      { framework_code: 'NIS2', domain: 'Risk Management', control_id: 'NIS2-RM-02', question_text: 'Is there a documented risk treatment plan with timelines and ownership?', order_index: 4, weight: 2 },
      { framework_code: 'NIS2', domain: 'Incident Response', control_id: 'NIS2-IR-01', question_text: 'Does the organization have an incident response plan aligned with NIS2 notification requirements?', order_index: 5, weight: 3 },
      { framework_code: 'NIS2', domain: 'Incident Response', control_id: 'NIS2-IR-02', question_text: 'Is the organization capable of reporting significant incidents within 24 hours as required by NIS2?', order_index: 6, weight: 3 },
      { framework_code: 'NIS2', domain: 'Supply Chain Security', control_id: 'NIS2-SC-01', question_text: 'Does the organization assess and manage cybersecurity risks in its supply chain?', order_index: 7, weight: 2 },
      { framework_code: 'NIS2', domain: 'Business Continuity', control_id: 'NIS2-BC-01', question_text: 'Is there a tested business continuity plan that addresses cyber incidents?', order_index: 8, weight: 2 },

      // ISO 27001
      { framework_code: 'ISO27001', domain: 'Information Security Policies', control_id: 'A.5.1', question_text: 'Are information security policies defined, approved by management, and communicated to all employees?', order_index: 1, weight: 3 },
      { framework_code: 'ISO27001', domain: 'Organization of Information Security', control_id: 'A.5.2', question_text: 'Are information security roles and responsibilities clearly assigned and documented?', order_index: 2, weight: 2 },
      { framework_code: 'ISO27001', domain: 'Asset Management', control_id: 'A.5.9', question_text: 'Is there a complete inventory of information assets with assigned owners?', order_index: 3, weight: 2 },
      { framework_code: 'ISO27001', domain: 'Access Control', control_id: 'A.5.15', question_text: 'Is there a formal access control policy based on the principle of least privilege?', order_index: 4, weight: 3 },
      { framework_code: 'ISO27001', domain: 'Cryptography', control_id: 'A.8.24', question_text: 'Is there a policy on the use of cryptographic controls and key management?', order_index: 5, weight: 2 },
      { framework_code: 'ISO27001', domain: 'Physical Security', control_id: 'A.7.1', question_text: 'Are physical security perimeters defined and secured for critical areas?', order_index: 6, weight: 2 },
      { framework_code: 'ISO27001', domain: 'Operations Security', control_id: 'A.8.7', question_text: 'Are malware protection controls implemented and regularly updated?', order_index: 7, weight: 3 },
      { framework_code: 'ISO27001', domain: 'Incident Management', control_id: 'A.5.24', question_text: 'Is there a structured incident management process with defined severity levels?', order_index: 8, weight: 3 },

      // NIST CSF
      { framework_code: 'NIST_CSF', domain: 'Identify (ID)', control_id: 'ID.AM-1', question_text: 'Are all physical devices and systems within the organization inventoried?', order_index: 1, weight: 2 },
      { framework_code: 'NIST_CSF', domain: 'Identify (ID)', control_id: 'ID.RA-1', question_text: 'Are asset vulnerabilities identified and documented?', order_index: 2, weight: 2 },
      { framework_code: 'NIST_CSF', domain: 'Protect (PR)', control_id: 'PR.AC-1', question_text: 'Are identities and credentials managed for authorized devices and users?', order_index: 3, weight: 3 },
      { framework_code: 'NIST_CSF', domain: 'Protect (PR)', control_id: 'PR.AT-1', question_text: 'Are all users informed and trained on cybersecurity awareness?', order_index: 4, weight: 2 },
      { framework_code: 'NIST_CSF', domain: 'Detect (DE)', control_id: 'DE.CM-1', question_text: 'Is the network monitored to detect potential cybersecurity events?', order_index: 5, weight: 3 },
      { framework_code: 'NIST_CSF', domain: 'Respond (RS)', control_id: 'RS.RP-1', question_text: 'Is a response plan executed during or after a detected cybersecurity event?', order_index: 6, weight: 3 },
      { framework_code: 'NIST_CSF', domain: 'Recover (RC)', control_id: 'RC.RP-1', question_text: 'Is a recovery plan executed during or after a cybersecurity event?', order_index: 7, weight: 2 },
      { framework_code: 'NIST_CSF', domain: 'Govern (GV)', control_id: 'GV.OC-1', question_text: 'Is cybersecurity risk management integrated into the organizational risk management program?', order_index: 8, weight: 3 },

      // CIS Controls v8
      { framework_code: 'CIS_V8', domain: 'Inventory and Control of Enterprise Assets', control_id: 'CIS-1', question_text: 'Does the organization maintain an accurate and up-to-date inventory of all enterprise assets?', order_index: 1, weight: 3 },
      { framework_code: 'CIS_V8', domain: 'Inventory and Control of Software Assets', control_id: 'CIS-2', question_text: 'Is there a complete inventory of all authorized and unauthorized software?', order_index: 2, weight: 2 },
      { framework_code: 'CIS_V8', domain: 'Data Protection', control_id: 'CIS-3', question_text: 'Are data management processes and technical controls in place to identify, classify, and protect sensitive data?', order_index: 3, weight: 3 },
      { framework_code: 'CIS_V8', domain: 'Secure Configuration', control_id: 'CIS-4', question_text: 'Are secure configurations established and maintained for enterprise assets and software?', order_index: 4, weight: 2 },
      { framework_code: 'CIS_V8', domain: 'Account Management', control_id: 'CIS-5', question_text: 'Is there a process to manage credentials and access control for user, admin, and service accounts?', order_index: 5, weight: 3 },
      { framework_code: 'CIS_V8', domain: 'Access Control Management', control_id: 'CIS-6', question_text: 'Are access control management processes defined and implemented using least privilege principles?', order_index: 6, weight: 2 },
      { framework_code: 'CIS_V8', domain: 'Continuous Vulnerability Management', control_id: 'CIS-7', question_text: 'Is there a continuous vulnerability management process to identify, remediate, and minimize the window of opportunity for attackers?', order_index: 7, weight: 3 },
      { framework_code: 'CIS_V8', domain: 'Audit Log Management', control_id: 'CIS-8', question_text: 'Are audit logs collected, managed, and analyzed to detect anomalies?', order_index: 8, weight: 2 },

      // QNRC — Quadro Nacional de Referência para a Cibersegurança
      // Identificar (ID)
      { framework_code: 'QNRC', domain: 'Identificar — Gestão de Ativos (ID.GA)', control_id: 'ID.GA-1', question_text: 'Are physical devices and systems within the organization inventoried?', question_text_pt: 'Os dispositivos físicos e sistemas da organização encontram-se inventariados?', guidance: 'Verify the existence of an updated hardware inventory covering all organizational assets.', guidance_pt: 'Verificar a existência de um inventário de hardware atualizado cobrindo todos os ativos organizacionais.', order_index: 1, weight: 2 },
      { framework_code: 'QNRC', domain: 'Identificar — Gestão de Ativos (ID.GA)', control_id: 'ID.GA-2', question_text: 'Are software platforms and applications within the organization inventoried?', question_text_pt: 'As plataformas de software e aplicações da organização encontram-se inventariadas?', guidance: 'Look for a software asset inventory including version and license information.', guidance_pt: 'Verificar a existência de um inventário de ativos de software com informação de versão e licença.', order_index: 2, weight: 2 },
      { framework_code: 'QNRC', domain: 'Identificar — Gestão de Ativos (ID.GA)', control_id: 'ID.GA-5', question_text: 'Are resources prioritized based on their classification, criticality, and business value?', question_text_pt: 'Os recursos são priorizados com base na sua classificação, criticidade e valor para o negócio?', order_index: 3, weight: 3 },
      { framework_code: 'QNRC', domain: 'Identificar — Ambiente de Negócio (ID.AO)', control_id: 'ID.AO-4', question_text: 'Are dependencies and critical functions for delivery of critical services established?', question_text_pt: 'As dependências e funções críticas para a prestação de serviços críticos estão identificadas e estabelecidas?', order_index: 4, weight: 3 },
      { framework_code: 'QNRC', domain: 'Identificar — Governação (ID.GV)', control_id: 'ID.GV-1', question_text: 'Is an organizational cybersecurity policy established and communicated?', question_text_pt: 'Existe uma política de cibersegurança organizacional estabelecida e comunicada?', guidance: 'Confirm the existence of a formal, approved, and communicated cybersecurity policy.', guidance_pt: 'Confirmar a existência de uma política de cibersegurança formal, aprovada e comunicada.', order_index: 5, weight: 3 },
      { framework_code: 'QNRC', domain: 'Identificar — Governação (ID.GV)', control_id: 'ID.GV-2', question_text: 'Are legal and regulatory requirements regarding cybersecurity understood and managed?', question_text_pt: 'Os requisitos legais e regulatórios relacionados com a cibersegurança são compreendidos e geridos?', order_index: 6, weight: 3 },
      { framework_code: 'QNRC', domain: 'Identificar — Avaliação de Risco (ID.AR)', control_id: 'ID.AR-1', question_text: 'Are asset vulnerabilities identified and documented?', question_text_pt: 'As vulnerabilidades dos ativos são identificadas e documentadas?', order_index: 7, weight: 2 },
      { framework_code: 'QNRC', domain: 'Identificar — Avaliação de Risco (ID.AR)', control_id: 'ID.AR-4', question_text: 'Are threats, vulnerabilities, likelihoods and impacts used to determine risk?', question_text_pt: 'As ameaças, vulnerabilidades, probabilidades e impactos são utilizados para determinar o risco?', order_index: 8, weight: 3 },
      { framework_code: 'QNRC', domain: 'Identificar — Estratégia de Gestão de Risco (ID.GR)', control_id: 'ID.GR-1', question_text: 'Are risk management processes established and managed by organizational leadership?', question_text_pt: 'Os processos de gestão de risco estão estabelecidos e são geridos pela liderança organizacional?', order_index: 9, weight: 3 },
      { framework_code: 'QNRC', domain: 'Identificar — Gestão de Risco na Cadeia de Fornecimento (ID.GL)', control_id: 'ID.GL-2', question_text: 'Are supply chain risks identified and evaluated?', question_text_pt: 'Os riscos na cadeia de fornecimento são identificados e avaliados?', order_index: 10, weight: 2 },

      // Proteger (PR)
      { framework_code: 'QNRC', domain: 'Proteger — Gestão de Identidades e Acessos (PR.GA)', control_id: 'PR.GA-1', question_text: 'Are identities and credentials issued, managed, verified, revoked and audited for authorized users?', question_text_pt: 'As identidades e credenciais são emitidas, geridas, verificadas, revogadas e auditadas para utilizadores autorizados?', order_index: 1, weight: 3 },
      { framework_code: 'QNRC', domain: 'Proteger — Gestão de Identidades e Acessos (PR.GA)', control_id: 'PR.GA-4', question_text: 'Are access permissions managed incorporating the principles of least privilege and separation of duties?', question_text_pt: 'As permissões de acesso são geridas incorporando os princípios do menor privilégio e separação de funções?', order_index: 2, weight: 3 },
      { framework_code: 'QNRC', domain: 'Proteger — Consciencialização e Formação (PR.FC)', control_id: 'PR.FC-1', question_text: 'Are all users informed and trained on cybersecurity?', question_text_pt: 'Todos os utilizadores são informados e formados em cibersegurança?', guidance: 'Look for evidence of regular cybersecurity awareness training for all staff.', guidance_pt: 'Verificar evidências de formação regular em sensibilização para a cibersegurança para todos os colaboradores.', order_index: 3, weight: 2 },
      { framework_code: 'QNRC', domain: 'Proteger — Segurança dos Dados (PR.SD)', control_id: 'PR.SD-1', question_text: 'Is data-at-rest protected using appropriate encryption or other controls?', question_text_pt: 'Os dados em repouso estão protegidos através de encriptação adequada ou outros controlos?', order_index: 4, weight: 3 },
      { framework_code: 'QNRC', domain: 'Proteger — Segurança dos Dados (PR.SD)', control_id: 'PR.SD-2', question_text: 'Is data-in-transit protected using encryption and secure protocols?', question_text_pt: 'Os dados em trânsito estão protegidos através de encriptação e protocolos seguros?', order_index: 5, weight: 3 },
      { framework_code: 'QNRC', domain: 'Proteger — Processos e Procedimentos (PR.PI)', control_id: 'PR.PI-4', question_text: 'Are backups of information conducted, maintained and tested periodically?', question_text_pt: 'Os backups de informação são realizados, mantidos e testados periodicamente?', order_index: 6, weight: 3 },
      { framework_code: 'QNRC', domain: 'Proteger — Processos e Procedimentos (PR.PI)', control_id: 'PR.PI-12', question_text: 'Is a vulnerability management plan developed and implemented?', question_text_pt: 'Existe um plano de gestão de vulnerabilidades desenvolvido e implementado?', order_index: 7, weight: 3 },
      { framework_code: 'QNRC', domain: 'Proteger — Manutenção (PR.MA)', control_id: 'PR.MA-1', question_text: 'Is maintenance of organizational assets performed with approved and controlled tools and logged?', question_text_pt: 'A manutenção dos ativos organizacionais é realizada com ferramentas aprovadas e controladas, sendo registada?', order_index: 8, weight: 2 },
      { framework_code: 'QNRC', domain: 'Proteger — Tecnologia de Proteção (PR.TP)', control_id: 'PR.TP-1', question_text: 'Are audit and log records determined, documented, implemented and reviewed in accordance with policy?', question_text_pt: 'Os registos de auditoria e logs são determinados, documentados, implementados e revistos de acordo com a política?', order_index: 9, weight: 2 },
      { framework_code: 'QNRC', domain: 'Proteger — Tecnologia de Proteção (PR.TP)', control_id: 'PR.TP-4', question_text: 'Are communications and control networks protected against unauthorized access and attacks?', question_text_pt: 'As redes de comunicações e de controlo estão protegidas contra acessos não autorizados e ataques?', order_index: 10, weight: 3 },

      // Detetar (DE)
      { framework_code: 'QNRC', domain: 'Detetar — Anomalias e Eventos (DE.AE)', control_id: 'DE.AE-1', question_text: 'Is a baseline of network operations and expected data flows established and managed?', question_text_pt: 'Existe uma linha de base das operações de rede e dos fluxos de dados esperados, estabelecida e gerida?', order_index: 1, weight: 2 },
      { framework_code: 'QNRC', domain: 'Detetar — Anomalias e Eventos (DE.AE)', control_id: 'DE.AE-3', question_text: 'Is event data collected and correlated from multiple sources and sensors?', question_text_pt: 'Os dados de eventos são recolhidos e correlacionados a partir de múltiplas fontes e sensores?', order_index: 2, weight: 2 },
      { framework_code: 'QNRC', domain: 'Detetar — Monitorização Contínua (DE.MC)', control_id: 'DE.MC-1', question_text: 'Is the network monitored to detect potential cybersecurity events?', question_text_pt: 'A rede é monitorizada para detetar potenciais eventos de cibersegurança?', order_index: 3, weight: 3 },
      { framework_code: 'QNRC', domain: 'Detetar — Monitorização Contínua (DE.MC)', control_id: 'DE.MC-4', question_text: 'Is malicious code detected and removed from organizational systems?', question_text_pt: 'O código malicioso é detetado e removido dos sistemas organizacionais?', order_index: 4, weight: 3 },
      { framework_code: 'QNRC', domain: 'Detetar — Processos de Deteção (DE.PD)', control_id: 'DE.PD-1', question_text: 'Are roles and responsibilities for detection well defined to ensure accountability?', question_text_pt: 'As funções e responsabilidades para a deteção estão bem definidas para garantir a responsabilização?', order_index: 5, weight: 2 },

      // Responder (RS)
      { framework_code: 'QNRC', domain: 'Responder — Planeamento de Resposta (RS.PR)', control_id: 'RS.PR-1', question_text: 'Is a response plan executed during or after a detected cybersecurity incident?', question_text_pt: 'Um plano de resposta é executado durante ou após a deteção de um incidente de cibersegurança?', order_index: 1, weight: 3 },
      { framework_code: 'QNRC', domain: 'Responder — Comunicações (RS.CO)', control_id: 'RS.CO-2', question_text: 'Are incidents reported consistent with established criteria and to relevant stakeholders and authorities?', question_text_pt: 'Os incidentes são reportados de forma consistente com os critérios estabelecidos e às partes interessadas e autoridades relevantes?', order_index: 2, weight: 3 },
      { framework_code: 'QNRC', domain: 'Responder — Análise (RS.AN)', control_id: 'RS.AN-1', question_text: 'Are notifications from detection systems investigated to understand the impact?', question_text_pt: 'As notificações dos sistemas de deteção são investigadas para compreender o impacto?', order_index: 3, weight: 2 },
      { framework_code: 'QNRC', domain: 'Responder — Mitigação (RS.MI)', control_id: 'RS.MI-1', question_text: 'Are incidents contained to limit their impact on the organization?', question_text_pt: 'Os incidentes são contidos para limitar o seu impacto na organização?', order_index: 4, weight: 3 },
      { framework_code: 'QNRC', domain: 'Responder — Melhorias (RS.ME)', control_id: 'RS.ME-1', question_text: 'Are response plans updated based on lessons learned from incidents?', question_text_pt: 'Os planos de resposta são atualizados com base nas lições aprendidas com os incidentes?', order_index: 5, weight: 2 },

      // Recuperar (RC)
      { framework_code: 'QNRC', domain: 'Recuperar — Planeamento de Recuperação (RC.PR)', control_id: 'RC.PR-1', question_text: 'Is a recovery plan executed during or after a cybersecurity incident to restore systems and services?', question_text_pt: 'Um plano de recuperação é executado durante ou após um incidente de cibersegurança para restaurar sistemas e serviços?', order_index: 1, weight: 3 },
      { framework_code: 'QNRC', domain: 'Recuperar — Melhorias (RC.ME)', control_id: 'RC.ME-1', question_text: 'Are recovery plans updated incorporating lessons learned from past incidents?', question_text_pt: 'Os planos de recuperação são atualizados incorporando as lições aprendidas de incidentes anteriores?', order_index: 2, weight: 2 },
      { framework_code: 'QNRC', domain: 'Recuperar — Comunicações (RC.CO)', control_id: 'RC.CO-3', question_text: 'Are recovery activities communicated to internal and external stakeholders as well as executive teams and management?', question_text_pt: 'As atividades de recuperação são comunicadas às partes interessadas internas e externas, bem como às equipas executivas e de gestão?', order_index: 3, weight: 2 },

      // ENISA Cybersecurity Framework (NIS2 Article 21 + ENISA Guidelines)

      // Domain 1: Governance & Risk Management (Art. 21.2.a)
      { framework_code: 'ENISA', domain: 'Governance & Risk Management', control_id: 'ENISA-GV-01', question_text: 'Does the organization have documented policies on risk analysis and information system security approved by top management?', guidance: 'Check for a formal risk management policy, board-level approval, and periodic review cycles.', order_index: 1, weight: 3 },
      { framework_code: 'ENISA', domain: 'Governance & Risk Management', control_id: 'ENISA-GV-02', question_text: 'Does the organization conduct regular cybersecurity risk assessments using a structured methodology?', guidance: 'Verify use of a recognized risk assessment methodology (e.g. ISO 27005, EBIOS) with documented outputs.', order_index: 2, weight: 3 },
      { framework_code: 'ENISA', domain: 'Governance & Risk Management', control_id: 'ENISA-GV-03', question_text: 'Are there defined roles and responsibilities for cybersecurity governance at all levels of the organization?', guidance: 'Look for CISO appointment, governance committees, and clear accountability chains.', order_index: 3, weight: 2 },
      { framework_code: 'ENISA', domain: 'Governance & Risk Management', control_id: 'ENISA-GV-04', question_text: 'Are the effectiveness of cybersecurity risk-management measures assessed and reviewed periodically?', guidance: 'Check for policies and procedures to evaluate effectiveness, internal audits, and management reviews (Art. 21.2.f).', order_index: 4, weight: 2 },

      // Domain 2: Incident Handling (Art. 21.2.b)
      { framework_code: 'ENISA', domain: 'Incident Handling', control_id: 'ENISA-IH-01', question_text: 'Does the organization have a documented and tested incident response plan aligned with NIS2 notification timelines?', guidance: 'Verify a formal IRP with roles, escalation paths, and compliance with the 24h early warning / 72h notification requirements.', order_index: 1, weight: 3 },
      { framework_code: 'ENISA', domain: 'Incident Handling', control_id: 'ENISA-IH-02', question_text: 'Is the organization capable of detecting, classifying, and triaging cybersecurity incidents in a timely manner?', guidance: 'Check for SIEM/SOC capabilities, incident classification criteria, and escalation procedures.', order_index: 2, weight: 3 },
      { framework_code: 'ENISA', domain: 'Incident Handling', control_id: 'ENISA-IH-03', question_text: 'Are post-incident reviews conducted and lessons learned documented and acted upon?', guidance: 'Look for evidence of post-mortem processes and improvements applied after significant incidents.', order_index: 3, weight: 2 },

      // Domain 3: Business Continuity & Crisis Management (Art. 21.2.c)
      { framework_code: 'ENISA', domain: 'Business Continuity & Crisis Management', control_id: 'ENISA-BC-01', question_text: 'Does the organization have a business continuity plan (BCP) that covers cyber incident scenarios?', guidance: 'Verify BCP documentation, scope, RTO/RPO targets, and alignment with cyber risk scenarios.', order_index: 1, weight: 3 },
      { framework_code: 'ENISA', domain: 'Business Continuity & Crisis Management', control_id: 'ENISA-BC-02', question_text: 'Are backup management procedures defined, implemented, and tested regularly?', guidance: 'Check for automated backups, off-site/cloud storage, encryption, and periodic restoration tests.', order_index: 2, weight: 3 },
      { framework_code: 'ENISA', domain: 'Business Continuity & Crisis Management', control_id: 'ENISA-BC-03', question_text: 'Is there a documented disaster recovery plan (DRP) with defined recovery time and point objectives?', guidance: 'Look for DRP documentation, RTO/RPO definitions, and evidence of regular DR drills.', order_index: 3, weight: 2 },
      { framework_code: 'ENISA', domain: 'Business Continuity & Crisis Management', control_id: 'ENISA-BC-04', question_text: 'Does the organization have a crisis management process for major cyber incidents including communication protocols?', guidance: 'Verify crisis management team, communication templates, and escalation to executive management.', order_index: 4, weight: 2 },

      // Domain 4: Supply Chain Security (Art. 21.2.d)
      { framework_code: 'ENISA', domain: 'Supply Chain Security', control_id: 'ENISA-SC-01', question_text: 'Does the organization maintain an inventory of critical suppliers and service providers with associated cyber risks?', guidance: 'Check for a supplier register, risk classification, and regular reviews.', order_index: 1, weight: 2 },
      { framework_code: 'ENISA', domain: 'Supply Chain Security', control_id: 'ENISA-SC-02', question_text: 'Are cybersecurity requirements contractually imposed on direct suppliers and service providers?', guidance: 'Look for security clauses in contracts, SLAs, and right-to-audit provisions.', order_index: 2, weight: 3 },
      { framework_code: 'ENISA', domain: 'Supply Chain Security', control_id: 'ENISA-SC-03', question_text: 'Are supply chain cybersecurity risks regularly assessed including vulnerabilities specific to each supplier?', guidance: 'Verify periodic supplier risk assessments and consideration of ENISA coordinated risk assessments (Art. 22).', order_index: 3, weight: 2 },

      // Domain 5: Network & System Security (Art. 21.2.e)
      { framework_code: 'ENISA', domain: 'Network & System Security', control_id: 'ENISA-NS-01', question_text: 'Are secure configuration baselines defined and enforced for all network devices, servers, and endpoints?', guidance: 'Check for hardening standards, configuration management tools, and regular compliance scans.', order_index: 1, weight: 2 },
      { framework_code: 'ENISA', domain: 'Network & System Security', control_id: 'ENISA-NS-02', question_text: 'Is there a vulnerability management process covering identification, assessment, prioritization, and remediation?', guidance: 'Verify vulnerability scanning frequency, patch management SLAs, and responsible disclosure procedures.', order_index: 2, weight: 3 },
      { framework_code: 'ENISA', domain: 'Network & System Security', control_id: 'ENISA-NS-03', question_text: 'Are security requirements integrated into the system and software development lifecycle (SDLC)?', guidance: 'Look for secure development standards, code reviews, SAST/DAST tools, and security testing in CI/CD pipelines.', order_index: 3, weight: 2 },
      { framework_code: 'ENISA', domain: 'Network & System Security', control_id: 'ENISA-NS-04', question_text: 'Are network segmentation and perimeter controls implemented to limit lateral movement?', guidance: 'Check for DMZ architecture, VLANs, firewall rules, and micro-segmentation where applicable.', order_index: 4, weight: 3 },

      // Domain 6: Cyber Hygiene & Training (Art. 21.2.g)
      { framework_code: 'ENISA', domain: 'Cyber Hygiene & Training', control_id: 'ENISA-HT-01', question_text: 'Do all employees receive regular cybersecurity awareness training appropriate to their role?', guidance: 'Verify training programs, completion rates, and frequency (at least annual). Check ENISA ECSF alignment for technical roles.', order_index: 1, weight: 2 },
      { framework_code: 'ENISA', domain: 'Cyber Hygiene & Training', control_id: 'ENISA-HT-02', question_text: 'Are basic cyber hygiene practices enforced across the organization (patching, password policy, clean desk, email security)?', guidance: 'Check for enforced password policies, MFA deployment, patch management, and anti-phishing controls.', order_index: 2, weight: 2 },
      { framework_code: 'ENISA', domain: 'Cyber Hygiene & Training', control_id: 'ENISA-HT-03', question_text: 'Is there a cybersecurity skills development program aligned with ENISA European Cybersecurity Skills Framework (ECSF)?', guidance: 'Look for role-based competency frameworks, training plans, and certifications for security staff.', order_index: 3, weight: 2 },

      // Domain 7: Cryptography & Encryption (Art. 21.2.h)
      { framework_code: 'ENISA', domain: 'Cryptography & Encryption', control_id: 'ENISA-CR-01', question_text: 'Does the organization have a cryptography policy covering approved algorithms, key lengths, and key management?', guidance: 'Verify alignment with ENISA crypto guidelines (e.g. ENISA Algorithms, Key Sizes and Parameters Report).', order_index: 1, weight: 2 },
      { framework_code: 'ENISA', domain: 'Cryptography & Encryption', control_id: 'ENISA-CR-02', question_text: 'Is encryption applied to sensitive data at rest and in transit using approved standards?', guidance: 'Check for TLS 1.2+, AES-256, and encryption of databases, storage, and backups.', order_index: 2, weight: 3 },
      { framework_code: 'ENISA', domain: 'Cryptography & Encryption', control_id: 'ENISA-CR-03', question_text: 'Is there a formal key management lifecycle including generation, distribution, storage, rotation, and destruction?', guidance: 'Look for HSM usage, key management policies, and regular key rotation procedures.', order_index: 3, weight: 2 },

      // Domain 8: Access Control & HR Security (Art. 21.2.i)
      { framework_code: 'ENISA', domain: 'Access Control & HR Security', control_id: 'ENISA-AC-01', question_text: 'Is access to systems and data controlled based on least privilege and need-to-know principles?', guidance: 'Verify RBAC implementation, access reviews, and privileged access management (PAM) solutions.', order_index: 1, weight: 3 },
      { framework_code: 'ENISA', domain: 'Access Control & HR Security', control_id: 'ENISA-AC-02', question_text: 'Are all information assets inventoried, classified, and protected according to their sensitivity?', guidance: 'Check for asset register, data classification policy, and labeling procedures.', order_index: 2, weight: 2 },
      { framework_code: 'ENISA', domain: 'Access Control & HR Security', control_id: 'ENISA-AC-03', question_text: 'Are human resources security controls applied throughout the employee lifecycle (hiring, transfers, termination)?', guidance: 'Verify background checks, onboarding security procedures, and prompt offboarding/access revocation.', order_index: 3, weight: 2 },

      // Domain 9: Multi-Factor Authentication & Secure Communications (Art. 21.2.j)
      { framework_code: 'ENISA', domain: 'Authentication & Secure Communications', control_id: 'ENISA-MFA-01', question_text: 'Is multi-factor authentication (MFA) enforced for access to critical systems, administrative interfaces, and remote access?', guidance: 'Verify MFA coverage for VPN, admin portals, cloud services, and email. Check for phishing-resistant MFA where appropriate.', order_index: 1, weight: 3 },
      { framework_code: 'ENISA', domain: 'Authentication & Secure Communications', control_id: 'ENISA-MFA-02', question_text: 'Are secure, encrypted communication channels used for internal and external business communications?', guidance: 'Check for end-to-end encrypted messaging, signed emails (S/MIME or PGP), and secure collaboration platforms.', order_index: 2, weight: 2 },
      { framework_code: 'ENISA', domain: 'Authentication & Secure Communications', control_id: 'ENISA-MFA-03', question_text: 'Are secured emergency communication systems available and tested to ensure continuity during a cyber crisis?', guidance: 'Look for out-of-band communication procedures and tools that remain operational during a major incident.', order_index: 3, weight: 2 },

      // Domain 10: Monitoring & Detection (ENISA Guidelines)
      { framework_code: 'ENISA', domain: 'Monitoring & Detection', control_id: 'ENISA-MD-01', question_text: 'Are security monitoring capabilities in place to detect anomalies and potential threats in real time?', guidance: 'Check for SIEM deployment, log aggregation from critical systems, and 24/7 monitoring (internal or MSSP).', order_index: 1, weight: 3 },
      { framework_code: 'ENISA', domain: 'Monitoring & Detection', control_id: 'ENISA-MD-02', question_text: 'Are threat intelligence feeds integrated into security monitoring and incident response processes?', guidance: 'Look for subscriptions to CTI sources (e.g. ENISA CERT-EU, ISACs), and evidence of IOC integration into detection tools.', order_index: 2, weight: 2 },
      { framework_code: 'ENISA', domain: 'Monitoring & Detection', control_id: 'ENISA-MD-03', question_text: 'Are audit logs collected, protected, and retained in accordance with regulatory requirements and reviewed regularly?', guidance: 'Verify log retention periods, tamper-proof storage, and regular log review or SIEM alerting.', order_index: 3, weight: 2 },
    ];

    await base44.entities.Question.bulkCreate(sampleQuestions);

    queryClient.invalidateQueries({ queryKey: ['frameworks'] });
    queryClient.invalidateQueries({ queryKey: ['questions'] });
    setIsSeeding(false);
    toast.success('Frameworks and questions seeded successfully');
  };

  return (
    <div className="space-y-6">
      {/* Delete User Confirmation */}
      <AlertDialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{userToDelete?.email}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2 justify-end">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteUserMutation.mutate(userToDelete?.id)}
              disabled={deleteUserMutation.isPending}
            >
              {deleteUserMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Invitation Confirmation */}
      <AlertDialog open={!!invitedToDelete} onOpenChange={() => setInvitedToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invitation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the invitation for <strong>{invitedToDelete?.email}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2 justify-end">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteInvitedUserMutation.mutate(invitedToDelete?.id)}
              disabled={deleteInvitedUserMutation.isPending}
            >
              {deleteInvitedUserMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit User Dialog (admin only) */}
      <EditUserDialog
        open={!!userToEdit}
        onOpenChange={(open) => !open && setUserToEdit(null)}
        user={userToEdit}
        customers={customers}
        currentUserRole={currentUser?.role}
        isSaving={updateUserMutation.isPending}
        onSave={(userId, data) => updateUserMutation.mutate({ userId, data })}
      />
      <div>
        <p className="text-muted-foreground text-sm">Platform configuration and framework management</p>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="frameworks">Frameworks</TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4 mt-4">

          {/* My Profile — visible to all users */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="w-4 h-4" />
                My Profile
              </CardTitle>
              <CardDescription>Update your display name and linked customer.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Full Name</Label>
                    <Input
                      value={profileName}
                      onChange={e => setProfileName(e.target.value)}
                      placeholder="Your full name"
                    />
                  </div>
                  {currentUser?.role !== 'admin' && (
                    <div className="space-y-1.5">
                      <Label>Associated Customer</Label>
                      <Input
                        value={currentUser?.customer_name || '—'}
                        disabled
                        className="bg-muted/50 text-muted-foreground"
                      />
                      <p className="text-xs text-muted-foreground">Contact a platform admin to change your customer assignment.</p>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between pt-2 border-t gap-4">
                  <Button type="submit" disabled={isSavingProfile} size="sm" className="gap-2">
                    {isSavingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Save Profile
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="gap-2"
                    onClick={() => myRecord && setUserToDelete(myRecord)}
                  >
                    <Trash2 className="w-4 h-4" /> Delete My Account
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Invite User — available to admin and customer_admin */}
          {(isAdmin || isCustomerAdmin) && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <UserPlus className="w-4 h-4" />
                    Invite User
                  </CardTitle>
                  <CardDescription>
                    {isCustomerAdmin
                      ? 'Invite users to join your customer organization.'
                      : 'Send an invitation to a new user to join the platform.'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleInvite} className="flex gap-3 items-end flex-wrap">
                    <div className="flex-1 min-w-48 space-y-1.5">
                      <label className="text-sm font-medium">Email</label>
                      <Input
                        type="email"
                        placeholder="user@example.com"
                        value={inviteEmail}
                        onChange={e => setInviteEmail(e.target.value)}
                        required
                      />
                    </div>
                    {isAdmin && (
                      <div className="w-36 space-y-1.5">
                        <label className="text-sm font-medium">Role</label>
                        <Select value={inviteRole} onValueChange={setInviteRole}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">User</SelectItem>
                            <SelectItem value="customer_admin">Customer Admin</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <Button type="submit" disabled={isInviting} className="gap-2">
                      {isInviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                      {isInviting ? 'Sending...' : 'Send Invite'}
                    </Button>
                  </form>
                </CardContent>
              </Card>

            </>
          )}

          {/* All Users table — admin only */}
          {isAdmin && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">All Users</CardTitle>
                  <CardDescription>{users.length} registered · {invitedUsers.filter(i => !users.find(u => u.email === i.email)).length} pending invitation</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead className="w-20"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map(u => (
                        <TableRow key={u.id}>
                          <TableCell className="font-medium">{u.display_name || u.full_name || '—'}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{u.email}</TableCell>
                          <TableCell className="text-sm">
                            {u.role === 'admin'
                              ? <span className="text-muted-foreground italic text-xs">N/A (admin)</span>
                              : u.customer_name
                                ? <Badge variant="outline" className="text-xs">{u.customer_name}</Badge>
                                : <span className="text-destructive text-xs font-medium">Not assigned</span>
                            }
                          </TableCell>
                          <TableCell>
                            <Badge variant={u.role === 'admin' ? 'default' : 'secondary'} className="capitalize">
                              {u.role === 'customer_admin' ? 'Customer Admin' : u.role}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-accent/10 text-accent border-accent/20">Active</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {u.created_date ? new Date(u.created_date).toLocaleDateString() : '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setUserToEdit(u)}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => setUserToDelete(u)}
                                disabled={deleteUserMutation.isPending}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {invitedUsers
                        .filter(i => !users.find(u => u.email === i.email))
                        .map(i => (
                          <TableRow key={i.id} className="opacity-60">
                            <TableCell className="font-medium text-muted-foreground">—</TableCell>
                            <TableCell className="text-muted-foreground text-sm">{i.email}</TableCell>
                            <TableCell className="text-muted-foreground text-xs">—</TableCell>
                            <TableCell>
                              <Badge variant={i.role === 'admin' ? 'default' : 'secondary'} className="capitalize">
                                {i.role === 'customer_admin' ? 'Customer Admin' : i.role}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-xs">
                              Invited {i.created_date ? new Date(i.created_date).toLocaleDateString() : ''}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => setInvitedToDelete(i)}
                                disabled={deleteInvitedUserMutation.isPending}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>


        {/* Frameworks Tab */}
        <TabsContent value="frameworks" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Active Frameworks
              </CardTitle>
              <CardDescription>Compliance frameworks configured in the platform</CardDescription>
            </CardHeader>
            <CardContent>
              {frameworks.length === 0 ? (
                <div className="text-center py-8 space-y-3">
                  <p className="text-sm text-muted-foreground">No frameworks configured yet.</p>
                  <Button onClick={seedFrameworks} disabled={isSeeding} className="gap-2">
                    {isSeeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <SettingsIcon className="w-4 h-4" />}
                    {isSeeding ? 'Seeding...' : 'Initialize Frameworks & Questions'}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {frameworks.map(fw => {
                    const fwQuestions = questions.filter(q => q.framework_code === fw.code);
                    const domains = [...new Set(fwQuestions.map(q => q.domain))];
                    const score = getRiskScore(fw.code);
                    const { label: riskLabel, color: riskColor } = getRiskLabel(score);
                    return (
                      <div key={fw.id} className="p-4 rounded-lg border">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{fw.name}</p>
                            <Badge variant="outline" className="text-xs font-mono">{fw.code}</Badge>
                          </div>
                          <Badge className="bg-accent/10 text-accent">{fw.status}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{fw.description}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {fwQuestions.length} questions · {domains.length} domains · Version {fw.version}
                        </p>
                        {/* Risk Score */}
                        <div className="mt-3 pt-3 border-t">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-medium text-muted-foreground">Overall Risk Score</span>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-semibold ${riskColor}`}>{riskLabel}</span>
                              {score !== null && (
                                <span className="text-xs font-mono font-bold">{score.toFixed(2)} / 5.00</span>
                              )}
                            </div>
                          </div>
                          {score !== null ? (
                            <Progress value={(score / 5) * 100} className="h-2" />
                          ) : (
                            <p className="text-xs text-muted-foreground italic">No assessment responses yet for this framework.</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}