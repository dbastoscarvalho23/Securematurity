import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { LanguageProvider, useLanguage } from '@/lib/LanguageContext';
import { ThemeProvider } from '@/lib/ThemeContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import MaintenanceGuard from '@/components/layout/MaintenanceGuard';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import AppLayout from '@/components/layout/AppLayout';
import Dashboard from '@/pages/Dashboard';
import Customers from '@/pages/Customers';
import Assessments from '@/pages/Assessments';
import AssessmentDetail from '@/pages/AssessmentDetail';
import Recommendations from '@/pages/Recommendations';
import Reports from '@/pages/Reports';
import Admin from '@/pages/Admin';
import AuditLog from '@/pages/AuditLog';
import QuestionBank from '@/pages/QuestionBank';
import Tasks from '@/pages/Tasks';
import ActionPlan from '@/pages/ActionPlan';
import TaskAnalytics from '@/pages/TaskAnalytics';
import SecurityDocuments from '@/pages/SecurityDocuments';
import DocumentAuditTrail from '@/pages/DocumentAuditTrail';
import RiskAssessment from '@/pages/RiskAssessment';
import EvidenceOverview from '@/pages/EvidenceOverview';
import ComplianceJourney from '@/pages/ComplianceJourney';
import EmailReport from '@/pages/EmailReport';
import SupplyChain from '@/pages/SupplyChain';
import Suppliers from '@/pages/Suppliers';
import RoPA from '@/pages/RoPA';
import IncidentManagement from '@/pages/IncidentManagement';
import DSRManagement from '@/pages/DSRManagement';
import VulnerabilityManagement from '@/pages/VulnerabilityManagement';
import ComplianceMetrics from '@/pages/ComplianceMetrics';
import Training from '@/pages/Training';
import FrameworkGuide from '@/pages/FrameworkGuide';
import RouteGuard from '@/components/layout/RouteGuard';
import Licensing from '@/pages/Licensing';
import LicenseUnavailable from '@/pages/LicenseUnavailable';
import Workspaces from '@/pages/Workspaces';
import Organization from '@/pages/Organization';
import Configuration from '@/pages/Configuration';
import SystemStatus from '@/pages/SystemStatus';
// «Delegações» — entrada única do acesso externo (fusão de ExternalAccess + UserAssignments).
import Delegations from '@/pages/Delegations';
import { Suspense, lazy } from 'react';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';

const StrategicReport = lazy(() => import('@/pages/StrategicReport'));
const KnowledgeBase = lazy(() => import('@/pages/KnowledgeBase'));
const AuditPackage = lazy(() => import('@/pages/AuditPackage'));
const PolicyAttestation = lazy(() => import('@/pages/PolicyAttestation'));
// Documentação técnica interna (separador «Dev»).
const TechnicalDocs = lazy(() => import('@/pages/TechnicalDocs'));
// TEMPORÁRIO — relatório de validação (documento de inspeção; retirar quando as correções forem aplicadas).
const ValidationReport = lazy(() => import('@/pages/ValidationReport'));
// Consola de automações e conservação (FB4).
const PlatformOperations = lazy(() => import('@/pages/PlatformOperations'));

