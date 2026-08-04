import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import PageHeader from '@/components/shared/PageHeader';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { Settings as SettingsIcon, Shield, Loader2, UserPlus, Mail, Trash2, Pencil, User, Plus, ToggleLeft, ToggleRight, Bell, Link, Upload, FileText, ExternalLink, FileBarChart, GraduationCap, Clock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { writeAuditLog } from '@/lib/auditLog';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import EditUserDialog from '@/components/settings/EditUserDialog';
import MaintenanceWindowPanel from '@/components/settings/MaintenanceWindowPanel';
import ReminderSettingsPanel from '@/components/settings/ReminderSettingsPanel';
import GeneratedReportsPanel from '@/components/genreports/GeneratedReportsPanel';
import TrainingReportsPanel from '@/components/genreports/TrainingReportsPanel';

export default function Settings() {
  const { user: currentUser, checkAppState, refreshUser } = useAuth();
  const { t } = useLanguage();
  const isAdmin = currentUser?.role === 'admin';
  const isCustomerAdmin = currentUser?.role === 'customer_admin';
  const isReadOnly = currentUser?.role === 'user';

  const [isSeeding, setIsSeeding] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('user');
  const [isInviting, setIsInviting] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [invitedToDelete, setInvitedToDelete] = useState(null);
  const [userToEdit, setUserToEdit] = useState(null);
  const [newFwDialog, setNewFwDialog] = useState(false);
  const [newFwForm, setNewFwForm] = useState({ code: '', name: '', version: '', description: '', reference_url: '' });
  const [isSavingFw, setIsSavingFw] = useState(false);
  const [fwRefEdit, setFwRefEdit] = useState({}); // { [fw.id]: { url: '', uploading: false } }
  const [fwStatusConfirm, setFwStatusConfirm] = useState(null);
  const [fwUrlConfirm, setFwUrlConfirm] = useState(null);
  const [fwDocConfirm, setFwDocConfirm] = useState(null);
  const [fwCreateConfirm, setFwCreateConfirm] = useState(false);
  const [selectedFwIds, setSelectedFwIds] = useState([]);
  const [fwBulkConfirm, setFwBulkConfirm] = useState(null);
  const [isBulkFwAction, setIsBulkFwAction] = useState(false);

  const handleFwRefUrlSave = async (fw, url) => {
    await base44.entities.Framework.update(fw.id, { reference_url: url });
    queryClient.invalidateQueries({ queryKey: ['frameworks'] });
    setFwRefEdit(prev => ({ ...prev, [fw.id]: { ...prev[fw.id], editingUrl: false } }));
    toast.success(t('settings_ref_link'));
  };

  const handleFwDocUpload = async (fw, file) => {
    setFwRefEdit(prev => ({ ...prev, [fw.id]: { ...prev[fw.id], uploading: true } }));
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    await base44.entities.Framework.update(fw.id, { document_url: file_url, document_name: file.name });
    queryClient.invalidateQueries({ queryKey: ['frameworks'] });
    setFwRefEdit(prev => ({ ...prev, [fw.id]: { ...prev[fw.id], uploading: false } }));
    toast.success(t('settings_doc_uploaded'));
  };

  // Profile edit state (for current user's own profile)
  const [profileName, setProfileName] = useState('');
  const [profileCustomerId, setProfileCustomerId] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const queryClient = useQueryClient();

  const deleteUserMutation = useMutation({
    mutationFn: async (userId) => {
      const res = await base44.functions.invoke('adminDeleteUser', { userId });
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['customerUsers'] });
      queryClient.invalidateQueries({ queryKey: ['pendingInvites'] });
      queryClient.invalidateQueries({ queryKey: ['users-for-customer'] });
      toast.success(t('settings_user_deleted'));
      setUserToDelete(null);
      },
      onError: (err) => {
      toast.error(err?.message || t('settings_user_delete_error'));
    }
  });

  const deleteInvitedUserMutation = useMutation({
    mutationFn: async (invitedUserId) => {
      await base44.entities.InvitedUser.delete(invitedUserId);
    },
    onSuccess: () => {
      refetchInvited();
      toast.success(t('settings_invitation_deleted'));
      setInvitedToDelete(null);
      },
      onError: (err) => {
      toast.error(err?.message || t('settings_invitation_delete_error'));
    }
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, data }) => {
      const res = await base44.functions.invoke('adminUpdateUser', { userId, data });
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      if (result?.roleError) {
        toast.warning(`Profile updated, but role could not be changed: ${result.roleError}`);
      } else {
        toast.success(t('settings_user_updated'));
      }
      setUserToEdit(null);
    },
    onError: (err) => {
      toast.error(err?.message || t('settings_user_update_error'));
    }
  });

  const handleCreateFramework = async () => {
    if (!newFwForm.code || !newFwForm.name) return;
    setIsSavingFw(true);
    const result = await base44.entities.Framework.create({ ...newFwForm, status: 'active' });
    await writeAuditLog({ action: 'framework_created', entity_type: 'Framework', entity_id: result?.id, details: `Created framework: ${newFwForm.name} (${newFwForm.code})` });
    queryClient.invalidateQueries({ queryKey: ['frameworks'] });
    setIsSavingFw(false);
    setNewFwDialog(false);
    setNewFwForm({ code: '', name: '', version: '', description: '', reference_url: '', document_url: '', document_name: '' });
    toast.success(t('settings_fw_created'));
  };

  const handleToggleFrameworkStatus = async (fw) => {
    const newStatus = fw.status === 'active' ? 'deprecated' : 'active';
    await base44.entities.Framework.update(fw.id, { status: newStatus });
    await writeAuditLog({ action: 'framework_status_changed', entity_type: 'Framework', entity_id: fw.id, details: `Framework ${fw.code} (${fw.name}) set to ${newStatus}` });
    queryClient.invalidateQueries({ queryKey: ['frameworks'] });
    toast.success(`${t('settings_fw_framework')} ${newStatus === 'active' ? t('settings_fw_activated') : t('settings_fw_deactivated')}`);
  };

  const handleBulkFwAction = async () => {
    if (!fwBulkConfirm) return;
    setIsBulkFwAction(true);
    try {
      const { action, ids } = fwBulkConfirm;
      if (action === 'delete') {
        for (const id of ids) {
          await base44.entities.Framework.delete(id);
        }
        await writeAuditLog({ action: 'framework_status_changed', entity_type: 'Framework', details: `Bulk deleted ${ids.length} frameworks` });
        toast.success(`${ids.length} ${t('settings_fw_bulk_deleted')}`);
      } else {
        const newStatus = action === 'activate' ? 'active' : 'deprecated';
        for (const id of ids) {
          await base44.entities.Framework.update(id, { status: newStatus });
        }
        await writeAuditLog({ action: 'framework_status_changed', entity_type: 'Framework', details: `Bulk set ${ids.length} frameworks to ${newStatus}` });
        toast.success(`${ids.length} ${newStatus === 'active' ? t('settings_fw_activated') : t('settings_fw_deactivated')}`);
      }
      setSelectedFwIds([]);
      queryClient.invalidateQueries({ queryKey: ['frameworks'] });
    } catch {
      toast.error(t('settings_fw_bulk_error'));
    }
    setIsBulkFwAction(false);
    setFwBulkConfirm(null);
  };

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
    queryFn: async () => {
      const res = await base44.functions.invoke('listUsers', {});
      return res.data?.users || [];
    },
    enabled: isAdmin || isCustomerAdmin,
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
    if (score === null) return { label: t('settings_fw_no_data'), color: 'text-muted-foreground' };
    if (score >= 4) return { label: t('settings_fw_low_risk'), color: 'text-accent' };
    if (score >= 3) return { label: t('settings_fw_moderate'), color: 'text-chart-3' };
    if (score >= 2) return { label: t('settings_fw_elevated'), color: 'text-chart-4' };
    return { label: t('settings_fw_high_risk'), color: 'text-destructive' };
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
      toast.success(t('settings_profile_saved'));
    } catch (err) {
      toast.error(err?.message || t('settings_profile_error'));
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
      // base44.users.inviteUser only accepts 'user' or 'admin'.
      // We map customer_admin -> 'user' (upgraded later via EditUserDialog)
      // and keep the desired role tracked in InvitedUser.
      const platformRole = inviteRole === 'admin' ? 'admin' : 'user';
      const trackedRole = isCustomerAdmin ? 'user' : inviteRole;
      await base44.users.inviteUser(inviteEmail, platformRole);
      const alreadyTracked = invitedUsers.find(u => u.email === inviteEmail);
      if (!alreadyTracked) {
        await base44.entities.InvitedUser.create({
          email: inviteEmail,
          role: trackedRole,
          status: 'inactive',
          invited_by: me?.email || '',
        });
      }
      toast.success(`${t('settings_invitation_sent')} ${inviteEmail}`);
      setInviteEmail('');
      setInviteRole('user');
      refetchInvited();
    } catch (err) {
      toast.error(err?.message || `${t('settings_invitation_error')} ${inviteEmail}`);
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
    toast.success(t('settings_fw_seeded'));
  };

  return (
    <div className="space-y-6">
      {/* Delete User Confirmation */}
      <ConfirmDialog
        open={!!userToDelete}
        onOpenChange={() => setUserToDelete(null)}
        title={t('settings_delete_user_title')}
        description={<>{t('settings_delete_user_desc')} <strong>{userToDelete?.email}</strong>? {t('settings_delete_user_undone')}</>}
        confirmLabel={deleteUserMutation.isPending ? t('common_deleting') : t('common_delete')}
        cancelLabel={t('common_cancel')}
        onConfirm={() => deleteUserMutation.mutate(userToDelete?.id)}
        loading={deleteUserMutation.isPending}
      />

      {/* Delete Invitation Confirmation */}
      <ConfirmDialog
        open={!!invitedToDelete}
        onOpenChange={() => setInvitedToDelete(null)}
        title={t('settings_delete_invite_title')}
        description={<>{t('settings_delete_invite_desc')} <strong>{invitedToDelete?.email}</strong>? {t('settings_delete_user_undone')}</>}
        confirmLabel={deleteInvitedUserMutation.isPending ? t('common_deleting') : t('common_delete')}
        cancelLabel={t('common_cancel')}
        onConfirm={() => deleteInvitedUserMutation.mutate(invitedToDelete?.id)}
        loading={deleteInvitedUserMutation.isPending}
      />

      {/* Edit User Dialog */}
      <EditUserDialog
        open={!!userToEdit}
        onOpenChange={(open) => !open && setUserToEdit(null)}
        user={userToEdit}
        customers={customers}
        currentUserRole={currentUser?.role}
        isSaving={updateUserMutation.isPending}
        onSave={(userId, data) => updateUserMutation.mutate({ userId, data })}
      />
      <PageHeader description={t('settings_subtitle')} />

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">{t('settings_tab_users')}</TabsTrigger>
          <TabsTrigger value="frameworks">{t('settings_tab_frameworks')}</TabsTrigger>
          <TabsTrigger value="reminders" className="flex items-center gap-1.5"><Bell className="w-3.5 h-3.5" />{t('settings_tab_reminders')}</TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="generated-reports" className="flex items-center gap-1.5"><FileBarChart className="w-3.5 h-3.5" />{t('nav_generated_reports')}</TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="reports" className="flex items-center gap-1.5"><GraduationCap className="w-3.5 h-3.5" />{t('settings_tab_reports')}</TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="app" className="flex items-center gap-1.5"><SettingsIcon className="w-3.5 h-3.5" />{t('settings_tab_app')}</TabsTrigger>
          )}
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4 mt-4">

          {/* My Profile — visible to all users */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="w-4 h-4" />
                {t('settings_my_profile')}
              </CardTitle>
              <CardDescription>{t('settings_my_profile_desc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>{t('settings_full_name')}</Label>
                    <Input
                      value={profileName}
                      onChange={e => setProfileName(e.target.value)}
                      placeholder={t('settings_full_name_placeholder')}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t('settings_email')}</Label>
                    <Input
                      value={currentUser?.email || '—'}
                      disabled
                      className="bg-muted/50 text-muted-foreground"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t('settings_role')}</Label>
                    <div className="flex items-center gap-2 h-9">
                      <Badge variant={currentUser?.role === 'admin' ? 'default' : 'secondary'}>
                        {currentUser?.role === 'customer_admin' ? t('settings_role_customer_admin') : currentUser?.role === 'admin' ? t('settings_role_admin') : t('settings_role_user')}
                      </Badge>
                      <Badge className="bg-accent/10 text-accent border-accent/20">{t('settings_user_active')}</Badge>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t('settings_associated_customer')}</Label>
                    {isAdmin ? (
                      <Select value={profileCustomerId || ''} onValueChange={v => setProfileCustomerId(v === '__none__' ? '' : v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">—</SelectItem>
                          {customers.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={currentUser?.customer_name || '—'}
                        disabled
                        className="bg-muted/50 text-muted-foreground"
                      />
                    )}
                    {currentUser?.role !== 'admin' && (
                      <p className="text-xs text-muted-foreground">{t('settings_customer_contact_admin')}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t('settings_col_joined')}</Label>
                    <Input
                      value={currentUser?.created_date ? new Date(currentUser.created_date).toLocaleDateString() : '—'}
                      disabled
                      className="bg-muted/50 text-muted-foreground"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t gap-4">
                  <Button type="submit" disabled={isSavingProfile} size="sm" className="gap-2">
                    {isSavingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {t('settings_save_profile')}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="gap-2"
                    onClick={() => myRecord && setUserToDelete(myRecord)}
                  >
                    <Trash2 className="w-4 h-4" /> {t('settings_delete_account')}
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
                    {t('settings_invite_user')}
                  </CardTitle>
                  <CardDescription>
                    {isCustomerAdmin ? t('settings_invite_user_desc_customer') : t('settings_invite_user_desc_admin')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleInvite} className="flex gap-3 items-end flex-wrap">
                    <div className="flex-1 min-w-48 space-y-1.5">
                      <label className="text-sm font-medium">{t('settings_email')}</label>
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
                        <label className="text-sm font-medium">{t('settings_role')}</label>
                        <Select value={inviteRole} onValueChange={setInviteRole}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">{t('settings_role_user')}</SelectItem>
                            <SelectItem value="customer_admin">{t('settings_role_customer_admin')}</SelectItem>
                            <SelectItem value="admin">{t('settings_role_admin')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <Button type="submit" disabled={isInviting} className="gap-2">
                      {isInviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                      {isInviting ? t('common_sending') : t('settings_send_invite')}
                    </Button>
                  </form>
                </CardContent>
              </Card>

            </>
          )}

          {/* All Users table — admin and customer_admin */}
          {(isAdmin || isCustomerAdmin) && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t('settings_all_users')}</CardTitle>
                  <CardDescription>
                    {users.length} {t('settings_registered')} · {invitedUsers.filter(i => !users.find(u => u.email === i.email)).length} {t('settings_pending_invitation')}
                    {(() => {
                      const pending = users.filter(u => u.role !== 'admin' && !u.customer_id);
                      return pending.length > 0
                        ? ` · ${pending.length} ${t('settings_pending_activation_count')}`
                        : '';
                    })()}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('settings_col_name')}</TableHead>
                        <TableHead>{t('settings_col_email')}</TableHead>
                        <TableHead>{t('settings_col_customer')}</TableHead>
                        <TableHead>{t('settings_col_role')}</TableHead>
                        <TableHead>{t('settings_col_status')}</TableHead>
                        <TableHead>{t('settings_col_joined')}</TableHead>
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
                              ? <span className="text-muted-foreground italic text-xs">{t('settings_na_admin')}</span>
                              : u.customer_name
                                ? <Badge variant="outline" className="text-xs">{u.customer_name}</Badge>
                                : <span className="text-destructive text-xs font-medium">{t('common_not_assigned')}</span>
                            }
                          </TableCell>
                          <TableCell>
                            <Badge variant={u.role === 'admin' ? 'default' : 'secondary'} className="capitalize">
                              {u.role === 'customer_admin' ? t('settings_role_customer_admin') : u.role === 'admin' ? t('settings_role_admin') : t('settings_role_user')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {u.role !== 'admin' && !u.customer_id ? (
                              <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20">
                                <Clock className="w-3 h-3 mr-1" />
                                {t('settings_pending_activation')}
                              </Badge>
                            ) : (
                              <Badge className="bg-accent/10 text-accent border-accent/20">{t('settings_user_active')}</Badge>
                            )}
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
                                {i.role === 'customer_admin' ? t('settings_role_customer_admin') : i.role === 'admin' ? t('settings_role_admin') : t('settings_role_user')}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-muted-foreground">{t('settings_user_inactive')}</Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-xs">
                              {t('settings_invited')} {i.created_date ? new Date(i.created_date).toLocaleDateString() : ''}
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
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    {t('settings_frameworks')}
                  </CardTitle>
                  <CardDescription>{t('settings_frameworks_desc')}</CardDescription>
                </div>
                {!isReadOnly && (
                  <div className="flex gap-2">
                    {frameworks.length === 0 && (
                      <Button onClick={seedFrameworks} disabled={isSeeding} variant="outline" className="gap-2">
                        {isSeeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <SettingsIcon className="w-4 h-4" />}
                        {isSeeding ? t('common_seeding') : t('settings_init_defaults')}
                      </Button>
                    )}
                    <Button onClick={() => setNewFwDialog(true)} className="gap-2">
                      <Plus className="w-4 h-4" /> {t('settings_new_framework')}
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {frameworks.length === 0 ? (
                <div className="text-center py-8 space-y-3">
                  <p className="text-sm text-muted-foreground">{t('settings_no_frameworks')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Bulk action bar — admin only */}
                  {isAdmin && (
                    <div className="flex items-center gap-3 pb-3 border-b flex-wrap">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={frameworks.length > 0 && selectedFwIds.length === frameworks.length}
                          onCheckedChange={(checked) => setSelectedFwIds(checked ? frameworks.map(f => f.id) : [])}
                        />
                        <span className="text-xs text-muted-foreground">{t('settings_fw_select_all')}</span>
                      </div>
                      {selectedFwIds.length > 0 && (
                        <>
                          <span className="text-xs font-medium">{selectedFwIds.length} {t('settings_fw_selected')}</span>
                          <div className="flex gap-2 ml-auto">
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => setFwBulkConfirm({ action: 'activate', ids: [...selectedFwIds] })}>
                              <ToggleRight className="w-3.5 h-3.5" /> {t('settings_fw_bulk_activate')}
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => setFwBulkConfirm({ action: 'deactivate', ids: [...selectedFwIds] })}>
                              <ToggleLeft className="w-3.5 h-3.5" /> {t('settings_fw_bulk_deactivate')}
                            </Button>
                            <Button size="sm" variant="destructive" className="h-7 text-xs gap-1.5" onClick={() => setFwBulkConfirm({ action: 'delete', ids: [...selectedFwIds] })}>
                              <Trash2 className="w-3.5 h-3.5" /> {t('settings_fw_bulk_delete')}
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  {frameworks.map(fw => {
                    const fwQuestions = questions.filter(q => q.framework_code === fw.code);
                    const domains = [...new Set(fwQuestions.map(q => q.domain))];
                    const score = getRiskScore(fw.code);
                    const { label: riskLabel, color: riskColor } = getRiskLabel(score);
                    const isActive = fw.status === 'active';
                    return (
                      <div key={fw.id} className={`p-4 rounded-lg border transition-opacity ${isActive ? '' : 'opacity-60'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {isAdmin && (
                              <Checkbox
                                checked={selectedFwIds.includes(fw.id)}
                                onCheckedChange={(checked) => setSelectedFwIds(prev => checked ? [...prev, fw.id] : prev.filter(id => id !== fw.id))}
                              />
                            )}
                            <p className="font-medium">{fw.name}</p>
                            <Badge variant="outline" className="text-xs font-mono">{fw.code}</Badge>
                            {fw.version && <span className="text-xs text-muted-foreground">v{fw.version}</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            {isReadOnly ? (
                              <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${
                                isActive
                                  ? 'bg-accent/10 text-accent border-accent/20'
                                  : 'bg-muted text-muted-foreground border-border'
                              }`}>
                                {isActive
                                  ? <><ToggleRight className="w-3.5 h-3.5" /> {t('settings_fw_active')}</>
                                  : <><ToggleLeft className="w-3.5 h-3.5" /> {t('settings_fw_inactive')}</>
                                }
                              </span>
                            ) : (
                              <button
                                onClick={() => setFwStatusConfirm(fw)}
                                className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                                  isActive
                                    ? 'bg-accent/10 text-accent border-accent/20 hover:bg-accent/20'
                                    : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
                                }`}
                                title={isActive ? t('settings_fw_click_deactivate') : t('settings_fw_click_activate')}
                              >
                                {isActive
                                  ? <><ToggleRight className="w-3.5 h-3.5" /> {t('settings_fw_active')}</>
                                  : <><ToggleLeft className="w-3.5 h-3.5" /> {t('settings_fw_inactive')}</>
                                }
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">{fw.description}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {fwQuestions.length} {t('settings_fw_questions')} · {domains.length} {t('settings_fw_domains')}
                        </p>
                        {fw.created_date && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {t('settings_fw_created_on')} {new Date(fw.created_date).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })}
                            {fw.updated_date && fw.updated_date !== fw.created_date && (
                              <> · {t('settings_fw_modified_on')} {new Date(fw.updated_date).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })}</>
                            )}
                          </p>
                        )}
                        {/* Risk Score */}
                        {isActive && (
                          <div className="mt-3 pt-3 border-t">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-medium text-muted-foreground">{t('settings_fw_overall_score')}</span>
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
                              <p className="text-xs text-muted-foreground italic">{t('settings_fw_no_responses')}</p>
                            )}
                          </div>
                        )}

                        {/* Reference Link & Document — visible to all, editable by admin */}
                        <div className="mt-3 pt-3 border-t space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('settings_fw_docs_section')}</p>
                          {/* Reference URL */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                            {isAdmin && fwRefEdit[fw.id]?.editingUrl ? (
                              <form className="flex gap-2 flex-1" onSubmit={e => { e.preventDefault(); setFwUrlConfirm({ fw, url: fwRefEdit[fw.id]?.url ?? fw.reference_url ?? '' }); }}>
                                <Input
                                  autoFocus
                                  className="h-7 text-xs flex-1"
                                  placeholder="https://..."
                                  value={fwRefEdit[fw.id]?.url ?? fw.reference_url ?? ''}
                                  onChange={e => setFwRefEdit(prev => ({ ...prev, [fw.id]: { ...prev[fw.id], url: e.target.value } }))}
                                />
                                <Button type="submit" size="sm" className="h-7 text-xs px-3">{t('common_save')}</Button>
                                 <Button type="button" variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => setFwRefEdit(prev => ({ ...prev, [fw.id]: { ...prev[fw.id], editingUrl: false } }))}>{t('common_cancel')}</Button>
                              </form>
                            ) : fw.reference_url ? (
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <a href={fw.reference_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate flex items-center gap-1">
                                  <ExternalLink className="w-3 h-3 flex-shrink-0" />{fw.reference_url}
                                </a>
                                {!isReadOnly && (
                                  <Button variant="ghost" size="sm" className="h-6 px-2 text-xs flex-shrink-0" onClick={() => setFwRefEdit(prev => ({ ...prev, [fw.id]: { ...prev[fw.id], editingUrl: true, url: fw.reference_url } }))}>{t('common_edit')}</Button>
                                )}
                              </div>
                            ) : isAdmin ? (
                              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground" onClick={() => setFwRefEdit(prev => ({ ...prev, [fw.id]: { ...prev[fw.id], editingUrl: true, url: '' } }))}>
                                {t('docs_add_ref_link')}
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">{t('settings_fw_no_link')}</span>
                            )}
                          </div>

                          {/* Document upload */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                            {fw.document_url ? (
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <a href={fw.document_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate flex items-center gap-1">
                                  <ExternalLink className="w-3 h-3 flex-shrink-0" />{fw.document_name || t('settings_fw_ref_doc_fallback')}
                                </a>
                                {isAdmin && (
                                  <label className="cursor-pointer">
                                    <span className="text-xs text-muted-foreground hover:text-foreground border rounded px-2 py-0.5">{t('docs_replace')}</span>
                                    <input type="file" className="hidden" onChange={e => { if (e.target.files[0]) setFwDocConfirm({ fw, file: e.target.files[0] }); e.target.value = ''; }} />
                                  </label>
                                )}
                              </div>
                            ) : isAdmin ? (
                              <label className="cursor-pointer flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                                {fwRefEdit[fw.id]?.uploading
                                  ? <><Loader2 className="w-3 h-3 animate-spin" /> {t('common_uploading')}</>
                                  : <><Upload className="w-3 h-3" /> {t('docs_upload_doc')}</>
                                }
                                <input type="file" className="hidden" disabled={fwRefEdit[fw.id]?.uploading} onChange={e => { if (e.target.files[0]) setFwDocConfirm({ fw, file: e.target.files[0] }); e.target.value = ''; }} />
                              </label>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">{t('settings_fw_no_doc')}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Framework Status Toggle Confirmation */}
          <ConfirmDialog
            open={!!fwStatusConfirm}
            onOpenChange={() => setFwStatusConfirm(null)}
            title={t('settings_fw_confirm_status')}
            description={<>{t('settings_fw_confirm_status_desc')} <strong>{fwStatusConfirm?.status === 'active' ? t('settings_fw_deactivate') : t('settings_fw_activate')}</strong> {t('settings_fw_framework').toLowerCase()} <strong>{fwStatusConfirm?.name}</strong>?</>}
            confirmLabel={t('common_confirm')}
            cancelLabel={t('common_cancel')}
            onConfirm={() => { handleToggleFrameworkStatus(fwStatusConfirm); setFwStatusConfirm(null); }}
            destructive={false}
          />

          {/* Framework URL Save Confirmation */}
          <ConfirmDialog
            open={!!fwUrlConfirm}
            onOpenChange={() => setFwUrlConfirm(null)}
            title={t('settings_fw_confirm_url')}
            description={<>{t('settings_fw_confirm_url_desc')} <strong>{fwUrlConfirm?.fw?.name}</strong>?</>}
            confirmLabel={t('common_confirm')}
            cancelLabel={t('common_cancel')}
            onConfirm={() => { handleFwRefUrlSave(fwUrlConfirm.fw, fwUrlConfirm.url); setFwUrlConfirm(null); }}
            destructive={false}
          />

          {/* Framework Document Upload Confirmation */}
          <ConfirmDialog
            open={!!fwDocConfirm}
            onOpenChange={() => setFwDocConfirm(null)}
            title={t('settings_fw_confirm_doc')}
            description={<>{t('settings_fw_confirm_doc_desc')} <strong>{fwDocConfirm?.fw?.name}</strong>?{fwDocConfirm?.fw?.document_url && <><br />{t('settings_fw_confirm_doc_replace')}</>}</>}
            confirmLabel={t('common_confirm')}
            cancelLabel={t('common_cancel')}
            onConfirm={() => { handleFwDocUpload(fwDocConfirm.fw, fwDocConfirm.file); setFwDocConfirm(null); }}
            destructive={false}
          />

          {/* Framework Create Confirmation */}
          <ConfirmDialog
            open={fwCreateConfirm}
            onOpenChange={setFwCreateConfirm}
            title={t('settings_fw_confirm_create')}
            description={<>{t('settings_fw_confirm_create_desc')} <strong>{newFwForm.name}</strong> (<strong>{newFwForm.code}</strong>)?</>}
            confirmLabel={t('common_confirm')}
            cancelLabel={t('common_cancel')}
            onConfirm={() => { setFwCreateConfirm(false); handleCreateFramework(); }}
            destructive={false}
          />

          {/* Bulk Framework Action Confirmation */}
          <ConfirmDialog
            open={!!fwBulkConfirm}
            onOpenChange={(open) => !isBulkFwAction && !open && setFwBulkConfirm(null)}
            title={fwBulkConfirm?.action === 'delete' ? t('settings_fw_bulk_confirm_delete_title') : t('settings_fw_bulk_confirm_toggle_title')}
            description={fwBulkConfirm?.action === 'delete'
              ? `${t('settings_fw_bulk_confirm_delete_desc')} ${fwBulkConfirm?.ids.length}? ${t('settings_fw_bulk_cannot_undo')}`
              : `${t('settings_fw_bulk_confirm_toggle_desc')} ${fwBulkConfirm?.ids.length}?`}
            confirmLabel={t('common_confirm')}
            cancelLabel={t('common_cancel')}
            onConfirm={handleBulkFwAction}
            loading={isBulkFwAction}
            destructive={fwBulkConfirm?.action === 'delete'}
          />

          {/* New Framework Dialog */}
          <Dialog open={newFwDialog} onOpenChange={setNewFwDialog}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{t('settings_fw_new_dialog_title')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>{t('settings_fw_code')}</Label>
                    <Input
                      value={newFwForm.code}
                      onChange={e => setNewFwForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                      placeholder="e.g. ISO27001"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t('settings_fw_version')}</Label>
                    <Input
                      value={newFwForm.version}
                      onChange={e => setNewFwForm(p => ({ ...p, version: e.target.value }))}
                      placeholder="e.g. 2022"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>{t('settings_fw_name')}</Label>
                  <Input
                    value={newFwForm.name}
                    onChange={e => setNewFwForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. ISO/IEC 27001:2022"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('settings_fw_description')}</Label>
                  <Textarea
                    value={newFwForm.description}
                    onChange={e => setNewFwForm(p => ({ ...p, description: e.target.value }))}
                    placeholder={t('settings_fw_desc_placeholder')}
                    rows={3}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('settings_fw_ref_url')}</Label>
                  <Input
                    value={newFwForm.reference_url}
                    onChange={e => setNewFwForm(p => ({ ...p, reference_url: e.target.value }))}
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('settings_fw_ref_doc')}</Label>
                  {newFwForm.document_name ? (
                    <div className="flex items-center gap-2 p-2 rounded-md border bg-muted/40 text-sm">
                      <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="truncate flex-1 text-xs">{newFwForm.document_name}</span>
                      <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setNewFwForm(p => ({ ...p, document_url: '', document_name: '' }))}>{t('settings_fw_remove')}</Button>
                    </div>
                  ) : (
                    <label className="flex items-center gap-2 cursor-pointer border border-dashed rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:border-primary transition-colors">
                      {newFwForm.uploadingDoc
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('common_uploading')}</>
                        : <><Upload className="w-4 h-4" /> {t('docs_upload_doc')}</>
                      }
                      <input type="file" className="hidden" disabled={newFwForm.uploadingDoc} onChange={async e => {
                        const file = e.target.files[0];
                        if (!file) return;
                        setNewFwForm(p => ({ ...p, uploadingDoc: true }));
                        const { file_url } = await base44.integrations.Core.UploadFile({ file });
                        setNewFwForm(p => ({ ...p, document_url: file_url, document_name: file.name, uploadingDoc: false }));
                      }} />
                    </label>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setNewFwDialog(false)}>{t('common_cancel')}</Button>
                <Button onClick={() => setFwCreateConfirm(true)} disabled={isSavingFw || !newFwForm.code || !newFwForm.name}>
                  {isSavingFw ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {t('settings_fw_create')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Reminders Tab */}
        <TabsContent value="reminders" className="space-y-4 mt-4">
          <ReminderSettingsPanel customers={customers} isAdmin={isAdmin} isReadOnly={isReadOnly} />
        </TabsContent>

        {/* Generated Reports Tab — admin only */}
        {isAdmin && (
          <TabsContent value="generated-reports" className="space-y-4 mt-4">
            <GeneratedReportsPanel customers={customers} />
          </TabsContent>
        )}

        {/* Training Reports Tab — admin only */}
        {isAdmin && (
          <TabsContent value="reports" className="space-y-4 mt-4">
            <TrainingReportsPanel />
          </TabsContent>
        )}

        {/* App Tab — maintenance window configuration */}
        {isAdmin && (
          <TabsContent value="app" className="space-y-4 mt-4">
            <MaintenanceWindowPanel isAdmin={isAdmin} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}