// Performance monitoring utilities

const PERFORMANCE_MEASURE_LIMIT = 100

const marks: Map<string, number> = new Map()
const measures: Array<{ name: string; duration: number; timestamp: number }> = []

export function startMark(name: string): void {
  marks.set(name, performance.now())
}

export function endMark(name: string): number | null {
  const startTime = marks.get(name)
  if (!startTime) return null

  const duration = performance.now() - startTime
  measures.push({
    name,
    duration,
    timestamp: Date.now(),
  })

  // Keep only last N measures
  if (measures.length > PERFORMANCE_MEASURE_LIMIT) {
    measures.splice(0, measures.length - PERFORMANCE_MEASURE_LIMIT)
  }

  marks.delete(name)
  return duration
}

export function getMetrics(): {
  measures: Array<{ name: string; duration: number; timestamp: number }>
  memory?: { used: number; total: number; limit: number }
} {
  const metrics: {
    measures: Array<{ name: string; duration: number; timestamp: number }>
    memory?: { used: number; total: number; limit: number }
  } = { measures }

  // Add memory info if available (Chrome-specific extension)
  if ('memory' in performance) {
    const mem = (
      performance as {
        memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number }
      }
    ).memory
    if (mem) {
      metrics.memory = {
        used: mem.usedJSHeapSize,
        total: mem.totalJSHeapSize,
        limit: mem.jsHeapSizeLimit,
      }
    }
  }

  return metrics
}

export function clearMetrics(): void {
  marks.clear()
  measures.length = 0
}

// Web Vitals tracking
export function trackWebVitals(): void {
  // Track Largest Contentful Paint (LCP)
  if ('PerformanceObserver' in window) {
    try {
      const lcpObserver = new PerformanceObserver((_list) => {})
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] })

      // Track First Input Delay (FID)
      const fidObserver = new PerformanceObserver(() => {})
      fidObserver.observe({ entryTypes: ['first-input'] })

      // Track Cumulative Layout Shift (CLS)
      const clsObserver = new PerformanceObserver(() => {})
      clsObserver.observe({ entryTypes: ['layout-shift'] })
      // eslint-disable-next-line no-empty
    } catch {}
  }
}