function PageFallback() {
  const { t } = useLanguage();
  return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-pulse text-muted-foreground">{t('common_loading')}</div>
    </div>
  );
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-border border-t-foreground rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public auth routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* All app routes gated by ProtectedRoute — unauthenticated users redirect to /login */}
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<MaintenanceGuard />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<RouteGuard path="/"><Dashboard /></RouteGuard>} />
          <Route path="/customers" element={<RouteGuard path="/customers"><Customers /></RouteGuard>} />
          <Route path="/assessments" element={<RouteGuard path="/assessments"><Assessments /></RouteGuard>} />
          <Route path="/assessments/:id" element={<RouteGuard path="/assessments"><AssessmentDetail /></RouteGuard>} />
          <Route path="/recommendations" element={<RouteGuard path="/recommendations"><Recommendations /></RouteGuard>} />
          <Route path="/reports" element={<RouteGuard path="/reports"><Reports /></RouteGuard>} />
          <Route path="/audit-package" element={<RouteGuard path="/audit-package"><ErrorBoundary fallback={<PageFallback />}><Suspense fallback={<PageFallback />}><AuditPackage /></Suspense></ErrorBoundary></RouteGuard>} />
          <Route path="/admin" element={<RouteGuard path="/admin"><Admin /></RouteGuard>} />
          <Route path="/audit-log" element={<RouteGuard path="/audit-log"><AuditLog /></RouteGuard>} />
          <Route path="/settings" element={<Navigate to="/configuration" replace />} />
          <Route path="/question-bank" element={<RouteGuard path="/question-bank"><QuestionBank /></RouteGuard>} />
          <Route path="/tasks" element={<RouteGuard path="/tasks"><Tasks /></RouteGuard>} />
          <Route path="/task-analytics" element={<RouteGuard path="/task-analytics"><TaskAnalytics /></RouteGuard>} />
          <Route path="/risk-assessment" element={<RouteGuard path="/risk-assessment"><RiskAssessment /></RouteGuard>} />
          <Route path="/security-documents" element={<RouteGuard path="/security-documents"><SecurityDocuments /></RouteGuard>} />
          <Route path="/document-audit-trail" element={<RouteGuard path="/document-audit-trail"><DocumentAuditTrail /></RouteGuard>} />
          <Route path="/action-plan" element={<RouteGuard path="/action-plan"><ActionPlan /></RouteGuard>} />
          <Route path="/evidence" element={<RouteGuard path="/evidence"><EvidenceOverview /></RouteGuard>} />
          <Route path="/compliance-journey" element={<RouteGuard path="/compliance-journey"><ComplianceJourney /></RouteGuard>} />
          <Route path="/supply-chain" element={<RouteGuard path="/supply-chain"><SupplyChain /></RouteGuard>} />
          <Route path="/suppliers" element={<RouteGuard path="/suppliers"><Suppliers /></RouteGuard>} />
          <Route path="/ropa" element={<RouteGuard path="/ropa"><RoPA /></RouteGuard>} />
          <Route path="/incidents" element={<RouteGuard path="/incidents"><IncidentManagement /></RouteGuard>} />
          <Route path="/dsr" element={<RouteGuard path="/dsr"><DSRManagement /></RouteGuard>} />
          <Route path="/vulnerabilities" element={<RouteGuard path="/vulnerabilities"><VulnerabilityManagement /></RouteGuard>} />
          <Route path="/compliance-metrics" element={<RouteGuard path="/compliance-metrics"><ComplianceMetrics /></RouteGuard>} />
          <Route path="/training" element={<RouteGuard path="/training"><Training /></RouteGuard>} />
          <Route path="/framework-guide" element={<RouteGuard path="/framework-guide"><FrameworkGuide /></RouteGuard>} />
          <Route path="/email-report" element={<RouteGuard path="/email-report"><EmailReport /></RouteGuard>} />
          <Route path="/licensing" element={<RouteGuard path="/licensing"><Licensing /></RouteGuard>} />
          <Route path="/license-unavailable" element={<RouteGuard path="/license-unavailable"><LicenseUnavailable /></RouteGuard>} />
          <Route path="/workspaces" element={<RouteGuard path="/workspaces"><Workspaces /></RouteGuard>} />
          <Route path="/organization" element={<RouteGuard path="/organization"><Organization /></RouteGuard>} />
          <Route path="/configuration" element={<RouteGuard path="/configuration"><Configuration /></RouteGuard>} />
          <Route path="/system-status" element={<RouteGuard path="/system-status"><SystemStatus /></RouteGuard>} />
          <Route path="/platform-operations" element={<RouteGuard path="/platform-operations"><ErrorBoundary fallback={<PageFallback />}><Suspense fallback={<PageFallback />}><PlatformOperations /></Suspense></ErrorBoundary></RouteGuard>} />
          <Route path="/user-assignments" element={<RouteGuard path="/user-assignments"><Delegations /></RouteGuard>} />
          <Route path="/strategic-report" element={<RouteGuard path="/strategic-report"><ErrorBoundary fallback={<PageFallback />}><Suspense fallback={<PageFallback />}><StrategicReport /></Suspense></ErrorBoundary></RouteGuard>} />
          <Route path="/knowledge-base" element={<RouteGuard path="/knowledge-base"><ErrorBoundary fallback={<PageFallback />}><Suspense fallback={<PageFallback />}><KnowledgeBase /></Suspense></ErrorBoundary></RouteGuard>} />
          <Route path="/knowledge-base/:slug" element={<RouteGuard path="/knowledge-base"><ErrorBoundary fallback={<PageFallback />}><Suspense fallback={<PageFallback />}><KnowledgeBase /></Suspense></ErrorBoundary></RouteGuard>} />
          <Route path="/policy-attestation" element={<RouteGuard path="/policy-attestation"><ErrorBoundary fallback={<PageFallback />}><Suspense fallback={<PageFallback />}><PolicyAttestation /></Suspense></ErrorBoundary></RouteGuard>} />
          {/* «Acesso Externo» foi fundido em «Delegações»: a rota antiga redireciona para a entrada única. */}
          <Route path="/external-access" element={<Navigate to="/user-assignments" replace />} />
          {/* Documentação técnica interna (separador «Dev»). */}
          <Route path="/documentacao-tecnica" element={<RouteGuard path="/documentacao-tecnica"><ErrorBoundary fallback={<PageFallback />}><Suspense fallback={<PageFallback />}><TechnicalDocs /></Suspense></ErrorBoundary></RouteGuard>} />
          {/* TEMPORÁRIO — relatório de validação (documento de inspeção; retirar quando as correções forem aplicadas). */}
          <Route path="/validacao-seguranca" element={<RouteGuard path="/validacao-seguranca"><ErrorBoundary fallback={<PageFallback />}><Suspense fallback={<PageFallback />}><ValidationReport /></Suspense></ErrorBoundary></RouteGuard>} />
        </Route>
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <ThemeProvider>
      <LanguageProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <AuthenticatedApp />
          </Router>
          <Toaster />
        </QueryClientProvider>
      </LanguageProvider>
      </ThemeProvider>
    </AuthProvider>
  )
}

export default App