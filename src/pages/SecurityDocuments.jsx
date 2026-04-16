import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, FileText, Shield, BookOpen, Workflow, Zap, ExternalLink, Pencil, Trash2, ChevronDown, ChevronRight, CheckCircle, Clock, History, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { writeAuditLog } from '@/lib/auditLog';
import SecurityDocumentDialog from '@/components/documents/SecurityDocumentDialog';
import VersionHistoryDialog from '@/components/documents/VersionHistoryDialog';
import PendingReviewsPanel from '@/components/documents/PendingReviewsPanel';
import ApprovalDialog from '@/components/documents/ApprovalDialog';

const LEVELS = [
  {
    id: 'policy',
    label: 'Level 1 — Policies',
    sublabel: 'Strategic · Approved by Board of Directors',
    icon: Shield,
    color: 'text-chart-1',
    bg: 'bg-chart-1/10',
    border: 'border-chart-1/20',
    examples: ['General Information Security Policy (GISP)', 'Privacy and Minor Data Protection Policy', 'Acceptable Use Policy (AUP)'],
  },
  {
    id: 'standard',
    label: 'Level 2 — Standards',
    sublabel: 'Tactical · Approved by CISO / Security Committee',
    icon: BookOpen,
    color: 'text-chart-2',
    bg: 'bg-chart-2/10',
    border: 'border-chart-2/20',
    examples: ['Information Classification Standard', 'Access Control and Authentication Standard', 'Secure Software Development Standard'],
  },
  {
    id: 'procedure',
    label: 'Level 3 — Procedures',
    sublabel: 'Operational · Approved by Operational Managers',
    icon: Workflow,
    color: 'text-chart-4',
    bg: 'bg-chart-4/10',
    border: 'border-chart-4/20',
    examples: ['Employee Onboarding and Offboarding Procedure', 'Backup Management Procedure', 'Data Subject Request Procedure (GDPR)'],
  },
  {
    id: 'playbook',
    label: 'Level 4 — Playbooks / Runbooks',
    sublabel: 'Technical · Created by Technical Teams',
    icon: Zap,
    color: 'text-chart-5',
    bg: 'bg-chart-5/10',
    border: 'border-chart-5/20',
    examples: ['Ransomware Incident Response Playbook', 'Application Portal Restoration Runbook', 'Phishing Response Playbook'],
  },
];

const STATUS_STYLES = {
  draft: 'bg-muted text-muted-foreground',
  under_review: 'bg-chart-3/10 text-chart-3 border-chart-3/20',
  approved: 'bg-chart-2/10 text-chart-2 border-chart-2/20',
  deprecated: 'bg-destructive/10 text-destructive border-destructive/20',
};
const STATUS_LABELS = { draft: 'Draft', under_review: 'Under Review', approved: 'Approved', deprecated: 'Deprecated' };

