import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { buildDataModel } from '@/lib/docsModel';

/**
 * Modelo de dados detalhado: entidades, campos-chave e relações.
 *
 * O inventário é derivado do repositório (esquema das entidades em JSONC); o
 * agrupamento por domínio é editorial. Uma entidade que exista no repositório e
 * ainda não tenha grupo aparece no aviso final em vez de desaparecer.
 */

function EntityCard({ entity }) {
  if (entity.missing) {
    return (
      <div className="rounded-lg border border-status-warning/30 bg-status-warning/10 p-2.5">
        <p className="font-mono text-xs">{entity.name}</p>
        <p className="text-[11px] text-muted-foreground">
          Declarada neste grupo mas ausente do repositório.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono text-sm font-medium">{entity.name}</p>
        <span className="text-[10px] text-muted-foreground">
          {entity.fieldCount} campos · {entity.requiredCount} obrigatórios
          {entity.relations.length > 0 && ` · ${entity.relations.length} relação(ões)`}
        </span>
      </div>
      <ul className="mt-1.5 space-y-0.5">
        {entity.keyFields.map((field) => (
          <li key={field.name} className="font-mono text-[11px] text-muted-foreground">
            {field.name}
            <span className="text-muted-foreground/70">: {field.type}</span>
            {field.required && <span className="ml-1 text-status-danger">obrigatório</span>}
            {field.relation && <span className="ml-1 text-chart-1">→ {field.relation}</span>}
          </li>
        ))}
      </ul>
      {entity.omittedFields > 0 && (
        <p className="mt-1 text-[10px] text-muted-foreground">
          +{entity.omittedFields} campo(s) no esquema
        </p>
      )}
    </div>
  );
}

export default function DataModelSection() {
  const model = buildDataModel();
  const total = model.groups.reduce((sum, group) => sum + group.entities.length, 0);

  return (
    <div className="space-y-4">
      <p className="text-sm">{model.notes.summary}</p>

      <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
        {model.notes.rules.map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
      </ul>

      <p className="text-xs text-muted-foreground">
        {total} entidades agrupadas por domínio. Campos-chave = relações e obrigatórios de
        cada esquema, lidos de <code className="font-mono">base44/entities</code>.
      </p>

      <div className="space-y-3">
        {model.groups.map((group) => (
          <div key={group.group} className="rounded-lg border p-3">
            <p className="text-sm font-medium">
              {group.group}
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {group.entities.length} entidades
              </span>
            </p>
            <div className="mt-2 grid gap-2 lg:grid-cols-2">
              {group.entities.map((entity) => (
                <EntityCard key={entity.name} entity={entity} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {model.unclassified.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-status-warning/30 bg-status-warning/10 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-warning" />
          <p className="text-sm">
            <span className="font-medium">
              {model.unclassified.length} entidade(s) sem grupo editorial:
            </span>{' '}
            <span className="font-mono text-xs">{model.unclassified.join(', ')}</span>
          </p>
        </div>
      )}
    </div>
  );
}
