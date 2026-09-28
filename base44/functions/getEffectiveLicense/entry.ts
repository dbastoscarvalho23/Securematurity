import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { getEffectiveLicense } from "../../shared/licenseGuard.ts";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { customer_id } = await req.json();
    if (!customer_id) return Response.json({ error: "customer_id is required" }, { status: 400 });

    // Tenant users can only query their own license; admins can query any
    if (user.role !== "admin" && user.customer_id !== customer_id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const license = await getEffectiveLicense(base44, customer_id);
    return Response.json(license);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
