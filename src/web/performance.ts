// Performance monitoring utilities
export class PerformanceMonitor {
  private static marks: Map<string, number> = new Map()
  private static measures: Array<{ name: string; duration: number; timestamp: number }> = []

  static startMark(name: string): void {
    this.marks.set(name, performance.now())
  }

  static endMark(name: string): number | null {
    const startTime = this.marks.get(name)
    if (!startTime) return null

    const duration = performance.now() - startTime
    this.measures.push({
      name,
      duration,
      timestamp: Date.now()
    })

    // Keep only last 100 measures
    if (this.measures.length > 100) {
      this.measures = this.measures.slice(-100)
    }

    this.marks.delete(name)
    return duration
  }

  static getMetrics(): {
    measures: Array<{ name: string; duration: number; timestamp: number }>
    memory?: { used: number; total: number; limit: number }
  } {
    const metrics: {
      measures: Array<{ name: string; duration: number; timestamp: number }>
      memory?: { used: number; total: number; limit: number }
    } = { measures: this.measures }

    // Add memory info if available
    if ('memory' in performance) {
      const mem = (performance as any).memory
      metrics.memory = {
        used: mem.usedJSHeapSize,
        total: mem.totalJSHeapSize,
        limit: mem.jsHeapSizeLimit
      }
    }

    return metrics
  }

  static clearMetrics(): void {
    this.marks.clear()
    this.measures.length = 0
  }
}

// Web Vitals tracking
export function trackWebVitals(): void {
  // Track Largest Contentful Paint (LCP)
  if ('PerformanceObserver' in window) {
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        const lastEntry = entries[entries.length - 1] as any
        if (lastEntry) {
          console.log('LCP:', lastEntry.startTime)
        }
      })
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] })

      // Track First Input Delay (FID)
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        entries.forEach((entry: any) => {
          console.log('FID:', entry.processingStart - entry.startTime)
        })
      })
      fidObserver.observe({ entryTypes: ['first-input'] })

      // Track Cumulative Layout Shift (CLS)
      let clsValue = 0
      const clsObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        entries.forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value
          }
        })
        console.log('CLS:', clsValue)
      })
      clsObserver.observe({ entryTypes: ['layout-shift'] })
    } catch (e) {
      console.warn('Performance tracking not fully supported')
    }
  }
}