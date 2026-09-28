import React from 'react';
import { Badge } from '@/components/ui/badge';
import { buildServiceArchitecture } from '@/lib/docsModel';

/**
 * Tech stack e arquitetura de serviços: funções, automações, código partilhado,
 * integrações e agente de IA.
 *
 * A narrativa é curada; a lista de workflows, módulos partilhados, conectores e
 * agente vem do repositório (nome, gatilho, cron, função chamada, âmbito).
 */
export default function ServiceArchitectureSection() {
  const model = buildServiceArchitecture();

  return (
    <div className="space-y-5">
      <p className="text-sm">{model.model.summary}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        {model.model.layers.map((layer) => (
          <div key={layer.title} className="rounded-lg border p-3">
            <p className="text-sm font-medium">{layer.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{layer.detail}</p>
          </div>
        ))}
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">
          Automações declaradas
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {model.workflows.length} workflows
          </span>
        </p>
        <div className="space-y-1.5">
          {model.workflows.map((workflow) => (
            <div key={workflow.name} className="rounded-lg border p-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{workflow.name}</p>
                <div className="flex flex-wrap items-center gap-1">
                  <Badge variant="outline" className="text-[10px] font-normal">
                    {workflow.trigger}
                  </Badge>
                  {(workflow.cron || workflow.events.length > 0) && (
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                      {workflow.cron || workflow.events.join(', ')}
                    </code>
                  )}
                </div>
              </div>
              {workflow.calls.length > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  chama{' '}
                  {workflow.calls.map((call) => (
                    <code key={call} className="mr-1 font-mono text-[11px]">
                      {call}
                    </code>
                  ))}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border p-3">
          <p className="text-sm font-medium">
            Código partilhado
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {model.shared.length} módulos
            </span>
          </p>
          <ul className="mt-2 space-y-1">
            {model.shared.map((module) => (
              <li key={module.name} className="text-sm text-muted-foreground">
                <code className="font-mono text-xs text-foreground">{module.name}</code>
                {module.note ? ` — ${module.note}` : ''}
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3">
          <div className="rounded-lg border p-3">
            <p className="text-sm font-medium">
              Integrações
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {model.connectors.length} conectores
              </span>
            </p>
            <ul className="mt-2 space-y-1.5">
              {model.connectors.map((connector) => (
                <li key={connector.name} className="text-sm text-muted-foreground">
                  <span className="text-foreground">{connector.name}</span>
                  <span className="ml-1 font-mono text-[11px]">({connector.type})</span>
                  {connector.scopes.length > 0 && (
                    <span className="block font-mono text-[10px]">
                      {connector.scopes.join(' · ')}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {model.agents.map((agent) => (
            <div key={agent.name} className="rounded-lg border p-3">
              <p className="text-sm font-medium">Agente de IA</p>
              <p className="mt-1 text-sm text-muted-foreground">
                <code className="font-mono text-xs text-foreground">{agent.name}</code> —{' '}
                {agent.description}
              </p>
              {agent.tools.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {agent.tools.map((tool) => (
                    <Badge key={tool.entity} variant="outline" className="font-mono text-[10px] font-normal">
                      {tool.entity}: {tool.operations.join('/')}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Convenções que o código impõe</p>
        <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
          {model.model.conventions.map((convention) => (
            <li key={convention}>{convention}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
