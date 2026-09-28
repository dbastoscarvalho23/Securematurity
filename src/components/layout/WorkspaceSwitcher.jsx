import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, ChevronsUpDown, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { normalizeRole } from '@/lib/rbac';

export default function WorkspaceSwitcher() {
  const { user, refreshUser } = useAuth();
  const { t } = useLanguage();
  const [switching, setSwitching] = useState(false);

  const normalizedRole = normalizeRole(user?.role);
  const allowedRoles = ['master_admin', 'workspace_admin', 'partner_admin'];
  if (!allowedRoles.includes(normalizedRole)) return null;

  const { data: workspaces = [] } = useQuery({
    queryKey: ['workspaces-list'],
    queryFn: () => base44.entities.Workspace.list(),
  });

  // Filter to subtree: master_admin sees all; others see only their subtree
  const userWorkspaceId = user?.data?.workspace_id || user?.workspace_id;
  const accessibleWorkspaces = normalizedRole === 'master_admin'
    ? workspaces
    : workspaces.filter(w =>
        w.id === userWorkspaceId ||
        (w.ancestor_workspace_ids || []).includes(userWorkspaceId)
      );

  if (!accessibleWorkspaces.length) return null;

  const selectedId = user?.data?.selected_workspace_id || user?.selected_workspace_id || userWorkspaceId;
  const selected = accessibleWorkspaces.find(w => w.id === selectedId) || accessibleWorkspaces[0];

  const handleSwitch = async (workspaceId) => {
    if (workspaceId === selectedId) return;
    setSwitching(true);
    try {
      await base44.auth.updateMe({ selected_workspace_id: workspaceId });
      await refreshUser();
    } catch (e) {
      console.error('Failed to switch workspace:', e);
    } finally {
      setSwitching(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 h-9 max-w-[200px]">
          <Building2 className="w-4 h-4 text-primary flex-shrink-0" />
          <span className="truncate hidden md:inline text-sm">
            {selected?.name || t('workspace_switcher_title')}
          </span>
          {switching
            ? <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
            : <ChevronsUpDown className="w-3.5 h-3.5 flex-shrink-0 opacity-50" />
          }
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          {t('workspace_switcher_title')}
        </DropdownMenuLabel>
        {accessibleWorkspaces.map(ws => (
          <DropdownMenuItem
            key={ws.id}
            onClick={() => handleSwitch(ws.id)}
            className="gap-2"
          >
            <Building2 className="w-4 h-4 flex-shrink-0 opacity-60" />
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate">{ws.name}</p>
              {ws.type && (
                <p className="text-xs text-muted-foreground capitalize">{ws.type}</p>
              )}
            </div>
            {ws.id === selectedId && <Check className="w-4 h-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
