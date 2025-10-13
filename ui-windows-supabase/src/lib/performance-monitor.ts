/**
 * Performance monitoring utility for tracking LLM chat procedure timings
 */

export interface PerformanceMetrics {
  operationName: string
  startTime: number
  endTime?: number
  duration?: number
  metadata?: Record<string, any>
}

export class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetrics> = new Map()
  private sessionId: string
  private startTime: number

  constructor(sessionId?: string) {
    this.sessionId = sessionId || `session-${Date.now()}`
    this.startTime = performance.now()
  }

  /**
   * Start tracking an operation
   */
  start(operationName: string, metadata?: Record<string, any>): void {
    const metric: PerformanceMetrics = {
      operationName,
      startTime: performance.now(),
      metadata
    }
    this.metrics.set(operationName, metric)
    console.log(`⏱️ [${this.sessionId}] START: ${operationName}`, metadata || '')
  }

  /**
   * End tracking an operation
   */
  end(operationName: string, metadata?: Record<string, any>): number {
    const metric = this.metrics.get(operationName)
    if (!metric) {
      console.warn(`⚠️ Operation "${operationName}" was not started`)
      return 0
    }

    const endTime = performance.now()
    const duration = endTime - metric.startTime

    metric.endTime = endTime
    metric.duration = duration
    if (metadata) {
      metric.metadata = { ...metric.metadata, ...metadata }
    }

    console.log(`⏱️ [${this.sessionId}] END: ${operationName} - ${duration.toFixed(2)}ms`, metadata || '')
    return duration
  }

  /**
   * Get all metrics
   */
  getMetrics(): PerformanceMetrics[] {
    return Array.from(this.metrics.values())
  }

  /**
   * Get a summary report
   */
  getSummary(): string {
    const metrics = this.getMetrics()
    const totalTime = performance.now() - this.startTime

    let report = `\n${'='.repeat(80)}\n`
    report += `📊 Performance Report - Session: ${this.sessionId}\n`
    report += `${'='.repeat(80)}\n\n`

    // Sort by start time
    const sortedMetrics = metrics.sort((a, b) => a.startTime - b.startTime)

    sortedMetrics.forEach(metric => {
      const duration = metric.duration || 0
      const percentage = ((duration / totalTime) * 100).toFixed(1)

      report += `📍 ${metric.operationName}\n`
      report += `   Duration: ${duration.toFixed(2)}ms (${percentage}% of total)\n`

      if (metric.metadata && Object.keys(metric.metadata).length > 0) {
        report += `   Metadata: ${JSON.stringify(metric.metadata)}\n`
      }
      report += '\n'
    })

    report += `${'='.repeat(80)}\n`
    report += `⏱️  TOTAL TIME: ${totalTime.toFixed(2)}ms\n`
    report += `${'='.repeat(80)}\n`

    return report
  }

  /**
   * Print summary to console
   */
  printSummary(): void {
    console.log(this.getSummary())
  }

  /**
   * Get metrics as JSON for storage or API
   */
  toJSON(): {
    sessionId: string
    totalTime: number
    metrics: PerformanceMetrics[]
  } {
    return {
      sessionId: this.sessionId,
      totalTime: performance.now() - this.startTime,
      metrics: this.getMetrics()
    }
  }

  /**
   * Get bottleneck (slowest operation)
   */
  getBottleneck(): PerformanceMetrics | null {
    const metrics = this.getMetrics()
    if (metrics.length === 0) return null

    return metrics.reduce((slowest, current) => {
      const slowestDuration = slowest.duration || 0
      const currentDuration = current.duration || 0
      return currentDuration > slowestDuration ? current : slowest
    })
  }
}

/**
 * Global performance monitor instance for the current message
 */
let currentMonitor: PerformanceMonitor | null = null
let isMonitoringEnabled = false

export const setMonitoringEnabled = (enabled: boolean): void => {
  isMonitoringEnabled = enabled
  if (typeof window !== 'undefined') {
    localStorage.setItem('performance-monitoring-enabled', String(enabled))
  }
}

export const isMonitoringActive = (): boolean => {
  if (typeof window !== 'undefined' && isMonitoringEnabled === false) {
    const stored = localStorage.getItem('performance-monitoring-enabled')
    isMonitoringEnabled = stored === 'true'
  }
  return isMonitoringEnabled
}

export const startMessageMonitoring = (messageId?: string): PerformanceMonitor => {
  currentMonitor = new PerformanceMonitor(messageId)
  return currentMonitor
}

export const getCurrentMonitor = (): PerformanceMonitor | null => {
  return currentMonitor
}

export const endMessageMonitoring = (): void => {
  if (currentMonitor) {
    currentMonitor.printSummary()

    const bottleneck = currentMonitor.getBottleneck()
    if (bottleneck) {
      console.log(`🔴 BOTTLENECK: ${bottleneck.operationName} (${bottleneck.duration?.toFixed(2)}ms)`)
    }

    // Dispatch performance data to UI only if monitoring is enabled
    if (typeof window !== 'undefined' && isMonitoringActive()) {
      const performanceData = currentMonitor.toJSON()
      window.dispatchEvent(new CustomEvent('performance-data', { detail: performanceData }))
    }

    currentMonitor = null
  }
}
