import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { LanguageProvider } from '@/lib/LanguageContext';
import { ThemeProvider } from '@/lib/ThemeContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Landing from '@/pages/Landing';
import Register from '@/pages/Register';
import AppLayout from '@/components/layout/AppLayout';
import Dashboard from '@/pages/Dashboard';
import Customers from '@/pages/Customers';
import Assessments from '@/pages/Assessments';
import AssessmentDetail from '@/pages/AssessmentDetail';
import Recommendations from '@/pages/Recommendations';
import Reports from '@/pages/Reports';
import Admin from '@/pages/Admin';
import AuditLog from '@/pages/AuditLog';
import Settings from '@/pages/Settings';
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

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin, isAuthenticated } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      return <Landing />;
    }
  }

  // Not authenticated - show landing or register page
  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="*" element={<Landing />} />
      </Routes>
    );
  }

  // Render the main app
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<RouteGuard path="/"><Dashboard /></RouteGuard>} />
        <Route path="/customers" element={<RouteGuard path="/customers"><Customers /></RouteGuard>} />
        <Route path="/assessments" element={<RouteGuard path="/assessments"><Assessments /></RouteGuard>} />
        <Route path="/assessments/:id" element={<RouteGuard path="/assessments"><AssessmentDetail /></RouteGuard>} />
        <Route path="/recommendations" element={<RouteGuard path="/recommendations"><Recommendations /></RouteGuard>} />
        <Route path="/reports" element={<RouteGuard path="/reports"><Reports /></RouteGuard>} />
        <Route path="/admin" element={<RouteGuard path="/admin"><Admin /></RouteGuard>} />
        <Route path="/audit-log" element={<RouteGuard path="/audit-log"><AuditLog /></RouteGuard>} />
        <Route path="/settings" element={<RouteGuard path="/settings"><Settings /></RouteGuard>} />
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