import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { resolveReadableCustomerIds } from "../../shared/accessUtils.ts";
import { getEffectiveLicense } from "../../shared/licenseGuard.ts";
import { resolveActor } from "../../shared/devActor.ts";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await resolveActor(base44, req);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { customer_id } = await req.json();
    if (!customer_id) return Response.json({ error: "customer_id is required" }, { status: 400 });

    // A leitura da licença segue o âmbito de LEITURA: o próprio tenant, a
    // carteira de um administrador de parceiro e os tenants a que o utilizador
    // tem acesso por delegação viva — um consultor delegado precisa da licença
    // do cliente para que os módulos contratados apareçam. O papel é
    // normalizado (um legado `admin` é o dono da plataforma), nunca comparado
    // com um literal (F7).
    const scope = await resolveReadableCustomerIds(base44, user);
    if (!scope.all && !scope.customerIds.includes(customer_id)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const license = await getEffectiveLicense(base44, customer_id);
    return Response.json(license);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
