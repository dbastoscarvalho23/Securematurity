import React from 'react';
import { Gauge } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import MaturityBadge from './MaturityBadge';
import { MATURITY_SCALE, buildMaturityMatrix } from '@/lib/validationReportModel';

/**
 * Matriz de maturidade — a escala 0–5 aplicada às três famílias de áreas: as do
 * relatório de validação, as áreas comerciais da plataforma (FM1–FM6) e as
 * categorias de requisitos NIS2.
 *
 * Tudo vem do modelo (`validationReportModel.js`): as notas são calculadas dos
 * achados de cada área, pelo que fechar um achado muda a nota e a justificação no
 * mesmo instante. Nada é escrito à mão aqui.
 */
export default function MaturityMatrix() {
  const families = buildMaturityMatrix();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Gauge className="h-4 w-4 text-muted-foreground" />
          Matriz de maturidade — escala 0–5 por área
        </CardTitle>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
          {MATURITY_SCALE.map((step) => (
            <span key={step.level} className="text-xs text-muted-foreground">
              <span className="font-mono font-semibold text-foreground">{step.level}</span> {step.label}
            </span>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {families.map((family) => (
          <section key={family.id} className="space-y-2">
            <div>
              <h3 className="text-sm font-semibold text-foreground">{family.label}</h3>
              <p className="text-xs text-muted-foreground">{family.description}</p>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {family.areas.map((area) => (
                <div key={area.id} className="space-y-1.5 rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">{area.label}</p>
                    <MaturityBadge maturity={area.maturity} className="shrink-0" />
                  </div>
                  <p className="text-xs text-muted-foreground">{area.maturity.rationale}</p>
                  {area.description && (
                    <p className="text-xs text-muted-foreground/80">{area.description}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}
