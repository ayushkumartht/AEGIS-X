import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ScrollManager } from '@/components/site/ScrollManager'
import LandingPage from './pages/LandingPage'

// Docs and the console (Recharts, MapLibre) load only when visited, keeping the landing page light.
const DocumentationPage = lazy(() => import('./pages/DocumentationPage'))
const ConsolePage = lazy(() => import('./pages/ConsolePage'))
const ReplayPage = lazy(() => import('./pages/ReplayPage'))
const AuditPage = lazy(() => import('./pages/AuditPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const CommandCenterPage = lazy(() => import('./pages/CommandCenterPage'))

function App() {
  return (
    <BrowserRouter>
      <ScrollManager />
      <Suspense fallback={<div className="min-h-screen bg-background" />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/docs" element={<DocumentationPage />} />
          <Route path="/demo" element={<ConsolePage initialDistrict="demo" />} />
          <Route path="/console" element={<ConsolePage />} />
          <Route path="/console/:district" element={<ConsolePage />} />
          <Route path="/replay/:eventId" element={<ReplayPage />} />
          <Route path="/audit" element={<AuditPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/command" element={<CommandCenterPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
