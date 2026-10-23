import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { ScrollManager } from '@/components/site/ScrollManager'
import { RouteErrorBoundary } from '@/components/site/RouteErrorBoundary'
import LandingPage from './pages/LandingPage'

// Docs and the console (Recharts, MapLibre) load only when visited, keeping the landing page light.
const DocumentationPage = lazy(() => import('./pages/DocumentationPage'))
const ConsolePage = lazy(() => import('./pages/ConsolePage'))
const ReplayPage = lazy(() => import('./pages/ReplayPage'))
const AuditPage = lazy(() => import('./pages/AuditPage'))
const CommandCenterPage = lazy(() => import('./pages/CommandCenterPage'))

function Pages() {
  const { pathname } = useLocation()
  return (
    <RouteErrorBoundary resetKey={pathname}>
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center bg-background">
            <span className="size-6 animate-spin rounded-full border-2 border-muted border-t-primary" aria-label="Loading" />
          </div>
        }
      >
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/docs" element={<DocumentationPage />} />
          <Route path="/demo" element={<ConsolePage initialDistrict="demo" />} />
          <Route path="/console" element={<ConsolePage />} />
          <Route path="/console/:district" element={<ConsolePage />} />
          <Route path="/replay/:eventId" element={<ReplayPage />} />
          <Route path="/audit" element={<AuditPage />} />
          <Route path="/command" element={<CommandCenterPage />} />
        </Routes>
      </Suspense>
    </RouteErrorBoundary>
  )
}

function App() {
  return (
    <BrowserRouter>
      <ScrollManager />
      <Pages />
    </BrowserRouter>
  )
}

export default App
