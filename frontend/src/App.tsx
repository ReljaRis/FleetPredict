import { Navigate, Route, Routes } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { AuthProvider, useAuth } from './lib/auth'
import { ToastProvider } from './components/ui'
import { AppShell } from './components/AppShell'
import { LayoutFade, PageTransition } from './components/PageTransition'
import { SiteHeader } from './components/SiteHeader'
import Landing from './pages/Landing'
import AuthPage from './pages/AuthPage'
import DashboardPage from './pages/app/DashboardPage'
import FleetPage from './pages/app/FleetPage'
import VehiclePage from './pages/app/VehiclePage'
import MaintenancePage from './pages/app/MaintenancePage'
import DocumentsPage from './pages/app/DocumentsPage'
import RoutesPage from './pages/app/RoutesPage'
import PredictionsPage from './pages/app/PredictionsPage'
import SettingsPage from './pages/app/SettingsPage'
import NotReady from './pages/NotReady'

/** Public pages share one navigation bar, so only the page under it changes when moving between them. */
function PublicLayout() {
  return (
    <LayoutFade className="flex min-h-screen flex-col bg-night text-white">
      <SiteHeader />
      <div className="flex-1">
        <PageTransition />
      </div>
    </LayoutFade>
  )
}

/** The signed-in app keeps its side menu in place and only swaps the page content. */
function ProtectedLayout() {
  const { session, loading } = useAuth()
  if (loading)
    return (
      <div className="grid min-h-screen place-items-center bg-canvas" aria-busy="true" aria-label="Loading">
        <Loader2 className="size-6 animate-spin text-ink-3" />
      </div>
    )
  if (!session) return <Navigate to="/login" replace />
  return (
    <LayoutFade>
      <AppShell>
        <PageTransition scroller={() => document.getElementById('app-main')} />
      </AppShell>
    </LayoutFade>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/register" element={<AuthPage mode="register" />} />
          </Route>
          <Route path="/app" element={<ProtectedLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="fleet" element={<FleetPage />} />
            <Route path="fleet/:id" element={<VehiclePage />} />
            <Route path="maintenance" element={<MaintenancePage />} />
            <Route path="documents" element={<DocumentsPage />} />
            <Route path="routes" element={<RoutesPage />} />
            <Route path="predictions" element={<PredictionsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<NotReady title="Page not found" />} />
        </Routes>
      </ToastProvider>
    </AuthProvider>
  )
}
