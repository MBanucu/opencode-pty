import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './components/App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { trackWebVitals, PerformanceMonitor } from './performance.ts'

// Initialize performance monitoring
trackWebVitals()
PerformanceMonitor.startMark('app-init')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
