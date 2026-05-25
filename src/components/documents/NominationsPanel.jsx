import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, UserCheck, Pencil, Trash2, ExternalLink, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import NominationDocumentDialog from './NominationDocumentDialog';
import { writeAuditLog } from '@/lib/auditLog';
import { useLanguage } from '@/lib/LanguageContext';

const STATUS_STYLES = {
  active: 'bg-chart-2/10 text-chart-2 border-chart-2/20',
  draft: 'bg-muted text-muted-foreground',
  expired: 'bg-chart-3/10 text-chart-3 border-chart-3/20',
  revoked: 'bg-destructive/10 text-destructive border-destructive/20',
};

export default function NominationsPanel({ customers, selectedCustomerId }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const isAdmin = user?.role === 'admin';

  const ROLE_LABELS = {
    risk_officer: t('nominations_role_risk_officer'),
    risk_committee: t('nominations_role_risk_committee'),
    cybersecurity_manager: t('nominations_role_cybersecurity_manager'),
    cybersecurity_committee: t('nominations_role_cybersecurity_committee'),
    dpo: t('nominations_role_dpo'),
    ciso: t('nominations_role_ciso'),
    incident_response_lead: t('nominations_role_incident_response_lead'),
    compliance_officer: t('nominations_role_compliance_officer'),
    other: t('nominations_role_other'),
  };

  const STATUS_LABEL_MAP = {
    active: t('common_active'),
    inactive: t('common_inactive'),
    draft: t('docs_status_draft'),
    expired: t('nominations_expired'),
    revoked: t('nominations_role_other'), // fallback
  };
  const isCustomerAdmin = user?.role === 'customer_admin';
  const customerId = user?.customer_id;
  const effectiveCustomerId = isAdmin ? selectedCustomerId : customerId;

  const [collapsed, setCollapsed] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const { data: nominations = [] } = useQuery({
    queryKey: ['nominationDocuments', effectiveCustomerId],
    queryFn: () => base44.entities.NominationDocument.list('-created_date', 200),
  });

  const filtered = effectiveCustomerId
    ? nominations.filter(n => n.customer_id === effectiveCustomerId)
    : nominations;

  // Check for expired/expiring soon
  const today = new Date();
  const soon = new Date();
  soon.setDate(soon.getDate() + 30);

  const getExpiryWarning = (n) => {
    if (!n.expiry_date) return null;
    const exp = new Date(n.expiry_date);
    if (exp < today) return 'expired';
    if (exp < soon) return 'expiring_soon';
    return null;
  };

  const saveMutation = useMutation({
    mutationFn: async (form) => {
      const data = {
        ...form,
        owner_email: form.owner_email || user?.email,
        customer_id: isAdmin ? form.customer_id : customerId,
        customer_name: isAdmin
          ? (customers?.find(c => c.id === form.customer_id)?.name || form.customer_name)
          : user?.customer_name,
      };
      if (form.id) {
        const result = await base44.entities.NominationDocument.update(form.id, data);
        await writeAuditLog({ action: 'document_updated', entity_type: 'NominationDocument', entity_id: form.id, details: `Updated nomination: ${form.title}` });
        return result;
      }
      const result = await base44.entities.NominationDocument.create(data);
      await writeAuditLog({ action: 'document_created', entity_type: 'NominationDocument', entity_id: result?.id, details: `Created nomination: ${form.title}` });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nominationDocuments'] });
      toast.success(editing?.id ? t('nominations_title') + ' updated' : t('nominations_title') + ' created');
      setDialogOpen(false);
      setEditing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (n) => {
      await base44.entities.NominationDocument.delete(n.id);
      await writeAuditLog({ action: 'document_deleted', entity_type: 'NominationDocument', entity_id: n.id, details: `Deleted nomination: ${n.title}` });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nominationDocuments'] });
      toast.success('Nomination document deleted');
    },
  });

  const canEdit = (n) => isAdmin || isCustomerAdmin || n.owner_email === user?.email;
  const canDelete = (n) => isAdmin || isCustomerAdmin;

  const expiringCount = filtered.filter(n => {
    const w = getExpiryWarning(n);
    return w === 'expired' || w === 'expiring_soon';
  }).length;

  return (
    <div className="rounded-xl border border-chart-5/20 overflow-hidden">
      {/* Header */}
      <div
        className="bg-chart-5/10 px-5 py-4 flex items-center justify-between cursor-pointer"
        onClick={() => setCollapsed(c => !c)}
      >
        <div className="flex items-center gap-3">
          <UserCheck className="w-5 h-5 text-chart-5" />
          <div>
            <h3 className="font-semibold text-chart-5">{t('nominations_title')}</h3>
            <p className="text-xs text-muted-foreground">{t('nominations_sublabel')}</p>
          </div>
          <Badge variant="secondary" className="ml-2">{filtered.length}</Badge>
          {expiringCount > 0 && (
            <div className="flex items-center gap-1 text-xs text-chart-3 bg-chart-3/10 px-2 py-0.5 rounded-full">
              <AlertTriangle className="w-3 h-3" />
              {expiringCount} {t('nominations_expiring')}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7"
            onClick={e => { e.stopPropagation(); setEditing(null); setDialogOpen(true); }}>
            <Plus className="w-3 h-3" /> {t('nominations_add')}
          </Button>
          {collapsed ? <ChevronRight className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </div>

      {!collapsed && (
        <div className="bg-card">
          {filtered.length === 0 ? (
            <div className="px-5 py-8 text-center space-y-2">
              <UserCheck className="w-8 h-8 mx-auto text-muted-foreground opacity-30" />
              <p className="text-sm text-muted-foreground">{t('nominations_empty')}</p>
              <p className="text-xs text-muted-foreground">{t('nominations_empty_examples')}</p>
              <Button size="sm" variant="outline" className="mt-2 gap-1.5" onClick={() => { setEditing(null); setDialogOpen(true); }}>
                <Plus className="w-3 h-3" /> {t('nominations_add_first')}
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map(n => {
                const warning = getExpiryWarning(n);
                return (
                  <div key={n.id} className="px-5 py-3 flex items-start gap-4 hover:bg-muted/20 transition-colors">
                    <UserCheck className="w-4 h-4 text-chart-5 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">{n.title}</p>
                        <Badge variant="outline" className="text-xs bg-chart-5/10 text-chart-5 border-chart-5/20">
                          {ROLE_LABELS[n.role_type] || n.role_type}
                        </Badge>
                        <Badge variant="outline" className={`text-xs ${STATUS_STYLES[n.status]}`}>
                          {STATUS_LABEL_MAP[n.status] || (n.status?.charAt(0).toUpperCase() + n.status?.slice(1))}
                        </Badge>
                        {warning === 'expired' && (
                          <span className="flex items-center gap-1 text-xs text-destructive">
                            <AlertTriangle className="w-3 h-3" /> {t('nominations_expired')}
                          </span>
                        )}
                        {warning === 'expiring_soon' && (
                          <span className="flex items-center gap-1 text-xs text-chart-3">
                            <AlertTriangle className="w-3 h-3" /> {t('nominations_expiring_soon')}
                          </span>
                        )}
                      </div>
                      {n.nominated_person && (
                        <p className="text-xs text-muted-foreground mt-0.5">{t('nominations_person')} {n.nominated_person}</p>
                      )}
                      {n.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{n.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        {n.nomination_date && <span>{t('nominations_nominated')} {new Date(n.nomination_date).toLocaleDateString()}</span>}
                        {n.expiry_date && <span>{t('nominations_expires')} {new Date(n.expiry_date).toLocaleDateString()}</span>}
                        {n.approved_by && <span>{t('nominations_approved_by')} {n.approved_by}</span>}
                        {isAdmin && n.customer_name && <span>· {n.customer_name}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {n.file_url && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                          <a href={n.file_url} target="_blank" rel="noreferrer">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </Button>
                      )}
                      {canEdit(n) && (
                        <Button variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => { setEditing(n); setDialogOpen(true); }}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {canDelete(n) && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => deleteMutation.mutate(n)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <NominationDocumentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        doc={editing}
        customers={customers}
        isAdmin={isAdmin}
        onSave={async (form) => saveMutation.mutateAsync(form)}
      />
    </div>
  );
}