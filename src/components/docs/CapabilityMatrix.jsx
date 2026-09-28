import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  ACTION_ACCENTS,
  ACTION_COLUMNS,
  CAPABILITY_TIER_ENTRIES,
  RESOURCES,
  ROLES,
  capabilityActions,
  resourceLabel,
  visibleResourceCount,
  rgba,
} from '@/lib/docsModel';

/**
 * Matriz de capacidades gerada em runtime a partir de CAPABILITIES (src/lib/rbac.js):
 * é a mesma matriz que o RouteGuard aplica. As letras são coloridas por ação para
 * tornar a leitura por linha possível sem decorar a legenda.
 */

function RoleChips({ roles, t }) {
  if (!roles || !roles.length) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {roles.map((role) => (
        <Badge key={role} variant="secondary" className="text-[10px] font-normal">
          {t(`role_${role}`) || role}
        </Badge>
      ))}
    </div>
  );
}

export default function CapabilityMatrix({ t }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {ACTION_COLUMNS.map((action) => (
          <span
            key={action.key}
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]"
            style={{
              borderColor: rgba(ACTION_ACCENTS[action.key], 0.35),
              backgroundColor: rgba(ACTION_ACCENTS[action.key], 0.08),
            }}
          >
            <span className="font-mono font-bold" style={{ color: rgba(ACTION_ACCENTS[action.key]) }}>
              {action.letter}
            </span>
            <span className="text-muted-foreground">{action.label}</span>
          </span>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[170px]">Recurso</TableHead>
              {ROLES.map((role) => (
                <TableHead key={role} className="text-center text-[11px]">
                  {t(`role_${role}`) || role}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {RESOURCES.map((resource) => (
              <TableRow key={resource}>
                <TableCell className="text-sm">
                  {resourceLabel(resource)}
                  <span className="ml-2 font-mono text-[10px] text-muted-foreground">{resource}</span>
                </TableCell>
                {ROLES.map((role) => {
                  const actions = capabilityActions(resource, role);
                  return (
                    <TableCell key={role} className="text-center font-mono text-[11px]">
                      {actions.length ? (
                        <span className="inline-flex gap-0.5">
                          {actions.map((action) => (
                            <span key={action.key} style={{ color: rgba(ACTION_ACCENTS[action.key]) }} title={action.label}>
                              {action.letter}
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/40">–</span>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
            <TableRow className="bg-muted/40">
              <TableCell className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Recursos com leitura
              </TableCell>
              {ROLES.map((role) => (
                <TableCell key={role} className="text-center text-[11px] font-semibold">
                  {visibleResourceCount(role)}/{RESOURCES.length}
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Tiers de capacidade (reutilizados pela matriz)</p>
        <div className="space-y-2">
          {CAPABILITY_TIER_ENTRIES.map(([name, roles]) => (
            <div key={name} className="flex flex-col gap-1 rounded-lg border p-2 sm:flex-row sm:items-center sm:gap-3">
              <code className="w-36 shrink-0 font-mono text-xs text-muted-foreground">{name}</code>
              <RoleChips roles={roles} t={t} />
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Os tiers T_* são exclusivos do tenant: um administrador de plataforma ou de parceiro não aparece em nenhuma
          capacidade de conformidade.
        </p>
      </div>
    </div>
  );
}
