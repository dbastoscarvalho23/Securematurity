import React from 'react';
import {
  BarChart3, BookOpen, ClipboardCheck, FolderLock, Lock, MapPin, Siren, Truck, TriangleAlert,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  TIER_ACCENTS,
  TIER_LABELS,
  buildAreaMap,
  buildModuleCards,
  buildTierLayers,
  rgba,
} from '@/lib/docsModel';

/**
 * Mapa visual dos módulos.
 *
 * Três vistas complementares, todas derivadas de `licenseModules.js`:
 *  1. Escada de tiers — o que cada tier comercial herda e acrescenta.
 *  2. Cartões de módulo — módulo, tiers, rotas gated e áreas onde aparece.
 *  3. Mapa de áreas — cada rota com o módulo que a licencia e o tier mínimo da área.
 */

const MODULE_ICONS = {
  nis2_journey: MapPin,
  assessments_action_plan: ClipboardCheck,
  documents_evidence: FolderLock,
  reporting_audit_prep: BarChart3,
  risk_management: TriangleAlert,
  incident_management: Siren,
  supplier_management: Truck,
  knowledge_guidance: BookOpen,
  privacy: Lock,
};

function TierLadder() {
  const layers = buildTierLayers();

  return (
    <div className="space-y-2">
      {layers.map((layer) => (
        <div
          key={layer.tier}
          className="flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:gap-4"
          style={{ backgroundColor: rgba(layer.accent, 0.05), borderColor: rgba(layer.accent, 0.28) }}
        >
          <div className="flex items-center gap-2.5 sm:w-48 sm:shrink-0">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white"
              style={{ backgroundColor: rgba(layer.accent) }}
            >
              {layer.modules.length}
            </span>
            <div>
              <p className="text-sm font-semibold" style={{ color: rgba(layer.accent) }}>
                {layer.label}
              </p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {layer.available ? 'Comercializável' : 'Catálogo (não vendido)'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 sm:flex-1">
            {layer.modules.map((code) => {
              const isNew = layer.added.includes(code);
              const card = buildModuleCards().find((m) => m.code === code);
              return (
                <span
                  key={code}
                  className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium"
                  style={
                    isNew
                      ? { borderColor: rgba(layer.accent, 0.4), backgroundColor: rgba(layer.accent, 0.14), color: rgba(layer.accent) }
                      : { borderColor: rgba([148, 163, 184], 0.35), backgroundColor: rgba([148, 163, 184], 0.1) }
                  }
                >
                  {isNew && <span aria-hidden>+</span>}
                  {card?.name || code}
                </span>
              );
            })}
          </div>
        </div>
      ))}
      <p className="text-xs text-muted-foreground">
        Os tiers são cumulativos: <span className="font-medium">Core ⊂ Profissional ⊂ Avançado</span>. O sinal
        <span className="mx-1 font-mono">+</span>
        marca o que cada tier acrescenta ao anterior.
      </p>
    </div>
  );
}

function ModuleCards() {
  const modules = buildModuleCards();

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {modules.map((module) => {
        const Icon = MODULE_ICONS[module.code] || ClipboardCheck;
        return (
          <div
            key={module.code}
            className="flex flex-col overflow-hidden rounded-xl border"
            style={{ borderColor: rgba(module.accent, 0.3), opacity: module.inOffering ? 1 : 0.72 }}
          >
            <div className="h-1" style={{ backgroundColor: rgba(module.accent) }} />
            <div className="flex flex-1 flex-col gap-2 p-3">
              <div className="flex items-start gap-2.5">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
                  style={{ backgroundColor: rgba(module.accent, 0.1), borderColor: rgba(module.accent, 0.25) }}
                >
                  <Icon className="h-4 w-4" style={{ color: rgba(module.accent) }} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-tight">{module.name}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">{module.code}</p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">{module.description}</p>

              <div className="flex flex-wrap gap-1">
                {module.tiers.length ? (
                  module.tiers.map((tier) => (
                    <Badge
                      key={tier}
                      variant="outline"
                      className="text-[10px] font-normal"
                      style={{ borderColor: rgba(TIER_ACCENTS[tier], 0.4), color: rgba(TIER_ACCENTS[tier]) }}
                    >
                      {TIER_LABELS[tier]}
                    </Badge>
                  ))
                ) : (
                  <Badge variant="outline" className="text-[10px] font-normal">Fora da oferta</Badge>
                )}
              </div>

              <div className="mt-auto space-y-1 border-t pt-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {module.routes.length} {module.routes.length === 1 ? 'rota licenciada' : 'rotas licenciadas'}
                </p>
                <div className="flex flex-wrap gap-1">
                  {module.routes.map((route) => (
                    <code
                      key={route}
                      className="rounded px-1.5 py-0.5 font-mono text-[10px]"
                      style={{ backgroundColor: rgba(module.accent, 0.1), color: rgba(module.accent) }}
                    >
                      {route}
                    </code>
                  ))}
                </div>
                {module.areas.length > 0 && (
                  <p className="pt-0.5 text-[10px] text-muted-foreground">
                    {module.areas.join(' · ')}
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AreaModuleMap() {
  const areas = buildAreaMap();

  return (
    <div className="overflow-hidden rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[160px]">Área funcional</TableHead>
            <TableHead>Rotas e módulo que as licencia</TableHead>
            <TableHead className="w-32 text-right">Tier mínimo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {areas.map((area) => (
            <TableRow key={area.area}>
              <TableCell className="align-top">
                <p className="text-sm font-medium">{area.area}</p>
                <p className="text-[11px] text-muted-foreground">{area.description}</p>
              </TableCell>
              <TableCell className="align-top">
                <div className="space-y-1">
                  {area.items.map((item) => (
                    <div key={item.route} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-xs">{item.name}</span>
                      <code className="font-mono text-[10px] text-muted-foreground">{item.route}</code>
                      {item.module ? (
                        <span
                          className="rounded-full border px-2 py-0.5 text-[10px] font-medium"
                          style={{ borderColor: rgba(item.accent, 0.4), backgroundColor: rgba(item.accent, 0.12), color: rgba(item.accent) }}
                        >
                          {item.moduleName}
                        </span>
                      ) : (
                        <span className="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">
                          sem gating (só RBAC)
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </TableCell>
              <TableCell className="align-top text-right">
                {area.requiredTier ? (
                  <Badge
                    variant="outline"
                    className="text-[10px] font-normal"
                    style={{ borderColor: rgba(TIER_ACCENTS[area.requiredTier], 0.4), color: rgba(TIER_ACCENTS[area.requiredTier]) }}
                  >
                    {TIER_LABELS[area.requiredTier]}
                  </Badge>
                ) : (
                  <span className="text-[10px] text-muted-foreground">Transversal</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function ModuleMap() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm font-medium">1 · Escada de tiers (cumulativa)</p>
        <TierLadder />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">2 · Catálogo de módulos e cobertura</p>
        <ModuleCards />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">3 · Mapa de áreas funcionais → módulos</p>
        <AreaModuleMap />
      </div>
    </div>
  );
}
