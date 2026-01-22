// Performance monitoring utilities
import pinoLogger from './logger.ts'

const log = pinoLogger.child({ module: 'performance' })

const PERFORMANCE_MEASURE_LIMIT = 100

export class PerformanceMonitor {
  private static marks: Map<string, number> = new Map()
  private static measures: Array<{ name: string; duration: number; timestamp: number }> = []
  private static readonly MAX_MEASURES = PERFORMANCE_MEASURE_LIMIT

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
      timestamp: Date.now(),
    })

    // Keep only last N measures
    if (this.measures.length > this.MAX_MEASURES) {
      this.measures = this.measures.slice(-this.MAX_MEASURES)
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
        limit: mem.jsHeapSizeLimit,
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
          log.debug({ value: lastEntry.startTime }, 'LCP measured')
        }
      })
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] })

      // Track First Input Delay (FID)
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        entries.forEach((entry: any) => {
          log.debug({ value: entry.processingStart - entry.startTime }, 'FID measured')
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
        log.debug({ value: clsValue }, 'CLS measured')
      })
      clsObserver.observe({ entryTypes: ['layout-shift'] })
    } catch (e) {
      log.warn({ error: e }, 'Performance tracking not fully supported')
    }
  }
}
