import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { RequireAuth } from './auth/RequireAuth'
import { AppShell } from './shell/AppShell'
import { LoginPage } from './routes/LoginPage'
import { MobileAuthPage } from './routes/MobileAuthPage'
import { RegisterPage } from './routes/RegisterPage'
import { ForgotPasswordPage } from './routes/ForgotPasswordPage'
import { ResetPasswordPage } from './routes/ResetPasswordPage'
import { VerifyEmailPage } from './routes/VerifyEmailPage'
const DashboardPage = lazy(() => import('./dashboard/DashboardPage').then((module) => ({ default: module.DashboardPage })))
const AccountsPage = lazy(() => import('./accounts/AccountsPage').then((module) => ({ default: module.AccountsPage })))
const CategoriesPage = lazy(() => import('./categories/CategoriesPage').then((module) => ({ default: module.CategoriesPage })))
const TransactionsPage = lazy(() => import('./transactions/TransactionsPage').then((module) => ({ default: module.TransactionsPage })))
const BudgetsPage = lazy(() => import('./budgets/BudgetsPage').then((module) => ({ default: module.BudgetsPage })))
const DebtsPage = lazy(() => import('./debts/DebtsPage').then((module) => ({ default: module.DebtsPage })))
const GoalsPage = lazy(() => import('./goals/GoalsPage').then((module) => ({ default: module.GoalsPage })))
const TrackersPage = lazy(() => import('./trackers/TrackersPage').then((module) => ({ default: module.TrackersPage })))
const RecurringPage = lazy(() => import('./recurring/RecurringPage').then((module) => ({ default: module.RecurringPage })))
const ReportsPage = lazy(() => import('./reports/ReportsPage').then((module) => ({ default: module.ReportsPage })))
const ImportWizardPage = lazy(() => import('./import/ImportWizardPage').then((module) => ({ default: module.ImportWizardPage })))
const DocumentsPage = lazy(() => import('./documents/DocumentsPage').then((module) => ({ default: module.DocumentsPage })))
const InvestmentsPage = lazy(() => import('./investments/InvestmentsPage').then((module) => ({ default: module.InvestmentsPage })))
const MarketNewsPage = lazy(() => import('./investments/MarketNewsPage').then((module) => ({ default: module.MarketNewsPage })))
const CompanyResearchPage = lazy(() => import('./investments/CompanyResearchPage').then((module) => ({ default: module.CompanyResearchPage })))
const ComparisonPage = lazy(() => import('./investments/ComparisonPage').then((module) => ({ default: module.ComparisonPage })))
const TechnicalPage = lazy(() => import('./investments/TechnicalPage').then((module) => ({ default: module.TechnicalPage })))
const BacktestPage = lazy(() => import('./investments/BacktestPage').then((module) => ({ default: module.BacktestPage })))
const ScenarioLibraryPage = lazy(() => import('./investments/ScenarioLibraryPage').then((module) => ({ default: module.ScenarioLibraryPage })))
const ScenarioDetailPage = lazy(() => import('./investments/ScenarioDetailPage').then((module) => ({ default: module.ScenarioDetailPage })))
const HoldingHistoryPage = lazy(() => import('./investments/HoldingHistoryPage').then((module) => ({ default: module.HoldingHistoryPage })))
const AdvisorPage = lazy(() => import('./advisor/AdvisorPage').then((module) => ({ default: module.AdvisorPage })))
const NotificationsPage = lazy(() => import('./notifications/NotificationsPage').then((module) => ({ default: module.NotificationsPage })))
const ApiKeysPage = lazy(() => import('./account-settings/ApiKeysPage').then((module) => ({ default: module.ApiKeysPage })))
const InvestorProfilePage = lazy(() => import('./account-settings/InvestorProfilePage').then((module) => ({ default: module.InvestorProfilePage })))
const BankSyncPage = lazy(() => import('./bank-sync/BankSyncPage').then((module) => ({ default: module.BankSyncPage })))
const RulesPage = lazy(() => import('./rules/RulesPage').then((module) => ({ default: module.RulesPage })))
import { PrivacyPage } from './legal/PrivacyPage'
import { TermsPage } from './legal/TermsPage'
const AdminPage = lazy(() => import('./admin/AdminPage').then((module) => ({ default: module.AdminPage })))

/**
 * Ticker Search was merged into Company Research (the search box now lives at
 * the top of `/investments/research`). Old bookmarks/links land here and get
 * sent on, keeping whatever query string (symbol, q, provider) they carried.
 */
function LegacyTickerSearchRedirect() {
  const location = useLocation()
  return <Navigate to={{ pathname: '/investments/research', search: location.search }} replace />
}

function App() {
  return (
    <Suspense fallback={<div role="status" aria-label="Loading page" />}>
      <Routes>
      {/* The PWA manifest's start_url and the deployed root are both "/".
          RequireAuth on /dashboard sends unauthenticated visitors to /login,
          so this lands both cases correctly. */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      <Route path="/login" element={<LoginPage />} />
      <Route path="/mobile-auth" element={<MobileAuthPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />

      {/* Public by necessity: Enable Banking, the banks' consent screens and the
          data-sharing-consents portal link here for people with no account on
          this instance. Behind RequireAuth these would be dead links. */}
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/accounts" element={<AccountsPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/budgets" element={<BudgetsPage />} />
          <Route path="/debts" element={<DebtsPage />} />
          <Route path="/goals" element={<GoalsPage />} />
          <Route path="/recurring" element={<RecurringPage />} />
          <Route path="/trackers" element={<TrackersPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/import" element={<ImportWizardPage />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/investments" element={<InvestmentsPage />} />
          <Route path="/investments/news" element={<MarketNewsPage />} />
          <Route path="/investments/search" element={<LegacyTickerSearchRedirect />} />
          <Route path="/investments/research" element={<CompanyResearchPage />} />
          <Route path="/investments/compare" element={<ComparisonPage />} />
          <Route path="/investments/technical" element={<TechnicalPage />} />
          <Route path="/investments/backtest" element={<BacktestPage />} />
          <Route path="/investments/scenarios" element={<ScenarioLibraryPage />} />
          <Route path="/investments/scenarios/:id" element={<ScenarioDetailPage />} />
          {/* A real holding's own journey page — the counterpart to a
              scenario's. Account plus ticker, because the same symbol can be
              held at two brokers with different cost bases. */}
          <Route
            path="/investments/holdings/:accountId/:symbol"
            element={<HoldingHistoryPage />}
          />
          <Route path="/advisor" element={<AdvisorPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/connections" element={<BankSyncPage />} />
          <Route path="/rules" element={<RulesPage />} />
          <Route path="/api-keys" element={<ApiKeysPage />} />
          <Route path="/investor-profile" element={<InvestorProfilePage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  )
}

export default App
