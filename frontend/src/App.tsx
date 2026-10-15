import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ScrollManager } from '@/components/site/ScrollManager'
import LandingPage from './pages/LandingPage'

// Docs and the demo (Recharts, canvas) load only when visited, keeping the landing page light.
const DocumentationPage = lazy(() => import('./pages/DocumentationPage'))
const DemoPage = lazy(() => import('./pages/DemoPage'))

function App() {
  return (
    <BrowserRouter>
      <ScrollManager />
      <Suspense fallback={<div className="min-h-screen bg-background" />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/docs" element={<DocumentationPage />} />
          <Route path="/demo" element={<DemoPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
