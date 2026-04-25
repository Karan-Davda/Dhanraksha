import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import { RequireAuth } from './auth/RequireAuth'
import { AppLayout } from './components/layout/AppLayout'
import { FullPageLoader } from './components/common/FullPageLoader'
import { LoginPage } from './pages/LoginPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { SettingsPage } from './pages/SettingsPage'
import { SetupRequiredPage } from './pages/SetupRequiredPage'
import { SignupPage } from './pages/SignupPage'
import { useNhost } from './nhost/useNhost'

const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const SavingsPage = lazy(() => import('./pages/SavingsPage').then((m) => ({ default: m.SavingsPage })))
const CategoriesPage = lazy(() => import('./features/categories/CategoriesPage').then((m) => ({ default: m.CategoriesPage })))
const BudgetsPage = lazy(() => import('./features/budgets/BudgetsPage').then((m) => ({ default: m.BudgetsPage })))
const NotificationsPage = lazy(() => import('./pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage })))
const CalendarPage = lazy(() => import('./pages/CalendarPage').then((m) => ({ default: m.CalendarPage })))
const SearchPage = lazy(() => import('./pages/SearchPage').then((m) => ({ default: m.SearchPage })))
const LedgerPage = lazy(() => import('./pages/LedgerPage').then((m) => ({ default: m.LedgerPage })))

export default function App() {
  const { isConfigured } = useNhost()

  if (!isConfigured) {
    return <SetupRequiredPage />
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      <Route path="/auth/login" element={<LoginPage />} />
      <Route path="/auth/signup" element={<SignupPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route
            path="/dashboard"
            element={
              <Suspense fallback={<FullPageLoader />}>
                <DashboardPage />
              </Suspense>
            }
          />
          <Route
            path="/ledger"
            element={
              <Suspense fallback={<FullPageLoader />}>
                <LedgerPage />
              </Suspense>
            }
          />
          <Route path="/expenses" element={<Navigate to="/ledger" replace />} />
          <Route path="/income" element={<Navigate to="/ledger" replace />} />
          <Route
            path="/savings"
            element={
              <Suspense fallback={<FullPageLoader />}>
                <SavingsPage />
              </Suspense>
            }
          />
          <Route
            path="/categories"
            element={
              <Suspense fallback={<FullPageLoader />}>
                <CategoriesPage />
              </Suspense>
            }
          />
          <Route
            path="/budgets"
            element={
              <Suspense fallback={<FullPageLoader />}>
                <BudgetsPage />
              </Suspense>
            }
          />
          <Route
            path="/notifications"
            element={
              <Suspense fallback={<FullPageLoader />}>
                <NotificationsPage />
              </Suspense>
            }
          />
          <Route
            path="/calendar"
            element={
              <Suspense fallback={<FullPageLoader />}>
                <CalendarPage />
              </Suspense>
            }
          />
          <Route
            path="/search"
            element={
              <Suspense fallback={<FullPageLoader />}>
                <SearchPage />
              </Suspense>
            }
          />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
