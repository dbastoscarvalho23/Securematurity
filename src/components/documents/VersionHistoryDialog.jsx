import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, RotateCcw, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';

const STATUS_STYLES = {
  draft: 'bg-muted text-muted-foreground',
  under_review: 'bg-chart-3/10 text-chart-3',
  approved: 'bg-chart-2/10 text-chart-2',
  deprecated: 'bg-destructive/10 text-destructive',
};

const formatLocalTimestamp = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString([], {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

export default function VersionHistoryDialog({ open, onOpenChange, doc, canRevert }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(null);

  const { data: versions = [], isLoading } = useQuery({
    queryKey: ['documentVersions', doc?.id],
    queryFn: () => base44.entities.DocumentVersion.filter({ document_id: doc.id }, '-created_date', 100),
    enabled: open && !!doc?.id,
  });

  const revertMutation = useMutation({
    mutationFn: async (version) => {
      // Snapshot current state first
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
        change_note: `Auto-snapshot before reverting to version ${version.version_label || version.id}`,
      });
      // Revert
      await base44.entities.SecurityDocument.update(doc.id, {
        title: version.title,
        description: version.description,
        level: version.level,
        status: 'under_review',
        file_url: version.file_url,
        file_name: version.file_name,
        approved_by: version.approved_by,
        approved_date: version.approved_date,
        review_date: version.review_date,
        tags: version.tags,
        framework_codes: version.framework_codes,
        version: version.version_label,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['securityDocuments'] });
      queryClient.invalidateQueries({ queryKey: ['documentVersions', doc?.id] });
      toast.success('Reverted to selected version (status reset to Under Review)');
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Version History
            <span className="text-sm font-normal text-muted-foreground">— {doc?.title}</span>
          </DialogTitle>
        </DialogHeader>

        {isLoading && (
          <p className="text-sm text-muted-foreground py-4 text-center">Loading history...</p>
        )}

        {!isLoading && versions.length === 0 && (
          <div className="py-10 text-center text-muted-foreground text-sm space-y-1">
            <p>No version history yet.</p>
            <p className="text-xs">Versions are saved automatically each time a document is updated.</p>
          </div>
        )}

        <div className="space-y-2">
          {versions.map((v, idx) => {
            const isExpanded = expanded === v.id;
            return (
              <div key={v.id} className="border rounded-lg overflow-hidden">
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                  onClick={() => setExpanded(isExpanded ? null : v.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {idx === 0 && <Badge variant="secondary" className="text-xs">Latest</Badge>}
                      {v.version_label && <span className="text-sm font-medium">v{v.version_label}</span>}
                      {v.status && (
                        <Badge variant="outline" className={`text-xs ${STATUS_STYLES[v.status]}`}>
                          {v.status.replace('_', ' ')}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">{formatLocalTimestamp(v.created_date)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      by <span className="font-medium">{v.changed_by}</span>
                      {v.change_note && <span> · {v.change_note}</span>}
                    </p>
                  </div>
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t bg-muted/10 space-y-3">
                    {v.title && <p className="text-sm mt-3"><span className="text-muted-foreground text-xs uppercase tracking-wide">Title</span><br />{v.title}</p>}
                    {v.description && <p className="text-sm"><span className="text-muted-foreground text-xs uppercase tracking-wide">Description</span><br />{v.description}</p>}
                    <div className="flex flex-wrap gap-4 text-sm">
                      {v.approved_by && <p><span className="text-muted-foreground text-xs uppercase tracking-wide block">Approved By</span>{v.approved_by}</p>}
                      {v.approved_date && <p><span className="text-muted-foreground text-xs uppercase tracking-wide block">Approval Date</span>{v.approved_date}</p>}
                    </div>
                    {(v.framework_codes?.length > 0 || v.tags?.length > 0) && (
                      <div className="flex flex-wrap gap-1">
                        {v.framework_codes?.map(f => <Badge key={f} variant="secondary" className="text-xs">{f}</Badge>)}
                        {v.tags?.map(t => <span key={t} className="text-xs bg-muted px-1.5 py-0.5 rounded">{t}</span>)}
                      </div>
                    )}
                    <div className="flex items-center gap-2 pt-1">
                      {v.file_url && (
                        <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" asChild>
                          <a href={v.file_url} target="_blank" rel="noreferrer">
                            <ExternalLink className="w-3 h-3" /> View file
                          </a>
                        </Button>
                      )}
                      {canRevert && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 text-xs h-7 text-chart-4 border-chart-4/30 hover:bg-chart-4/10"
                          onClick={() => revertMutation.mutate(v)}
                          disabled={revertMutation.isPending}
                        >
                          <RotateCcw className="w-3 h-3" /> Revert to this version
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}