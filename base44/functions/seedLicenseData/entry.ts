import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { writeLicenseAuditLog } from "../../shared/licenseGuard.ts";

/**
 * seedLicenseData — Seeds the licensing system with default data.
 *
 * Creates in order:
 * 1. LicenseTier (4 records: core, professional, advanced, partner)
 * 2. LicenseModule (9 records with new module codes)
 * 3. LicenseEntitlement (~22 records pointing to module codes)
 * 4. LicenseStandard (3 records: NIS2, RJCS, ISO27001)
 * 5. TenantSubscription (1 per customer with tier_code and status)
 *
 * Idempotent: skips records that already exist.
 *
 * Admin only.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin" && user.role !== "master_admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const results = {
      tiers_created: 0,
      tiers_skipped: 0,
      modules_created: 0,
      modules_skipped: 0,
      entitlements_created: 0,
      entitlements_skipped: 0,
      standards_created: 0,
      standards_skipped: 0,
      subscriptions_created: 0,
      subscriptions_skipped: 0,
    };

    // ─── 1. LicenseTier (4 records) ────────────────────────────
    const tiers = [
      {
        code: "core",
        name: "Core",
        description: "Essential NIS2 compliance journey, assessments, documents, and reporting",
        is_partner_tier: false,
        display_order: 1,
        modules: ["nis2_journey", "assessments_action_plan", "documents_evidence", "reporting_audit_prep"],
        is_active: true,
      },
      {
        code: "professional",
        name: "Professional",
        description: "Core plus risk management and incident management",
        is_partner_tier: false,
        display_order: 2,
        modules: ["nis2_journey", "assessments_action_plan", "documents_evidence", "reporting_audit_prep", "risk_management", "incident_management"],
        is_active: true,
      },
      {
        code: "advanced",
        name: "Advanced",
        description: "Full platform with supplier management, knowledge guidance, and privacy",
        is_partner_tier: false,
        display_order: 3,
        modules: ["nis2_journey", "assessments_action_plan", "documents_evidence", "reporting_audit_prep", "risk_management", "incident_management", "supplier_management", "knowledge_guidance", "privacy"],
        is_active: true,
      },
      {
        code: "partner",
        name: "Partner",
        description: "All modules — for partner organizations managing multiple tenants",
        is_partner_tier: true,
        display_order: 4,
        modules: ["nis2_journey", "assessments_action_plan", "documents_evidence", "reporting_audit_prep", "risk_management", "incident_management", "supplier_management", "knowledge_guidance", "privacy"],
        is_active: true,
      },
    ];

    for (const tier of tiers) {
      const existing = await base44.asServiceRole.entities.LicenseTier.filter({ code: tier.code });
      if (existing.length > 0) {
        results.tiers_skipped++;
        continue;
      }
      await base44.asServiceRole.entities.LicenseTier.create(tier);
      results.tiers_created++;
    }

    // ─── 2. LicenseModule (9 records) ──────────────────────────
    const modules = [
      { code: "nis2_journey", name: "Jornada NIS2", description: "Checklist de conformidade RJCS/NIS2 passo a passo", tier_code: "core", display_order: 1, is_active: true },
      { code: "assessments_action_plan", name: "Avaliações e Plano de Ação", description: "Avaliações de maturidade, recomendações, tarefas e plano de ação", tier_code: "core", display_order: 2, is_active: true },
      { code: "documents_evidence", name: "Documentos e Evidências", description: "Gestão de documentos de segurança e evidências", tier_code: "core", display_order: 3, is_active: true },
      { code: "reporting_audit_prep", name: "Relatórios e Preparação de Auditoria", description: "Relatórios, métricas de conformidade e analytics", tier_code: "core", display_order: 4, is_active: true },
      { code: "risk_management", name: "Gestão de Risco", description: "Avaliação e gestão de riscos de cibersegurança", tier_code: "professional", display_order: 5, is_active: true },
      { code: "incident_management", name: "Gestão de Incidentes", description: "Registo e gestão de incidentes e vulnerabilidades", tier_code: "professional", display_order: 6, is_active: true },
      { code: "supplier_management", name: "Gestão de Fornecedores", description: "Avaliação de fornecedores e cadeia de abastecimento", tier_code: "advanced", display_order: 7, is_active: true },
      { code: "knowledge_guidance", name: "Conhecimento e Orientação", description: "Guia de frameworks e formação", tier_code: "advanced", display_order: 8, is_active: true },
      { code: "privacy", name: "Privacidade", description: "Registo de atividades de tratamento e pedidos de titulares", tier_code: "advanced", display_order: 9, is_active: true },
    ];

    for (const mod of modules) {
      const existing = await base44.asServiceRole.entities.LicenseModule.filter({ code: mod.code });
      if (existing.length > 0) {
        results.modules_skipped++;
        continue;
      }
      await base44.asServiceRole.entities.LicenseModule.create(mod);
      results.modules_created++;
    }

    // ─── 3. LicenseEntitlement (~22 records) ───────────────────
    const entitlements = [
      // nis2_journey
      { code: "nis2_checklist", name: "NIS2 Checklist", description: "Step-by-step NIS2 compliance checklist", module_code: "nis2_journey", is_active: true },
      { code: "nis2_progress_tracking", name: "NIS2 Progress Tracking", description: "Track compliance journey progress", module_code: "nis2_journey", is_active: true },
      // assessments_action_plan
      { code: "maturity_assessments", name: "Maturity Assessments", description: "Conduct maturity assessments", module_code: "assessments_action_plan", is_active: true },
      { code: "action_plan_management", name: "Action Plan Management", description: "Manage remediation action plans", module_code: "assessments_action_plan", is_active: true },
      { code: "recommendations_engine", name: "Recommendations Engine", description: "AI-powered recommendations", module_code: "assessments_action_plan", is_active: true },
      { code: "task_management", name: "Task Management", description: "Create and track compliance tasks", module_code: "assessments_action_plan", is_active: true },
      { code: "task_analytics", name: "Task Analytics", description: "Analytics for task completion", module_code: "assessments_action_plan", is_active: true },
      // documents_evidence
      { code: "security_documents", name: "Security Documents", description: "Manage security policy documents", module_code: "documents_evidence", is_active: true },
      { code: "evidence_collection", name: "Evidence Collection", description: "Collect and manage compliance evidence", module_code: "documents_evidence", is_active: true },
      { code: "document_audit_trail", name: "Document Audit Trail", description: "Track document changes and access", module_code: "documents_evidence", is_active: true },
      // reporting_audit_prep
      { code: "compliance_reports", name: "Compliance Reports", description: "Generate compliance reports", module_code: "reporting_audit_prep", is_active: true },
      { code: "strategic_reports", name: "Strategic Reports", description: "Executive strategic reporting", module_code: "reporting_audit_prep", is_active: true },
      { code: "compliance_metrics", name: "Compliance Metrics", description: "Compliance metrics and dashboards", module_code: "reporting_audit_prep", is_active: true },
      { code: "email_reports", name: "Email Reports", description: "Schedule and send reports via email", module_code: "reporting_audit_prep", is_active: true },
      // risk_management
      { code: "risk_assessment", name: "Risk Assessment", description: "Cybersecurity risk assessment", module_code: "risk_management", is_active: true },
      { code: "risk_matrix", name: "Risk Matrix", description: "Visual risk matrix widget", module_code: "risk_management", is_active: true },
      // incident_management
      { code: "incident_tracking", name: "Incident Tracking", description: "Track security incidents", module_code: "incident_management", is_active: true },
      { code: "vulnerability_management", name: "Vulnerability Management", description: "Manage vulnerabilities", module_code: "incident_management", is_active: true },
      // supplier_management
      { code: "supplier_assessment", name: "Supplier Assessment", description: "Assess supplier security", module_code: "supplier_management", is_active: true },
      { code: "supply_chain_management", name: "Supply Chain Management", description: "Manage supply chain risks", module_code: "supplier_management", is_active: true },
      // knowledge_guidance
      { code: "framework_guide", name: "Framework Guide", description: "AI-powered framework guidance", module_code: "knowledge_guidance", is_active: true },
      { code: "knowledge_base", name: "Knowledge Base", description: "Compliance knowledge base", module_code: "knowledge_guidance", is_active: true },
      // privacy
      { code: "ropa_management", name: "RoPA Management", description: "Record of Processing Activities", module_code: "privacy", is_active: true },
      { code: "dsr_management", name: "DSR Management", description: "Data Subject Request management", module_code: "privacy", is_active: true },
    ];

    for (const ent of entitlements) {
      const existing = await base44.asServiceRole.entities.LicenseEntitlement.filter({ code: ent.code });
      if (existing.length > 0) {
        results.entitlements_skipped++;
        continue;
      }
      await base44.asServiceRole.entities.LicenseEntitlement.create(ent);
      results.entitlements_created++;
    }

    // ─── 4. LicenseStandard (3 records) ────────────────────────
    const standards = [
      { code: "NIS2", name: "NIS2 Directive", description: "Network and Information Security Directive 2", is_active: true },
      { code: "RJCS", name: "RJCS", description: "Recomendações para a Jornada de Conformidade e Segurança", is_active: true },
      { code: "ISO27001", name: "ISO/IEC 27001", description: "Information security management systems standard", is_active: true },
    ];

    for (const std of standards) {
      const existing = await base44.asServiceRole.entities.LicenseStandard.filter({ code: std.code });
      if (existing.length > 0) {
        results.standards_skipped++;
        continue;
      }
      await base44.asServiceRole.entities.LicenseStandard.create(std);
      results.standards_created++;
    }

    // ─── 5. TenantSubscription (1 per customer) ───────────────
    const customers = await base44.asServiceRole.entities.Customer.list("name", 500);
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().split("T")[0];

    for (const customer of customers) {
      const existing = await base44.asServiceRole.entities.TenantSubscription.filter({ customer_id: customer.id });
      if (existing.length > 0) {
        results.subscriptions_skipped++;
        continue;
      }

      // Default to core tier
      await base44.asServiceRole.entities.TenantSubscription.create({
        customer_id: customer.id,
        customer_name: customer.name,
        tier_code: "core",
        status: "active",
        started_date: today,
        seat_limit: customer.user_seat_limit || 5,
        seats_used: 0,
        monthly_usage_count: 0,
        monthly_usage_reset_date: resetDate,
        notes: "Seeded by seedLicenseData (default: core tier)",
      });

      // Create TenantModule records for core modules
      for (const moduleCode of ["nis2_journey", "assessments_action_plan", "documents_evidence", "reporting_audit_prep"]) {
        await base44.asServiceRole.entities.TenantModule.create({
          customer_id: customer.id,
          module_code: moduleCode,
          status: "active",
          activated_at: now.toISOString(),
        });
      }

      // Create TenantStandard for NIS2 (default)
      await base44.asServiceRole.entities.TenantStandard.create({
        customer_id: customer.id,
        standard_code: "NIS2",
        status: "active",
        activated_at: now.toISOString(),
      });

      results.subscriptions_created++;
    }

    await writeLicenseAuditLog(
      base44, "license_data_seeded", "", "system",
      `License data seeded: ${results.tiers_created} tiers, ${results.modules_created} modules, ${results.entitlements_created} entitlements, ${results.standards_created} standards, ${results.subscriptions_created} subscriptions`,
    );

    return Response.json({ success: true, ...results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
