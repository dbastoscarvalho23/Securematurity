import React from 'react';
import { Eye, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { useRoleSimulation } from '@/lib/RoleSimulationContext';
import { normalizeRole } from '@/lib/rbac';

const SIMULATABLE_ROLES = [
  'master_admin', 'workspace_admin', 'customer_admin',
  'grc_analyst', 'control_owner', 'executive', 'auditor', 'employee',
];

export default function RoleSimulationSelector() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { simulatedRole, setSimulatedRole, clearSimulation, isSimulating } = useRoleSimulation();

  // Only real master_admin sees the selector
  if (normalizeRole(user?.role) !== 'master_admin') return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={isSimulating ? 'default' : 'ghost'} size="sm" className="gap-2 h-9">
          <Eye className="w-4 h-4" />
          <span className="hidden md:inline text-sm">
            {isSimulating ? t('simulation_view_as') : t('simulation_real')}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          {t('simulation_view_as')}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={clearSimulation} className="gap-2">
          <Check className={`w-4 h-4 ${!isSimulating ? 'opacity-100' : 'opacity-0'}`} />
          <span>{t('simulation_real')}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {SIMULATABLE_ROLES.map(role => (
          <DropdownMenuItem
            key={role}
            onClick={() => setSimulatedRole(role)}
            className="gap-2"
          >
            <Check className={`w-4 h-4 ${simulatedRole === role ? 'opacity-100' : 'opacity-0'}`} />
            <span>{t(`role_${role}`) || role}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
