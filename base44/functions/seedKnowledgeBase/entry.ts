import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { assertContentManager } from "../../shared/contentUtils.ts";

/**
 * seedKnowledgeBase — loads the platform content catalogue into the persisted
 * KnowledgeArticle entity (Phase 7). Replaces the frontend mock catalogue.
 *
 * Idempotent: articles are matched by `slug` and only created when missing, so
 * re-running never duplicates or overwrites content that has since been edited
 * through the editorial workflow.
 *
 * Admin-only (`master_admin`/`workspace_admin`/`grc_analyst`).
 */
const ARTICLES = [
  // ─── Platform guide ─────────────────────────────────────────
  {
    slug: "pg-getting-started",
    title: "Getting Started with AnkoraOne",
    summary: "Learn the basics of navigating the platform, understanding your dashboard, and starting your compliance journey.",
    category: "guide",
    framework: "",
    tags: ["platform", "onboarding", "dashboard", "getting started"],
    section: "platform",
    body: `## Your workspace
The dashboard is the entry point of every session. It adapts to your role: platform and partner administrators see administration widgets, GRC analysts see the assessment and action plan work, employees see their own tasks, attestations and training.

## The compliance journey
Work through the NIS2 journey step by step: define scope, run the maturity assessment, resolve the identified gaps and collect the evidence. Each step links to the screen that performs it — the journey is a map, not a separate data set.

## Where to start
1. Confirm your organization profile and users.
2. Open the NIS2 journey and review the scope.
3. Run your first maturity assessment, then generate the action plan from its gaps.`,
  },
  {
    slug: "pg-assessments",
    title: "Running Maturity Assessments",
    summary: "How to create, configure, and complete maturity assessments across multiple frameworks.",
    category: "guide",
    framework: "",
    tags: ["assessment", "maturity", "framework", "evaluation"],
    section: "platform",
    body: `## Create an assessment
Assessments are scoped to one customer and one period. Choose the framework and the question set; the questions and their weights are snapshotted when the assessment is completed, so later edits to the question bank never rewrite history.

## Answering
Each requirement is answered on a maturity scale from 1 to 5, with an optional target and evidence notes. Answers can be marked as «not applicable» — that is a scope decision, not a gap.

## Completion and reopening
Completion is a server-side operation: coverage, scores and the methodology snapshot are computed from the persisted answers. An assessment closed with pending questions requires explicit confirmation. Reopening preserves the previous result in the assessment history.`,
  },
  {
    slug: "pg-tasks-action-plan",
    title: "Managing Tasks and Action Plans",
    summary: "Create remediation tasks, assign them to owners, and track completion through your action plan.",
    category: "guide",
    framework: "",
    tags: ["task", "action", "remediation", "plan"],
    section: "platform",
    body: `## Where actions come from
The action plan is derived from the gap analysis of a completed assessment. Every gap answered below its target, or left unanswered in a partial completion, becomes a recommendation; each recommendation generates a task with an owner, a due date, a priority and the evidence required.

## Priority and deadlines
Priority combines the size of the gap with the weight of the requirement: critical (≥ 9), high (≥ 6), medium (≥ 3) and low. The suggested deadline follows the priority: 30, 90, 180 or 365 days.

## Tracking
The action plan screen tracks progress by priority and owner; the task analytics screen shows throughput and overdue work.`,
  },
  {
    slug: "pg-reports",
    title: "Generating Reports",
    summary: "Create strategic reports, email summaries, and export compliance documentation.",
    category: "guide",
    framework: "",
    tags: ["report", "reporting", "export", "email"],
    section: "platform",
    body: `## Available reports
Reports and Metrics shows maturity evolution, domain coverage and assessment history for a single customer or the whole portfolio. The Strategic Report is an executive summary; the Email Report delivers a scheduled summary to the recipients you configure.

## Audit package
For an external audit, generate an audit package: it freezes the scope, the index, the document versions, the controls with their assessed maturity, the evidence (with hashes) and the decisions taken, into a single record that can be exported.

## Exports
Every export keeps the customer scope of the session — a report never mixes tenants.`,
  },
  {
    slug: "pg-evidence",
    title: "Evidence Collection and Audit Trails",
    summary: "Upload evidence, maintain document audit trails, and prepare for external audits.",
    category: "guide",
    framework: "",
    tags: ["evidence", "audit", "document", "trail"],
    section: "platform",
    body: `## Evidence register
Evidence lives with the requirement it supports: attach files to an assessment answer, or register a formal document at one of the four levels (policy, standard, procedure, playbook). Documents carry a version, a status and an approval.

## Integrity
Every uploaded file is hashed (SHA-256) at upload time; the hash is kept with the document and with each version snapshot. The audit package reports the hash next to the evidence so a reviewer can confirm the file has not changed.

## Audit trail
The document audit trail lists creations, edits, approvals and version restorations with the user and timestamp of each change.`,
  },
  {
    slug: "pg-user-management",
    title: "User Roles and Permissions",
    summary: "Understand the 9-role tier system, assign users, and manage workspace access.",
    category: "guide",
    framework: "",
    tags: ["user", "role", "permission", "workspace", "organization", "settings"],
    section: "platform",
    body: `## The nine roles
Platform administrator, partner administrator, customer administrator, GRC analyst, control owner, executive, auditor, employee and consultant. Each role sees a different workspace: platform and partner administrators manage the platform and the catalogue, tenant roles operate the compliance work, employees see their own portal.

## Delegation
Access to another organization's data is always explicit: a consultant receives a time-boxed delegation with a reason, a scope and an expiry date, approved by an administrator of the customer. Onboarding grants account setup only, never operational access.

## Where to manage
Organization and User assignments hold the tenant tree, the members and the delegations.`,
  },
  {
    slug: "pg-licensing",
    title: "Licensing and Subscriptions",
    summary: "Manage your subscription tier, activate modules, and understand license-gated features.",
    category: "guide",
    framework: "",
    tags: ["license", "subscription", "tier", "module"],
    section: "platform",
    body: `## Three tiers
Core, Profissional and Avançado are cumulative: each tier adds whole modules to the previous one, and a module behaves the same in every tier that includes it. Core is the commercially available tier at launch.

## Modules
Each module gates a group of screens. A route whose module is not licensed redirects to the "module not licensed" notice instead of failing silently.

## Administration
The Licensing screen shows the catalogue of tiers and modules, the standards available and the subscriptions per customer.`,
  },
  {
    slug: "pg-faq-ai",
    title: "AI Assistant FAQ",
    summary: "Common questions about the AI-powered features, credit usage, and data privacy.",
    category: "faq",
    framework: "",
    tags: ["ai", "faq", "credits", "privacy"],
    section: "platform",
    body: `## Is AI required?
No. The Core NIS2 journey — scope, assessment, gaps, actions and evidence — is completable without any AI feature. The framework guide is an accelerator, never a dependency.

## What data is sent?
Only the text of the question you ask and the framework context needed to answer it. Tenant data is not used to train models.

## Usage
AI consumption is counted per customer and shown on the system status screen.`,
  },

  // ─── Compliance & frameworks ────────────────────────────────
  {
    slug: "cp-nis2-overview",
    title: "NIS2 Directive Overview",
    summary: "Understanding the NIS2 Directive (DL 125/2025 in Portugal), scope, and key obligations.",
    category: "article",
    framework: "NIS2",
    tags: ["nis2", "compliance", "directive", "dl 125"],
    section: "compliance",
    body: `## What it is
NIS2 is the EU directive on the security of network and information systems, transposed in Portugal by DL 125/2025 (RJCS). It raises the baseline of cybersecurity obligations for essential and important entities.

## Who is in scope
Entities in the listed sectors — energy, transport, health, water, digital infrastructure, ICT services, public administration, manufacturing and others — above the size thresholds, plus certain entities regardless of size.

## Core obligations
Risk management and governance, incident reporting within tight deadlines, supply chain security, business continuity, and accountability of the management body.`,
  },
  {
    slug: "cp-nis2-risk",
    title: "NIS2 Risk Management Requirements",
    summary: "Risk assessment and management obligations under NIS2, including supply chain security.",
    category: "article",
    framework: "NIS2",
    tags: ["nis2", "risk", "risk management", "supply chain", "supplier"],
    section: "compliance",
    body: `## Risk management measures
The directive requires technical, operational and organizational measures proportionate to the risk: risk analysis and information system security policies, incident handling, business continuity, supply chain security, and vulnerability handling.

## Governance
The management body approves the measures and can be held accountable. Training of the management body is an explicit obligation.

## Evidence
The assessment questions map to these obligations; the evidence collected for each answer is what an auditor will look at.`,
  },
  {
    slug: "cp-nis2-incident",
    title: "NIS2 Incident Reporting Obligations",
    summary: "Timeline and procedures for incident reporting under NIS2, including early warning and notification.",
    category: "article",
    framework: "NIS2",
    tags: ["nis2", "incident", "incident response", "reporting"],
    section: "compliance",
    body: `## Three deadlines
An early warning within 24 hours of becoming aware, an incident notification within 72 hours, and a final report within one month.

## What to report
Whether the incident is suspected of being caused by unlawful or malicious acts, whether it has cross-border impact, and the initial assessment of severity.

## Preparing
Define the escalation path, keep a register of incidents with their timelines, and rehearse the notification.`,
  },
  {
    slug: "cp-iso27001-overview",
    title: "ISO 27001 Implementation Guide",
    summary: "How to implement an Information Security Management System (ISMS) aligned with ISO/IEC 27001.",
    category: "guide",
    framework: "ISO27001",
    tags: ["iso27001", "isms", "compliance", "security"],
    section: "compliance",
    body: `## The management system
ISO/IEC 27001 asks for a management system, not a checklist: context, leadership, planning, support, operation, evaluation and improvement.

## Key artefacts
Scope, interested parties, risk assessment and treatment, the Statement of Applicability, objectives and the internal audit programme.

## Relation with NIS2
An ISMS provides most of the governance and process evidence NIS2 expects.`,
  },
  {
    slug: "cp-iso27001-controls",
    title: "ISO 27001 Annex A Controls",
    summary: "Overview of Annex A control categories and how to map them to your security posture.",
    category: "article",
    framework: "ISO27001",
    tags: ["iso27001", "controls", "annex a", "security"],
    section: "compliance",
    body: `## Four themes
Organizational, people, physical and technological controls.

## Statement of Applicability
For each control, record whether it applies and why, and where the implementation evidence lives.

## Mapping
Map Annex A controls to the framework controls you already assess, so one piece of evidence serves both.`,
  },
  {
    slug: "cp-nist-csf",
    title: "NIST Cybersecurity Framework",
    summary: "Implementing the NIST CSF functions: Identify, Protect, Detect, Respond, Recover.",
    category: "guide",
    framework: "NIST_CSF",
    tags: ["nist", "csf", "framework", "compliance"],
    section: "compliance",
    body: `## The functions
Identify, Protect, Detect, Respond and Recover form a lifecycle view of cybersecurity.

## Profiles and tiers
A current profile describes where you are; a target profile where you want to be. The gap between them is the roadmap.

## Using it here
The CSF functions are a useful way to organize findings that do not map cleanly to a single regulation.`,
  },
  {
    slug: "cp-cis-v8",
    title: "CIS Controls v8 Implementation",
    summary: "How to implement the 18 CIS Controls v8 safeguards and track compliance.",
    category: "guide",
    framework: "CIS_V8",
    tags: ["cis", "controls", "v8", "safeguards", "compliance"],
    section: "compliance",
    body: `## Prioritized safeguards
CIS Controls v8 groups 18 controls into implementation groups, starting with the basic hygiene that removes most of the common attack surface.

## Getting started
Inventory the assets, then work through the controls in implementation group order: the first group delivers most of the risk reduction.`,
  },
  {
    slug: "cp-gdpr-ropa",
    title: "GDPR Records of Processing Activities",
    summary: "How to maintain your RoPA and manage Data Subject Requests under GDPR.",
    category: "article",
    framework: "GDPR",
    tags: ["gdpr", "ropa", "record of processing", "privacy", "dsr", "data subject"],
    section: "compliance",
    body: `## The RoPA
Keep a record of every processing activity: purpose, categories of data and data subjects, recipients, transfers, retention and security measures.

## Data subject requests
Log every request, verify the identity, answer within one month (extendable) and record the outcome.

## Note
The privacy module is preserved in the codebase but is outside the Core launch offering.`,
  },
  {
    slug: "cp-training-awareness",
    title: "Security Awareness Training",
    summary: "Setting up and tracking security awareness training programs for your organization.",
    category: "guide",
    framework: "",
    tags: ["training", "awareness", "security", "education"],
    section: "compliance",
    body: `## Why it matters
Most incidents start with a person. Awareness training is both a regulatory expectation and the cheapest risk reduction available.

## Programme
Define the audience, the cadence and the content; track enrolment and completion per user.

## Evidence
Completion records are the evidence an auditor asks for.`,
  },
  {
    slug: "cp-policy-attestation",
    title: "Policy Attestation Best Practices",
    summary: "How to manage policy attestations and ensure organization-wide compliance acknowledgment.",
    category: "article",
    framework: "",
    tags: ["policy", "attestation", "compliance", "acknowledgment"],
    section: "compliance",
    body: `## What it proves
Attestation records that each person has read and accepted a policy, with who, when and which version.

## Running it
Publish the policy, request the attestation from the right population, and monitor who has not yet signed.

## Keeping it current
Re-request attestation whenever the policy changes — a version bump invalidates the previous acknowledgments.`,
  },
  {
    slug: "cp-vulnerability-mgmt",
    title: "Vulnerability Management Process",
    summary: "Establishing a vulnerability management lifecycle aligned with compliance requirements.",
    category: "article",
    framework: "",
    tags: ["vulnerability", "vulnerability management", "security", "patch"],
    section: "compliance",
    body: `## The lifecycle
Identify, classify, prioritize, remediate and verify — continuously, not once a year.

## Prioritization
Weigh exploitability and exposure, not only the raw CVSS score.

## Tracking
Keep each vulnerability with its owner, its due date and its remediation evidence; the register is what proves the process exists.`,
  },
  {
    slug: "cp-supplier-risk",
    title: "Third-Party and Supplier Risk Management",
    summary: "Assessing and managing risks from suppliers and supply chain partners.",
    category: "article",
    framework: "",
    tags: ["supplier", "supply chain", "third-party", "risk", "vendor"],
    section: "compliance",
    body: `## Why suppliers
Your risk surface includes what your suppliers can reach. NIS2 makes supply chain security an explicit obligation.

## Assessment
Classify suppliers by criticality and data access, send questionnaires, and record the answers and the contractual security clauses.

## Continuous monitoring
Reassess on a cadence and on significant change; keep the evidence with the supplier record.`,
  },
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    assertContentManager(user);

    const existing = await base44.asServiceRole.entities.KnowledgeArticle.list("order_index", 500);
    const bySlug = new Map<string, any>(existing.map((a: any) => [a.slug, a]));

    const created: string[] = [];
    const reused: string[] = [];

    for (let index = 0; index < ARTICLES.length; index += 1) {
      const article = ARTICLES[index];
      if (bySlug.has(article.slug)) {
        reused.push(article.slug);
        continue;
      }
      await base44.asServiceRole.entities.KnowledgeArticle.create({
        ...article,
        status: "published",
        version: 1,
        order_index: index,
        is_active: true,
        author_email: user.email || "",
        reviewer_email: user.email || "",
        review_note: "",
        published_at: new Date().toISOString(),
      });
      created.push(article.slug);
    }

    await base44.asServiceRole.entities.AuditLog.create({
      customer_id: "",
      action: "knowledge_base_seeded",
      user_email: user.email || "",
      entity_type: "KnowledgeArticle",
      entity_id: "",
      details: JSON.stringify({ created: created.length, reused: reused.length }),
    });

    return Response.json({ created: created.length, reused: reused.length, slugs: created });
  } catch (error) {
    return Response.json({ error: error.message, code: error.code }, { status: error.status || 500 });
  }
});
