import React from 'react';
import { ArrowRight, Building2, GitBranch, KeyRound, UserCog } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { DELEGATION_FLOW, TENANCY_MODELS } from '@/lib/devDocsData';

/**
 * Diagrama do modelo de isolamento: as quatro entidades que definem
 * inquilino, árvore organizacional, identidade e delegação — seguidas do
 * ciclo de vida de uma delegação.
 */

const TENANCY_ICONS = {
  Customer: Building2,
  Workspace: GitBranch,
  User: UserCog,
  UserCustomerAssignment: KeyRound,
};

const TENANCY_ACCENTS = [
  [37, 99, 235],
  [124, 58, 237],
  [13, 148, 136],
  [202, 138, 4],
];

export default function TenancyDiagram() {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 lg:grid-cols-4">
        {TENANCY_MODELS.map((model, index) => {
          const Icon = TENANCY_ICONS[model.name] || Building2;
          const accent = TENANCY_ACCENTS[index] || TENANCY_ACCENTS[0];
          const rgb = `rgb(${accent.join(', ')})`;
          const isLast = index === TENANCY_MODELS.length - 1;

          return (
            <div key={model.name} className="relative flex">
              <div
                className="flex-1 rounded-xl border p-3"
                style={{ backgroundColor: `rgba(${accent.join(', ')}, 0.05)`, borderColor: `rgba(${accent.join(', ')}, 0.25)` }}
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" style={{ color: rgb }} />
                  <p className="font-mono text-xs font-semibold" style={{ color: rgb }}>
                    {model.name}
                  </p>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{model.description}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {model.fields.map((field) => (
                    <Badge key={field} variant="outline" className="font-mono text-[10px] font-normal">
                      {field}
                    </Badge>
                  ))}
                </div>
              </div>
              {!isLast && (
                <ArrowRight className="absolute -right-3 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-muted-foreground lg:block" />
              )}
            </div>
          );
        })}
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Ciclo de delegação</p>
        <ol className="space-y-2">
          {DELEGATION_FLOW.map((step, index) => (
            <li key={step} className="flex items-start gap-3 rounded-lg border p-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-[11px] font-semibold text-muted-foreground">
                {index + 1}
              </span>
              <span className="text-sm text-muted-foreground">{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
