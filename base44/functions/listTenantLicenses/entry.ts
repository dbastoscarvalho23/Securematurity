import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import {
  normalizeRole,
  isPlatformOwner,
  isPartnerAdmin,
  resolveScopeCustomerIds,
} from "../../shared/accessUtils.ts";
import { resolveActor } from "../../shared/devActor.ts";
import {
  TIER_MODULES,
  COMMERCIALLY_AVAILABLE_TIERS,
  addonName,
  modulesForAddon,
  getEffectiveLicense,
} from "../../shared/licenseGuard.ts";
import { OFFER_ADDON_CODES } from "../../shared/commercialOffer.ts";

/**
 * listTenantLicenses — a leitura que o painel de provisionamento (FB1) precisa.
 *
 * A página /licensing lê as entidades directamente, mas as RLS de licenciamento
 * só conhecem `master_admin` (e o próprio tenant): um administrador de parceiro
 * não conseguiria ver as subscrições da sua carteira. Esta função resolve o
 * âmbito no servidor e devolve, por cliente, a subscrição e a licença efectiva
 * já calculada — a mesma que o gating do produto usa, sem uma segunda regra.
 *
 * Máximo de clientes por resposta para manter a leitura previsível.
 */
const MAX_TENANTS = 100;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await resolveActor(base44, req);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const role = normalizeRole(user.role);
    if (!isPlatformOwner(role) && !isPartnerAdmin(role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const scope = await resolveScopeCustomerIds(base44, user);
    const customers = await base44.asServiceRole.entities.Customer.list("name", 500);
    const scoped = (scope.all ? customers : customers.filter((c: any) => scope.customerIds.includes(c.id)))
      .slice(0, MAX_TENANTS);

    const moduleCatalogue = await base44.asServiceRole.entities.LicenseModule.list("display_order", 100);
    const moduleNames = new Map(moduleCatalogue.map((m: any) => [m.code, m.name]));
    const standardCatalogue = await base44.asServiceRole.entities.LicenseStandard.list("code", 50);

    const tenants = [];
    for (const customer of scoped) {
      const subs = await base44.asServiceRole.entities.TenantSubscription.filter({ customer_id: customer.id });
      const license = await getEffectiveLicense(base44, customer.id);
      const overrides = await base44.asServiceRole.entities.TenantModule.filter({ customer_id: customer.id });
      // Com um contrato fechado e outro criado depois, vale o contrato vivo.
      const subscription = subs.find((sub: any) => sub.status !== "cancelled") || subs[0] || null;
      tenants.push({
        id: customer.id,
        name: customer.name || "",
        subscription,
        license: {
          licensed: license.licensed,
          status: license.status,
          tier_code: license.tier_code,
          seat_limit: license.seat_limit,
          seats_used: license.seats_used,
          warning: license.warning || null,
          grace_until: license.grace_until || null,
          module_codes: (license.modules || []).map((m: any) => m.code),
          standards: license.standards || [],
        },
        overrides: overrides.map((o: any) => ({
          module_code: o.module_code,
          status: o.status,
          reason: o.reason || "",
          expires_at: o.expires_at || null,
        })),
        // Packs contratados (FM1): o painel mostra-os como decisão comercial, e
        // não apenas como o efeito que têm (as excepções por módulo acima).
        addons: (subscription?.addons || []).map((a: any) => ({
          addon_code: a.addon_code,
          name: a.name || addonName(a.addon_code),
          status: a.status || null,
          amount_cents: a.amount_cents ?? null,
          started_date: a.started_date ?? null,
          ended_date: a.ended_date ?? null,
        })),
      });
    }

    return Response.json({
      scope: { all: scope.all, customer_ids: scope.all ? [] : scope.customerIds },
      tenants,
      catalogue: {
        tiers: Object.entries(TIER_MODULES).map(([code, modules]) => ({ code, modules })),
        commercially_available: COMMERCIALLY_AVAILABLE_TIERS,
        modules: moduleCatalogue.map((m: any) => ({ code: m.code, name: m.name || moduleNames.get(m.code) || m.code })),
        standards: standardCatalogue.map((s: any) => ({ code: s.code, name: s.name || s.code })),
        // Packs do catálogo de código: o painel mostra-os com os módulos que abrem.
        addons: OFFER_ADDON_CODES.map((code) => ({
          code,
          name: addonName(code),
          modules: modulesForAddon(code).map((moduleCode: string) => ({
            code: moduleCode,
            name: moduleNames.get(moduleCode) || moduleCode,
          })),
        })),
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
