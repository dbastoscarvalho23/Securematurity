import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { buildApiStructure } from '@/lib/docsModel';

/**
 * Estrutura da API: rotas do frontend e funções de backend com entradas e saídas.
 *
 * Rotas, recursos, módulos e contratos são derivados do código — as rotas de
 * `rbac.js` e `licenseModules.js`, o contrato de cada função do próprio ficheiro.
 * A narrativa de chamada e os códigos de erro são curados.
 */

/** Lista compacta de chaves (ações, entradas, saídas). */
function KeyList({ label, keys, tone = 'outline' }) {
  if (!keys.length) return null;
  return (
    <div className="flex flex-wrap items-baseline gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {keys.map((key) => (
        <Badge key={key} variant={tone} className="font-mono text-[10px] font-normal">
          {key}
        </Badge>
      ))}
    </div>
  );
}

function FunctionBlock({ fn }) {
  if (fn.missing) {
    return (
      <div className="rounded-lg border border-status-warning/30 bg-status-warning/10 p-2.5">
        <p className="font-mono text-xs">{fn.name}</p>
        <p className="text-[11px] text-muted-foreground">
          Declarada neste grupo mas ausente do repositório.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 rounded-lg border p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono text-sm font-medium">{fn.name}</p>
        <span className="text-[10px] text-muted-foreground">
          {fn.actions.length > 0 ? `multiplexada · ${fn.actions.length} ações` : 'comando único'}
          {fn.noteIsCurated ? ' · nota curada' : ''}
        </span>
      </div>
      {fn.note && <p className="text-xs text-muted-foreground">{fn.note}</p>}
      <KeyList label="ações" keys={fn.actions} />
      <KeyList label="entradas" keys={fn.inputs} tone="secondary" />
      <KeyList label="saídas" keys={fn.outputs} tone="secondary" />
      {!fn.inputs.length && !fn.outputs.length && (
        <p className="text-[11px] text-muted-foreground">
          Contrato não extraível deste ficheiro (lê o pedido por outro caminho).
        </p>
      )}
    </div>
  );
}

export default function ApiStructureSection() {
  const model = buildApiStructure();
  const functionCount = model.groups.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <div className="space-y-5">
      <p className="text-sm">{model.model.summary}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border p-3">
          <p className="text-sm font-medium">Como se chama</p>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-muted-foreground">
            {model.model.call.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-sm font-medium">Códigos de erro</p>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-muted-foreground">
            {model.model.errors.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">
          Rotas do frontend
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {model.routes.length} rotas · recurso de capacidade e módulo que as licencia
          </span>
        </p>
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-56">Rota</TableHead>
                <TableHead>Página</TableHead>
                <TableHead className="w-40">Recurso</TableHead>
                <TableHead className="w-44">Módulo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {model.routes.map((route) => (
                <TableRow key={route.route}>
                  <TableCell className="font-mono text-[11px]">{route.route}</TableCell>
                  <TableCell className="text-xs">
                    {route.name || <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="font-mono text-[11px] text-muted-foreground">
                    {route.resource || '—'}
                  </TableCell>
                  <TableCell className="text-xs">
                    {route.moduleName || (
                      <span className="text-muted-foreground">sem gating (só RBAC)</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">
          Funções de backend
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {functionCount} funções · resumo, ações, entradas e saídas lidos do código
          </span>
        </p>
        <div className="space-y-3">
          {model.groups.map((group) => (
            <div key={group.group} className="rounded-lg border p-3">
              <p className="text-sm font-medium">
                {group.group}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {group.items.length} funções
                </span>
              </p>
              <div className="mt-2 grid gap-2 xl:grid-cols-2">
                {group.items.map((fn) => (
                  <FunctionBlock key={fn.name} fn={fn} />
                ))}
              </div>
            </div>
          ))}

          {model.unclassified.length > 0 && (
            <div className="rounded-lg border border-status-warning/30 bg-status-warning/10 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-warning" />
                <p className="text-sm font-medium">
                  {model.unclassified.length} função(ões) sem grupo editorial
                </p>
              </div>
              <div className="mt-2 grid gap-2 xl:grid-cols-2">
                {model.unclassified.map((fn) => (
                  <FunctionBlock key={fn.name} fn={fn} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
