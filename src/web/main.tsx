import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './components/App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import './index.css'

if (import.meta.env.DEV) {
  console.log('[Browser] Starting React application...')
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
