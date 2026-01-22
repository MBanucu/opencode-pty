import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './components/App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { trackWebVitals, PerformanceMonitor } from './performance.ts'
import { createLogger } from './logger.ts'
import './index.css'

const log = createLogger('web-ui')

if (import.meta.env.DEV) {
  log.debug('Starting React application')
}

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
