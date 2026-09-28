import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Network, Plus, ChevronRight, ChevronDown, Building2, RefreshCw, Trash2, Pencil } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { toast } from 'sonner';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';
import { fetchWorkspaceTree, flattenWorkspaceTree, WORKSPACE_TYPES, migrateExistingWorkspaces } from '@/lib/workspace';
import { isPlatformOwner } from '@/lib/rbac';

function WorkspaceNode({ node, onAddChild, onEdit, onDelete, t }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const typeMeta = WORKSPACE_TYPES[node.type] || WORKSPACE_TYPES.organization;

  return (
    <div className="select-none">
      <div
        className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-muted/50 group"
        style={{ marginLeft: `${(node._depth || 0) * 24}px` }}
      >
        {hasChildren ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-muted-foreground hover:text-foreground"
            aria-label={t('aria_workspace_toggle')}
            aria-expanded={expanded}
          >
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        ) : (
          <span className="w-4" />
        )}
        <Building2 className="w-4 h-4 text-muted-foreground" />
        <span className="font-medium text-sm flex-1">{node.name}</span>
        <Badge variant="outline" className={`text-xs ${typeMeta.badge}`}>{typeMeta.label}</Badge>
        {node.customer_name && (
          <span className="text-xs text-muted-foreground hidden sm:inline">{node.customer_name}</span>
        )}
        {node.status === 'inactive' && (
          <Badge variant="outline" className="text-xs bg-muted text-muted-foreground">{t('common_inactive')}</Badge>
        )}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onAddChild(node)} aria-label={t('aria_workspace_add_child')} title={t('aria_workspace_add_child')}>
            <Plus className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(node)} aria-label={t('aria_workspace_edit')} title={t('aria_workspace_edit')}>
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          {!hasChildren && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(node)} aria-label={t('aria_workspace_delete')} title={t('aria_workspace_delete')}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children.map(child => (
            <WorkspaceNode
              key={child.id}
              node={{ ...child, _depth: (node._depth || 0) + 1 }}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onDelete={onDelete}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function WorkspaceFormDialog({ open, onClose, editingNode, parentNode, t }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [type, setType] = useState('organization');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (open) {
      setName(editingNode?.name || '');
      setType(editingNode?.type || 'organization');
      setDescription(editingNode?.description || '');
    }
  }, [open, editingNode]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error(t('common_required_field'));
      return;
    }
    setSaving(true);
    try {
      if (editingNode) {
        // Update existing workspace
        await base44.entities.Workspace.update(editingNode.id, {
          name: name.trim(),
          type,
          description: description.trim() || undefined,
        });
        toast.success(t('workspace_updated'));
      } else {
        // Create new workspace
        const parentId = parentNode?.id || null;
        const ancestorIds = parentNode?.ancestor_ids
          ? [...parentNode.ancestor_ids, parentId]
          : parentId
            ? [parentId]
            : [];

        await base44.entities.Workspace.create({
          name: name.trim(),
          type,
          parent_id: parentId,
          ancestor_ids: ancestorIds,
          status: 'active',
          path: parentNode ? `${parentNode.path || parentNode.name} > ${name.trim()}` : name.trim(),
          description: description.trim() || undefined,
        });
        toast.success(t('workspace_created'));
      }
      queryClient.invalidateQueries({ queryKey: ['workspace-tree'] });
      onClose();
    } catch (error) {
      toast.error(error.message || t('common_error'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingNode) return;
    setSaving(true);
    try {
      await base44.entities.Workspace.delete(editingNode.id);
      toast.success(t('workspace_deleted'));
      queryClient.invalidateQueries({ queryKey: ['workspace-tree'] });
      onClose();
    } catch (error) {
      toast.error(error.message || t('common_error'));
    } finally {
      setSaving(false);
    }
  };

  const isDeleteMode = editingNode && !editingNode.children?.length;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editingNode ? t('workspace_edit') : parentNode ? t('workspace_add_child') : t('workspace_add_root')}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>{t('workspace_name')}</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder={t('workspace_name_placeholder')} />
          </div>
          <div className="space-y-2">
            <Label>{t('workspace_type')}</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(WORKSPACE_TYPES).map(([code, meta]) => (
                  <SelectItem key={code} value={code}>{meta.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('workspace_description')}</Label>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder={t('workspace_description_placeholder')} />
          </div>
          {parentNode && (
            <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
              {t('workspace_parent')}: <span className="font-medium">{parentNode.name}</span>
            </div>
          )}
        </div>
        <DialogFooter>
          {isDeleteMode && (
            <Button variant="destructive" onClick={handleDelete} disabled={saving} className="mr-auto">
              <Trash2 className="w-4 h-4 mr-1" /> {t('common_delete')}
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>{t('common_cancel')}</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : null}
            {t('common_save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Workspaces() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNode, setEditingNode] = useState(null);
  const [parentNode, setParentNode] = useState(null);
  const [migrating, setMigrating] = useState(false);

  const { data: treeData, isLoading } = useQuery({
    queryKey: ['workspace-tree'],
    queryFn: fetchWorkspaceTree,
    enabled: isPlatformOwner(user?.role),
  });

  if (!isPlatformOwner(user?.role)) {
    return <EmptyState icon={Network} title={t('common_no_permission')} className="h-64" />;
  }

  const tree = treeData?.tree || [];
  const flatList = flattenWorkspaceTree(tree);

  const handleAddRoot = () => {
    setEditingNode(null);
    setParentNode(null);
    setDialogOpen(true);
  };

  const handleAddChild = (node) => {
    setEditingNode(null);
    setParentNode(node);
    setDialogOpen(true);
  };

  const handleEdit = (node) => {
    setEditingNode(node);
    setParentNode(null);
    setDialogOpen(true);
  };

  const handleDelete = (node) => {
    setEditingNode(node);
    setParentNode(null);
    setDialogOpen(true);
  };

  const handleMigrate = async () => {
    setMigrating(true);
    try {
      const result = await migrateExistingWorkspaces();
      toast.success(t('workspace_migrated', { count: result.migrated_count }));
    } catch (error) {
      toast.error(error.message || t('common_error'));
    } finally {
      setMigrating(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader description={t('workspace_subtitle')} />

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-xs">
            {flatList.length} {t('workspace_total')}
          </Badge>
          <Button variant="outline" size="sm" onClick={handleMigrate} disabled={migrating}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${migrating ? 'animate-spin' : ''}`} />
            {t('workspace_migrate_existing')}
          </Button>
        </div>
        <Button size="sm" onClick={handleAddRoot}>
          <Plus className="w-4 h-4 mr-1" />
          {t('workspace_add_root')}
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <LoadingState variant="skeleton" rows={5} label={t('common_loading')} />
          ) : tree.length > 0 ? (
            <div className="space-y-1">
              {tree.map(node => (
                <WorkspaceNode
                  key={node.id}
                  node={{ ...node, _depth: 0 }}
                  onAddChild={handleAddChild}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  t={t}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Network}
              title={t('workspace_empty')}
              description={t('workspace_empty_desc')}
              className="h-48"
            />
          )}
        </CardContent>
      </Card>

      <WorkspaceFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        editingNode={editingNode}
        parentNode={parentNode}
        t={t}
      />
    </div>
  );
}
