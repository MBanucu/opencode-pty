// Performance monitoring utilities

const PERFORMANCE_MEASURE_LIMIT = 100

export class PerformanceMonitor {
  private static marks: Map<string, number> = new Map()
  private static measures: Array<{ name: string; duration: number; timestamp: number }> = []
  private static readonly MAX_MEASURES = PERFORMANCE_MEASURE_LIMIT

  static startMark(name: string): void {
    PerformanceMonitor.marks.set(name, performance.now())
  }

  static endMark(name: string): number | null {
    const startTime = PerformanceMonitor.marks.get(name)
    if (!startTime) return null

    const duration = performance.now() - startTime
    PerformanceMonitor.measures.push({
      name,
      duration,
      timestamp: Date.now(),
    })

    // Keep only last N measures
    if (PerformanceMonitor.measures.length > PerformanceMonitor.MAX_MEASURES) {
      PerformanceMonitor.measures = PerformanceMonitor.measures.slice(-PerformanceMonitor.MAX_MEASURES)
    }

    PerformanceMonitor.marks.delete(name)
    return duration
  }

  static getMetrics(): {
    measures: Array<{ name: string; duration: number; timestamp: number }>
    memory?: { used: number; total: number; limit: number }
  } {
    const metrics: {
      measures: Array<{ name: string; duration: number; timestamp: number }>
      memory?: { used: number; total: number; limit: number }
    } = { measures: PerformanceMonitor.measures }

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

  static clearMetrics(): void {
    PerformanceMonitor.marks.clear()
    PerformanceMonitor.measures.length = 0
  }
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
