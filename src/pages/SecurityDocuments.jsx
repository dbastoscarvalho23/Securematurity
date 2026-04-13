import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Search, FileText, Shield, BookOpen, Workflow, Zap, Upload, ExternalLink, Pencil, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { writeAuditLog } from '@/lib/auditLog';
import SecurityDocumentDialog from '@/components/documents/SecurityDocumentDialog';

const LEVELS = [
  {
    id: 'policy',
    label: 'Level 1 — Policies',
    sublabel: 'Strategic · Approved by Board of Directors',
    icon: Shield,
    color: 'text-chart-1',
    bg: 'bg-chart-1/10',
    border: 'border-chart-1/20',
    examples: ['General Information Security Policy (GISP)', 'Privacy and Minor Data Protection Policy', 'Acceptable Use Policy for Technologies (AUP)'],
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

const STATUS_LABELS = {
  draft: 'Draft',
  under_review: 'Under Review',
  approved: 'Approved',
  deprecated: 'Deprecated',
};

export default function SecurityDocuments() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'admin';
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [collapsed, setCollapsed] = useState({});

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['securityDocuments'],
    queryFn: () => base44.entities.SecurityDocument.list('-created_date', 500),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
    enabled: isAdmin,
  });

  const saveMutation = useMutation({
    mutationFn: async (form) => {
      if (form.id) {
        const result = await base44.entities.SecurityDocument.update(form.id, form);
        await writeAuditLog({ action: 'settings_changed', entity_type: 'SecurityDocument', entity_id: form.id, details: `Updated document: ${form.title}` });
        return result;
      }
      const result = await base44.entities.SecurityDocument.create(form);
      await writeAuditLog({ action: 'settings_changed', entity_type: 'SecurityDocument', entity_id: result?.id, details: `Created document: ${form.title}` });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['securityDocuments'] });
      toast.success(editingDoc ? 'Document updated' : 'Document created');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (doc) => {
      await base44.entities.SecurityDocument.delete(doc.id);
      await writeAuditLog({ action: 'settings_changed', entity_type: 'SecurityDocument', entity_id: doc.id, details: `Deleted document: ${doc.title}` });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['securityDocuments'] });
      toast.success('Document deleted');
    },
  });

  const filteredDocs = useMemo(() => {
    if (!search) return docs;
    const q = search.toLowerCase();
    return docs.filter(d =>
      d.title?.toLowerCase().includes(q) ||
      d.description?.toLowerCase().includes(q) ||
      d.tags?.some(t => t.toLowerCase().includes(q)) ||
      d.framework_codes?.some(f => f.toLowerCase().includes(q))
    );
  }, [docs, search]);

  const toggleCollapse = (id) => setCollapsed(c => ({ ...c, [id]: !c[id] }));

  const handleNew = (level) => {
    setEditingDoc({ level });
    setDialogOpen(true);
  };

  const handleEdit = (doc) => {
    setEditingDoc(doc);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search documents..." className="pl-9" />
        </div>
        {isAdmin && (
          <Button onClick={() => { setEditingDoc(null); setDialogOpen(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> New Document
          </Button>
        )}
      </div>

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
                  <p className="text-xs text-muted-foreground">{level.id.charAt(0).toUpperCase() + level.id.slice(1)}s</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Level sections */}
      {LEVELS.map(level => {
        const levelDocs = filteredDocs.filter(d => d.level === level.id);
        const Icon = level.icon;
        const isCollapsed = collapsed[level.id];

        return (
          <div key={level.id} className={`rounded-xl border ${level.border} overflow-hidden`}>
            {/* Section header */}
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
                {isAdmin && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs h-7"
                    onClick={e => { e.stopPropagation(); handleNew(level.id); }}
                  >
                    <Plus className="w-3 h-3" /> Add
                  </Button>
                )}
                {isCollapsed ? <ChevronRight className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </div>
            </div>

            {/* Documents list */}
            {!isCollapsed && (
              <div className="bg-card">
                {levelDocs.length === 0 ? (
                  <div className="px-5 py-8 text-center space-y-2">
                    <FileText className="w-8 h-8 mx-auto text-muted-foreground opacity-30" />
                    <p className="text-sm text-muted-foreground">No documents yet</p>
                    <p className="text-xs text-muted-foreground">Examples: {level.examples.join(' · ')}</p>
                    {isAdmin && (
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
                            {doc.customer_name && <span>· {doc.customer_name}</span>}
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
                          {isAdmin && (
                            <>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(doc)}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(doc)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </>
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

      <SecurityDocumentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        doc={editingDoc}
        customers={customers}
        isAdmin={isAdmin}
        onSave={async (form) => { await saveMutation.mutateAsync(form); setDialogOpen(false); }}
      />
    </div>
  );
}