import React from 'react';
import { Eye, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/lib/LanguageContext';
import { useRoleSimulation } from '@/lib/RoleSimulationContext';

export default function SimulationBanner() {
  const { t } = useLanguage();
  const { simulatedRole, clearSimulation, isSimulating } = useRoleSimulation();

  if (!isSimulating) return null;

  const roleLabel = t(`role_${simulatedRole}`) || simulatedRole;

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2 bg-chart-4/10 border-b border-chart-4/20 text-chart-4">
      <div className="flex items-center gap-2 text-sm">
        <Eye className="w-4 h-4 flex-shrink-0" />
        <span className="font-medium">
          {t('simulation_banner_title').replace('{role}', roleLabel)}
        </span>
        <span className="hidden sm:inline text-xs opacity-80">
          {t('simulation_banner_desc')}
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={clearSimulation}
        className="h-7 gap-1.5 border-chart-4/40 text-chart-4 hover:bg-chart-4/10"
      >
        <X className="w-3.5 h-3.5" />
        {t('simulation_exit')}
      </Button>
    </div>
  );
}
