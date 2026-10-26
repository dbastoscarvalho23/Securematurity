import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { invokeFn } from '@/lib/invokeFn';

/** Rota → módulo da licença (igual aos códigos da produção). Rotas sem módulo estão sempre disponíveis. */
export const ROUTE_MODULES = {
  '/compliance-journey': 'nis2_journey',
  '/assessments': 'assessments_action_plan',
  '/action-plan': 'assessments_action_plan',
  '/recommendations': 'assessments_action_plan',
  '/evidence': 'documents_evidence',
  '/security-documents': 'documents_evidence',
  '/document-audit-trail': 'documents_evidence',
  '/legal-library': 'knowledge_guidance',
  '/framework-guide': 'knowledge_guidance',
  '/risk-assessment': 'risk_management',
  '/reports': 'reporting_audit_prep',
  '/compliance-metrics': 'reporting_audit_prep',
  '/email-report': 'reporting_audit_prep',
  '/assets': 'asset_management',
  '/incidents': 'incident_management',
  '/vulnerabilities': 'incident_management',
  '/suppliers': 'supplier_management',
  '/supply-chain': 'supplier_management',
  '/ropa': 'privacy',
  '/dsr': 'privacy',
};

export const moduleForPath = (path) => {
  if (ROUTE_MODULES[path]) return ROUTE_MODULES[path];
  const hit = Object.keys(ROUTE_MODULES).find((p) => path.startsWith(`${p}/`));
  return hit ? ROUTE_MODULES[hit] : null;
};

export const callLicensing = (payload) => invokeFn('licensing', payload);

/** Licença efetiva do utilizador atual (ou do cliente indicado, para o admin). */
export function useLicense(customerId) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['license-me', customerId || user?.customer_id || 'none'],
    queryFn: () => callLicensing({ action: 'me', ...(customerId ? { customer_id: customerId } : {}) }),
    enabled: Boolean(user),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

/**
 * O utilizador tem o módulo? O admin da plataforma tem sempre. Enquanto a licença carrega devolve true
 * (o servidor recusa de qualquer forma o que não estiver licenciado).
 */
export function hasModule(license, user, code) {
  if (!code || user?.role === 'admin') return true;
  if (!license) return true;
  return Boolean(license.effective && (license.modules || []).includes(code));
}

const today = () => new Date().toISOString().slice(0, 10);
/** Igual a subscriptionState() em base44/shared/license.ts. */
export function subscriptionState(sub, now = today()) {
  if (!sub) return 'legacy';
  if (sub.status === 'closed') return 'closed';
  if (sub.status === 'suspended') return 'suspended';
  if (sub.status === 'trial') return sub.trial_ends_at && now > sub.trial_ends_at ? 'expired' : 'trial';
  if (sub.expires_date && now > sub.expires_date) return sub.grace_until && now <= sub.grace_until ? 'grace' : 'expired';
  return 'active';
}

export const STATE_STYLE = {
  legacy: 'bg-muted text-muted-foreground',
  trial: 'bg-chart-1/10 text-chart-1 border-chart-1/30',
  active: 'bg-chart-2/10 text-chart-2 border-chart-2/30',
  grace: 'bg-chart-3/10 text-chart-3 border-chart-3/30',
  expired: 'bg-destructive/10 text-destructive border-destructive/30',
  suspended: 'bg-destructive/10 text-destructive border-destructive/30',
  closed: 'bg-muted text-muted-foreground line-through',
};

/** Ficheiro do certificado: JSON com o JWS e o conteúdo legível. */
export function downloadCertificateJson(cert) {
  const blob = new Blob([JSON.stringify({ format: 'ankoraone-license/1', jws: cert.jws, payload: JSON.parse(cert.payload) }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${cert.serial}.ankoraone-license.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Certificado em PDF (resumo legível + JWS para verificação). */
export async function downloadCertificatePdf(cert, moduleNames = {}) {
  const { default: jsPDF } = await import('jspdf');
  const p = JSON.parse(cert.payload);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = 22;
  doc.setFontSize(18); doc.text('Certificado de licença AnkoraOne', 20, y); y += 10;
  doc.setFontSize(10); doc.setTextColor(100);
  doc.text(`N.º de série ${p.serial} · emitido em ${p.issued_at.slice(0, 10)} por ${p.issued_by}`, 20, y); y += 10;
  doc.setTextColor(0); doc.setFontSize(11);
  const line = (k, v) => { doc.setFont(undefined, 'bold'); doc.text(k, 20, y); doc.setFont(undefined, 'normal'); doc.text(String(v ?? '—'), 70, y); y += 7; };
  line('Cliente', `${p.customer.name}${p.customer.nif ? ` (NIF ${p.customer.nif})` : ''}`);
  line('Bundle', `${p.tier.name}${p.tier.version ? ` (versão ${p.tier.version})` : ''}`);
  line('Validade', `${p.valid_from} a ${p.valid_until || 'sem data de fim'}`);
  line('Utilizadores', p.seats);
  line('Pedidos de IA/mês', p.ai_quota_monthly ?? 'sem limite');
  y += 3; doc.setFont(undefined, 'bold'); doc.text('Módulos', 20, y); y += 6; doc.setFont(undefined, 'normal');
  for (const m of p.modules) { doc.text(`• ${moduleNames[m] || m}`, 24, y); y += 5.5; }
  if (p.standards?.length) { y += 3; doc.setFont(undefined, 'bold'); doc.text('Referenciais', 20, y); y += 6; doc.setFont(undefined, 'normal'); doc.text(p.standards.join(', '), 24, y, { maxWidth: 165 }); y += 8; }
  y += 4; doc.setFontSize(8); doc.setTextColor(100);
  doc.text('Assinatura digital Ed25519 (JWS). Verifique na consola de licenças ou com a chave pública AnkoraOne.', 20, y); y += 5;
  doc.setFont('courier', 'normal');
  doc.text(doc.splitTextToSize(cert.jws, 170), 20, y);
  doc.save(`${p.serial}.pdf`);
}
