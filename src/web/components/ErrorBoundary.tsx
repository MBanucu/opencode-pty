import React from 'react'

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
  errorInfo?: React.ErrorInfo
}

interface ErrorBoundaryProps {
  children: React.ReactNode
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    console.error('[Browser] React Error Boundary caught error:', error)
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[Browser] React Error Boundary details:')
    console.error('[Browser] Error:', error)
    console.error('[Browser] Error Info:', errorInfo)
    console.error('[Browser] Component Stack:', errorInfo.componentStack)

    this.setState({
      error,
      errorInfo,
    })
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: '20px',
            margin: '20px',
            border: '1px solid #ff6b6b',
            borderRadius: '8px',
            backgroundColor: '#ffebee',
          }}
        >
          <h2 style={{ color: '#d32f2f', marginTop: 0 }}>Something went wrong</h2>
          <p>A React error occurred. Check the browser console for details.</p>
          <details style={{ marginTop: '10px' }}>
            <summary>Error Details (for debugging)</summary>
            <pre
              style={{
                backgroundColor: '#f5f5f5',
                padding: '10px',
                borderRadius: '4px',
                overflow: 'auto',
                fontSize: '12px',
                marginTop: '10px',
              }}
            >
              {this.state.error && this.state.error.toString()}
              {this.state.errorInfo?.componentStack}
            </pre>
          </details>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '10px',
              padding: '8px 16px',
              backgroundColor: '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Reload Page
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
