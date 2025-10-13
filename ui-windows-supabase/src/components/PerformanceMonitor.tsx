'use client'

import { useState, useEffect } from 'react'
import { PerformanceMetrics, isMonitoringActive, setMonitoringEnabled } from '@/lib/performance-monitor'

interface PerformanceData {
  sessionId: string
  totalTime: number
  metrics: PerformanceMetrics[]
}

export function PerformanceMonitor() {
  const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [isEnabled, setIsEnabled] = useState(false)

  useEffect(() => {
    // Initialize enabled state from localStorage
    setIsEnabled(isMonitoringActive())

    // Custom event listener for performance data
    const handlePerformanceData = (event: CustomEvent) => {
      setPerformanceData(event.detail)
      setIsVisible(true)
    }

    window.addEventListener('performance-data' as any, handlePerformanceData as any)

    return () => {
      window.removeEventListener('performance-data' as any, handlePerformanceData as any)
    }
  }, [])

  const toggleMonitoring = () => {
    const newState = !isEnabled
    setIsEnabled(newState)
    setMonitoringEnabled(newState)
    if (!newState) {
      setIsVisible(false)
      setPerformanceData(null)
    }
  }

  // Always show toggle button
  const toggleButton = (
    <button
      onClick={toggleMonitoring}
      className={`fixed bottom-4 right-4 px-3 py-2 rounded-lg shadow-lg transition-colors z-50 ${
        isEnabled
          ? 'bg-blue-600 text-white hover:bg-blue-700'
          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
      }`}
      title={isEnabled ? 'Disable Performance Monitoring' : 'Enable Performance Monitoring'}
    >
      ⏱️ {isEnabled ? 'ON' : 'OFF'}
    </button>
  )

  if (!isVisible || !performanceData) return toggleButton

  const { metrics, totalTime } = performanceData
  const bottleneck = metrics.reduce((slowest, current) => {
    const slowestDuration = slowest.duration || 0
    const currentDuration = current.duration || 0
    return currentDuration > slowestDuration ? current : slowest
  }, metrics[0])

  return (
    <>
      {toggleButton}
      <div className="fixed bottom-16 right-4 w-96 bg-white border border-gray-300 rounded-lg shadow-xl z-50">
        <div className="bg-gray-800 text-white px-4 py-2 rounded-t-lg flex justify-between items-center">
          <h3 className="font-semibold">⏱️ Performance Monitor</h3>
          <button
            onClick={() => setIsVisible(false)}
            className="text-gray-300 hover:text-white"
          >
            ✕
          </button>
        </div>

      <div className="p-4 max-h-96 overflow-y-auto">
        <div className="mb-3 p-2 bg-blue-50 rounded">
          <div className="text-sm font-semibold text-blue-900">Total Time</div>
          <div className="text-2xl font-bold text-blue-600">{totalTime.toFixed(0)}ms</div>
        </div>

        {bottleneck && (
          <div className="mb-3 p-2 bg-red-50 rounded border border-red-200">
            <div className="text-sm font-semibold text-red-900">🔴 Bottleneck</div>
            <div className="text-lg font-bold text-red-600">{bottleneck.operationName}</div>
            <div className="text-sm text-red-700">{bottleneck.duration?.toFixed(0)}ms ({((bottleneck.duration || 0) / totalTime * 100).toFixed(1)}%)</div>
          </div>
        )}

        <div className="space-y-2">
          {metrics.map((metric, index) => {
            const duration = metric.duration || 0
            const percentage = (duration / totalTime) * 100
            const isBottleneck = metric.operationName === bottleneck?.operationName

            return (
              <div
                key={index}
                className={`p-2 rounded ${isBottleneck ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}
              >
                <div className="flex justify-between items-start mb-1">
                  <div className="text-sm font-medium text-gray-900 flex-1">
                    {metric.operationName}
                  </div>
                  <div className="text-sm font-semibold text-gray-700 ml-2">
                    {duration.toFixed(0)}ms
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${isBottleneck ? 'bg-red-500' : 'bg-blue-500'}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-600 w-12 text-right">
                    {percentage.toFixed(1)}%
                  </div>
                </div>

                {metric.metadata && Object.keys(metric.metadata).length > 0 && (
                  <div className="mt-1 text-xs text-gray-500">
                    {Object.entries(metric.metadata).map(([key, value]) => (
                      <span key={key} className="mr-2">
                        {key}: {JSON.stringify(value)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
      </div>
    </>
  )
}