export default function SecurityDocuments() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'admin';
  const isCustomerAdmin = user?.role === 'customer_admin';
  const isUser = !isAdmin && !isCustomerAdmin;
  const customerId = user?.customer_id;

  const [search, setSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [collapsed, setCollapsed] = useState({});
  const [historyDoc, setHistoryDoc] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [approvalDoc, setApprovalDoc] = useState(null);
  const [approvalOpen, setApprovalOpen] = useState(false);

  const { data: allDocs = [] } = useQuery({
    queryKey: ['securityDocuments'],
    queryFn: () => base44.entities.SecurityDocument.list('-created_date', 500),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
    enabled: isAdmin,
  });

  // Determine the effective customer filter
  const effectiveCustomerId = isAdmin ? selectedCustomerId : customerId;

  // Filter docs by customer + search
  const docs = useMemo(() => {
    let filtered = allDocs;
    if (effectiveCustomerId) {
      filtered = filtered.filter(d => d.customer_id === effectiveCustomerId);
    }
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(d =>
        d.title?.toLowerCase().includes(q) ||
        d.description?.toLowerCase().includes(q) ||
        d.tags?.some(t => t.toLowerCase().includes(q)) ||
        d.framework_codes?.some(f => f.toLowerCase().includes(q))
      );
    }
    return filtered;
  }, [allDocs, effectiveCustomerId, search]);

  // Permissions
  const canCreate = isAdmin || isCustomerAdmin || isUser; // all can add
  const canApprove = isAdmin || isCustomerAdmin;

  const canEditDoc = (doc) => {
    if (isAdmin) return true;
    if (isCustomerAdmin) return doc.customer_id === customerId;
    // user: only own docs
    return doc.owner_email === user?.email;
  };

  const canDeleteDoc = (doc) => {
    if (isAdmin) return true;
    if (isCustomerAdmin) return doc.customer_id === customerId;
    return false;
  };

  const saveMutation = useMutation({
    mutationFn: async (form) => {
      if (form.id) {
        // If a regular user edits, set back to under_review
        const updatedForm = isUser ? { ...form, status: 'under_review' } : form;
        const result = await base44.entities.SecurityDocument.update(form.id, updatedForm);
        await writeAuditLog({ action: 'document_updated', entity_type: 'SecurityDocument', entity_id: form.id, details: `Updated document: ${form.title}` });
        return result;
      }
      // New doc: admin/customer_admin -> draft, user -> under_review
      const newForm = {
        ...form,
        owner_email: user?.email,
        status: isUser ? 'under_review' : (form.status || 'draft'),
        customer_id: isUser || isCustomerAdmin ? customerId : form.customer_id,
        customer_name: isUser || isCustomerAdmin
          ? (user?.customer_name || form.customer_name)
          : form.customer_name,
      };
      const result = await base44.entities.SecurityDocument.create(newForm);
      await writeAuditLog({ action: 'document_created', entity_type: 'SecurityDocument', entity_id: result?.id, details: `Created document: ${form.title}` });
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['securityDocuments'] });
      const isEdit = !!variables.id;
      if (isUser) {
        toast.success(isEdit ? 'Document submitted for re-approval' : 'Document submitted for approval by Customer Admin');
      } else {
        toast.success(isEdit ? 'Document updated' : 'Document created');
      }
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ doc, comments, signature }) => {
      const approverName = user?.display_name || user?.full_name || user?.email;
      const approvedDate = new Date().toISOString().split('T')[0];

      // Snapshot current state as a version before approving
      await base44.entities.DocumentVersion.create({
        document_id: doc.id,
        version_label: doc.version,
        title: doc.title,
        description: doc.description,
        level: doc.level,
        status: doc.status,
        file_url: doc.file_url,
        file_name: doc.file_name,
        approved_by: doc.approved_by,
        approved_date: doc.approved_date,
        review_date: doc.review_date,
        tags: doc.tags,
        framework_codes: doc.framework_codes,
        changed_by: user?.email,
        change_note: `Pre-approval snapshot. Approved by ${approverName}${comments ? ` — ${comments}` : ''}`,
      });

      await base44.entities.SecurityDocument.update(doc.id, {
        status: 'approved',
        approved_by: approverName,
        approved_date: approvedDate,
      });

      await writeAuditLog({
        action: 'document_approved',
        entity_type: 'SecurityDocument',
        entity_id: doc.id,
        details: `Document formally approved by ${approverName} (signed as: "${signature}")${comments ? ` — ${comments}` : ''}: ${doc.title}`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['securityDocuments'] });
      queryClient.invalidateQueries({ queryKey: ['documentVersionsAll'] });
      setApprovalOpen(false);
      setApprovalDoc(null);
      toast.success('Document approved and signed off');
    },
  });

  const handleApproveClick = (doc) => {
    setApprovalDoc(doc);
    setApprovalOpen(true);
  };

  const deleteMutation = useMutation({
    mutationFn: async (doc) => {
      await base44.entities.SecurityDocument.delete(doc.id);
      await writeAuditLog({ action: 'document_deleted', entity_type: 'SecurityDocument', entity_id: doc.id, details: `Deleted document: ${doc.title}` });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['securityDocuments'] });
      toast.success('Document deleted');
    },
  });

  const toggleCollapse = (id) => setCollapsed(c => ({ ...c, [id]: !c[id] }));

  const handleSearch = async () => {
    if (!searchQuery.trim()) { setSearchResults(null); return; }
    setSearching(true);
    const res = await base44.functions.invoke('searchDocuments', {
      query: searchQuery,
      customer_id: effectiveCustomerId || undefined,
    });
    setSearchResults(res.data?.results || []);
    setSearching(false);
  };

  const handleNew = (level) => {
    setEditingDoc({ level });
    setDialogOpen(true);
  };

  const handleEdit = (doc) => {
    setEditingDoc(doc);
    setDialogOpen(true);
  };

  // Customer info display
  const currentCustomer = isAdmin
    ? customers.find(c => c.id === selectedCustomerId)
    : { name: user?.customer_name };

  const pendingApprovals = docs.filter(d => d.status === 'under_review').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex flex-wrap items-center gap-3">
          {/* Platform admin: customer selector */}
          {isAdmin && (
            <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="All Customers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>All Customers</SelectItem>
                {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {/* Non-admin: show customer badge */}
          {!isAdmin && user?.customer_name && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-sm font-medium">
              <Shield className="w-3.5 h-3.5" />
              {user.customer_name}
            </div>
          )}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search documents..." className="pl-9 w-56" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {pendingApprovals > 0 && canApprove && (
            <div className="flex items-center gap-1.5 text-sm text-chart-3 bg-chart-3/10 px-3 py-1.5 rounded-lg">
              <Clock className="w-3.5 h-3.5" />
              {pendingApprovals} pending approval{pendingApprovals > 1 ? 's' : ''}
            </div>
          )}
          {canCreate && (
            <Button onClick={() => { setEditingDoc(null); setDialogOpen(true); }} className="gap-2">
              <Plus className="w-4 h-4" /> New Document
            </Button>
          )}
        </div>
      </div>

      {/* Full-text search bar */}
      <div className="flex gap-2 items-center p-4 bg-muted/30 rounded-xl border">
        <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <Input
          value={searchQuery}
          onChange={e => { setSearchQuery(e.target.value); if (!e.target.value) setSearchResults(null); }}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder="Full-text search across all documents..."
          className="border-0 bg-transparent shadow-none focus-visible:ring-0 flex-1 pl-0"
        />
        <Button size="sm" onClick={handleSearch} disabled={searching} className="gap-1.5">
          {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
          Search
        </Button>
        {searchResults !== null && (
          <Button size="sm" variant="ghost" onClick={() => { setSearchResults(null); setSearchQuery(''); }}>
            Clear
          </Button>
        )}
      </div>

      {/* Search results */}
      {searchResults !== null && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for "{searchQuery}"</p>
          {searchResults.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No matching documents found.</p>
          ) : (
            <div className="divide-y border rounded-xl bg-card overflow-hidden">
              {searchResults.map(doc => (
                <div key={doc.id} className="px-5 py-3 flex items-start gap-4">
                  <FileText className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{doc.title}</p>
                      <Badge variant="secondary" className="text-xs capitalize">{doc.level}</Badge>
                      <Badge variant="outline" className={`text-xs ${STATUS_STYLES[doc.status]}`}>{STATUS_LABELS[doc.status]}</Badge>
                      <span className="text-xs text-primary font-medium">{doc.relevance_score}% match</span>
                    </div>
                    {doc.match_reason && <p className="text-xs text-muted-foreground mt-0.5">{doc.match_reason}</p>}
                  </div>
                  <div className="flex gap-1">
                    {doc.file_url && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                        <a href={doc.file_url} target="_blank" rel="noreferrer"><ExternalLink className="w-3.5 h-3.5" /></a>
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setHistoryDoc(doc); setHistoryOpen(true); }}>
                      <History className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pending Reviews Panel */}
      <PendingReviewsPanel docs={docs} onEdit={canApprove || isUser ? handleEdit : null} />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {LEVELS.map(level => {
          const count = docs.filter(d => d.level === level.id).length;
          const Icon = level.icon;
          return (
            <Card key={level.id} className={`border ${level.border}`}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2 rounded-lg ${level.bg}`}>
                  <Icon className={`w-4 h-4 ${level.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="text-xs text-muted-foreground capitalize">{level.id}s</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Level sections */}
      {LEVELS.map(level => {
        const levelDocs = docs.filter(d => d.level === level.id);
        const Icon = level.icon;
        const isCollapsed = collapsed[level.id];

        return (
          <div key={level.id} className={`rounded-xl border ${level.border} overflow-hidden`}>
            <div
              className={`${level.bg} px-5 py-4 flex items-center justify-between cursor-pointer`}
              onClick={() => toggleCollapse(level.id)}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-5 h-5 ${level.color}`} />
                <div>
                  <h3 className={`font-semibold ${level.color}`}>{level.label}</h3>
                  <p className="text-xs text-muted-foreground">{level.sublabel}</p>
                </div>
                <Badge variant="secondary" className="ml-2">{levelDocs.length}</Badge>
              </div>
              <div className="flex items-center gap-2">
                {canCreate && (
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7"
                    onClick={e => { e.stopPropagation(); handleNew(level.id); }}>
                    <Plus className="w-3 h-3" /> Add
                  </Button>
                )}
                {isCollapsed ? <ChevronRight className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </div>
            </div>

            {!isCollapsed && (
              <div className="bg-card">
                {levelDocs.length === 0 ? (
                  <div className="px-5 py-8 text-center space-y-2">
                    <FileText className="w-8 h-8 mx-auto text-muted-foreground opacity-30" />
                    <p className="text-sm text-muted-foreground">No documents yet</p>
                    <p className="text-xs text-muted-foreground">Examples: {level.examples.join(' · ')}</p>
                    {canCreate && (
                      <Button size="sm" variant="outline" className="mt-2 gap-1.5" onClick={() => handleNew(level.id)}>
                        <Plus className="w-3 h-3" /> Add first document
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="divide-y">
                    {levelDocs.map(doc => (
                      <div key={doc.id} className="px-5 py-3 flex items-start gap-4 hover:bg-muted/20 transition-colors">
                        <FileText className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium">{doc.title}</p>
                            {doc.version && <span className="text-xs text-muted-foreground">v{doc.version}</span>}
                            <Badge variant="outline" className={`text-xs ${STATUS_STYLES[doc.status]}`}>
                              {STATUS_LABELS[doc.status]}
                            </Badge>
                            {doc.status === 'under_review' && canApprove && (
                              <Button size="sm" variant="outline" className="h-6 text-xs gap-1 text-chart-2 border-chart-2/30 hover:bg-chart-2/10"
                                onClick={() => handleApproveClick(doc)}>
                                <CheckCircle className="w-3 h-3" /> Approve
                              </Button>
                            )}
                          </div>
                          {doc.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{doc.description}</p>}
                          <div className="flex flex-wrap gap-1 mt-1">
                            {doc.framework_codes?.map(f => (
                              <Badge key={f} variant="secondary" className="text-xs px-1.5 py-0">{f}</Badge>
                            ))}
                            {doc.tags?.map(t => (
                              <span key={t} className="text-xs text-muted-foreground bg-muted px-1.5 py-0 rounded">{t}</span>
                            ))}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            {doc.approved_by && <span>Approved by: {doc.approved_by}</span>}
                            {doc.approved_date && <span>{new Date(doc.approved_date).toLocaleDateString()}</span>}
                            {isAdmin && doc.customer_name && <span>· {doc.customer_name}</span>}
                            {doc.owner_email && isCustomerAdmin && <span>· by {doc.owner_email}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {doc.file_url && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                              <a href={doc.file_url} target="_blank" rel="noreferrer">
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" title="Version history"
                            onClick={() => { setHistoryDoc(doc); setHistoryOpen(true); }}>
                            <History className="w-3.5 h-3.5" />
                          </Button>
                          {canEditDoc(doc) && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(doc)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {canDeleteDoc(doc) && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => deleteMutation.mutate(doc)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      <ApprovalDialog
        open={approvalOpen}
        onOpenChange={setApprovalOpen}
        doc={approvalDoc}
        approverName={user?.display_name || user?.full_name}
        approverEmail={user?.email}
        onConfirm={({ comments, signature }) => approveMutation.mutateAsync({ doc: approvalDoc, comments, signature })}
      />

      <VersionHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        doc={historyDoc}
        canRevert={historyDoc ? (isAdmin || isCustomerAdmin || historyDoc?.owner_email === user?.email) : false}
      />

      <SecurityDocumentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        doc={editingDoc}
        customers={customers}
        isAdmin={isAdmin}
        isUser={isUser}
        onSave={async (form) => { await saveMutation.mutateAsync(form); setDialogOpen(false); }}
      />
    </div>
  );
}